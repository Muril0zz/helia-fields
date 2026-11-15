import { crop, type Priorities, type Scenario, type StrategyResult } from '../engine';
import { useT } from '../i18n';
import type { SimResult } from '../worker/protocol';
import { BandBars } from './Charts';
import { useMoney } from './money';
import { StrategyCard } from './StrategyCard';
import { OutlookCard } from './OutlookCard';
import { AnswerHero } from './AnswerHero';

function Slider({
  name, value, min, max, step, onChange, format, color,
}: {
  name: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; format: (v: number) => string; color?: string;
}) {
  return (
    <label className="slider">
      <span className="slider-name">
        {color && <i className="swatch" style={{ background: color }} />}
        {name}
      </span>
      <span className="slider-val">{format(value)}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} aria-label={name} />
    </label>
  );
}

const colorOf = (r: StrategyResult) => crop(r.strategy.years[0].second ?? r.strategy.years[0].cover ?? r.strategy.years[0].main).color;
const dots = (v: number) => '●'.repeat(v) || '—';

export function LabPanel({
  result, busy, error, scenario, onScenario, priorities, onPriorities, outlook, onOutlook,
}: {
  outlook: boolean;
  onOutlook: (v: boolean) => void;
  result: SimResult | null;
  busy: boolean;
  error: string | null;
  scenario: Scenario;
  onScenario: (s: Scenario) => void;
  priorities: Priorities;
  onPriorities: (p: Priorities) => void;
}) {
  const t = useT();
  const money = useMoney();
  const all = result ? [result.current, ...result.recommendations] : [];
  const rows = (pick: (r: StrategyResult) => { mean: number; p10: number; p90: number }, scale = 1) =>
    all.map((r, i) => {
      const b = pick(r);
      return { label: i === 0 ? t.today : t.option(i), color: i === 0 ? 'var(--faint)' : colorOf(r), mean: b.mean * scale, p10: b.p10 * scale, p90: b.p90 * scale, current: i === 0 };
    });
  const seasons = result?.current.outcomes.length ?? 0;
  return (
    <section className="panel panel-right" aria-label={t.lab}>
      <header className="panel-head">
        <div>
          <div className="eyebrow">{t.lab}</div>
          <h2 className="title">{t.labTitle}</h2>
        </div>
        {result && !busy && (
          <button className="ghost no-print" style={{ padding: '6px 11px', fontSize: 12 }} onClick={() => window.print()}>
            {t.saveReport}
          </button>
        )}
        <div className="status" aria-live="polite">
          <span className={`dot ${busy ? 'busy' : result ? 'live' : ''}`} />
          {busy ? t.simulating : result ? t.status(result.evaluated, result.simulated, seasons, Math.round(result.ms)) : t.waiting}
        </div>
      </header>

      <div className="console">
        <div className="console-grid">
          <div className="section-label">{t.whatIf}</div>
          <Slider name={t.rainfall} value={scenario.rainPct} min={-40} max={20} step={5} onChange={(v) => onScenario({ ...scenario, rainPct: v })} format={(v) => `${v > 0 ? '+' : ''}${v}%`} color="var(--water)" />
          <Slider name={t.warming} value={scenario.tempDelta} min={0} max={3} step={0.5} onChange={(v) => onScenario({ ...scenario, tempDelta: v })} format={(v) => `+${v.toFixed(1)} °C`} color="var(--bad)" />
        </div>
        <div className="console-grid two">
          <div className="section-label" style={{ gridColumn: '1 / -1' }}>{t.matters}</div>
          <Slider name={t.saveWater} value={priorities.water} min={0} max={3} step={1} onChange={(v) => onPriorities({ ...priorities, water: v })} format={dots} color="var(--water)" />
          <Slider name={t.soilHealth} value={priorities.soil} min={0} max={3} step={1} onChange={(v) => onPriorities({ ...priorities, soil: v })} format={dots} color="var(--soil)" />
          <Slider name={t.income} value={priorities.income} min={0} max={3} step={1} onChange={(v) => onPriorities({ ...priorities, income: v })} format={dots} color="var(--income)" />
          <Slider name={t.lowRisk} value={priorities.risk} min={0} max={3} step={1} onChange={(v) => onPriorities({ ...priorities, risk: v })} format={dots} color="var(--risk)" />
        </div>
      </div>

      <div className="panel-scroll">
        {error && <p className="error">{t.couldNot(error)}</p>}
        {!result ? (
          <div className="cards">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="card">
                <div className="card-top">
                  <div className="sk" style={{ width: 112, height: 112, borderRadius: '50%' }} />
                  <div>
                    <div className="sk" style={{ height: 10, width: '40%' }} />
                    <div className="sk" style={{ height: 18, width: '90%', marginTop: 8 }} />
                    <div className="sk" style={{ height: 12, width: '70%', marginTop: 8 }} />
                  </div>
                </div>
                <div className="sk" style={{ height: 60 }} />
                <div className="sk" style={{ height: 90 }} />
              </div>
            ))}
          </div>
        ) : (
          <>
            {!result.current.feasible && <p className="error" style={{ margin: '0 0 10px' }}>{t.infeasible}</p>}
            {result.recommendations.length === 0 && <p className="error" style={{ margin: '0 0 10px' }}>{t.noOptions}</p>}
            <AnswerHero result={result} />
            <OutlookCard result={result} on={outlook} onToggle={onOutlook} />
            <p className="hint" style={{ margin: '0 0 10px' }}>{t.ringHint}</p>
            <div className="cards" style={{ opacity: busy ? 0.6 : 1, transition: 'opacity .2s' }}>
              {all.map((r, i) => (
                <StrategyCard key={r.strategy.id} result={r} current={result.current} rank={i} rain={result.climate.monthlyRain} />
              ))}
            </div>

            <div className="section" style={{ marginTop: 18 }}>
              <div className="section-label">{t.sideBySide}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 18 }}>
                <div>
                  <p className="sub" style={{ marginBottom: 6, color: 'var(--text)' }}>{t.barePerYear}</p>
                  <BandBars rows={rows((r) => r.metrics.bareDays)} unit="d" better="low" seasons={seasons} />
                </div>
                <div>
                  <p className="sub" style={{ marginBottom: 6, color: 'var(--text)' }}>{t.rainOnBare}</p>
                  <BandBars rows={rows((r) => r.metrics.rainOnBareMm)} unit="mm" better="low" seasons={seasons} />
                </div>
                <div>
                  <p className="sub" style={{ marginBottom: 6, color: 'var(--text)' }}>{t.marginHa}</p>
                  <BandBars rows={rows((r) => r.metrics.margin, money.fx)} unit={money.symbol} better="high" seasons={seasons} />
                </div>
                <div>
                  <p className="sub" style={{ marginBottom: 6, color: 'var(--text)' }}>{t.waterMet}</p>
                  <BandBars rows={rows((r) => r.metrics.waterStress, 100)} unit="%" better="high" seasons={seasons} />
                </div>
              </div>
            </div>

            <div className="note">
              <strong style={{ color: 'var(--muted)' }}>{t.howTitle}</strong> {t.how(result.climate.years.first, result.climate.years.last)}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
