import { animate, useMotionValue, useReducedMotion } from 'framer-motion';
import { useEffect, useRef } from 'react';
import { useLang } from '../i18n';

/** Number that rolls to its new value in ~0.2 s instead of jumping. */
export function RollingNumber({
  value,
  decimals = 0,
  prefix = '',
  suffix = '',
  signed = false,
}: {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  signed?: boolean;
}) {
  const mv = useMotionValue(value);
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();
  const locale = useLang() === 'pt' ? 'pt-BR' : 'en-US';
  const fmt = (v: number) => {
    const abs = Math.abs(v).toLocaleString(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    const sign = v < 0 ? '−' : signed && v > 0 ? '+' : '';
    return `${sign}${prefix}${abs}${suffix}`;
  };
  useEffect(() => {
    if (reduce) {
      mv.set(value);
      if (ref.current) ref.current.textContent = fmt(value);
      return;
    }
    const controls = animate(mv, value, {
      duration: 0.22,
      ease: [0.2, 0.8, 0.2, 1],
      onUpdate: (v) => {
        if (ref.current) ref.current.textContent = fmt(v);
      },
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, reduce, locale]);
  return (
    <span ref={ref} aria-label={fmt(value)}>
      {fmt(mv.get())}
    </span>
  );
}
