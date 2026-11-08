//! Fairpay's built-in agent, on Cairn (github.com/whatstask/Cairn).
//!
//! It hires and pays through Fairpay's MCP server, the way Fairpay lets an
//! agent touch money: a human funds every escrow in PayPal; the server never
//! lets an agent release more than the AI referee recommended; and
//! `release_payment` is destructive, so Cairn pauses the run for a person's
//! approval before every payment. Spend is capped by a Cairn budget and every
//! step is journaled, so a paused run resumes later — even in another process.
//!
//! Terminal:
//!   fairpay-agent hire  "A logo for my bakery, two milestones, $300, pay lina@example.com"
//!   fairpay-agent settle <contract_id>
//!
//! For the Fairpay app (one JSON object on stdout):
//!   fairpay-agent json hire   "<brief>"
//!   fairpay-agent json settle <contract_id>
//!   fairpay-agent json decide <run_id> <call_id> yes|no
//!
//! Env: ANTHROPIC_API_KEY (or CAIRN_MODEL=<Cairn model spec>), FAIRPAY_MCP_URL
//! (default http://localhost:3200/api/mcp), FAIRPAY_AGENT_KEY, CAIRN_RUNS_DIR.

use std::io::{self, Write};
use std::sync::Arc;

use cairn::mcp::{McpClient, ToolOptions};
use cairn::prelude::*;
use serde_json::{json, Value};

const SYSTEM: &str = "You are Fairpay's procurement agent. You hire people for your principal \
through Fairpay, a pay-on-proof escrow on PayPal. \
HIRING: split the work into 1-4 milestones, each with 2-5 short, checkable acceptance criteria and a USD amount that \
adds up to the budget; then call create_escrow once. The CLIENT funds it by opening the fund_url in PayPal; the freelancer is only paid later, on proof. Never invent an email: use the one given, or stop and say it is missing. \
SETTLING: call get_escrow first. For each milestone with status submitted, read the referee verdict: \
if it recommends release or partial, call release_payment with no amount (that pays the referee's recommendation); \
if it recommends request_changes, call request_changes with its message. Never pay an unsubmitted milestone. \
Finish with at most three short sentences. If you created or settled a contract, put its id on the last line as CONTRACT: <id>.";

async fn agent() -> Result<Agent, Box<dyn std::error::Error>> {
    let url = std::env::var("FAIRPAY_MCP_URL").unwrap_or_else(|_| "http://localhost:3200/api/mcp".into());
    let headers: Vec<(String, String)> = std::env::var("FAIRPAY_AGENT_KEY")
        .map(|k| vec![("authorization".to_string(), format!("Bearer {k}"))])
        .unwrap_or_default();
    let fairpay = McpClient::connect_http(&url, headers).await?;
    // Effects come from Fairpay's MCP annotations: get_escrow reads,
    // release_payment is destructive and therefore waits for approval.
    let tools = fairpay.tools(ToolOptions::default()).await?;
    // Free first: K2 Horizon (IFM) at $0, then Claude only if K2 fails or
    // gives an unusable answer. Priced so the budget is enforceable.
    let claude_spec = std::env::var("CAIRN_MODEL").unwrap_or_else(|_| "anthropic:claude-opus-5-5".into());
    let has_k2 = std::env::var("K2_API_KEY").map(|k| !k.is_empty()).unwrap_or(false);
    let has_claude = std::env::var("ANTHROPIC_API_KEY").map(|k| !k.is_empty()).unwrap_or(false) || std::env::var("CAIRN_MODEL").is_ok();
    let mut chain: Vec<Arc<dyn Model>> = Vec::new();
    if has_k2 {
        if std::env::var("K2_BASE_URL").is_err() { std::env::set_var("K2_BASE_URL", "https://api.ifm.ai/v1"); }
        let k2 = std::env::var("K2_MODEL").unwrap_or_else(|_| "IFM/K2-Horizon-375B-A23B".into());
        chain.push(Arc::new(Priced::new(cairn::models::from_spec(&format!("compat:k2:{k2}"))?, Pricing::new(0.0, 0.0))));
    }
    if has_claude || chain.is_empty() {
        chain.push(Arc::new(Priced::new(cairn::models::from_spec(&claude_spec)?, Pricing::new(4.0, 20.0))));
    }
    let model: Arc<dyn Model> = if chain.len() == 1 { chain.remove(0) } else { Arc::new(FallbackModel::new(chain)) };
    let runs = std::env::var("CAIRN_RUNS_DIR").unwrap_or_else(|_| "runs".into());
    Ok(Agent::builder("fairpay-agent")
        .model(model)
        .system(SYSTEM)
        .tools(tools)
        .budget(Budget::default().max_steps(16).max_usd(0.50))
        .journal(JsonlJournal::new(&runs)?)
        .build()?)
}

fn task(mode: &str, arg: &str) -> String {
    match mode {
        "hire" => format!("Hire for this: {arg}"),
        _ => format!("Settle Fairpay contract {arg}: pay what the referee supports, nothing more."),
    }
}

fn report(o: &RunOutcome) -> Value {
    let (status, text) = match &o.status {
        Status::Completed { output } => ("completed", output.clone()),
        Status::AwaitingApproval => ("awaiting_approval", String::new()),
        Status::Failed { error } => ("failed", error.clone()),
        Status::BudgetExceeded { reason } => ("budget_exceeded", reason.clone()),
        Status::Canceled { reason } => ("canceled", reason.clone()),
        Status::Running => ("running", String::new()),
    };
    json!({
        "run_id": o.run_id, "status": status, "output": text,
        "awaiting": o.awaiting_approval.iter().map(|c| json!({ "id": c.id, "name": c.name, "input": c.input })).collect::<Vec<_>>(),
        "steps": o.steps, "cost_usd": o.cost_usd,
    })
}

#[tokio::main]
async fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let json_mode = args.first().map(String::as_str) == Some("json");
    let rest: Vec<String> = if json_mode { args[1..].to_vec() } else { args.clone() };
    let result = if json_mode { run_json(&rest).await } else { run_terminal(&rest).await };
    if let Err(e) = result {
        if json_mode {
            println!("{}", json!({ "status": "error", "output": e.to_string(), "awaiting": [] }));
        } else {
            eprintln!("error: {e}");
        }
        std::process::exit(1);
    }
}

async fn run_json(a: &[String]) -> Result<(), Box<dyn std::error::Error>> {
    let agent = agent().await?;
    let outcome = match a.first().map(String::as_str) {
        Some(mode @ ("hire" | "settle")) if a.len() > 1 => agent.run(&task(mode, &a[1..].join(" "))).await?,
        Some("decide") if a.len() == 4 => {
            agent.decide(&a[1], &a[2], a[3] == "yes", Some("fairpay-app"), None).await?;
            agent.resume(&a[1]).await?
        }
        _ => return Err("usage: json hire <brief> | json settle <id> | json decide <run> <call> yes|no".into()),
    };
    println!("{}", report(&outcome));
    Ok(())
}

async fn run_terminal(a: &[String]) -> Result<(), Box<dyn std::error::Error>> {
    let (mode, arg) = match a.first().map(String::as_str) {
        Some(m @ ("hire" | "settle")) if a.len() > 1 => (m, a[1..].join(" ")),
        _ => {
            eprintln!("usage:\n  fairpay-agent hire \"<what you need, budget, freelancer email>\"\n  fairpay-agent settle <contract_id>");
            std::process::exit(2);
        }
    };
    let agent = agent().await?;
    let mut outcome = agent.run(&task(mode, &arg)).await?;
    while outcome.status == Status::AwaitingApproval {
        for call in &outcome.awaiting_approval {
            println!("\n⏸  The agent wants to {}:\n   {}", call.name, call.input);
            print!("   Approve? [y/N] ");
            io::stdout().flush()?;
            let mut answer = String::new();
            io::stdin().read_line(&mut answer)?;
            let yes = answer.trim().eq_ignore_ascii_case("y");
            agent.decide(&outcome.run_id, &call.id, yes, Some("terminal"), None).await?;
            println!("   {}", if yes { "✅ approved" } else { "❌ denied" });
        }
        outcome = agent.resume(&outcome.run_id).await?;
    }
    let r = report(&outcome);
    println!("\n{}\n\nstatus: {} · steps: {} · cost ${:.4} · journal: runs/{}.jsonl",
             r["output"].as_str().unwrap_or(""), r["status"].as_str().unwrap_or(""), outcome.steps, outcome.cost_usd, outcome.run_id);
    Ok(())
}
