import { motion } from 'framer-motion';
import { rotationName } from '../engine';
import { useLang } from '../i18n';
import type { SimResult } from '../worker/protocol';
import { RollingNumber } from './RollingNumber';
import { useMoney } from './money';

const TXT = {
  en: { eyebrow: 'Our recommendation', easiest: 'Smallest change · keeps your crops', bare: 'days of bare soil a year', n: 'kg/ha nitrogen left', margin: '/ha indicative margin', straw: 't/ha more straw' },
  pt: { eyebrow: 'Nossa recomendação', easiest: 'Menor mudança · mantém suas culturas', bare: 'dias de solo descoberto por ano', n: 'kg/ha de nitrogênio deixado', margin: '/ha de margem indicativa', straw: 't/ha a mais de palha' },
};

/** The answer first: the top option and what it changes, in three numbers. */
export function AnswerHero({ result }: { result: SimResult }) {
  const lang = useLang();
  const x = TXT[lang];
  const money = useMoney();
  const rec = result.recommendations[0];
  if (!rec) return null;
  const cur = result.current.metrics;
  const m = rec.metrics;
  const stats: { v: number; label: string; good: boolean; dec?: number }[] = [
    { v: m.bareDays.mean - cur.bareDays.mean, label: x.bare, good: m.bareDays.mean <= cur.bareDays.mean },
    { v: m.nCredit.mean - cur.nCredit.mean, label: x.n, good: m.nCredit.mean >= cur.nCredit.mean },
    { v: money.local(m.margin.mean - cur.margin.mean), label: `${money.symbol}${x.margin}`, good: m.margin.mean >= cur.margin.mean },
  ];
  return (
    <motion.section className="answer" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }} aria-label={x.eyebrow}>
      <div className="answer-eyebrow">
        {x.eyebrow}
        {rec.tag === 'easiest' && <span>{x.easiest}</span>}
      </div>
      <h3 className="answer-title">{rotationName(rec.strategy.years, lang)}</h3>
      <div className="answer-stats">
        {stats.map((s) => (
          <div key={s.label}>
            <div className={`answer-v ${s.good ? 'good' : 'warn'}`}>
              <RollingNumber value={s.v} signed decimals={s.dec ?? 0} />
            </div>
            <div className="answer-k">{s.label}</div>
          </div>
        ))}
      </div>
    </motion.section>
  );
}
