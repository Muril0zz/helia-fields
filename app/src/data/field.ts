import type { DailySeries, RotationYear, SoilInfo } from '../engine';
import { fetchNdvi, readCycles, type CycleReading, type NdviPoint } from './modis';
import { fetchPower } from './power';
import { fetchSoilGrids } from './soil';
import { textureFrom } from '../engine/soil';
import { fetchSlope } from './terrain';

export type SourceState = 'idle' | 'busy' | 'live' | 'cache' | 'off';

export interface DemoSite {
  id: string;
  name: string;
  short: string;
  lat: number;
  lon: number;
  current: RotationYear[];
  irrigation: boolean;
  livestock: boolean;
  story: string;
  /** Shown as a button on the landing card (default true). */
  featured?: boolean;
}

export const DEMO_SITES: DemoSite[] = [
  {
    id: 'sorriso-br', name: 'Sorriso, Mato Grosso, Brazil', short: 'Mato Grosso', lat: -12.62, lon: -55.86,
    current: [{ main: 'soy', second: 'maize' }], irrigation: false, livestock: false,
    story: "Brazil's soybean capital: soybean then second-season maize, then a long bare dry season.",
  },
  {
    id: 'vilhena-br', name: 'Vilhena, Rondônia, Brazil', short: 'Rondônia', lat: -12.55, lon: -60.05,
    current: [{ main: 'soy', second: 'maize' }], irrigation: false, livestock: true,
    story: 'Amazon-edge farms where integrated crop-livestock is spreading.',
  },
  {
    id: 'ames-us', name: 'Ames, Iowa, USA', short: 'Iowa', lat: 42.06, lon: -93.55,
    current: [{ main: 'maize' }, { main: 'soy' }], irrigation: false, livestock: false,
    story: 'The US corn belt: maize one year, soybean the next, bare all winter.',
  },
  {
    id: 'salina-us', name: 'Salina, Kansas, USA', short: 'Kansas', lat: 38.95, lon: -97.45,
    current: [{ main: 'wheat' }], irrigation: false, livestock: false,
    story: 'Winter wheat country on the High Plains, often wheat then fallow.',
  },
  {
    id: 'ludhiana-in', name: 'Ludhiana, Punjab, India', short: 'Punjab', lat: 30.95, lon: 75.95,
    current: [{ main: 'rice', second: 'wheat' }], irrigation: true, livestock: true, featured: false,
    story: "Rice–wheat on pumped groundwater; GRACE shows the aquifer falling.",
  },
  {
    id: 'nakuru-ke', name: 'Nakuru, Kenya', short: 'Kenya', lat: -0.25, lon: 35.9,
    current: [{ main: 'maize' }], irrigation: false, livestock: true,
    story: 'Highland smallholder maize with two rainy seasons.',
  },
];

export interface FieldData {
  lat: number;
  lon: number;
  name: string;
  demo: DemoSite | null;
  series: DailySeries;
  cycles: CycleReading | null;
  slope: { slopePct: number; elevation: number } | null;
  soilgrids: SoilInfo | null;
  sources: { power: SourceState; modis: SourceState; terrain: SourceState; soil: SourceState };
}

interface DemoFile {
  series: DailySeries;
  ndvi: NdviPoint[];
  soilgrids: { clay?: number; sand?: number; soc?: number; phh2o?: number } | null;
}

async function loadDemo(id: string): Promise<DemoFile> {
  const res = await fetch(`/demo/${id}.json`);
  if (!res.ok) throw new Error(`demo ${id} missing`);
  return res.json();
}

/**
 * Loads everything for a field. Demo sites ship a snapshot of the same NASA data so the
 * demo survives a dead network; any other point on Earth is fetched live.
 */
export async function loadField(
  lat: number,
  lon: number,
  demo: DemoSite | null,
  onProgress: (s: Partial<FieldData['sources']>) => void,
  onLate: (patch: Partial<Pick<FieldData, 'cycles' | 'soilgrids' | 'slope'>>) => void,
  signal?: AbortSignal,
): Promise<FieldData> {
  const sources: FieldData['sources'] = { power: 'busy', modis: 'busy', terrain: 'busy', soil: 'busy' };
  onProgress({ ...sources });
  // slow or flaky sources never block the analysis: they patch the field when they land
  fetchSlope(lat, lon).then((v) => {
    onProgress({ terrain: v ? 'live' : 'off' });
    if (v && !signal?.aborted) onLate({ slope: v });
  });
  if (!demo) {
    fetchSoilGrids(lat, lon, signal).then((v) => {
      onProgress({ soil: v ? 'live' : 'off' });
      if (v && !signal?.aborted) onLate({ soilgrids: v });
    });
  }

  let series: DailySeries;
  let cycles: CycleReading | null = null;
  let soilgrids: SoilInfo | null = null;
  if (demo) {
    // demo sites are fully reproducible: every input comes from the same snapshot
    const file = await loadDemo(demo.id);
    series = file.series;
    const ndvi: NdviPoint[] = file.ndvi ?? [];
    cycles = ndvi.length ? readCycles(ndvi) : null;
    const sg = file.soilgrids;
    if (sg && typeof sg.clay === 'number' && typeof sg.sand === 'number') {
      soilgrids = { texture: textureFrom(sg.clay, sg.sand), clayPct: sg.clay, sandPct: sg.sand, socGkg: sg.soc ?? null, ph: sg.phh2o ?? null, source: 'SoilGrids' };
    }
    sources.power = 'cache';
    sources.modis = ndvi.length ? 'cache' : 'off';
    sources.soil = soilgrids ? 'cache' : 'off';
    onProgress({ power: 'cache', modis: sources.modis, soil: sources.soil });
  } else {
    fetchNdvi(lat, lon, 2022, signal)
      .then((v) => {
        onProgress({ modis: v.length ? 'live' : 'off' });
        if (v.length && !signal?.aborted) onLate({ cycles: readCycles(v) });
      })
      .catch(() => onProgress({ modis: 'off' }));
    series = await fetchPower(lat, lon, signal);
    sources.power = 'live';
    onProgress({ power: 'live' });
  }
  return {
    lat,
    lon,
    name: demo?.name ?? `${Math.abs(lat).toFixed(3)}°${lat >= 0 ? 'N' : 'S'}  ${Math.abs(lon).toFixed(3)}°${lon >= 0 ? 'E' : 'W'}`,
    demo,
    series,
    cycles,
    slope: null,
    soilgrids,
    sources: { ...sources },
  };
}

/** A sensible starting guess for today's rotation from what MODIS sees. */
export function guessCurrent(
  cycles: CycleReading | null,
  rainLimited: boolean,
  lat = 0,
  annualRainMm = 1000,
): RotationYear[] {
  const kind = cycles?.kind ?? 'single';
  const double = kind === 'double' || kind === 'triple';
  if (rainLimited) {
    if (annualRainMm < 800) return double ? [{ main: 'pmillet', second: 'cowpea' }] : [{ main: 'pmillet' }];
    return double ? [{ main: 'soy', second: 'maize' }] : [{ main: 'soy' }];
  }
  if (double) return [{ main: 'wheat', second: 'soy' }];
  // one green-up a year: a spring peak means a winter cereal, a summer peak a row crop
  const peaks = cycles?.peaks ?? [];
  if (peaks.length) {
    const spring = peaks.filter((p) => {
      const m = Number(p.date.slice(5, 7));
      return lat >= 0 ? m >= 3 && m <= 6 : m >= 9 && m <= 12;
    }).length;
    if (spring / peaks.length >= 0.5) return [{ main: 'wheat' }];
  }
  return [{ main: 'maize' }];
}
