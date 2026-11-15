import { useEffect, useMemo, useRef, useState } from 'react';
import { crop, cropName, rotationName } from '../engine';
import type { WaterTrace } from '../engine/water';
import { useLang, useT } from '../i18n';
import type { EngineClient } from '../worker/client';
import type { SimResult } from '../worker/protocol';
import { RollingNumber } from './RollingNumber';

type Trace = WaterTrace & { year: number; years: number[] };

const W = 340;
const TOP = 74; // soil surface
const BOT = 236; // 1.5 m
const H = 262;

/** Pearson correlation, for the "our bucket vs NASA" agreement line. */
function corr(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 10) return NaN;
  const ma = a.reduce((x, y) => x + y, 0) / n;
  const mb = b.reduce((x, y) => x + y, 0) / n;
  let sab = 0;
  let saa = 0;
  let sbb = 0;
  for (let i = 0; i < n; i++) {
    sab += (a[i] - ma) * (b[i] - mb);
    saa += (a[i] - ma) ** 2;
    sbb += (b[i] - mb) ** 2;
  }
  return sab / Math.sqrt(saa * sbb || 1);
}

/**
 * Water under the field, day by day through one real season: rain falls, the profile fills,
 * roots grow down and drink, bare months dry out, storms drain past the roots.
 */
export function SoilColumn({ client, result, ninoYears, autoPlay = false }: { client: EngineClient; result: SimResult; ninoYears: number[]; autoPlay?: boolean }) {
  const t = useT();
  const lang = useLang();
  const options = useMemo(
    () => [result.current, ...result.recommendations].map((r, i) => ({ id: r.strategy.id, label: i === 0 ? t.today : t.option(i), name: rotationName(r.strategy.years, lang) })),
    [result, t, lang],
  );
  const [which, setWhich] = useState(0);
  const [year, setYear] = useState<number | null>(null);
  const [trace, setTrace] = useState<Trace | null>(null);
  const [day, setDay] = useState(0);
  const [playing, setPlaying] = useState(false);
  const strategyId = options[Math.min(which, options.length - 1)]?.id;

  useEffect(() => {
    if (!strategyId) return;
    let live = true;
    client
      .trace(strategyId, year ?? 9999)
      .then((tr) => {
        if (!live) return;
        setTrace(tr);
        setDay((d) => (autoPlay ? 0 : Math.min(d, tr.days.length - 1)));
        if (autoPlay && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) setPlaying(true);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, strategyId, year, result]);

  // play: one day per frame at ~30 fps (a season in ~12 s)
  const raf = useRef(0);
  useEffect(() => {
    if (!playing || !trace) return;
    let last = performance.now();
    const step = (now: number) => {
      if (now - last >= 33) {
        last = now;
        setDay((d) => {
          if (d >= trace.days.length - 1) {
            setPlaying(false);
            return d;
          }
          return d + 1;
        });
      }
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [playing, trace]);

  if (!trace || !trace.days.length) {
    return (
      <div className="section">
        <div className="section-label">{t.water.title}</div>
        <div className="sk" style={{ height: 260 }} />
      </div>
    );
  }

  const d = trace.days[Math.min(day, trace.days.length - 1)];
  const cross = Number(trace.days[0].date.slice(5, 7)) >= 7;
  const label = (y: number) => (cross ? `${y}/${String((y + 1) % 100).padStart(2, '0')}` : String(y));
  const k = trace.years.indexOf(trace.year);
  const waterTop = BOT - d.fill * (BOT - TOP);
  const cropC = d.cropId ? crop(d.cropId).color : null;
  const drops = Math.min(14, Math.round(d.rain / 2.5));
  const stems = 11;
  const n = trace.days.length;
  // season strip
  const SX = (i: number) => 8 + (i / Math.max(1, n - 1)) * (W - 16);
  const fillPath = trace.days.map((x, i) => `${i ? 'L' : 'M'}${SX(i).toFixed(1)},${(60 - x.fill * 46).toFixed(1)}`).join(' ');
  const nasaPath = trace.days
    .map((x, i) => (x.gwet == null ? '' : `${i && trace.days[i - 1].gwet != null ? 'L' : 'M'}${SX(i).toFixed(1)},${(60 - Math.max(0, Math.min(1, (x.gwet - 0.35) / 0.4)) * 46).toFixed(1)}`))
    .join(' ');
  const paired = trace.days.filter((x) => x.gwet != null);
  const r = corr(
    paired.map((x) => x.fill),
    paired.map((x) => x.gwet as number),
  );
  const date = new Date(`${d.date}T12:00:00Z`).toLocaleDateString(lang === 'pt' ? 'pt-BR' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  const mm = Math.round(d.fill * trace.capacity);

  return (
    <div className="section soilcol">
      <div className="section-label">{t.water.title}</div>
      <div className="soilcol-controls">
        <div className="seg" role="group" aria-label={t.water.which}>
          {options.map((o, i) => (
            <button key={o.id} aria-pressed={which === i} onClick={() => setWhich(i)} title={o.name}>
              {o.label}
            </button>
          ))}
        </div>
        <div className="soilcol-year">
          <button className="ghost mini" onClick={() => setYear(trace.years[Math.max(0, k - 1)])} disabled={k <= 0} aria-label={t.water.prev}>‹</button>
          <span>
            {label(trace.year)}
            {ninoYears.includes(trace.year) && <em> · El Niño</em>}
          </span>
          <button className="ghost mini" onClick={() => setYear(trace.years[Math.min(trace.years.length - 1, k + 1)])} disabled={k >= trace.years.length - 1} aria-label={t.water.next}>›</button>
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="soilcol-svg" role="img" aria-label={t.water.aria(date, Math.round(d.fill * 100))}>
        <defs>
          <linearGradient id="soilg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#5a3b22" />
            <stop offset="1" stopColor="#2b1c12" />
          </linearGradient>
          <clipPath id="soilclip">
            <rect x="0" y={TOP} width={W} height={BOT - TOP} />
          </clipPath>
        </defs>
        {/* sky and rain */}
        <rect x="0" y="0" width={W} height={TOP} fill={d.rain > 1 ? '#0e1c3a' : '#0b1530'} />
        {d.rain <= 1 && d.et > 3.5 && <circle cx={W - 34} cy={24} r={11} fill="#FFC93C" opacity={0.85} />}
        {Array.from({ length: drops }, (_, i) => {
          const x = 14 + ((i * 97) % (W - 28));
          return <line key={i} className="drop" x1={x} y1={4} x2={x - 3} y2={16} stroke="#4cb4ff" strokeWidth={2} strokeLinecap="round" style={{ animationDelay: `${(i % 5) * 0.09}s` }} />;
        })}
        {/* crop or bare soil at the surface */}
        {cropC ? (
          Array.from({ length: stems }, (_, i) => {
            const x = 22 + i * ((W - 44) / (stems - 1));
            const h = 6 + d.canopy * 46;
            return (
              <g key={i}>
                <line x1={x} y1={TOP} x2={x} y2={TOP - h} stroke={cropC} strokeWidth={2.5} strokeLinecap="round" />
                <ellipse cx={x - 5} cy={TOP - h * 0.6} rx={5 * (0.4 + d.canopy)} ry={2.2} fill={cropC} />
                <ellipse cx={x + 5} cy={TOP - h * 0.8} rx={5 * (0.4 + d.canopy)} ry={2.2} fill={cropC} />
              </g>
            );
          })
        ) : (
          <rect x="0" y={TOP - 3} width={W} height={3} fill="#ff4d5e" opacity={0.85} />
        )}
        {/* the soil profile and its water */}
        <rect x="0" y={TOP} width={W} height={BOT - TOP} fill="url(#soilg)" />
        <g clipPath="url(#soilclip)">
          <rect x="0" y={waterTop} width={W} height={BOT - waterTop} fill="#2a7bf4" opacity={0.55} className="water-fill" />
          <rect x="0" y={waterTop} width={W} height={2} fill="#7ed3f7" opacity={0.9} className="water-fill" />
        </g>
        {/* roots */}
        {d.root > 0 &&
          Array.from({ length: stems }, (_, i) => {
            const x = 22 + i * ((W - 44) / (stems - 1));
            const depth = TOP + (d.root / trace.depth) * (BOT - TOP);
            return <path key={i} d={`M${x},${TOP} C${x - 6},${(TOP + depth) / 2} ${x + 6},${(TOP + depth) / 2} ${x},${depth}`} stroke="#f3e3c3" strokeWidth={1.2} fill="none" opacity={0.75} />;
          })}
        {/* drainage below the roots */}
        {d.drain > 0.5 &&
          [0.25, 0.5, 0.75].map((f) => <line key={f} className="drain" x1={W * f} y1={BOT + 3} x2={W * f} y2={BOT + 16} stroke="#4cb4ff" strokeWidth={2} strokeLinecap="round" />)}
        <rect x="0" y={BOT} width={W} height={H - BOT} fill="#170f0a" />
        {[0, 0.5, 1, 1.5].map((m) => (
          <text key={m} x={W - 4} y={TOP + (m / trace.depth) * (BOT - TOP) + (m === 0 ? 10 : m === 1.5 ? -3 : 3)} textAnchor="end" className="soilcol-tick">
            {m.toLocaleString(lang === 'pt' ? 'pt-BR' : 'en-US')} m
          </text>
        ))}
        <text x={8} y={BOT + 18} className="soilcol-tick">{d.drain > 0.5 ? t.water.recharge : t.water.below}</text>
        <text x={8} y={TOP + 14} className="soilcol-tag">{d.cropId ? cropName(d.cropId, lang) : t.water.bare}</text>
      </svg>

      <div className="soilcol-readout">
        <button className="obs-play" onClick={() => {
          if (day >= n - 1) setDay(0);
          setPlaying(!playing);
        }} aria-label={playing ? t.obs.pause : t.obs.play}>
          {playing ? (
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><rect x="2" y="1" width="3.5" height="12" rx="1" fill="currentColor" /><rect x="8.5" y="1" width="3.5" height="12" rx="1" fill="currentColor" /></svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 1.5v11l9.5-5.5z" fill="currentColor" /></svg>
          )}
        </button>
        <div className="soilcol-date">{date}</div>
        <div className="soilcol-k">
          <span>{t.water.inSoil}</span>
          <b><RollingNumber value={mm} /> mm</b>
        </div>
        <div className="soilcol-k">
          <span>{t.water.rainToday}</span>
          <b><RollingNumber value={d.rain} decimals={0} /> mm</b>
        </div>
        <div className="soilcol-k">
          <span>{t.water.drink}</span>
          <b><RollingNumber value={d.et} decimals={1} /> mm</b>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${W} 70`}
        className="soilcol-strip"
        onPointerDown={(e) => {
          const el = e.currentTarget;
          const go = (x: number) => {
            const b = el.getBoundingClientRect();
            const sx = ((x - b.left) / b.width) * W;
            setDay(Math.max(0, Math.min(n - 1, Math.round(((sx - 8) / (W - 16)) * (n - 1)))));
          };
          setPlaying(false);
          go(e.clientX);
          el.setPointerCapture(e.pointerId);
          el.onpointermove = (ev) => go(ev.clientX);
          el.onpointerup = () => (el.onpointermove = null);
        }}
        role="slider"
        aria-valuemin={0}
        aria-valuemax={n - 1}
        aria-valuenow={day}
        aria-label={t.water.timeline}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') setDay((x) => Math.min(n - 1, x + 7));
          if (e.key === 'ArrowLeft') setDay((x) => Math.max(0, x - 7));
        }}
      >
        {/* crop band */}
        {trace.days.map((x, i) =>
          i % 3 === 0 ? <rect key={i} x={SX(i)} y={63} width={(3 * (W - 16)) / n + 0.5} height={5} fill={x.cropId ? crop(x.cropId).color : '#ff4d5e'} opacity={x.cropId ? 0.9 : 0.7} /> : null,
        )}
        {trace.days.map((x, i) => (x.rain > 4 ? <rect key={`r${i}`} x={SX(i)} y={14 - Math.min(12, x.rain / 5)} width={1.2} height={Math.min(12, x.rain / 5)} fill="#4cb4ff" opacity={0.7} /> : null))}
        <path d={nasaPath} fill="none" stroke="#FFC93C" strokeWidth={1.3} strokeDasharray="3 3" opacity={0.9} />
        <path d={fillPath} fill="none" stroke="#7ed3f7" strokeWidth={2} />
        <line x1={SX(day)} x2={SX(day)} y1={2} y2={68} stroke="#eaf0ff" strokeWidth={1.5} />
      </svg>
      <p className="hint soilcol-legend">
        <i className="swatch" style={{ background: '#7ed3f7' }} /> {t.water.ours} &nbsp;
        <i className="swatch" style={{ background: '#FFC93C' }} /> {t.water.nasa}
        {Number.isFinite(r) ? ` · ${t.water.agree(r)}` : ''}
      </p>
      <div className="soilcol-totals">
        <span>{t.water.season}</span>
        <span><b>{Math.round(trace.totals.rain).toLocaleString(lang === 'pt' ? 'pt-BR' : 'en-US')}</b> mm {t.water.rainT}</span>
        <span><b>{Math.round(trace.totals.et).toLocaleString(lang === 'pt' ? 'pt-BR' : 'en-US')}</b> mm {t.water.etT}</span>
        <span><b>{Math.round(trace.totals.drain).toLocaleString(lang === 'pt' ? 'pt-BR' : 'en-US')}</b> mm {t.water.drainT}</span>
        <span><b>{trace.totals.stressDays}</b> {t.water.stressT}</span>
      </div>
    </div>
  );
}
