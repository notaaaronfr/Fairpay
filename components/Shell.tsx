'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { setTheme, setRole } from '../lib/actions.ts';
import { Mark, Wordmark } from './Brand.tsx';
import { Bell, Sun, Moon } from './Icons.tsx';

const at = (path: string, href: string): 'page' | undefined =>
  (href === '/' ? path === '/' || path.startsWith('/c/') : path.startsWith(href)) ? 'page' : undefined;

export function Header({ theme, role, live }: { theme: 'light' | 'dark'; role: 'client' | 'freelancer'; live: boolean }) {
  const path = usePathname();
  return (
    <header className="head">
      <Link href="/" className="brand" aria-label="Fairpay home"><Mark size={38} /><Wordmark /></Link>
      <nav className="pills" aria-label="Sections">
        <Link href="/" aria-current={at(path, '/')}>Escrows</Link>
        <Link href="/new" aria-current={at(path, '/new')}>New</Link>
        <Link href="/agents" aria-current={at(path, '/agents')}>Agents</Link>
        <Link href="/activity" aria-current={at(path, "/activity")}>Activity</Link>
      </nav>
      <div className="tools">
        <form action={setTheme}>
          <input type="hidden" name="to" value={path} />
          <input type="hidden" name="theme" value={theme === 'dark' ? 'light' : 'dark'} />
          <button className="round" aria-label={theme === 'dark' ? 'Light mode' : 'Dark mode'} title={theme === 'dark' ? 'Light mode' : 'Dark mode'}>
            {theme === 'dark' ? <Sun /> : <Moon />}
          </button>
        </form>
        <Link href="/activity" className="round" aria-label="Activity" title={live ? 'PayPal sandbox connected' : 'PayPal simulated'}>
          <Bell /><span className={`dot ${live ? 'on' : ''}`} />
        </Link>
        <form action={setRole}>
          <input type="hidden" name="to" value={path} />
          <input type="hidden" name="role" value={role === 'client' ? 'freelancer' : 'client'} />
          <button className="round" title={`Viewing as ${role}. Switch to ${role === 'client' ? 'freelancer' : 'client'}.`} aria-label={`Viewing as ${role}; switch`}>
            {role === 'client' ? 'CL' : 'FR'}<span className="dot on" />
          </button>
        </form>
      </div>
    </header>
  );
}
