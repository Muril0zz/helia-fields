import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { fetchRainForecast, type RainForecast } from '../data/forecast';
import { useLang, useT } from '../i18n';
import { RollingNumber } from './RollingNumber';

/** The next 16 days of rain over the field, against what is normal for the season. */
export function RainComing({ lat, lon, monthlyRain }: { lat: number; lon: number; monthlyRain: number[] }) {
  const t = useT();
  const lang = useLang();
  const [fc, setFc] = useState<RainForecast | null | 'off'>(null);
  useEffect(() => {
    const ctl = new AbortController();
    setFc(null);
    fetchRainForecast(lat, lon, ctl.signal)
      .then((f) => !ctl.signal.aborted && setFc(f))
      .catch(() => !ctl.signal.aborted && setFc('off'));
    return () => ctl.abort();
  }, [lat, lon]);

  if (fc === 'off') return null;
  const loc = lang === 'pt' ? 'pt-BR' : 'en-US';
  if (!fc) {
    return (
      <div className="section">
        <div className="section-label">{t.rainc.title}</div>
        <div className="sk" style={{ height: 96 }} />
      </div>
    );
  }
  const total = fc.days.reduce((a, d) => a + d.mm, 0);
  // normal rain for the same 16 days, from 20 years of NASA POWER
  const normal = fc.days.reduce((a, d) => {
    const m = Number(d.date.slice(5, 7)) - 1;
    const dim = new Date(Number(d.date.slice(0, 4)), m + 1, 0).getDate();
    return a + monthlyRain[m] / dim;
  }, 0);
  const pct = normal > 1 ? (100 * total) / normal : null;
  const max = Math.max(20, ...fc.days.map((d) => d.mm));
  const fmt = (iso: string, opts: Intl.DateTimeFormatOptions) => new Date(`${iso}T12:00:00`).toLocaleDateString(loc, opts);

  return (
    <div className="section rainc">
      <div className="section-label">
        {t.rainc.title} <span>{t.rainc.days}</span>
      </div>
      <div className="rainc-head">
        <div>
          <div className="rainc-v">
            <RollingNumber value={total} /> <small>mm</small>
          </div>
          {pct !== null && (
            <div className={`rainc-pct ${pct >= 120 ? 'wet' : pct <= 70 ? 'dry' : ''}`}>{t.rainc.vsNormal(Math.round(pct))}</div>
          )}
        </div>
        <div className={`rainc-sow ${fc.sowingRain ? 'yes' : 'no'}`}>
          {fc.sowingRain ? t.rainc.sowYes(fmt(fc.sowingRain, { day: 'numeric', month: 'short' })) : t.rainc.sowNo}
        </div>
      </div>
      <div className="rainc-bars" role="img" aria-label={t.rainc.aria(Math.round(total))}>
        {fc.days.map((d, i) => (
          <div key={d.date} className="rainc-col" title={`${fmt(d.date, { weekday: 'short', day: 'numeric', month: 'short' })}: ${d.mm.toFixed(1)} mm · ${d.prob} %`}>
            <motion.i
              initial={{ height: 0 }}
              animate={{ height: `${Math.max(2, (d.mm / max) * 100)}%` }}
              transition={{ duration: 0.2, delay: i * 0.02 }}
              style={{ opacity: 0.35 + 0.65 * (d.prob / 100), background: fc.sowingRain && d.date >= fc.sowingRain && i < fc.days.findIndex((x) => x.date === fc.sowingRain) + 3 ? 'var(--accent)' : 'var(--water)' }}
            />
            <span>{i % 3 === 0 ? fmt(d.date, { day: 'numeric' }) : ''}</span>
          </div>
        ))}
      </div>
      <p className="hint" style={{ margin: '6px 0 0' }}>{t.rainc.source}</p>
    </div>
  );
}
