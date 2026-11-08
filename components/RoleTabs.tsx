'use client';

import { usePathname } from 'next/navigation';
import { setRole } from '../lib/actions.ts';

/** Client | Freelancer — the same escrow from either side. */
export function RoleTabs({ role }: { role: 'client' | 'freelancer' }) {
  const path = usePathname();
  return (
    <form action={setRole} className="seg fill" aria-label="View as">
      <input type="hidden" name="to" value={path} />
      <button name="role" value="client" aria-pressed={role === 'client'}>Client</button>
      <button name="role" value="freelancer" aria-pressed={role === 'freelancer'}>Freelancer</button>
    </form>
  );
}
