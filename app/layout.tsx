import './globals.css';
import type { Metadata } from 'next';
import { Space_Grotesk, Space_Mono } from 'next/font/google';
import { cookies } from 'next/headers';
import { role, modes } from '../lib/ui.ts';
import { TopBar } from '../components/TopBar.tsx';

const grotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-grotesk', display: 'swap' });
const mono = Space_Mono({ subsets: ['latin'], weight: ['400', '700'], variable: '--font-mono', display: 'swap' });

export const metadata: Metadata = {
  title: 'Fairpay — pay on proof',
  description: 'Milestone escrow on PayPal with an AI referee: money is held before work starts and released when the work is proven.',
};

export default async function Layout({ children }: { children: React.ReactNode }) {
  const theme = (await cookies()).get('fp_theme')?.value === 'dark' ? 'dark' : 'light';
  const m = modes();
  return (
    <html lang="en" data-theme={theme} className={`${grotesk.variable} ${mono.variable}`}>
      <body>
        <div className="frame">
          <div className="inner">
            <TopBar role={await role()} theme={theme} paypal={m.paypalLabel} paypalOn={m.paypal !== 'simulated'} ai={m.aiLabel} aiOn={m.ai} />
            {children}
            <div className="footer">
              Fairpay holds money with PayPal and releases it only on a person&rsquo;s click. The AI referee recommends; it never pays.
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
