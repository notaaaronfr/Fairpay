import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { agentRun, log, now, update } from './db.ts';

/**
 * The bridge to Fairpay's built-in agent, which runs on Cairn (Rust).
 *
 * Each call launches the agent binary for one step of work. The agent talks
 * back to this same app over MCP, so it can only do what any agent may: open
 * an escrow, read it, submit, release up to the referee's recommendation.
 * When it wants to move money, Cairn pauses the run and journals it; the app
 * shows the pending payment, and a person's Approve or Deny resumes the run
 * — in a new process, from the journal.
 */

const CANDIDATES = [
  process.env.FAIRPAY_AGENT_BIN,
  'agents/cairn-buyer/target/release/fairpay-agent',
  'agents/cairn-buyer/target/debug/fairpay-agent',
].filter(Boolean) as string[];

export function agentBinary(): string | null {
  for (const c of CANDIDATES) { const p = resolve(/*turbopackIgnore: true*/ c); if (existsSync(p)) return p; }
  return null;
}

export function agentReady(): { ok: boolean; why?: string } {
  if (!agentBinary()) return { ok: false, why: 'Build the agent: npm run agent:build' };
  if (!process.env.ANTHROPIC_API_KEY && !process.env.CAIRN_MODEL) return { ok: false, why: 'Set ANTHROPIC_API_KEY' };
  return { ok: true };
}

export interface AgentResult {
  run_id?: string; status: string; output: string; cost_usd?: number; steps?: number;
  awaiting: { id: string; name: string; input: any }[];
}

function exec(args: string[], origin: string): Promise<AgentResult> {
  const bin = agentBinary();
  if (!bin) return Promise.resolve({ status: 'error', output: 'The agent is not built. Run: npm run agent:build', awaiting: [] });
  return new Promise(res => {
    const child = spawn(bin, ['json', ...args], {
      env: {
        ...process.env,
        FAIRPAY_MCP_URL: `${origin}/api/mcp`,
        CAIRN_RUNS_DIR: resolve(/*turbopackIgnore: true*/ process.env.CAIRN_RUNS_DIR ?? 'data/agent-runs'),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '', err = '';
    const timer = setTimeout(() => child.kill('SIGTERM'), 240_000);
    child.stdout.on('data', b => (out += b));
    child.stderr.on('data', b => (err += b));
    child.on('close', () => {
      clearTimeout(timer);
      const line = out.trim().split('\n').reverse().find(l => l.startsWith('{'));
      try { res(JSON.parse(line ?? '')); }
      catch { res({ status: 'error', output: (err || out || 'The agent stopped without an answer.').slice(-400), awaiting: [] }); }
    });
  });
}

const contractIn = (text: string) => text.match(/ctr_[a-z0-9]{12}/)?.[0] ?? null;

function save(d: DatabaseSync, r: AgentResult, mode: 'hire' | 'settle', brief: string, contractId: string | null) {
  if (!r.run_id) return;
  const prev = agentRun(d, r.run_id);
  const fields = { status: r.status, output: r.output ?? '', awaiting: JSON.stringify(r.awaiting ?? []),
                   cost_usd: r.cost_usd ?? prev?.cost_usd ?? 0, updated_at: now(),
                   contract_id: contractId ?? prev?.contract_id ?? null };
  if (prev) update(d, 'agent_runs', r.run_id, fields);
  else d.prepare(`INSERT INTO agent_runs (id, contract_id, mode, brief, status, output, awaiting, cost_usd, created_at, updated_at)
                  VALUES (?,?,?,?,?,?,?,?,?,?)`)
        .run(r.run_id, fields.contract_id, mode, brief, r.status, fields.output, fields.awaiting, r.cost_usd ?? 0, now(), now());
}

/** One sentence in, an escrow out. Returns the contract the agent opened. */
export async function hire(d: DatabaseSync, brief: string, origin: string): Promise<{ contractId: string | null; result: AgentResult }> {
  const r = await exec(['hire', brief], origin);
  const contractId = contractIn(r.output);
  save(d, r, 'hire', brief, contractId);
  if (contractId) log(d, { contract: contractId, actor: 'system', kind: 'agent.hired', detail: { run: r.run_id, cost: r.cost_usd } });
  return { contractId, result: r };
}

/** Let the agent settle what the referee supports; it pauses before paying. */
export async function settle(d: DatabaseSync, contractId: string, origin: string): Promise<AgentResult> {
  const r = await exec(['settle', contractId], origin);
  save(d, r, 'settle', contractId, contractId);
  log(d, { contract: contractId, actor: 'system', kind: r.status === 'awaiting_approval' ? 'agent.waiting' : 'agent.done',
           detail: { run: r.run_id, status: r.status, cost: r.cost_usd } });
  return r;
}

/** A person's answer to a paused payment. The run resumes from Cairn's journal. */
export async function decide(d: DatabaseSync, runId: string, callId: string, approve: boolean, origin: string): Promise<AgentResult> {
  const run = agentRun(d, runId);
  const r = await exec(['decide', runId, callId, approve ? 'yes' : 'no'], origin);
  save(d, { ...r, run_id: r.run_id ?? runId }, run?.mode ?? 'settle', run?.brief ?? '', run?.contract_id ?? null);
  if (run?.contract_id) log(d, { contract: run.contract_id, actor: 'client', kind: approve ? 'agent.approved' : 'agent.denied', detail: { run: runId } });
  return r;
}
