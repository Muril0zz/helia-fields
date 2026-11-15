import { crop } from './crops';
import { runCrop, varietyFor, type WeatherView } from './simulate';
import type { Climatology } from './climate';
import { erodibility, slopeFactor } from './soil';
import type {
  PriceTable,
  CalendarBlock,
  Constraints,
  CropRun,
  RotationYear,
  SiteInfo,
  SoilInfo,
  YearOutcome,
} from './types';

export interface YearContext {
  soil: SoilInfo;
  site: SiteInfo;
  constraints: Constraints;
  /** Climatology used to match each crop's variety to the local season. */
  clim?: Climatology;
  /** Local prices and costs (USD); missing entries fall back to the catalog. */
  prices?: PriceTable;
}

const priceOf = (ctx: YearContext, id: string) => ctx.prices?.[id]?.price ?? crop(id).price;
const costOf = (ctx: YearContext, id: string) => ctx.prices?.[id]?.cost ?? crop(id).cost;

function variety(w: WeatherView, ctx: YearContext, cropId: string, sowIndex: number) {
  if (!ctx.clim) return {};
  const doy = w.doy ? w.doy[sowIndex] : (sowIndex % 365) + 1;
  return varietyFor(ctx.clim, crop(cropId), doy);
}

export interface YearSim {
  outcome: YearOutcome;
  blocks: { cropId: string | null; role: CalendarBlock['role']; start: number; days: number }[];
  residueOut: number;
}

const TURNAROUND_SECOND = 7;
const TURNAROUND_COVER = 3;
const DESICCATION_GAP = 10;
const IRRIGATION_COST_PER_MM = 0.35; // USD per mm per ha, pumping energy

/** Indicative second-season potential relative to the main season. */
const SECOND_SEASON_FACTOR = 0.85;

/** First index ≥ from whose 5-day mean temperature allows sowing, within maxWait days. */
function sowableFrom(w: WeatherView, from: number, tsow: number, limit: number, maxWait = 30): number | null {
  for (let i = from; i < Math.min(limit, from + maxWait); i++) {
    let acc = 0;
    let n = 0;
    for (let j = i; j < Math.min(w.tmax.length, i + 5); j++) {
      acc += (w.tmax[j] + w.tmin[j]) / 2;
      n++;
    }
    if (n && acc / n >= tsow) return i;
  }
  return null;
}

/**
 * Simulate one rotation year from the main-crop sowing index (start) up to the next
 * main sowing (next, exclusive): main crop → optional second crop → optional cover.
 */
export function simulateYear(
  w: WeatherView,
  start: number,
  next: number,
  ry: RotationYear,
  ctx: YearContext,
  residueIn: number,
): YearSim {
  const runs: CropRun[] = [];
  const len = next - start;
  const canopy = new Array<number>(len).fill(0);
  const living = new Array<boolean>(len).fill(false);
  const residueAdd = new Array<number>(len).fill(0);
  const blocks: YearSim['blocks'] = [];
  let margin = 0;
  let nCredit = 0;
  let irrigationMm = 0;

  const place = (detail: ReturnType<typeof runCrop>, residueT: number) => {
    const r = detail.run;
    detail.canopy.forEach((cv, k) => {
      const idx = r.sowIndex - start + k;
      if (idx >= 0 && idx < len) {
        canopy[idx] = Math.max(canopy[idx], cv);
        living[idx] = true;
      }
    });
    const hIdx = r.harvestIndex - start;
    if (hIdx >= 0 && hIdx < len) residueAdd[hIdx] += residueT;
    blocks.push({ cropId: r.cropId, role: r.role, start: r.sowIndex - start, days: r.days });
    runs.push(r);
    irrigationMm += r.irrigation;
  };

  // main crop
  const main = crop(ry.main);
  const mainDetail = runCrop(w, ry.main, 'main', start, ctx.soil, {
    bound: next,
    constraints: ctx.constraints,
    ...variety(w, ctx, ry.main, start),
  });
  const mainRun = mainDetail.run;
  margin += priceOf(ctx, ry.main) * main.yieldRef * mainRun.yieldFactor - costOf(ctx, ry.main);
  nCredit += main.nCredit * mainRun.yieldFactor;
  place(mainDetail, main.residue * Math.max(0.3, mainRun.yieldFactor));
  let cursor = mainRun.harvestIndex + 1;

  // second crop
  let secondId: string | null = null;
  if (ry.second) {
    const sc = crop(ry.second);
    const sow = sowableFrom(w, cursor + TURNAROUND_SECOND, sc.tsow, next - DESICCATION_GAP);
    if (sow !== null && next - DESICCATION_GAP - sow >= sc.minDays * 0.8) {
      const d = runCrop(w, ry.second, 'second', sow, ctx.soil, {
        bound: next - DESICCATION_GAP,
        constraints: ctx.constraints,
        ...variety(w, ctx, ry.second, sow),
      });
      const intercropPenalty = ry.cover === 'brachiaria' && (ry.second === 'maize' || ry.second === 'sorghum') ? 0.97 : 1;
      d.run.yieldFactor *= intercropPenalty;
      margin += priceOf(ctx, ry.second) * sc.yieldRef * SECOND_SEASON_FACTOR * d.run.yieldFactor - costOf(ctx, ry.second);
      nCredit += sc.nCredit * d.run.yieldFactor;
      place(d, sc.residue * Math.max(0.3, d.run.yieldFactor));
      cursor = d.run.harvestIndex + 1;
      secondId = ry.second;
    } else {
      // the second crop could not be sown in time this year: a lost season
      runs.push({
        cropId: ry.second, role: 'second', year: w.year?.[start] ?? 0, sowIndex: cursor, harvestIndex: cursor,
        days: 0, etc: 0, eta: 0, irrigation: 0, heatDays: 0, frostHit: false, wetPenalty: 0, matured: false,
        yieldFactor: 0, waterFactor: 0,
      });
    }
  }

  // cover / forage crop
  if (ry.cover) {
    const cc = crop(ry.cover);
    const intercropped = ry.cover === 'brachiaria' && (secondId === 'maize' || secondId === 'sorghum');
    const sowAt = intercropped ? cursor : cursor + TURNAROUND_COVER;
    const sow = intercropped ? sowAt : sowableFrom(w, sowAt, cc.tsow, next - DESICCATION_GAP, 45);
    if (sow !== null && next - DESICCATION_GAP - sow >= 30) {
      const d = runCrop(w, ry.cover, 'cover', sow, ctx.soil, {
        bound: next - DESICCATION_GAP,
        untilBound: true,
        headStart: intercropped ? 0.35 : 0,
        constraints: { ...ctx.constraints, irrigation: false },
      });
      const growth = d.development * Math.max(0.2, d.run.waterFactor);
      d.run.yieldFactor = growth;
      margin += -costOf(ctx, cc.id) + (ctx.constraints.livestock ? cc.forageValue * growth : 0);
      nCredit += cc.nCredit * growth;
      place(d, cc.residue * growth);
    }
  }

  // soil cover, erosion and residue bookkeeping, day by day
  const k = erodibility(ctx.soil) * slopeFactor(ctx.site.slopePct);
  let residue = residueIn;
  let bareDays = 0;
  let rainOnBare = 0;
  let erosivity = 0;
  let livingDays = 0;
  let residueReturned = 0;
  let bareStart = -1;
  for (let d = 0; d < len; d++) {
    const i = start + d;
    const tmean = (w.tmax[i] + w.tmin[i]) / 2;
    residue *= Math.exp(-(0.004 + 0.0007 * Math.max(0, tmean - 8)));
    residue += residueAdd[d];
    residueReturned += residueAdd[d];
    const mulch = 1 - Math.exp(-0.35 * residue);
    const exposed = (1 - canopy[d]) * (1 - mulch);
    const p = w.prec[i];
    rainOnBare += p * exposed;
    if (p > 12.7) erosivity += p ** 1.5 * exposed * k;
    if (living[d]) {
      livingDays++;
      if (bareStart >= 0) {
        blocks.push({ cropId: null, role: 'bare', start: bareStart, days: d - bareStart });
        bareStart = -1;
      }
    } else {
      bareDays++;
      if (bareStart < 0) bareStart = d;
    }
  }
  if (bareStart >= 0) blocks.push({ cropId: null, role: 'bare', start: bareStart, days: len - bareStart });

  const grain = runs.filter((r) => r.role !== 'cover');
  const etc = grain.reduce((a, r) => a + r.etc, 0);
  const eta = grain.reduce((a, r) => a + r.eta, 0);
  margin -= irrigationMm * IRRIGATION_COST_PER_MM;
  // normalise to a 365-day year so rotations with uneven year lengths compare fairly
  const scale = 365 / len;
  return {
    outcome: {
      year: w.year?.[start] ?? 0,
      runs,
      bareDays: bareDays * scale,
      livingRootDays: livingDays * scale,
      rainOnBareMm: rainOnBare * scale,
      erosivityIndex: erosivity * scale,
      residueT: residueReturned,
      nCredit,
      margin,
      waterStress: etc > 0 ? eta / etc : 1,
      irrigationMm,
      failures: grain.filter((r) => r.yieldFactor < 0.6).length,
    },
    blocks: blocks.sort((a, b) => a.start - b.start),
    residueOut: residue,
  };
}
