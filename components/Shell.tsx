'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { setTheme } from '../lib/actions.ts';
import { Mark, Wordmark } from './Brand.tsx';
import { Home, Doc, Bot, Pulse, Help, Sun, Moon, Plus } from './Icons.tsx';

const at = (path: string, href: string): 'page' | undefined =>
  (href === '/' ? path === '/' || path.startsWith('/c/') : path.startsWith(href)) ? 'page' : undefined;

export function Sidebar({ theme }: { theme: 'light' | 'dark' }) {
  const path = usePathname();
  return (
    <aside className="side" aria-label="Main">
      <Link href="/" aria-label="Fairpay home" style={{ width: 'auto', height: 'auto', background: 'none', border: 0, boxShadow: 'none' }}><Mark size={44} /></Link>
      <Link href="/" aria-current={at(path, '/')} title="Escrows"><Home /></Link>
      <Link href="/new" aria-current={at(path, '/new')} title="New contract"><Doc /></Link>
      <Link href="/agents" aria-current={at(path, '/agents')} title="For agents"><Bot /></Link>
      <Link href="/#activity" title="Activity"><Pulse /></Link>
      <Link href="/#faq" title="How it works"><Help /></Link>
      <div className="grow" />
      <form action={setTheme}>
        <input type="hidden" name="to" value={path} />
        <input type="hidden" name="theme" value={theme === 'dark' ? 'light' : 'dark'} />
        <button aria-label={theme === 'dark' ? 'Light mode' : 'Dark mode'} title={theme === 'dark' ? 'Light mode' : 'Dark mode'}>
          {theme === 'dark' ? <Sun /> : <Moon />}
        </button>
      </form>
    </aside>
  );
}

export function TopBar({ paypal, paypalOn, ai, aiOn }: { paypal: string; paypalOn: boolean; ai: string; aiOn: boolean }) {
  const path = usePathname();
  return (
    <header className="top">
      <Link href="/" className="brandline"><Wordmark /></Link>
      <div className="spacer" />
      <nav className="seg" aria-label="Sections">
        <Link href="/" aria-current={at(path, '/')}>Escrows</Link>
        <Link href="/new" aria-current={at(path, '/new')}>New contract</Link>
        <Link href="/agents" aria-current={at(path, '/agents')}>For agents</Link>
      </nav>
      <div className="spacer" />
      <div className="status">
        <span><i className={paypalOn ? 'on' : 'off'} />{paypal}</span>
        <span><i className={aiOn ? 'on' : 'off'} />{ai}</span>
      </div>
      <Link href="/new" className="btn primary"><Plus />Start escrow</Link>
    </header>
  );
}
