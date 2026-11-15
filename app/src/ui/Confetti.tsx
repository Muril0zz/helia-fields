import { useEffect, useRef } from 'react';

const COLORS = ['#FFC23D', '#3DDC84', '#FFE08A', '#FF8A3D', '#4C8DFF', '#2EF2C9'];

/** The one celebration: a short burst in crop colours when the best rotation lands. */
export function Confetti({ fire }: { fire: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!fire) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const cv = ref.current;
    if (!cv) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = window.innerWidth * dpr;
    cv.height = window.innerHeight * dpr;
    const ctx = cv.getContext('2d')!;
    ctx.scale(dpr, dpr);
    const ox = window.innerWidth - Math.min(760, window.innerWidth * 0.5) / 2;
    const oy = 180;
    const parts = Array.from({ length: 140 }, () => {
      const a = Math.random() * Math.PI * 2;
      const v = 4 + Math.random() * 8;
      return {
        x: ox, y: oy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 4,
        w: 5 + Math.random() * 5, h: 3 + Math.random() * 3, r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.4,
        c: COLORS[Math.floor(Math.random() * COLORS.length)],
      };
    });
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const k = (t - start) / 1400;
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      parts.forEach((p) => {
        p.vy += 0.25;
        p.vx *= 0.985;
        p.x += p.vx;
        p.y += p.vy;
        p.r += p.vr;
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - k);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.r);
        ctx.fillStyle = p.c;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });
      if (k < 1) raf = requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [fire]);
  return <canvas ref={ref} style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 20 }} aria-hidden="true" />;
}
