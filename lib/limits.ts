import type { DatabaseSync } from 'node:sqlite';
import { usingModel } from './referee.ts';

/**
 * Spend limits for the public demo's paid AI calls (the referee, criteria
 * sharpening, the Cairn agent). Counted in SQLite so they survive restarts.
 *
 *   FAIRPAY_AI_PER_IP_HOUR  calls per visitor per hour   (default 12)
 *   FAIRPAY_AI_PER_DAY      calls for everyone, per day  (default 300)
 *
 * K2 Horizon is tried first and costs nothing; the caps protect the paid
 * Claude fallback (and K2's own rate limits) from a busy or abusive demo.
 *
 * The per-visitor limit keys on the client IP, which a caller can fake; the
 * daily cap is the real ceiling on spend. When a limit is hit nothing breaks:
 * the referee and sharpening fall back to their offline versions, and the
 * agent says so instead of running.
 */

export type AiKind = 'referee' | 'sharpen' | 'agent';

const num = (v: string | undefined, d: number) => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? n : d; };
export const limits = () => ({
  perIpHour: num(process.env.FAIRPAY_AI_PER_IP_HOUR, 12),
  perDay: num(process.env.FAIRPAY_AI_PER_DAY, 300),
});

export const LIMITED = 'The demo’s AI limit is reached for now';

/** Whether a paid AI call may run now. Records it when it may. */
export function allowAI(d: DatabaseSync, ip: string, kind: AiKind): { ok: boolean; why?: string } {
  if (kind !== 'agent' && !usingModel()) return { ok: true }; // offline anyway: free
  const { perIpHour, perDay } = limits();
  const now = Date.now();
  const hourAgo = new Date(now - 3_600_000).toISOString();
  const dayAgo = new Date(now - 86_400_000).toISOString();
  const today = (d.prepare('SELECT COUNT(*) n FROM ai_calls WHERE at >= ?').get(dayAgo) as any).n as number;
  if (today >= perDay) return { ok: false, why: `${LIMITED} (daily cap). Try again tomorrow, or run it locally with your own key.` };
  const mine = (d.prepare('SELECT COUNT(*) n FROM ai_calls WHERE ip = ? AND at >= ?').get(ip, hourAgo) as any).n as number;
  if (mine >= perIpHour) return { ok: false, why: `${LIMITED} for you (${perIpHour} an hour). Try again in a bit.` };
  d.prepare('INSERT INTO ai_calls (ip, kind, at) VALUES (?,?,?)').run(ip, kind, new Date(now).toISOString());
  return { ok: true };
}

/** The visitor's address as the proxy or server reports it. */
export function clientIp(h: { get(name: string): string | null }): string {
  return h.get('x-forwarded-for')?.split(',')[0].trim() || h.get('x-real-ip') || 'unknown';
}
