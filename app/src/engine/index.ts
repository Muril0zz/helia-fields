import { CROPS as CROP_LIST } from './crops';
import { climatology, prepare, type Climatology, type PreparedSeries } from './climate';
import { explain } from './explain';
import {
  SOW_SHIFTS,
  SowingPlanner,
  candidateStrategies,
  sowDoy,
  distance,
  score,
  simulateStrategy,
  slotDiff,
  strategyId,
  strategyName,
  typicalCalendar,
  metricsFrom,
  type SimulatedStrategy,
} from './strategy';
import { MIN_ANALOGS, isAnalog, outcomePhase, type AnalogSpec, type EnsoPhase } from './enso';
import type { Lang } from './lang';
import type {
  PriceTable,
  Constraints,
  DailySeries,
  Priorities,
  RotationYear,
  Scenario,
  SiteInfo,
  SoilInfo,
  Strategy,
  StrategyResult,
} from './types';

export * from './types';
export { CROPS, crop } from './crops';
export { monthOfDoy } from './explain';
export * from './lang';
export { OUTLOOK, OUTLOOK_SPEC, seasonOni, phaseOf, isAnalog, type EnsoPhase, type AnalogSpec } from './enso';

export interface SimBundle {
  prep: PreparedSeries;
  clim: Climatology;
  planner: SowingPlanner;
  current: SimulatedStrategy;
  candidates: SimulatedStrategy[];
  evaluated: number;
  years: { first: number; last: number };
  ctx: { soil: SoilInfo; site: SiteInfo; constraints: Constraints; prices?: PriceTable };
  gwetAtSowing: number | null;
  ms: number;
}

export function makeStrategy(years: RotationYear[]): Strategy {
  return { id: strategyId(years), name: strategyName(years), years };
}

const PREFILTER_KEEP = 28;

/**
 * Heavy step: simulate the current rotation and every candidate through the
 * historical record under a what-if scenario. Depends on everything except priorities.
 */
export function simulateAll(input: {
  series: DailySeries;
  soil: SoilInfo;
  site: SiteInfo;
  constraints: Constraints;
  scenario: Scenario;
  current: Strategy;
  /** Priorities used only to rank the quick climatology pre-screen. */
  priorities: Priorities;
  /** Local prices and costs in USD (from official sources or the farmer). */
  prices?: PriceTable;
}): SimBundle {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const prep = prepare(input.series, input.scenario);
  const clim = climatology(prep);
  const ctx = { soil: input.soil, site: input.site, constraints: input.constraints, clim, prices: input.prices };
  const planner = new SowingPlanner(clim, ctx, prep);

  // quick screen of every buildable rotation on the typical (climatology) year
  // crops that need new machinery (cotton) only when the farmer accepts it or already grows them
  const grown = new Set(input.current.years.flatMap((y) => [y.main, y.second, y.cover].filter(Boolean) as string[]));
  const allow = (id: string) => Boolean(input.constraints.newEquipment) || !CROP_LIST.find((c) => c.id === id)?.infra || grown.has(id);
  const all = candidateStrategies(planner, input.constraints.irrigation, allow);
  const screened = all
    .map((s) => {
      const t = typicalCalendar(clim, s, planner, ctx);
      const pseudo: SimulatedStrategy = quickSim(s, t);
      return { s, sc: score(pseudo, clim.annualRain, input.priorities).total };
    })
    .sort((a, b) => b.sc - a.sc);

  // keep the best, plus the best option for each main crop so variety survives
  const keep = new Map<string, Strategy>();
  for (const x of screened.slice(0, PREFILTER_KEEP)) keep.set(x.s.id, x.s);
  const seenMain = new Set<string>();
  for (const x of screened) {
    const m = x.s.years[0].main;
    if (!seenMain.has(m)) {
      seenMain.add(m);
      keep.set(x.s.id, x.s);
    }
  }
  // the smallest change a farmer can make: today's rotation plus a cover crop in the gap
  for (const cc of CROP_LIST.filter((c) => c.roles.includes('cover'))) {
    if (input.current.years.every((y) => y.cover)) break;
    const years = input.current.years.map((y) => (y.cover ? y : { ...y, cover: cc.id }));
    const st = makeStrategy(years);
    keep.set(st.id, st);
  }
  // two-year rotations alternating the two best distinct main crops
  const byMain = new Map<string, Strategy>();
  for (const x of screened) if (!byMain.has(x.s.years[0].main)) byMain.set(x.s.years[0].main, x.s);
  const topMains = [...byMain.values()].slice(0, 4);
  for (let i = 0; i < topMains.length; i++)
    for (let j = i + 1; j < topMains.length; j++) {
      const s = makeStrategy([topMains[i].years[0], topMains[j].years[0]]);
      keep.set(s.id, s);
    }

  // give today's rotation its best feasible sowing date too, so the comparison is fair
  const currentVariants = [input.current];
  if (input.current.years.some((y) => y.second)) {
    for (const shift of SOW_SHIFTS) {
      const years = input.current.years.map((y) => (y.second ? { ...y, sowShift: shift } : y));
      const ok = years.every((y) => {
        const base = planner.plan(y.main);
        return planner.yieldAt(y.main, sowDoy(planner, y)) >= base.yieldFactor * 0.8;
      });
      if (ok) currentVariants.push({ ...input.current, years });
    }
  }
  const bestCurrent = currentVariants
    .map((s) => ({ s, sc: score(quickSim(s, typicalCalendar(clim, s, planner, ctx)), clim.annualRain, input.priorities).total }))
    .sort((a, b) => b.sc - a.sc)[0].s;
  const current = simulateStrategy(prep, clim, bestCurrent, planner, ctx);
  const candidates = [...keep.values()]
    .filter((s) => slotDiff(s, input.current) > 0)
    .map((s) => simulateStrategy(prep, clim, s, planner, ctx))
    .filter((r) => r.feasible);

  const firstMainDoy = sowDoy(planner, bestCurrent.years[0]);
  const gw: number[] = [];
  prep.doy.forEach((d, i) => {
    if (d === firstMainDoy) gw.push(prep.gwetRoot[i]);
  });
  const years = { first: prep.year[0], last: prep.year[prep.year.length - 1] };
  const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  return {
    prep,
    clim,
    planner,
    current,
    candidates,
    evaluated: all.length + (keep.size - Math.min(keep.size, all.length)),
    years,
    ctx,
    gwetAtSowing: gw.length ? gw.reduce((a, b) => a + b, 0) / gw.length : null,
    ms: t1 - t0,
  };
}

function quickSim(s: Strategy, t: ReturnType<typeof typicalCalendar>): SimulatedStrategy {
  const o = t.outcomes;
  const one = (f: (x: (typeof o)[number]) => number) => {
    const v = o.reduce((a, x) => a + f(x), 0) / Math.max(1, o.length);
    return { mean: v, p10: v, p90: v };
  };
  return {
    strategy: s,
    feasible: true,
    outcomes: o,
    calendar: t.blocks,
    metrics: {
      bareDays: one((x) => x.bareDays),
      rainOnBareMm: one((x) => x.rainOnBareMm),
      residueT: one((x) => x.residueT),
      nCredit: one((x) => x.nCredit),
      margin: one((x) => x.margin),
      waterStress: one((x) => x.waterStress),
      irrigationMm: one((x) => x.irrigationMm),
      livingRootDays: one((x) => x.livingRootDays),
      failureRate: o.filter((x) => x.failures > 0).length / Math.max(1, o.length),
      families: 1,
      pestBreaks: 0,
    },
  };
}

export interface SeasonPhase {
  /** Calendar year the season was sown. */
  year: number;
  oni: number | null;
  phase: EnsoPhase | null;
}

export interface Ranking {
  current: StrategyResult;
  recommendations: StrategyResult[];
  /** ENSO phase of every simulated season (from the current rotation's sowing dates). */
  seasons: SeasonPhase[];
  /** Set when the ranking used only seasons matching an ENSO outlook. */
  analog: (AnalogSpec & { years: number[]; used: boolean }) | null;
}

/** Same rotation, judged only on the seasons that match an ENSO outlook. */
function onlyAnalogs(sim: SimulatedStrategy, prep: PreparedSeries, spec: AnalogSpec): SimulatedStrategy {
  const outcomes = sim.outcomes.filter((o) => isAnalog(outcomePhase(o, prep).oni, spec));
  return { ...sim, outcomes, metrics: metricsFrom(outcomes, sim.strategy) };
}

/**
 * Light step: score and pick three distinct recommendations for these priorities.
 * With an ENSO outlook, each rotation is judged only on past seasons of that phase.
 */
export function rank(
  bundle: SimBundle,
  priorities: Priorities,
  howMany = 3,
  lang: Lang = 'en',
  outlook: AnalogSpec | null = null,
): Ranking {
  const seasons: SeasonPhase[] = bundle.current.outcomes.map((o) => ({ year: Number(bundle.prep.dates[o.runs[0]?.sowIndex ?? 0]?.slice(0, 4)), ...outcomePhase(o, bundle.prep) }));
  let analog: Ranking['analog'] = null;
  if (outlook) {
    const years = seasons.filter((s) => isAnalog(s.oni, outlook)).map((s) => s.year);
    const used = years.length >= MIN_ANALOGS;
    analog = { ...outlook, years, used };
    if (used) {
      bundle = {
        ...bundle,
        current: onlyAnalogs(bundle.current, bundle.prep, outlook),
        candidates: bundle.candidates.map((c) => onlyAnalogs(c, bundle.prep, outlook)).filter((c) => c.outcomes.length >= MIN_ANALOGS - 1),
      };
    }
  }
  const scored = bundle.candidates
    .map((sim) => ({ sim, sc: score(sim, bundle.clim.annualRain, priorities) }))
    .sort((a, b) => b.sc.total - a.sc.total);
  const picks: typeof scored = [];
  const curTotal = score(bundle.current, bundle.clim.annualRain, priorities).total;
  // the easiest option to adopt: keep today's crops and change only the off-season
  const easiest = scored.find((x) => {
    const a = x.sim.strategy;
    const b = bundle.current.strategy;
    return a.years.length === b.years.length && a.years.every((y, i) => y.main === b.years[i].main && (y.second ?? '') === (b.years[i].second ?? ''));
  });
  const easiestOk = easiest && easiest.sc.total > curTotal + 1 ? easiest : null;
  for (const x of scored) {
    if (picks.length >= (easiestOk ? howMany - 1 : howMany)) break;
    if (x === easiestOk) continue;
    if (distance(x.sim.strategy, bundle.current.strategy) < 0.2) continue;
    // each pick must be a genuinely different approach, not a one-crop swap
    if (picks.some((p) => slotDiff(p.sim.strategy, x.sim.strategy) < 2)) continue;
    if (easiestOk && slotDiff(easiestOk.sim.strategy, x.sim.strategy) < 2) continue;
    picks.push(x);
  }
  // the smallest change leads: it is the one a farmer can adopt next season
  if (easiestOk) picks.unshift(easiestOk);
  const toResult = (sim: SimulatedStrategy, isCurrent: boolean): StrategyResult => ({
    ...sim,
    scores: score(sim, bundle.clim.annualRain, priorities),
    explanation: explain({
      sim,
      current: bundle.current,
      isCurrent,
      priorities,
      constraints: bundle.ctx.constraints,
      soil: bundle.ctx.soil,
      years: bundle.years,
      gwetAtSowing: bundle.gwetAtSowing,
      lang,
    }),
  });
  return {
    current: toResult(bundle.current, true),
    recommendations: picks.map((p) => ({ ...toResult(p.sim, false), tag: p === easiestOk ? ('easiest' as const) : undefined })),
    seasons,
    analog,
  };
}
