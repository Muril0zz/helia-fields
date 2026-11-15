import { ONI } from './enso-data';
import type { PreparedSeries } from './climate';
import type { YearOutcome } from './types';

export type EnsoPhase = 'elnino' | 'lanina' | 'neutral';

/** NOAA CPC official outlook used for "next season" mode. Update monthly from the ENSO Diagnostic Discussion. */
export const OUTLOOK = {
  issued: '2026-11-12',
  phase: 'elnino' as EnsoPhase,
  probability: 0.79,
  through: 'JFM 2027',
  oniLatest: { season: 'ASO 2026', value: 2.46 },
  source: 'NOAA CPC ENSO Diagnostic Discussion, 12 Nov 2026',
  url: 'https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso_advisory/ensodisc.shtml',
};

/** ONI threshold used by NOAA for El Niño / La Niña conditions. */
const T = 0.5;

/** Mean ONI over the six months from sowing: the window that decides a crop season. */
export function seasonOni(sowIso: string): number | null {
  const y = Number(sowIso.slice(0, 4));
  const m = Number(sowIso.slice(5, 7)) - 1;
  const v: number[] = [];
  for (let k = 0; k < 6; k++) {
    const mm = (m + k) % 12;
    const yy = y + Math.floor((m + k) / 12);
    const x = ONI[yy]?.[mm];
    if (x != null) v.push(x);
  }
  return v.length >= 3 ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

export function phaseOf(oni: number | null): EnsoPhase | null {
  if (oni == null) return null;
  return oni >= T ? 'elnino' : oni <= -T ? 'lanina' : 'neutral';
}

/** Phase of one simulated season, from the sowing date of its first crop. */
export function outcomePhase(o: YearOutcome, prep: PreparedSeries): { oni: number | null; phase: EnsoPhase | null } {
  const iso = prep.dates[o.runs[0]?.sowIndex ?? -1];
  const oni = iso ? seasonOni(iso) : null;
  return { oni, phase: phaseOf(oni) };
}

/** Which past seasons count as analogs of an outlook: a phase, optionally only strong events. */
export interface AnalogSpec {
  phase: EnsoPhase;
  /** Minimum |season ONI| (1.0 = moderate-to-strong events only). */
  minAbsOni?: number;
}

export function isAnalog(oni: number | null, spec: AnalogSpec): boolean {
  if (phaseOf(oni) !== spec.phase || oni == null) return false;
  return spec.phase === 'neutral' || Math.abs(oni) >= (spec.minAbsOni ?? T);
}

/** The analog set for the current NOAA outlook (strong El Niño → strong past El Niño seasons). */
export const OUTLOOK_SPEC: AnalogSpec = { phase: 'elnino', minAbsOni: 1.0 };

/** Fewer analog seasons than this and the outlook view falls back to all seasons. */
export const MIN_ANALOGS = 3;
