/** Small stroke icons, drawn for Fairpay. */
const P = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

export const Logo = () => (
  <svg viewBox="0 0 24 24" aria-hidden><circle cx="12" cy="12" r="10" fill="currentColor" /><path d="M7.5 12.3l3 3 6-6.6" stroke="var(--canvas)" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
export const Plus = () => <svg viewBox="0 0 24 24" aria-hidden><path d="M12 5v14M5 12h14" {...P} /></svg>;
export const Lock = () => <svg viewBox="0 0 24 24" aria-hidden><rect x="5" y="11" width="14" height="9" rx="2" {...P} /><path d="M8 11V8a4 4 0 0 1 8 0v3" {...P} /></svg>;
export const Upload = () => <svg viewBox="0 0 24 24" aria-hidden><path d="M12 15V4M7 9l5-5 5 5M5 20h14" {...P} /></svg>;
export const Send = () => <svg viewBox="0 0 24 24" aria-hidden><path d="M7 17L17 7M9 7h8v8" {...P} /></svg>;
export const Return = () => <svg viewBox="0 0 24 24" aria-hidden><path d="M9 14l-4-4 4-4M5 10h9a5 5 0 0 1 0 10h-2" {...P} /></svg>;
export const Spark = () => <svg viewBox="0 0 24 24" aria-hidden><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6" {...P} /></svg>;
export const Sun = () => <svg viewBox="0 0 24 24" aria-hidden><circle cx="12" cy="12" r="4" {...P} /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.4 1.4M17.6 17.6L19 19M5 19l1.4-1.4M17.6 6.4L19 5" {...P} /></svg>;
export const Moon = () => <svg viewBox="0 0 24 24" aria-hidden><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" {...P} /></svg>;
