import { OUTLOOK_SPEC, rank, simulateAll, type DailySeries, type Lang, type SimBundle } from '../engine';
import type { FromWorker, SimResult, ToWorker } from './protocol';
import { waterTrace } from '../engine/water';
import { setMoney } from '../engine/explain';

let series: DailySeries | null = null;
let bundle: SimBundle | null = null;

const post = (m: FromWorker) => (self as unknown as { postMessage(x: FromWorker): void }).postMessage(m);

/** Typical extreme: the hottest/coldest 2 % of days in the daily record (not the smoothed mean). */
function percentile(values: number[], q: number): number {
  const s = Float64Array.from(values).sort();
  return s[Math.min(s.length - 1, Math.max(0, Math.round((s.length - 1) * q)))] ?? 0;
}

function toResult(b: SimBundle, priorities: Parameters<typeof rank>[1], lang: Lang, outlookOn = false): SimResult {
  const base = rank(b, priorities, 3, lang);
  const nino = rank(b, priorities, 3, lang, OUTLOOK_SPEC);
  const r = outlookOn && nino.analog?.used ? nino : base;
  const pick = (x: typeof r.current) => ({ margin: x.metrics.margin.mean, failRate: x.metrics.failureRate, waterMet: x.metrics.waterStress.mean });
  const used = Boolean(nino.analog?.used);
  const outlook = {
    years: nino.analog?.years ?? [],
    total: base.current.outcomes.length,
    used,
    active: outlookOn && used,
    all: pick(base.current),
    analog: used ? pick(nino.current) : null,
    best: used && nino.recommendations[0] ? nino.recommendations[0].strategy : null,
    bestMargin: used && nino.recommendations[0] ? nino.recommendations[0].metrics.margin.mean : null,
  };
  const sowing: Record<string, number> = {};
  [r.current, ...r.recommendations].forEach((s) =>
    s.strategy.years.forEach((y) => {
      sowing[y.main] = b.planner.plan(y.main).doy;
    }),
  );
  return {
    outlook,
    current: r.current,
    recommendations: r.recommendations,
    climate: {
      annualRain: b.clim.annualRain,
      annualEt0: b.clim.annualEt0,
      monthlyRain: b.clim.monthly.prec,
      monthlyEt0: b.clim.monthly.et0,
      monthlyTmean: b.clim.monthly.tmean,
      hottestTmax: percentile(b.prep.tmax, 0.98),
      coldestTmin: percentile(b.prep.tmin, 0.02),
      years: b.years,
      gwetAtSowing: b.gwetAtSowing,
      rainLimited: b.planner.isRainLimited,
    },
    sowing,
    evaluated: b.evaluated,
    simulated: b.candidates.length + 1,
    ms: b.ms,
  };
}

self.onmessage = (e: MessageEvent<ToWorker>) => {
  const m = e.data;
  try {
    if (m.type === 'load') {
      series = m.series;
      bundle = null;
      post({ type: 'loaded', id: m.id });
    } else if (m.type === 'simulate') {
      if (!series) throw new Error('no weather series loaded');
      setMoney(m.req.money);
      bundle = simulateAll({ series, ...m.req });
      post({ type: 'result', id: m.id, result: toResult(bundle, m.req.priorities, m.req.lang ?? 'en', m.req.outlook) });
    } else if (m.type === 'trace') {
      if (!bundle) throw new Error('nothing simulated yet');
      const sim = [bundle.current, ...bundle.candidates].find((c) => c.strategy.id === m.strategyId) ?? bundle.current;
      const prep = bundle.prep;
      const yearOf = (o: (typeof sim.outcomes)[number]) => Number(prep.dates[o.runs[0]?.sowIndex ?? 0].slice(0, 4));
      const years = sim.outcomes.map(yearOf);
      let k = years.indexOf(m.year);
      if (k < 0) k = years.length - 1;
      const o = sim.outcomes[k];
      const from = Math.max(0, (o.runs[0]?.sowIndex ?? 0) - 25);
      const nextSow = sim.outcomes[k + 1]?.runs[0]?.sowIndex;
      const to = nextSow !== undefined ? nextSow - 26 : from + 364;
      const runs = sim.outcomes.flatMap((x) => x.runs);
      const tr = waterTrace(prep, runs, bundle.ctx.soil, from, to);
      post({ type: 'trace', id: m.id, trace: { ...tr, year: years[k], years } });
    } else if (m.type === 'rank') {
      if (!bundle) throw new Error('nothing simulated yet');
      if (m.money) setMoney(m.money);
      post({ type: 'result', id: m.id, result: toResult(bundle, m.priorities, m.lang ?? 'en', m.outlook) });
    }
  } catch (err) {
    post({ type: 'error', id: m.id, message: err instanceof Error ? err.message : String(err) });
  }
};
