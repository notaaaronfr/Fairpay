import { cookies } from 'next/headers';
import { config } from './paypal.ts';
import { usingModel, MODEL } from './referee.ts';

export type Role = 'client' | 'freelancer';
export const role = async (): Promise<Role> =>
  (await cookies()).get('fp_role')?.value === 'freelancer' ? 'freelancer' : 'client';

export const usd = (n: number) =>
  '$' + Number(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function modes() {
  const pp = config().mode;
  return {
    paypal: pp, paypalLabel: pp === 'simulated' ? 'PayPal: simulated' : pp === 'sandbox' ? 'PayPal sandbox' : 'PayPal live',
    ai: usingModel(), aiLabel: usingModel() ? `Referee: ${MODEL}` : 'Referee: offline',
  };
}

export function ago(iso: string): string {
  const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export const STATUS: Record<string, { label: string; tone: string }> = {
  draft: { label: 'Unfunded', tone: '' },
  awaiting_funds: { label: 'Awaiting PayPal', tone: 'amber' },
  funded: { label: 'Held', tone: 'blue' },
  closed: { label: 'Settled', tone: 'green' },
  open: { label: 'In progress', tone: '' },
  submitted: { label: 'Submitted', tone: 'amber' },
  changes_requested: { label: 'Changes', tone: 'red' },
  released: { label: 'Paid', tone: 'green' },
  cancelled: { label: 'Cancelled', tone: '' },
};
