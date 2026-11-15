import { crop } from './crops';
import type { PreparedSeries } from './climate';
import { kcAt } from './simulate';
import { availableWaterPerMetre } from './soil';
import type { CropRun, SoilInfo } from './types';

/** One day of water under the field. */
export interface WaterDay {
  date: string;
  rain: number; // mm
  et: number; // mm taken by the crop or evaporated from bare soil
  /** Plant-available water in the 1.5 m profile, 0 (wilting) to 1 (field capacity). */
  fill: number;
  /** Water that drained below 1.5 m today (recharge towards groundwater), mm. */
  drain: number;
  /** Depth reached by roots, m (0 when the soil is bare). */
  root: number;
  /** Green canopy cover, 0–1. */
  canopy: number;
  cropId: string | null;
  /** NASA POWER (MERRA-2) root-zone wetness for the same day, 0–1: an independent check. */
  gwet: number | null;
}

export interface WaterTrace {
  days: WaterDay[];
  /** Plant-available water the profile holds when full, mm. */
  capacity: number;
  depth: number;
  totals: { rain: number; et: number; drain: number; stressDays: number };
}

const DEPTH = 1.5;

/**
 * A continuous daily soil-water bucket (FAO-56 style) through one rotation season, so the
 * whole year can be watched: rain filling the profile, crops drinking it, bare months losing it
 * to evaporation and storms draining past the roots.
 */
export function waterTrace(prep: PreparedSeries, runs: CropRun[], soil: SoilInfo, from: number, to: number): WaterTrace {
  const perM = availableWaterPerMetre(soil);
  const capacity = perM * DEPTH;
  const g0 = prep.gwetRoot[from];
  let s = capacity * (g0 === undefined ? 0.5 : Math.max(0, Math.min(1, (g0 - 0.35) / 0.4)));
  const days: WaterDay[] = [];
  let rainT = 0;
  let etT = 0;
  let drainT = 0;
  let stress = 0;
  const end = Math.min(to, prep.dates.length - 1);
  for (let i = Math.max(0, from); i <= end; i++) {
    const run = runs.find((r) => i >= r.sowIndex && i <= r.harvestIndex);
    let et: number;
    let root = 0;
    let canopy = 0;
    if (run) {
      const c = crop(run.cropId);
      const f = Math.min(1, (i - run.sowIndex) / Math.max(1, run.harvestIndex - run.sowIndex));
      const kc = kcAt(c, f);
      root = 0.15 + (Math.min(DEPTH, c.rootDepth) - 0.15) * Math.min(1, f / 0.55);
      canopy = Math.max(0, Math.min(1, (kc - 0.15) / Math.max(0.1, c.kc[1] - 0.15)));
      // only the water within reach of the roots counts towards stress
      const tawRoot = perM * root;
      const inReach = s * (root / DEPTH);
      const depl = tawRoot - inReach;
      const raw = c.p * tawRoot;
      const ks = depl <= raw ? 1 : Math.max(0, (tawRoot - depl) / Math.max(1e-6, tawRoot - raw));
      if (ks < 0.7) stress++;
      et = ks * kc * prep.et0[i];
    } else {
      // bare soil: the top ~15 cm dries by evaporation, faster when it is wet
      et = Math.min(0.3 * prep.et0[i] * (0.3 + 0.7 * (s / capacity)), s * 0.1);
    }
    const rain = prep.prec[i];
    s = s + rain - et;
    let drain = 0;
    if (s > capacity) {
      drain = s - capacity;
      s = capacity;
    }
    s = Math.max(0, s);
    rainT += rain;
    etT += et;
    drainT += drain;
    days.push({
      date: prep.dates[i],
      rain,
      et,
      fill: s / capacity,
      drain,
      root,
      canopy,
      cropId: run?.cropId ?? null,
      gwet: prep.gwetRoot[i] ?? null,
    });
  }
  return { days, capacity, depth: DEPTH, totals: { rain: rainT, et: etT, drain: drainT, stressDays: stress } };
}
