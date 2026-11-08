import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';

/**
 * Storage: one SQLite file, built into Node — nothing to install or host.
 * Contracts hold milestones; every money movement and every AI verdict is
 * also written to `events`, an append-only trail both parties can read.
 */

export type ContractStatus = 'draft' | 'awaiting_funds' | 'funded' | 'closed';
export type MilestoneStatus = 'open' | 'submitted' | 'changes_requested' | 'released' | 'cancelled';

export interface Contract {
  id: string; title: string; scope: string;
  client_name: string; freelancer_name: string; freelancer_email: string;
  status: ContractStatus; total_usd: number;
  order_id: string | null; authorization_id: string | null; payer: string | null;
  hold_expires: string | null; refunded_usd: number;
  created_at: string;
}

export interface Milestone {
  id: string; contract_id: string; position: number;
  title: string; criteria: string; amount_usd: number;
  status: MilestoneStatus;
  submission_note: string | null; submission_url: string | null; submitted_at: string | null;
  review: string | null;            // JSON of the latest AI verdict
  paid_usd: number; capture_id: string | null; payout_batch_id: string | null; payout_status: string | null;
}

export interface Event {
  id: number; contract_id: string; milestone_id: string | null;
  actor: 'client' | 'freelancer' | 'referee' | 'paypal' | 'system';
  kind: string; detail: string; at: string;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS contracts (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, scope TEXT NOT NULL DEFAULT '',
  client_name TEXT NOT NULL, freelancer_name TEXT NOT NULL, freelancer_email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft', total_usd REAL NOT NULL,
  order_id TEXT, authorization_id TEXT, payer TEXT, hold_expires TEXT,
  refunded_usd REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS milestones (
  id TEXT PRIMARY KEY, contract_id TEXT NOT NULL REFERENCES contracts(id),
  position INTEGER NOT NULL, title TEXT NOT NULL, criteria TEXT NOT NULL, amount_usd REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  submission_note TEXT, submission_url TEXT, submitted_at TEXT,
  review TEXT, paid_usd REAL NOT NULL DEFAULT 0,
  capture_id TEXT, payout_batch_id TEXT, payout_status TEXT
);
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT, contract_id TEXT NOT NULL, milestone_id TEXT,
  actor TEXT NOT NULL, kind TEXT NOT NULL, detail TEXT NOT NULL DEFAULT '{}', at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS agent_runs (
  id TEXT PRIMARY KEY, contract_id TEXT, mode TEXT NOT NULL, brief TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL, output TEXT NOT NULL DEFAULT '', awaiting TEXT NOT NULL DEFAULT '[]',
  cost_usd REAL NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ms ON milestones(contract_id, position);
CREATE INDEX IF NOT EXISTS idx_ev ON events(contract_id, id);
`;

let shared: DatabaseSync | null = null;

/** The app's database. Tests pass their own in-memory one. */
export function db(): DatabaseSync {
  if (!shared) {
    const path = process.env.FAIRPAY_DB ?? 'data/fairpay.db';
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    shared = open(path);
  }
  return shared;
}

export function open(path = ':memory:'): DatabaseSync {
  const d = new DatabaseSync(path);
  d.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  d.exec(SCHEMA);
  return d;
}

export const now = () => new Date().toISOString();
export const newId = (p: string) => `${p}_${randomUUID().replace(/-/g, '').slice(0, 12)}`;

export const contract = (d: DatabaseSync, id: string) =>
  d.prepare('SELECT * FROM contracts WHERE id=?').get(id) as unknown as Contract | undefined;
export const contracts = (d: DatabaseSync) =>
  d.prepare('SELECT * FROM contracts ORDER BY created_at DESC').all() as unknown as Contract[];
export const milestones = (d: DatabaseSync, contractId: string) =>
  d.prepare('SELECT * FROM milestones WHERE contract_id=? ORDER BY position').all(contractId) as unknown as Milestone[];
export const milestone = (d: DatabaseSync, id: string) =>
  d.prepare('SELECT * FROM milestones WHERE id=?').get(id) as unknown as Milestone | undefined;
export const events = (d: DatabaseSync, contractId: string) =>
  d.prepare('SELECT * FROM events WHERE contract_id=? ORDER BY id DESC').all(contractId) as unknown as Event[];

/** The latest activity across every contract, newest first. */
export const recent = (d: DatabaseSync, limit = 30) =>
  d.prepare(`SELECT e.*, c.title AS contract_title, m.title AS milestone_title
               FROM events e JOIN contracts c ON c.id = e.contract_id
               LEFT JOIN milestones m ON m.id = e.milestone_id
              ORDER BY e.id DESC LIMIT ?`).all(limit) as unknown as (Event & { contract_title: string; milestone_title: string | null })[];

export interface AgentRun {
  id: string; contract_id: string | null; mode: 'hire' | 'settle'; brief: string;
  status: string; output: string; awaiting: string; cost_usd: number; created_at: string; updated_at: string;
}
export const agentRuns = (d: DatabaseSync, contractId: string) =>
  d.prepare('SELECT * FROM agent_runs WHERE contract_id=? ORDER BY created_at DESC').all(contractId) as unknown as AgentRun[];
export const agentRun = (d: DatabaseSync, id: string) =>
  d.prepare('SELECT * FROM agent_runs WHERE id=?').get(id) as unknown as AgentRun | undefined;

export function log(d: DatabaseSync, e: { contract: string; milestone?: string | null; actor: Event['actor']; kind: string; detail?: unknown }) {
  d.prepare('INSERT INTO events (contract_id, milestone_id, actor, kind, detail, at) VALUES (?,?,?,?,?,?)')
    .run(e.contract, e.milestone ?? null, e.actor, e.kind, JSON.stringify(e.detail ?? {}), now());
}

export function update(d: DatabaseSync, table: 'contracts' | 'milestones' | 'agent_runs', id: string, fields: Record<string, unknown>) {
  const keys = Object.keys(fields);
  if (!keys.length) return;
  d.prepare(`UPDATE ${table} SET ${keys.map(k => `${k}=?`).join(', ')} WHERE id=?`)
    .run(...keys.map(k => fields[k] as any), id);
}
