import { crop } from './crops';
import type { Climatology } from './climate';
import { availableWaterPerMetre } from './soil';
import type { Constraints, Crop, CropRole, CropRun, SoilInfo } from './types';

/** Minimal daily arrays a crop run needs (a real year or a climatology pseudo-year). */
export interface WeatherView {
  tmax: number[];
  tmin: number[];
  prec: number[];
  et0: number[];
  gwetRoot?: number[];
  year?: number[];
  /** Day of year per index (1–366); climatology views wrap every 365 days. */
  doy?: number[];
}

export interface RunOptions {
  /** Hard stop: the crop must be gone by this index (exclusive). */
  bound: number;
  /** Cover crops grow until the bound instead of stopping at maturity. */
  untilBound?: boolean;
  /** Start part-way through development (intercropped pasture already established). */
  headStart?: number;
  constraints: Constraints;
  /** Thermal time of the variety actually grown (shorter where the season is short). */
  gddTarget?: number;
  /** Yield multiplier for that variety (short-season varieties yield a little less). */
  varietyFactor?: number;
}

export interface RunDetail {
  run: CropRun;
  /** Per-day canopy cover 0–1 from sowing to harvest (inclusive of harvest day). */
  canopy: number[];
  /** Fraction of thermal development reached (covers may stop early). */
  development: number;
}

function kcAt(c: Crop, f: number): number {
  const [l1, l2, l3] = c.stages;
  const a1 = l1;
  const a2 = l1 + l2;
  const a3 = l1 + l2 + l3;
  const [ini, mid, end] = c.kc;
  if (f < a1) return ini;
  if (f < a2) return ini + ((f - a1) / l2) * (mid - ini);
  if (f < a3) return mid;
  return mid + (Math.min(1, (f - a3) / c.stages[3])) * (end - mid);
}

/**
 * Daily FAO-56 single-coefficient water balance for one crop from sowIndex.
 * Development follows thermal time; yield follows FAO-33 Ky plus heat and frost penalties.
 */
export function runCrop(
  w: WeatherView,
  cropId: string,
  role: CropRole,
  sowIndex: number,
  soil: SoilInfo,
  opts: RunOptions,
): RunDetail {
  const c = crop(cropId);
  const taw = availableWaterPerMetre(soil) * c.rootDepth;
  const raw = c.p * taw;
  const irrigate = opts.constraints.irrigation;
  const g0 = w.gwetRoot?.[sowIndex];
  const relAvail = g0 === undefined ? 0.5 : Math.max(0, Math.min(1, (g0 - 0.35) / 0.4));
  let dr = (1 - relAvail) * taw;
  const gddReq = opts.gddTarget ?? c.gdd;
  let gdd = (opts.headStart ?? 0) * gddReq;
  let etc = 0;
  let eta = 0;
  let irr = 0;
  let heat = 0;
  let wetDays = 0;
  let frost = false;
  let lateFrost = false;
  let matured = false;
  const canopy: number[] = [];
  let i = sowIndex;
  const last = Math.min(opts.bound, w.tmax.length) - 1;
  const percolation = c.needsIrrigation ? 3 : 0; // flooded paddy losses, mm/day
  for (; i <= last; i++) {
    const days = i - sowIndex + 1;
    const tmean = (w.tmax[i] + w.tmin[i]) / 2;
    if (!frost) gdd += Math.max(0, Math.min(tmean, c.topt) - c.tbase);
    const f = Math.min(1, gdd / gddReq);
    const kc = frost ? c.kc[0] : kcAt(c, f);
    const dayEtc = kc * w.et0[i] + percolation;
    if (irrigate && dr > raw) {
      irr += dr;
      dr = 0;
    }
    const ks = dr <= raw ? 1 : Math.max(0, (taw - dr) / Math.max(1e-6, taw - raw));
    const dayEta = ks * dayEtc;
    etc += dayEtc;
    eta += dayEta;
    dr = Math.min(taw, Math.max(0, dr - w.prec[i] + dayEta));
    if (f >= 0.45 && f <= 0.65 && w.tmax[i] > c.theat) heat++;
    if (w.prec[i] > 2) wetDays++;
    const frostLimit = f < 0.5 ? c.tfrost : Math.max(c.tfrost, -2);
    if (f > 0.05 && w.tmin[i] <= frostLimit) {
      // a killing frost once grain is nearly filled only trims yield; earlier it ends the crop
      if (f >= 0.85 && !opts.untilBound) {
        lateFrost = true;
        matured = true;
        canopy.push(0.2);
        break;
      }
      frost = true;
    }
    const cover = Math.max(0, Math.min(1, (kc - 0.15) / Math.max(0.1, c.kc[1] - 0.15)));
    canopy.push(frost ? Math.min(cover, 0.2) : cover);
    // frost-sensitive plants die outright; the dead stand is left as straw
    if (frost && c.tfrost > -5) break;
    if (!opts.untilBound && f >= 1 && days >= c.minDays) {
      matured = true;
      break;
    }
    if (!opts.untilBound && days >= c.maxDays) break;
    if (opts.untilBound && f >= 1) matured = true;
  }
  const harvestIndex = Math.min(i, last);
  const development = Math.min(1, gdd / gddReq);
  if (opts.untilBound && development >= 0.9) matured = true;
  const waterFactor = etc > 0 ? Math.max(0, 1 - c.ky * (1 - eta / etc)) : 0;
  const heatPen = Math.min(0.5, heat * 0.04);
  const frostPen = frost ? 0.6 : lateFrost ? 0.1 : 0;
  // a crop cut short still yields in proportion to how far it developed
  const maturePen = matured ? 1 : Math.max(0.15, development ** 2);
  const cycleDays = harvestIndex - sowIndex + 1;
  const wetShare = cycleDays > 0 ? wetDays / cycleDays : 0;
  const wetPenalty = c.wetTol === undefined ? 0 : Math.min(0.7, Math.max(0, wetShare - c.wetTol) * 2);
  const yieldFactor = Math.max(
    0,
    waterFactor * (1 - heatPen) * (1 - frostPen) * (1 - wetPenalty) * maturePen * (opts.varietyFactor ?? 1),
  );
  return {
    run: {
      cropId,
      role,
      year: w.year?.[sowIndex] ?? 0,
      sowIndex,
      harvestIndex,
      days: harvestIndex - sowIndex + 1,
      etc,
      eta,
      irrigation: irr,
      heatDays: heat,
      frostHit: frost,
      wetPenalty,
      matured,
      yieldFactor,
      waterFactor,
    },
    canopy,
    development,
  };
}

/**
 * Farmers pick a variety whose cycle fits the season: thermal time is capped at 88 % of the
 * degree-days available before the typical first frost (or the crop's longest cycle).
 * Shorter varieties yield a little less: factor = (target / nominal)^0.4.
 */
export function varietyFor(clim: Climatology, c: Crop, sowDoy: number): { gddTarget: number; varietyFactor: number } {
  let avail = 0;
  for (let k = 0; k < c.maxDays; k++) {
    const idx = (sowDoy - 1 + k) % 365;
    if (k > 30 && clim.tmin[idx] <= c.tfrost + 1) break;
    avail += Math.max(0, Math.min(clim.tmean[idx], c.topt) - c.tbase);
  }
  const gddTarget = Math.max(c.gdd * 0.5, Math.min(c.gdd, avail * 0.88));
  return { gddTarget, varietyFactor: (gddTarget / c.gdd) ** 0.4 };
}

/** Build a two-year pseudo weather series from the smoothed climatology. */
export function climatologyView(clim: Climatology): WeatherView {
  const twice = (a: number[]) => [...a, ...a];
  const doy = Array.from({ length: 730 }, (_, i) => (i % 365) + 1);
  return { tmax: twice(clim.tmax), tmin: twice(clim.tmin), prec: twice(clim.prec), et0: twice(clim.et0), doy };
}

/**
 * Best sowing day for a main crop: the earliest day-of-year whose climatological
 * season reaches 97 % of the best attainable yield factor. Sowing early keeps room
 * for a second crop, which is how double-cropping regions actually plan.
 */
export function bestSowingDoy(
  clim: Climatology,
  cropId: string,
  soil: SoilInfo,
  constraints: Constraints,
): { doy: number; yieldFactor: number } {
  const c = crop(cropId);
  const view = climatologyView(clim);
  const results: { doy: number; y: number }[] = [];
  for (let d = 0; d < 365; d += 4) {
    if (clim.tmean[d] < c.tsow) continue;
    const r = runCrop(view, cropId, 'main', d, soil, { bound: d + c.maxDays + 1, constraints, ...varietyFor(clim, c, d + 1) });
    results.push({ doy: d + 1, y: r.run.yieldFactor });
  }
  if (!results.length) return { doy: 1, yieldFactor: 0 };
  const best = Math.max(...results.map((r) => r.y));
  const anchor = seasonAnchor(clim, c);
  const ordered = [...results].sort(
    (a, b) => ((a.doy - anchor + 365) % 365) - ((b.doy - anchor + 365) % 365),
  );
  const pick = ordered.find((r) => r.y >= best * 0.97) ?? ordered[0];
  return { doy: pick.doy, yieldFactor: pick.y };
}

/**
 * Where the growing year "starts" for a crop. Temperature-limited climates start
 * warm-season crops after the coldest point and cool-season crops after the warmest
 * point (autumn sowing); rain-limited climates start after the dry season.
 */
export function seasonAnchor(clim: Climatology, c: Crop): number {
  const tRange = Math.max(...clim.tmean) - Math.min(...clim.tmean);
  const coolSeason = c.tbase <= 5;
  if (tRange > 10) {
    const target = coolSeason ? Math.max(...clim.tmean) : Math.min(...clim.tmean);
    return clim.tmean.indexOf(target) + 1;
  }
  if (coolSeason) return clim.tmean.indexOf(Math.max(...clim.tmean)) + 1;
  return driestDoy(clim);
}

/** Day of year at the centre of the driest 60-day stretch (rain minus demand). */
export function driestDoy(clim: Climatology): number {
  let bestK = 0;
  let bestV = Infinity;
  for (let k = 0; k < 365; k++) {
    let v = 0;
    for (let j = -30; j < 30; j++) {
      const idx = (k + j + 365) % 365;
      v += clim.prec[idx] - clim.et0[idx];
    }
    if (v < bestV) {
      bestV = v;
      bestK = k;
    }
  }
  return bestK + 1;
}

export { kcAt };
