/**
 * The Fairpay mark: two offset strokes — a sky-blue shadow behind a navy
 * stroke — that draw an "f" whose foot finishes as a checkmark. Paid, on
 * proof. A small yellow sparkle sits on the corner of the sticker tile.
 */
export function Mark({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden className="mark">
      <defs>
        <linearGradient id="fp-tile" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#E9F4FF" />
          <stop offset="1" stopColor="#CDE6FF" />
        </linearGradient>
        <linearGradient id="fp-front" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0070E0" />
          <stop offset="1" stopColor="#003087" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="44" height="44" rx="14" fill="url(#fp-tile)" />
      {/* back stroke, offset like a riso misprint */}
      <path d="M11.5 26.5l6.5 6.5 9.6-16.8c1.7-3 4.6-4.5 8-3.6M20.5 22.5h10.5"
            fill="none" stroke="#009CDE" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" transform="translate(2.6 2.2)" opacity=".85" />
      {/* front stroke: the f, whose foot is a check */}
      <path d="M11.5 26.5l6.5 6.5 9.6-16.8c1.7-3 4.6-4.5 8-3.6M20.5 22.5h10.5"
            fill="none" stroke="url(#fp-front)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      {/* sparkle */}
      <path d="M38.5 6.5l1.3 3.2 3.2 1.3-3.2 1.3-1.3 3.2-1.3-3.2-3.2-1.3 3.2-1.3z" fill="#FFC439" stroke="#003087" strokeWidth=".8" strokeLinejoin="round" />
    </svg>
  );
}

export function Wordmark() {
  return <span className="wordmark">fair<b>pay</b></span>;
}
