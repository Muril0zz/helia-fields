import type { SoilInfo, SoilTexture } from './types';

/** Simplified USDA texture triangle from clay and sand percentages. */
export function textureFrom(clay: number, sand: number): SoilTexture {
  const silt = Math.max(0, 100 - clay - sand);
  if (clay >= 40) return 'clay';
  if (clay >= 27 && sand <= 45) return 'clay loam';
  if (clay >= 20 && sand > 45) return 'sandy clay loam';
  if (sand >= 85) return 'sand';
  if (sand >= 70) return 'loamy sand';
  if (sand >= 52) return 'sandy loam';
  if (silt >= 50) return 'silt loam';
  return 'loam';
}

/** Plant-available water, mm per metre of soil (field capacity minus wilting point). */
const AWC: Record<SoilTexture, number> = {
  sand: 60,
  'loamy sand': 85,
  'sandy loam': 120,
  loam: 160,
  'silt loam': 185,
  'sandy clay loam': 140,
  'clay loam': 160,
  clay: 145,
};

export function availableWaterPerMetre(soil: SoilInfo): number {
  return AWC[soil.texture];
}

/** Erodibility multiplier (RUSLE K-factor style, relative to loam = 1). */
const ERODIBILITY: Record<SoilTexture, number> = {
  sand: 0.45,
  'loamy sand': 0.6,
  'sandy loam': 0.85,
  loam: 1,
  'silt loam': 1.3,
  'sandy clay loam': 0.8,
  'clay loam': 0.85,
  clay: 0.7,
};

export function erodibility(soil: SoilInfo): number {
  return ERODIBILITY[soil.texture];
}

/** RUSLE-style slope factor, 1 at 9 % slope. */
export function slopeFactor(slopePct: number): number {
  const s = Math.max(0.2, slopePct);
  return Math.max(0.15, Math.min(6, (s / 9) ** 1.3));
}

export const DEFAULT_SOIL: SoilInfo = {
  texture: 'clay loam',
  clayPct: 32,
  sandPct: 38,
  socGkg: null,
  ph: null,
  source: 'default',
};
