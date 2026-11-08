'use client';

import { useFormStatus } from 'react-dom';

/** A submit button that says what is happening while the server works. */
export function Submit({ children, pending, className, style, disabled }: {
  children: React.ReactNode; pending: string; className?: string; style?: React.CSSProperties; disabled?: boolean;
}) {
  const { pending: busy } = useFormStatus();
  return <button className={className} style={style} disabled={busy || disabled} aria-busy={busy}>{busy ? pending : children}</button>;
}
