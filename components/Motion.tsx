'use client';

/**
 * Motion primitives for Fairpay. Small, quiet, and all of them stand still
 * when the visitor has asked for reduced motion.
 */
import { useEffect, useRef, useState } from 'react';
import { animate, motion, useInView, useMotionValue, useReducedMotion, useSpring, useTransform } from 'motion/react';

const EASE = [0.22, 1, 0.36, 1] as const;

/* ── money that counts up, cents in grey ───────────────────────────────── */
export function CountUp({ value, className, cents = true, duration = 1.4 }: { value: number; className?: string; cents?: boolean; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const seen = useInView(ref, { once: true });
  const calm = useReducedMotion();
  const [n, setN] = useState(calm ? value : 0);
  useEffect(() => {
    if (!seen) return;
    if (calm) { setN(value); return; }
    const c = animate(0, value, { duration, ease: EASE, onUpdate: setN });
    return () => c.stop();
  }, [seen, value, calm, duration]);
  const [w, c] = n.toFixed(2).split('.');
  return (
    <span ref={ref} className={className} style={{ fontVariantNumeric: 'tabular-nums' }}>
      ${Number(w).toLocaleString('en-US')}{cents && <span className="c">.{c}</span>}
    </span>
  );
}

/* ── words that arrive out of a blur, one after another ────────────────── */
export function BlurText({ text, className, delay = 0, step = 0.06 }: { text: string; className?: string; delay?: number; step?: number }) {
  const calm = useReducedMotion();
  if (calm) return <span className={className}>{text}</span>;
  return (
    <span className={className} aria-label={text}>
      {text.split(' ').map((w, i) => (
        <motion.span key={i} aria-hidden style={{ display: 'inline-block', whiteSpace: 'pre' }}
          initial={{ opacity: 0, filter: 'blur(10px)', y: 8 }}
          animate={{ opacity: 1, filter: 'blur(0px)', y: 0 }}
          transition={{ duration: 0.6, delay: delay + i * step, ease: EASE }}>
          {w}{i < text.split(' ').length - 1 ? ' ' : ''}
        </motion.span>
      ))}
    </span>
  );
}

/* ── anything that rises into place, staggered by index ────────────────── */
export function Rise({ children, i = 0, className, style, as = 'div' }: {
  children: React.ReactNode; i?: number; className?: string; style?: React.CSSProperties; as?: 'div' | 'tr' | 'section' | 'article';
}) {
  const calm = useReducedMotion();
  const M = motion[as] as any;
  return (
    <M className={className} style={style}
      initial={calm ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay: Math.min(i, 10) * 0.06, ease: EASE }}>
      {children}
    </M>
  );
}

/* ── a soft light that follows the cursor across a panel ───────────────── */
export function Spotlight({ children, className = '', style, id }: { children: React.ReactNode; className?: string; style?: React.CSSProperties; id?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div ref={ref} id={id} className={`${className} spot`} style={style}
      onMouseMove={e => {
        const r = ref.current!.getBoundingClientRect();
        ref.current!.style.setProperty('--mx', `${e.clientX - r.left}px`);
        ref.current!.style.setProperty('--my', `${e.clientY - r.top}px`);
      }}>
      {children}
    </div>
  );
}

/* ── a card that leans toward the cursor ───────────────────────────────── */
export function Tilt({ children, className }: { children: React.ReactNode; className?: string }) {
  const calm = useReducedMotion();
  const x = useMotionValue(0), y = useMotionValue(0);
  const rx = useSpring(useTransform(y, [-0.5, 0.5], [9, -9]), { stiffness: 180, damping: 18 });
  const ry = useSpring(useTransform(x, [-0.5, 0.5], [-11, 11]), { stiffness: 180, damping: 18 });
  const glare = useTransform([x, y] as any, ([a, b]: number[]) =>
    `radial-gradient(circle at ${(a + 0.5) * 100}% ${(b + 0.5) * 100}%, rgba(255,255,255,.22), transparent 55%)`);
  if (calm) return <div className={className}>{children}</div>;
  return (
    <motion.div className={className} style={{ rotateX: rx, rotateY: ry, transformPerspective: 700 }}
      initial={{ opacity: 0, y: 20, rotateZ: -4 }} animate={{ opacity: 1, y: 0, rotateZ: 0 }} transition={{ duration: 0.9, ease: EASE }}
      onMouseMove={e => { const r = e.currentTarget.getBoundingClientRect(); x.set((e.clientX - r.left) / r.width - 0.5); y.set((e.clientY - r.top) / r.height - 0.5); }}
      onMouseLeave={() => { x.set(0); y.set(0); }}>
      {children}
      <motion.span aria-hidden style={{ position: 'absolute', inset: 0, borderRadius: 'inherit', background: glare, pointerEvents: 'none' }} />
    </motion.div>
  );
}

/* ── a bar that fills to its value ─────────────────────────────────────── */
export function Fill({ pct, className, delay = 0.3 }: { pct: number; className?: string; delay?: number }) {
  const calm = useReducedMotion();
  return (
    <motion.i className={className} initial={calm ? false : { width: 0 }} whileInView={{ width: `${pct}%` }}
      viewport={{ once: true }} transition={{ duration: 1.1, delay, ease: EASE }} style={{ width: calm ? `${pct}%` : undefined }} />
  );
}

/* ── the tracker line: the fill draws in, the current stop breathes ────── */
export function TrackFill({ ratio }: { ratio: number }) {
  const calm = useReducedMotion();
  const target = `calc((100% - 12px) * ${ratio})`;
  return (
    <motion.span className="fill" initial={calm ? false : { width: 0 }} animate={{ width: target }}
      transition={{ duration: 1.4, delay: 0.35, ease: EASE }} style={{ width: calm ? target : undefined }} />
  );
}
