import { motion } from 'framer-motion';
import { useState } from 'react';
import { crop, cropName, rotationName, type StrategyResult } from '../engine';

const cropColor = (id: string) => crop(id).color;
import { useLang, useT } from '../i18n';
import { useMoney } from './money';
import { OrbitRing } from './OrbitRing';
import { RollingNumber } from './RollingNumber';

const TABS = ['why', 'evidence', 'benefits', 'gaps', 'risks'] as const;

const SCORES: { key: 'water' | 'soil' | 'income' | 'risk'; color: string }[] = [
  { key: 'water', color: 'var(--water)' },
  { key: 'soil', color: 'var(--soil)' },
  { key: 'income', color: 'var(--income)' },
  { key: 'risk', color: 'var(--risk)' },
];

export function StrategyCard({
  result,
  current,
  rank,
  rain,
}: {
  result: StrategyResult;
  current: StrategyResult;
  rank: number; // 0 = current, 1.. = recommendation
  rain: number[];
}) {
  const t = useT();
  const lang = useLang();
  const money = useMoney();
  const TAB_LABEL = t.tabs;
  const name = rotationName(result.strategy.years, lang);
  const [tab, setTab] = useState<(typeof TABS)[number]>(rank === 0 ? 'evidence' : 'why');
  const m = result.metrics;
  const c = current.metrics;
  const isCur = rank === 0;
  const crops = [...new Set(result.strategy.years.flatMap((y) => [y.main, y.second, y.cover].filter(Boolean) as string[]))];
  const delta = (v: number, ref: number, betterLow: boolean) => {
    if (isCur || Math.abs(v - ref) < 0.5) return null;
    const good = betterLow ? v < ref : v > ref;
    return <small className={good ? 'delta-good' : 'delta-bad'}> {v > ref ? '▲' : '▼'}</small>;
  };
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, delay: rank * 0.05 }}
      className={`card ${isCur ? 'is-current' : ''} ${rank === 1 ? 'is-best' : ''}`}
      aria-label={isCur ? 'Your current rotation' : `Recommendation ${rank}`}
    >
      <div className="card-top">
        <OrbitRing blocks={result.calendar} years={result.strategy.years.length} rain={rain} label={name} />
        <div style={{ minWidth: 0 }}>
          <div className={`card-rank ${rank === 1 ? 'best' : ''}`}>{isCur ? t.rankToday : result.tag === 'easiest' ? t.rankEasiest : rank === 1 ? t.rankBest : t.option(rank)}</div>
          <h3 className="card-name">
            {name.split(' / ').map((line, i, arr) => (
              <span key={i} style={{ display: 'block' }}>
                {arr.length > 1 && <span className="card-year">{t.yearTag}{i + 1}</span>}
                {line}
              </span>
            ))}
          </h3>
          <p className="card-head">{result.explanation.headline}</p>
          <div className="total">
            <span className="total-v">
              <RollingNumber value={result.scores.total} />
            </span>
            <span className="total-k">{t.fit}</span>
          </div>
        </div>
      </div>

      <div className="legend">
        {crops.map((id) => (
          <span key={id}>
            <i className="swatch" style={{ background: cropColor(id) }} />
            {cropName(id, lang)}
          </span>
        ))}
        <span>
          <i className="swatch" style={{ background: 'var(--bare)', height: 4 }} />
          {t.bareSoil}
        </span>
        <span>
          <i className="swatch" style={{ background: 'var(--water)', width: 3 }} />
          {t.rainWord}
        </span>
      </div>

      <div className="bars">
        {SCORES.map((s) => (
          <div className="bar-row" key={s.key}>
            <span>{t.scores[s.key]}</span>
            <div className="bar">
              <span style={{ width: `${result.scores[s.key]}%`, background: s.color, transition: 'width .22s cubic-bezier(.2,.8,.2,1)' }} />
            </div>
            <span className="bar-num">
              <RollingNumber value={result.scores[s.key]} />
            </span>
          </div>
        ))}
      </div>

      <div className="facts">
        <div className="fact">
          <div className="fact-k">{t.facts.bare}</div>
          <div className="fact-v">
            <RollingNumber value={m.bareDays.mean} />
            <small> {t.dyr}</small>
            {delta(m.bareDays.mean, c.bareDays.mean, true)}
          </div>
        </div>
        <div className="fact">
          <div className="fact-k">{t.facts.straw}</div>
          <div className="fact-v">
            <RollingNumber value={m.residueT.mean} decimals={1} />
            <small> t/ha</small>
            {delta(m.residueT.mean, c.residueT.mean, false)}
          </div>
        </div>
        <div className="fact">
          <div className="fact-k">{t.facts.margin}</div>
          <div className="fact-v">
            <RollingNumber value={money.local(m.margin.mean)} prefix={`${money.symbol} `} />
            {delta(m.margin.mean, c.margin.mean, false)}
          </div>
        </div>
        <div className="fact">
          <div className="fact-k">{t.facts.water}</div>
          <div className="fact-v">
            <RollingNumber value={m.waterStress.mean * 100} />
            <small>%</small>
            {delta(m.waterStress.mean * 100, c.waterStress.mean * 100, false)}
          </div>
        </div>
        <div className="fact">
          <div className="fact-k">{t.facts.n}</div>
          <div className="fact-v">
            <RollingNumber value={m.nCredit.mean} />
            <small> kg/ha</small>
            {delta(m.nCredit.mean, c.nCredit.mean, false)}
          </div>
        </div>
        <div className="fact">
          <div className="fact-k">{t.facts.bad}</div>
          <div className="fact-v">
            <RollingNumber value={m.failureRate * 100} />
            <small>%</small>
            {delta(m.failureRate * 100, c.failureRate * 100, true)}
          </div>
        </div>
      </div>

      <div className="tabs" role="tablist" aria-label="Explanation">
        {TABS.map((k) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>
            {TAB_LABEL[k]}
            {k === 'risks' || k === 'gaps' ? ` · ${result.explanation[k].length}` : ''}
          </button>
        ))}
      </div>
      <div className="tab-body" role="tabpanel">
        <ul>
          {result.explanation[tab].map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      </div>
      {/* the printed report shows every section, not just the open tab */}
      <div className="print-only">
        {TABS.map((k) => (
          <div key={k} style={{ marginTop: 6 }}>
            <strong>{TAB_LABEL[k]}</strong>
            <ul>
              {result.explanation[k].map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </motion.article>
  );
}
