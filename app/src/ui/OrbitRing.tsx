import { crop } from '../engine';
import type { CalendarBlock } from '../engine';

const MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

function arc(cx: number, cy: number, r: number, a0: number, a1: number) {
  const p = (a: number) => [cx + r * Math.sin(a), cy - r * Math.cos(a)];
  const [x0, y0] = p(a0);
  const [x1, y1] = p(a1);
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

/**
 * The farm year as an orbit: 12 o'clock is 1 January, clockwise. Each ring is one
 * year of the rotation; coloured arcs are crops, red arcs are bare soil.
 * The inner bars show the typical monthly rain.
 */
export function OrbitRing({
  blocks,
  years,
  rain,
  size = 112,
  label,
}: {
  blocks: CalendarBlock[];
  years: number;
  rain?: number[];
  size?: number;
  label: string;
}) {
  const c = size / 2;
  const outer = c - 4;
  const ringW = years > 1 ? 9 : 12;
  const gap = 3;
  const maxRain = rain ? Math.max(1, ...rain) : 1;
  const innerR = outer - years * (ringW + gap) - 2;
  const toA = (doy: number) => ((doy - 1) / 365) * Math.PI * 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label}>
      {Array.from({ length: years }).map((_, k) => {
        const r = outer - ringW / 2 - k * (ringW + gap);
        return <circle key={k} cx={c} cy={c} r={r} fill="none" stroke="rgba(150,176,255,0.10)" strokeWidth={ringW} />;
      })}
      {blocks.map((b, i) => {
        const r = outer - ringW / 2 - b.yearIndex * (ringW + gap);
        const a0 = toA(b.startDoy) + 0.012;
        const a1 = toA(b.startDoy) + (Math.min(b.days, 364) / 365) * Math.PI * 2 - 0.012;
        if (a1 <= a0) return null;
        const color = b.cropId ? crop(b.cropId).color : 'var(--bare)';
        return (
          <path
            key={i}
            d={arc(c, c, r, a0, a1)}
            fill="none"
            stroke={color}
            strokeWidth={b.cropId ? ringW : ringW * 0.42}
            strokeLinecap="butt"
            opacity={b.cropId ? 1 : 0.9}
          >
            <title>{b.cropId ? `${crop(b.cropId).name}: ${Math.round(b.days)} days` : `Bare soil: ${Math.round(b.days)} days`}</title>
          </path>
        );
      })}
      {rain &&
        rain.map((v, m) => {
          const a = ((m + 0.5) / 12) * Math.PI * 2;
          const len = (v / maxRain) * (innerR - 14);
          const r0 = 12;
          return (
            <line
              key={m}
              x1={c + r0 * Math.sin(a)}
              y1={c - r0 * Math.cos(a)}
              x2={c + (r0 + Math.max(1, len)) * Math.sin(a)}
              y2={c - (r0 + Math.max(1, len)) * Math.cos(a)}
              stroke="var(--water)"
              strokeWidth={3}
              strokeLinecap="round"
              opacity={0.75}
            />
          );
        })}
      {MONTHS.map((m, i) => {
        if (i % 3 !== 0) return null;
        const a = (i / 12) * Math.PI * 2;
        const r = innerR - 4;
        return (
          <text key={i} x={c + r * Math.sin(a)} y={c - r * Math.cos(a) + 3} fontSize={8} textAnchor="middle" fill="var(--faint)" fontFamily="var(--mono)">
            {m}
          </text>
        );
      })}
    </svg>
  );
}
