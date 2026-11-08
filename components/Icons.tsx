/** Stroke icons, drawn for Fairpay. */
const P = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

export const Plus = () => <svg viewBox="0 0 24 24" aria-hidden><path d="M12 5v14M5 12h14" {...P} /></svg>;
export const Lock = () => <svg viewBox="0 0 24 24" aria-hidden><rect x="5" y="11" width="14" height="9" rx="2.5" {...P} /><path d="M8 11V8a4 4 0 0 1 8 0v3" {...P} /></svg>;
export const Send = () => <svg viewBox="0 0 24 24" aria-hidden><path d="M4.5 12L20 4.5 15.5 20l-3.2-6.8z" {...P} /><path d="M12.3 13.2L20 4.5" {...P} /></svg>;
export const Swap = () => <svg viewBox="0 0 24 24" aria-hidden><path d="M8 4v15M4.5 7.5L8 4l3.5 3.5M16 20V5M19.5 16.5L16 20l-3.5-3.5" {...P} /></svg>;
export const Down = () => <svg viewBox="0 0 24 24" aria-hidden><path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19.5h14" {...P} /></svg>;
export const Up = () => <svg viewBox="0 0 24 24" aria-hidden><path d="M12 20V9M7.5 13.5L12 9l4.5 4.5M5 4.5h14" {...P} /></svg>;
export const In = () => <svg viewBox="0 0 24 24" aria-hidden><path d="M17 7L7 17M7 9v8h8" {...P} /></svg>;
export const Arrow = () => <svg viewBox="0 0 24 24" aria-hidden><path d="M7 17L17 7M9 7h8v8" {...P} /></svg>;
export const Search = () => <svg viewBox="0 0 24 24" aria-hidden><circle cx="11" cy="11" r="6.5" {...P} /><path d="M20 20l-4.2-4.2" {...P} /></svg>;
export const Bell = () => <svg viewBox="0 0 24 24" aria-hidden><path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15z" {...P} /><path d="M10 20.5h4" {...P} /></svg>;
export const Sun = () => <svg viewBox="0 0 24 24" aria-hidden><circle cx="12" cy="12" r="4" {...P} /><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" {...P} /></svg>;
export const Moon = () => <svg viewBox="0 0 24 24" aria-hidden><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" {...P} /></svg>;
export const Spark = () => <svg viewBox="0 0 24 24" aria-hidden><path d="M12 3l2 5.5L19.5 10 14 12l-2 5.5L10 12 4.5 10 10 8.5z" {...P} /></svg>;
export const Doc = () => <svg viewBox="0 0 24 24" aria-hidden><path d="M7 3.5h7l4 4V19a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 19V5A1.5 1.5 0 0 1 7.5 3.5z" {...P} /><path d="M13.5 3.5V8h4.5M9 13h6M9 16.5h4" {...P} /></svg>;
export const Check = () => <svg viewBox="0 0 24 24" aria-hidden><circle cx="12" cy="12" r="8.5" {...P} /><path d="M8.5 12.2l2.4 2.4 4.6-5" {...P} /></svg>;
export const Back = () => <svg viewBox="0 0 24 24" aria-hidden><path d="M9 14l-4-4 4-4M5 10h9a5 5 0 0 1 0 10h-2" {...P} /></svg>;
