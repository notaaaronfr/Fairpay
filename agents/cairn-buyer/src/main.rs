//! A governed AI buyer for Fairpay, built on Cairn (github.com/whatstask/Cairn).
//!
//! The agent can hire a freelancer and pay them — but only the way Fairpay
//! allows an agent to spend money:
//!
//!   * it opens an escrow, and a HUMAN funds it in PayPal (the agent gets a link,
//!     never the power to approve);
//!   * it can release at most what the AI referee recommended (enforced by the
//!     Fairpay server);
//!   * `release_payment` is marked destructive, so Cairn pauses for a person's
//!     approval before every payment — asked here in the terminal;
//!   * its own model spend is capped by a Cairn budget, and every step is
//!     written to a journal in ./runs you can replay.
//!
//!   cargo run -- hire  "A logo for my bakery, two milestones, $300 total, freelancer lina@example.com"
//!   cargo run -- settle <contract_id>
//!
//! Needs ANTHROPIC_API_KEY (or CAIRN_MODEL=<any Cairn model spec>) and a running Fairpay
//! (FAIRPAY_MCP_URL, default http://localhost:3200/api/mcp).

use std::io::{self, Write};
use std::sync::Arc;

use cairn::mcp::{McpClient, ToolOptions};
use cairn::prelude::*;

const SYSTEM: &str = "You are a careful procurement agent. You hire people for your principal \
through Fairpay, a pay-on-proof escrow on PayPal. Rules: \
(1) When hiring, split the work into 1-4 milestones, each with checkable acceptance criteria and a USD amount, \
then call create_escrow. Report the fund_url: a human must open it to fund the escrow. Never claim money is held until get_escrow says status is funded. \
(2) When settling, call get_escrow first. For each submitted milestone, read the referee's verdict. \
Release only what the referee recommends (release_payment with no amount uses its recommendation). \
If the referee recommends request_changes, call request_changes with its message instead of paying. \
(3) Never pay for a milestone that has not been submitted. \
Finish with a short report: what was paid, to whom, what is still held, and what you are waiting for.";

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let task = match args.first().map(String::as_str) {
        Some("hire") if args.len() > 1 => format!("Hire for this, then tell me the funding link: {}", args[1..].join(" ")),
        Some("settle") if args.len() > 1 => format!(
            "Settle Fairpay contract {}: check every milestone and pay what the referee supports, nothing more.",
            args[1]
        ),
        _ => {
            eprintln!("usage:\n  fairpay-cairn-buyer hire \"<what you need, budget, freelancer email>\"\n  fairpay-cairn-buyer settle <contract_id>");
            std::process::exit(2);
        }
    };

    let url = std::env::var("FAIRPAY_MCP_URL").unwrap_or_else(|_| "http://localhost:3200/api/mcp".into());
    let headers: Vec<(String, String)> = std::env::var("FAIRPAY_AGENT_KEY")
        .map(|k| vec![("authorization".to_string(), format!("Bearer {k}"))])
        .unwrap_or_default();
    let fairpay = McpClient::connect_http(&url, headers).await?;
    // Effects come from Fairpay's MCP annotations: get_escrow is a read,
    // release_payment is destructive and therefore needs approval.
    let tools = fairpay.tools(ToolOptions::default()).await?;
    println!("connected to {} ({} tools) at {url}", fairpay.server_name(), tools.len());

    let spec = std::env::var("CAIRN_MODEL").unwrap_or_else(|_| "anthropic:claude-opus-5-5".into());
    // Priced so the budget can be enforced. Rates are $ per million tokens; set your own.
    let model: Arc<dyn Model> = Arc::new(Priced::new(cairn::models::from_spec(&spec)?, Pricing::new(4.0, 20.0)));

    let agent = Agent::builder("fairpay-buyer")
        .model(model)
        .system(SYSTEM)
        .tools(tools)
        .budget(Budget::default().max_steps(16).max_usd(0.50))
        .journal(JsonlJournal::new("runs")?)
        .build()?;

    let mut outcome = agent.run(&task).await?;
    while outcome.status == Status::AwaitingApproval {
        for call in &outcome.awaiting_approval {
            println!("\n⏸  The agent wants to {}:\n   {}", call.name, call.input);
            print!("   Approve? [y/N] ");
            io::stdout().flush()?;
            let mut answer = String::new();
            io::stdin().read_line(&mut answer)?;
            let yes = answer.trim().eq_ignore_ascii_case("y");
            agent.decide(&outcome.run_id, &call.id, yes, Some("terminal"), None).await?;
            println!("   {}", if yes { "✅ approved" } else { "❌ denied — the agent is told why" });
        }
        outcome = agent.resume(&outcome.run_id).await?;
    }

    println!("\n{}", outcome.output().unwrap_or("(the run did not finish)"));
    let status = if outcome.output().is_some() { "completed".to_string() } else { format!("{:?}", outcome.status) };
    println!(
        "\nstatus: {status} · steps: {} · model cost: ${:.4} · journal: runs/{}.jsonl",
        outcome.steps, outcome.cost_usd, outcome.run_id
    );
    Ok(())
}
