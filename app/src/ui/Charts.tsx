import type { NdviPoint } from '../data/modis';
import { useLang, useT } from '../i18n';

const MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

/** Monthly rain (bars) against crop-reference demand ET0 (line). */
export function WaterBudget({ rain, et0, height = 92 }: { rain: number[]; et0: number[]; height?: number }) {
  const w = 320;
  const h = height;
  const pad = { l: 4, r: 4, t: 8, b: 16 };
  const max = Math.max(1, ...rain, ...et0);
  const bw = (w - pad.l - pad.r) / 12;
  const y = (v: number) => pad.t + (h - pad.t - pad.b) * (1 - v / max);
  const line = et0.map((v, i) => `${i ? 'L' : 'M'} ${pad.l + bw * (i + 0.5)} ${y(v)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} role="img" aria-label="Monthly rain versus evaporative demand">
      {rain.map((v, i) => {
        const deficit = v < et0[i] * 0.5;
        return (
          <rect
            key={i}
            x={pad.l + bw * i + 3}
            y={y(v)}
            width={bw - 6}
            height={Math.max(1, h - pad.b - y(v))}
            rx={2}
            fill={deficit ? 'rgba(76,180,255,0.35)' : 'var(--water)'}
          >
            <title>{`Rain ${Math.round(v)} mm vs demand ${Math.round(et0[i])} mm`}</title>
          </rect>
        );
      })}
      <path d={line} fill="none" stroke="var(--warn)" strokeWidth={2} />
      {MONTHS.map((m, i) => (
        <text key={i} x={pad.l + bw * (i + 0.5)} y={h - 3} fontSize={9} textAnchor="middle" fill="var(--faint)" fontFamily="var(--mono)">
          {m}
        </text>
      ))}
    </svg>
  );
}

/** MODIS NDVI time series with detected green-up peaks. */
export function NdviSpark({ points, peaks, height = 70 }: { points: NdviPoint[]; peaks: NdviPoint[]; height?: number }) {
  const w = 320;
  const h = height;
  if (points.length < 2) return null;
  const t0 = Date.parse(points[0].date);
  const t1 = Date.parse(points[points.length - 1].date);
  const x = (d: string) => 4 + ((Date.parse(d) - t0) / Math.max(1, t1 - t0)) * (w - 8);
  const y = (v: number) => 6 + (h - 20) * (1 - Math.max(0, Math.min(1, v)));
  const path = points.map((p, i) => `${i ? 'L' : 'M'} ${x(p.date).toFixed(1)} ${y(p.ndvi).toFixed(1)}`).join(' ');
  const years = [...new Set(points.map((p) => p.date.slice(0, 4)))];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} role="img" aria-label="MODIS NDVI time series">
      <line x1={4} x2={w - 4} y1={y(0.35)} y2={y(0.35)} stroke="var(--bare)" strokeDasharray="3 4" strokeWidth={1} opacity={0.6} />
      <path d={path} fill="none" stroke="var(--good)" strokeWidth={1.8} strokeLinejoin="round" />
      {peaks.map((p, i) => (
        <circle key={i} cx={x(p.date)} cy={y(p.ndvi)} r={3.2} fill="var(--bg)" stroke="var(--accent)" strokeWidth={1.8}>
          <title>{`Green-up peak ${p.date}, NDVI ${p.ndvi.toFixed(2)}`}</title>
        </circle>
      ))}
      {years.map((yr) => {
        const d = `${yr}-01-01`;
        if (Date.parse(d) < t0 || Date.parse(d) > t1 - 60 * 86_400_000) return null;
        return (
          <g key={yr}>
            <line x1={x(d)} x2={x(d)} y1={4} y2={h - 14} stroke="var(--line)" />
            <text x={x(d) + 3} y={h - 3} fontSize={9} fill="var(--faint)" fontFamily="var(--mono)">
              {yr}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** Horizontal comparison bars with a p10–p90 whisker. */
export function BandBars({
  rows,
  unit,
  better,
  seasons,
}: {
  seasons: number;
  rows: { label: string; color: string; mean: number; p10: number; p90: number; current?: boolean }[];
  unit: string;
  better: 'low' | 'high';
}) {
  const t = useT();
  const lang = useLang();
  const max = Math.max(1, ...rows.map((r) => Math.max(r.p90, r.mean)));
  const min = Math.min(0, ...rows.map((r) => Math.min(r.p10, r.mean)));
  const span = max - min || 1;
  const pos = (v: number) => ((v - min) / span) * 100;
  return (
    <div style={{ display: 'grid', gap: 7 }}>
      {rows.map((r) => (
        <div key={r.label} style={{ display: 'grid', gridTemplateColumns: '92px 1fr 64px', gap: 8, alignItems: 'center', fontSize: 12 }}>
          <span style={{ color: r.current ? 'var(--muted)' : 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.label}</span>
          <div style={{ position: 'relative', height: 14 }}>
            <div style={{ position: 'absolute', top: 6, height: 2, left: `${pos(r.p10)}%`, width: `${Math.max(0.5, pos(r.p90) - pos(r.p10))}%`, background: 'var(--line-strong)' }} />
            <div
              style={{
                position: 'absolute', top: 2, height: 10, left: `${Math.min(pos(0), pos(r.mean))}%`,
                width: `${Math.abs(pos(r.mean) - pos(0))}%`, borderRadius: 3, background: r.color, opacity: r.current ? 0.55 : 1,
                transition: 'left .22s, width .22s',
              }}
            />
          </div>
          <span style={{ fontFamily: 'var(--mono)', textAlign: 'right' }}>
            {Math.round(r.mean).toLocaleString(lang === 'pt' ? 'pt-BR' : 'en-US')}
            <small style={{ color: 'var(--faint)' }}> {unit}</small>
          </span>
        </div>
      ))}
      <span className="hint" style={{ margin: 0 }}>
        {t.bandHint(seasons, better)}
      </span>
    </div>
  );
}
