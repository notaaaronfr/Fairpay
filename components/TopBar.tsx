'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { setRole, setTheme } from '../lib/actions.ts';
import { Logo, Sun, Moon } from './Icons.tsx';

export function TopBar({ role, theme, paypal, paypalOn, ai, aiOn }: {
  role: 'client' | 'freelancer'; theme: 'light' | 'dark';
  paypal: string; paypalOn: boolean; ai: string; aiOn: boolean;
}) {
  const path = usePathname();
  const here = (href: string): 'page' | undefined => (href === '/' ? path === '/' || path.startsWith('/c/') : path.startsWith(href)) ? 'page' : undefined;
  return (
    <header className="bar">
      <Link href="/" className="logo"><Logo />Fairpay</Link>
      <nav className="nav">
        <Link href="/" aria-current={here('/')}>Escrows</Link>
        <Link href="/new" aria-current={here('/new')}>New contract</Link>
        <Link href="/agents" aria-current={here('/agents')}>For agents</Link>
      </nav>
      <div className="grow" />
      <div className="meta">
        <span><i className={`dot ${paypalOn ? 'on' : 'off'}`} />{paypal}</span>
        <span><i className={`dot ${aiOn ? 'on' : 'off'}`} />{ai}</span>
        <form action={setRole} className="toggle" aria-label="View as">
          <input type="hidden" name="to" value={path} />
          <button name="role" value="client" aria-pressed={role === 'client'}>Client</button>
          <button name="role" value="freelancer" aria-pressed={role === 'freelancer'}>Freelancer</button>
        </form>
        <form action={setTheme}>
          <input type="hidden" name="to" value={path} />
          <input type="hidden" name="theme" value={theme === 'dark' ? 'light' : 'dark'} />
          <button className="icon-btn" aria-label={theme === 'dark' ? 'Light mode' : 'Dark mode'} title={theme === 'dark' ? 'Light mode' : 'Dark mode'}>
            {theme === 'dark' ? <Sun /> : <Moon />}
          </button>
        </form>
      </div>
    </header>
  );
}
