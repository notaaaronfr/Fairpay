/**
 * The Fairpay mark: two interlocking rounded links — navy and PayPal blue —
 * woven over and under each other. Two parties, bound by one trusted payment.
 */
export function Mark({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden className="mark">
      <rect x="4" y="12" width="26" height="24" rx="12" fill="none" stroke="var(--mark-a)" strokeWidth="6.5" />
      <rect x="18" y="12" width="26" height="24" rx="12" fill="none" stroke="var(--mark-b)" strokeWidth="6.5" />
      {/* the weave: navy passes back over blue at the top crossing */}
      <path d="M22.4 13.1A12 12 0 0 1 30 24" fill="none" stroke="var(--mark-a)" strokeWidth="6.5" />
    </svg>
  );
}

export function Wordmark() {
  return <span className="wordmark">fairpay</span>;
}
