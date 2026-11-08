import './globals.css';
import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { cookies } from 'next/headers';
import { modes, role } from '../lib/ui.ts';
import { Header } from '../components/Shell.tsx';

const sans = Plus_Jakarta_Sans({ subsets: ['latin'], weight: ['200', '300', '400', '500', '600'], variable: '--font-sans', display: 'swap' });

export const metadata: Metadata = {
  title: 'Fairpay — pay on proof',
  description: 'Milestone escrow on PayPal with an AI referee: money is held before work starts and released when the work is proven.',
  icons: { icon: '/icon.svg' },
};

export default async function Layout({ children }: { children: React.ReactNode }) {
  const theme = (await cookies()).get('fp_theme')?.value === 'dark' ? 'dark' : 'light';
  const m = modes();
  return (
    <html lang="en" data-theme={theme} className={sans.variable}>
      <body>
        <div className="wrap">
          <Header theme={theme} role={await role()} live={m.paypal !== 'simulated'} />
          {children}
          <div className="pagefoot">
            {m.paypalLabel} · {m.aiLabel}
          </div>
        </div>
      </body>
    </html>
  );
}
