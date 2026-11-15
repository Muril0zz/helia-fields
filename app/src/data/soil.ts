import type { SoilInfo } from '../engine';
import { textureFrom } from '../engine/soil';
import { fetchJson } from './fetchJson';

interface SgResponse {
  properties: {
    layers: { name: string; unit_measure: { d_factor: number }; depths: { values: { mean: number | null } }[] }[];
  };
}

/** ISRIC SoilGrids 250 m topsoil (0–30 cm). Returns null when the service has no value. */
export async function fetchSoilGrids(lat: number, lon: number, signal?: AbortSignal): Promise<SoilInfo | null> {
  const url =
    'https://rest.isric.org/soilgrids/v2.0/properties/query' +
    `?lon=${lon.toFixed(4)}&lat=${lat.toFixed(4)}&property=clay&property=sand&property=soc&property=phh2o` +
    '&depth=0-5cm&depth=5-15cm&depth=15-30cm&value=mean';
  try {
    const d = await fetchJson<SgResponse>(url, 6_000, signal);
    const get = (name: string) => {
      const layer = d.properties.layers.find((l) => l.name === name);
      if (!layer) return null;
      const vals = layer.depths.map((x) => x.values.mean).filter((v): v is number => v !== null);
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length / layer.unit_measure.d_factor : null;
    };
    const clay = get('clay');
    const sand = get('sand');
    if (clay === null || sand === null) return null;
    return { texture: textureFrom(clay, sand), clayPct: clay, sandPct: sand, socGkg: get('soc'), ph: get('phh2o'), source: 'SoilGrids' };
  } catch {
    return null;
  }
}

export const SOIL_PRESETS: { id: string; label: string; soil: SoilInfo }[] = [
  { id: 'clay', label: 'Clay', soil: { texture: 'clay', clayPct: 50, sandPct: 20, socGkg: null, ph: null, source: 'farmer' } },
  { id: 'clay loam', label: 'Clay loam', soil: { texture: 'clay loam', clayPct: 32, sandPct: 35, socGkg: null, ph: null, source: 'farmer' } },
  { id: 'loam', label: 'Loam', soil: { texture: 'loam', clayPct: 20, sandPct: 40, socGkg: null, ph: null, source: 'farmer' } },
  { id: 'silt loam', label: 'Silt loam', soil: { texture: 'silt loam', clayPct: 15, sandPct: 20, socGkg: null, ph: null, source: 'farmer' } },
  { id: 'sandy loam', label: 'Sandy loam', soil: { texture: 'sandy loam', clayPct: 12, sandPct: 62, socGkg: null, ph: null, source: 'farmer' } },
  { id: 'sand', label: 'Sandy', soil: { texture: 'loamy sand', clayPct: 7, sandPct: 80, socGkg: null, ph: null, source: 'farmer' } },
];
