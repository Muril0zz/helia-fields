import { CROPS, SHARED_PESTS, crop } from './crops';
import type { Climatology, PreparedSeries } from './climate';
import { simulateYear, type YearContext } from './rotation';
import { bestSowingDoy, climatologyView, runCrop, seasonAnchor, varietyFor } from './simulate';
import type {
  CalendarBlock,
  MetricBand,
  Priorities,
  RotationYear,
  Strategy,
  StrategyResult,
  YearOutcome,
} from './types';

export function band(values: number[]): MetricBand {
  if (!values.length) return { mean: 0, p10: 0, p90: 0 };
  const s = [...values].sort((a, b) => a - b);
  const q = (p: number) => {
    const pos = (s.length - 1) * p;
    const lo = Math.floor(pos);
    const hi = Math.ceil(pos);
    return s[lo] + (s[hi] - s[lo]) * (pos - lo);
  };
  return { mean: values.reduce((a, b) => a + b, 0) / values.length, p10: q(0.1), p90: q(0.9) };
}

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

export function jan1Indices(prep: PreparedSeries): Map<number, number> {
  const jan1 = new Map<number, number>();
  prep.doy.forEach((d, i) => {
    if (d === 1) jan1.set(prep.year[i], i);
  });
  return jan1;
}

/** Accept a sowing date within this share of the best yield if it is earlier (leaves room for a second crop). */
export const SOW_TOLERANCE = 0.97;
const ONSET_RAIN_MM = 25; // 3-day rain that wets the seedbed enough to sow
const ONSET_MAX_WAIT = 45;

/**
 * Decides when each main crop is sown. Rain-limited climates use a per-year onset
 * rule (sow after the first 25 mm in 3 days once the window opens), the way farmers
 * actually start the season; the window itself is chosen by simulating every
 * candidate day over all historical years.
 */
export class SowingPlanner {
  private cache = new Map<string, { doy: number; yieldFactor: number; rainTrigger: boolean }>();
  /** Average yield factor by candidate sowing day, per crop (every 4 days). */
  private curves = new Map<string, { doy: number; y: number }[]>();
  private jan1: Map<number, number> | null;
  private years: number[];
  private rainLimited: boolean;
  constructor(
    private clim: Climatology,
    private ctx: YearContext,
    private prep?: PreparedSeries,
  ) {
    this.jan1 = prep ? jan1Indices(prep) : null;
    this.years = this.jan1 ? [...this.jan1.keys()].sort((a, b) => a - b) : [];
    // hot all year (coldest month ≥ 15 °C) or little seasonal swing: rain sets the calendar
    this.rainLimited = Math.max(...clim.tmean) - Math.min(...clim.tmean) <= 10 || Math.min(...clim.monthly.tmean) >= 15;
  }

  get isRainLimited(): boolean {
    return this.rainLimited;
  }

  private triggers(cropId: string): boolean {
    return this.rainLimited && crop(cropId).tbase > 5 && !this.ctx.constraints.irrigation;
  }

  /** Index at which the crop is really sown, given the nominal window opening. */
  sowIndex(cropId: string, nominal: number): number {
    const p = this.prep;
    if (!p || !this.plan(cropId).rainTrigger) return nominal;
    const last = Math.min(p.prec.length - 3, nominal + ONSET_MAX_WAIT);
    for (let i = nominal; i < last; i++) {
      if (p.prec[i] + p.prec[i + 1] + p.prec[i + 2] >= ONSET_RAIN_MM) return i + 2;
    }
    return last;
  }

  plan(cropId: string) {
    let v = this.cache.get(cropId);
    if (v) return v;
    const rainTrigger = this.triggers(cropId);
    if (!this.prep || !this.jan1 || this.years.length < 3) {
      v = { ...bestSowingDoy(this.clim, cropId, this.ctx.soil, this.ctx.constraints), rainTrigger };
      this.cache.set(cropId, v);
      return v;
    }
    const c = crop(cropId);
    const p = this.prep;
    // provisional entry so sowIndex() can read rainTrigger while we search
    this.cache.set(cropId, { doy: 1, yieldFactor: 0, rainTrigger });
    const evalYears = this.years.slice(0, -1);
    const coolTemperate = !this.rainLimited && c.tbase <= 5;
    const falling = (d: number) => this.clim.tmean[(d - 1 + 30) % 365] < this.clim.tmean[d - 1];
    const search = (autumnOnly: boolean) => {
      const out: { doy: number; y: number }[] = [];
      for (let d = 1; d <= 365; d += 4) {
        if (this.clim.tmean[d - 1] < c.tsow) continue;
        // winter-type cereals and oilseeds are sown as temperatures fall (autumn)
        if (autumnOnly && !falling(d)) continue;
        let acc = 0;
        let n = 0;
        for (const yr of evalYears) {
          const nominal = this.jan1!.get(yr)! + d - 1;
          const sow = this.sowIndex(cropId, nominal);
          if (sow + c.maxDays >= p.dates.length) continue;
          const r = runCrop(p, cropId, 'main', sow, this.ctx.soil, {
            bound: sow + c.maxDays + 1,
            constraints: this.ctx.constraints,
            ...varietyFor(this.clim, c, d),
          });
          acc += r.run.yieldFactor;
          n++;
        }
        if (n) out.push({ doy: d, y: acc / n });
      }
      return out;
    };
    let results = search(coolTemperate);
    if (coolTemperate && Math.max(0, ...results.map((r) => r.y)) < 0.5) results = search(false);
    this.curves.set(cropId, results);
    if (!results.length) {
      v = { doy: 1, yieldFactor: 0, rainTrigger };
    } else {
      const best = Math.max(...results.map((r) => r.y));
      const anchor = seasonAnchor(this.clim, c);
      const ordered = [...results].sort((a, b) => ((a.doy - anchor + 365) % 365) - ((b.doy - anchor + 365) % 365));
      const pick = ordered.find((r) => r.y >= best * SOW_TOLERANCE) ?? ordered[0];
      v = { doy: pick.doy, yieldFactor: pick.y, rainTrigger };
    }
    this.cache.set(cropId, v);
    return v;
  }

  /** Average yield factor if the crop is sown on this day of year (nearest evaluated day). */
  yieldAt(cropId: string, doy: number): number {
    const plan = this.plan(cropId);
    const curve = this.curves.get(cropId);
    if (!curve || !curve.length) return plan.yieldFactor;
    let best = curve[0];
    let dist = Infinity;
    for (const pt of curve) {
      const dd = Math.min(Math.abs(pt.doy - doy), 365 - Math.abs(pt.doy - doy));
      if (dd < dist) {
        dist = dd;
        best = pt;
      }
    }
    // days the crop cannot be sown at all (too cold) were never evaluated
    return dist > 6 ? 0 : best.y;
  }
}

/** Day of year a rotation year's main crop is sown (single-crop optimum minus any shift). */
export function sowDoy(planner: SowingPlanner, ry: RotationYear): number {
  const d = planner.plan(ry.main).doy - (ry.sowShift ?? 0);
  return ((d - 1 + 365 * 2) % 365) + 1;
}

export function strategyCrops(s: Strategy): string[] {
  return s.years.flatMap((y) => [y.main, y.second, y.cover].filter(Boolean) as string[]);
}

export function pestConflicts(s: Strategy): { pair: string; why: string; a: string; b: string; key: string }[] {
  const seq = s.years.flatMap((y) => [y.main, y.second].filter(Boolean) as string[]);
  const out: { pair: string; why: string; a: string; b: string; key: string }[] = [];
  for (let i = 0; i < seq.length; i++) {
    const a = seq[i];
    const b = seq[(i + 1) % seq.length];
    if (seq.length === 1 && a !== b) continue;
    const key = `${a}>${b}`;
    const why = SHARED_PESTS[key];
    if (why) out.push({ pair: `${crop(a).name} → ${crop(b).name}`, why, a, b, key });
  }
  return out;
}

/** Typical-year calendar from the smoothed climatology. */
export function typicalCalendar(clim: Climatology, s: Strategy, planner: SowingPlanner, ctx: YearContext) {
  const view = climatologyView(clim);
  const blocks: CalendarBlock[] = [];
  const outcomes: YearOutcome[] = [];
  let residue = 0;
  // two passes so residue reaches a steady state before we read the calendar
  for (let pass = 0; pass < 2; pass++) {
    s.years.forEach((ry, k) => {
      const doy = sowDoy(planner, ry);
      const nextDoy = sowDoy(planner, s.years[(k + 1) % s.years.length]);
      const start = doy - 1;
      const next = nextDoy - 1 + 365;
      const sim = simulateYear(view, start, next, ry, ctx, residue);
      residue = sim.residueOut;
      if (pass === 1) {
        outcomes.push(sim.outcome);
        sim.blocks.forEach((b) =>
          blocks.push({ cropId: b.cropId, role: b.role, startDoy: ((start + b.start) % 365) + 1, days: b.days, yearIndex: k }),
        );
      }
    });
  }
  return { blocks, outcomes };
}

export interface SimulatedStrategy {
  strategy: StrategyResult['strategy'];
  feasible: boolean;
  outcomes: YearOutcome[];
  calendar: CalendarBlock[];
  metrics: StrategyResult['metrics'];
}

/** Run a rotation continuously through every historical year in the series. */
export function simulateStrategy(
  prep: PreparedSeries,
  clim: Climatology,
  s: Strategy,
  planner: SowingPlanner,
  ctx: YearContext,
): SimulatedStrategy {
  const jan1 = jan1Indices(prep);
  const years = [...jan1.keys()].sort((a, b) => a - b);
  const outcomes: YearOutcome[] = [];
  let residue = 0;
  const L = s.years.length;
  for (let yi = 0; yi < years.length - 1; yi++) {
    const k = yi % L;
    const ry = s.years[k];
    const nextMain = s.years[(k + 1) % L].main;
    const nextRy = s.years[(k + 1) % L];
    const start = planner.sowIndex(ry.main, jan1.get(years[yi])! + sowDoy(planner, ry) - 1);
    const next = planner.sowIndex(nextMain, jan1.get(years[yi + 1])! + sowDoy(planner, nextRy) - 1);
    if (next >= prep.dates.length - 1 || next - start < 120) break;
    const sim = simulateYear(prep, start, next, ry, ctx, residue);
    residue = sim.residueOut;
    if (yi >= L) outcomes.push(sim.outcome); // first cycle is warm-up for residue
  }
  const typical = typicalCalendar(clim, s, planner, ctx);
  const mainYields = s.years.map((y) => planner.yieldAt(y.main, sowDoy(planner, y)));
  const feasible = outcomes.length > 0 && mainYields.every((y) => y >= 0.35);
  return {
    strategy: s,
    feasible,
    outcomes,
    calendar: typical.blocks,
    metrics: metricsFrom(outcomes, s),
  };
}

/** Season-by-season outcomes → distribution metrics (all seasons, or only the analog ones). */
export function metricsFrom(outcomes: YearOutcome[], s: Strategy): StrategyResult['metrics'] {
  return {
    bareDays: band(outcomes.map((o) => o.bareDays)),
    rainOnBareMm: band(outcomes.map((o) => o.rainOnBareMm)),
    residueT: band(outcomes.map((o) => o.residueT)),
    nCredit: band(outcomes.map((o) => o.nCredit)),
    margin: band(outcomes.map((o) => o.margin)),
    waterStress: band(outcomes.map((o) => o.waterStress)),
    irrigationMm: band(outcomes.map((o) => o.irrigationMm)),
    livingRootDays: band(outcomes.map((o) => o.livingRootDays)),
    failureRate: outcomes.length ? outcomes.filter((o) => o.failures > 0).length / outcomes.length : 1,
    families: new Set(strategyCrops(s).map((id) => crop(id).family)).size,
    pestBreaks: pestConflicts(s).length,
  };
}

/** Absolute 0–100 scores so numbers mean the same thing at every location. */
export function score(sim: SimulatedStrategy, annualRain: number, priorities: Priorities) {
  const m = sim.metrics;
  const water = clamp(100 * m.waterStress.mean - m.irrigationMm.mean / 8);
  const soil = clamp(
    30 * (m.livingRootDays.mean / 365) +
      25 * Math.min(1, m.residueT.mean / 14) +
      25 * Math.max(0, 1 - m.rainOnBareMm.mean / Math.max(200, annualRain * 0.6)) +
      10 * Math.min(1, m.nCredit.mean / 100) +
      10 * Math.min(1, (m.families - 1) / 2) -
      8 * m.pestBreaks,
  );
  const income = clamp(50 + m.margin.mean / 30);
  const spread = Math.abs(m.margin.p90 - m.margin.p10);
  const risk = clamp(100 * (1 - m.failureRate) - spread / 40);
  const wsum = priorities.water + priorities.soil + priorities.income + priorities.risk || 1;
  const total =
    (water * priorities.water + soil * priorities.soil + income * priorities.income + risk * priorities.risk) / wsum;
  return { water, soil, income, risk, total };
}

/** Every rotation the catalog can build for this place, before simulation. */
export function candidateStrategies(planner: SowingPlanner, irrigation: boolean, allow: (cropId: string) => boolean = () => true): Strategy[] {
  // Tropical soybean regions restrict a second soybean crop to control Asian rust.
  const tropicalSoyRules = planner.isRainLimited;
  const mains = CROPS.filter((c) => c.roles.includes('main'))
    .filter((c) => irrigation || !c.needsIrrigation)
    // pearl millet grain belongs to hot, rain-limited seasons (Sahel, Indian arid zones)
    .filter((c) => c.id !== 'pmillet' || planner.isRainLimited)
    .filter((c) => allow(c.id))
    .filter((c) => planner.plan(c.id).yieldFactor >= 0.5);
  const seconds = [undefined, ...CROPS.filter((c) => c.roles.includes('second') && allow(c.id)).map((c) => c.id)];
  const covers = [undefined, ...CROPS.filter((c) => c.roles.includes('cover')).map((c) => c.id)];
  const out: Strategy[] = [];
  for (const m of mains) {
    for (const s of seconds) {
      if (s === m.id) continue;
      if (s === 'soy' && tropicalSoyRules) continue;
      for (const c of covers) {
        const years = [{ main: m.id, second: s, cover: c }];
        out.push({ id: strategyId(years), name: strategyName(years), years });
        if (s) {
          // earlier main-crop sowing variants that leave room for the second crop
          const base = planner.plan(m.id);
          for (const shift of SOW_SHIFTS) {
            const doy = ((base.doy - shift - 1 + 730) % 365) + 1;
            if (planner.yieldAt(m.id, doy) < base.yieldFactor * 0.8) continue;
            const ys = [{ main: m.id, second: s, cover: c, sowShift: shift }];
            out.push({ id: strategyId(ys), name: strategyName(ys), years: ys });
          }
        }
      }
    }
  }
  return out;
}

export function strategyId(years: Strategy['years']): string {
  return years.map((y) => [y.main, y.second ?? '-', y.cover ?? '-'].join('+') + (y.sowShift ? `@-${y.sowShift}` : '')).join('|');
}

/** Days earlier than the single-crop optimum that the main crop may be sown. */
export const SOW_SHIFTS = [25, 50, 75, 100];

export function strategyName(years: Strategy['years']): string {
  return years
    .map((y) => {
      const parts = [crop(y.main).name.replace(/ \(.*\)/, '')];
      if (y.second) parts.push(crop(y.second).name.replace(/ \(.*\)/, ''));
      if (y.cover) parts.push(crop(y.cover).name.replace(/ \(.*\)/, ''));
      else parts.push('fallow');
      return parts.join(' → ');
    })
    .join(' / ');
}

/** Number of slots (main/second/cover per year) that differ; different lengths count as 3. */
export function slotDiff(a: Strategy, b: Strategy): number {
  if (a.years.length !== b.years.length) return 3;
  let d = 0;
  a.years.forEach((y, i) => {
    const z = b.years[i];
    if (y.main !== z.main) d++;
    if ((y.second ?? '') !== (z.second ?? '')) d++;
    if ((y.cover ?? '') !== (z.cover ?? '')) d++;
  });
  return d;
}

/** How different two rotations are: share of crop slots that differ. */
export function distance(a: Strategy, b: Strategy): number {
  const sa = new Set(strategyCrops(a));
  const sb = new Set(strategyCrops(b));
  const union = new Set([...sa, ...sb]);
  let inter = 0;
  sa.forEach((x) => sb.has(x) && inter++);
  return 1 - inter / union.size;
}
