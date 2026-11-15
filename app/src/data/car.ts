import { fetchJson } from './fetchJson';
import type { NdviPoint } from './modis';

/**
 * Brazil's Rural Environmental Registry (CAR / SICAR): every rural property's boundary is public.
 * The SICAR GeoServer answers browser requests directly, one layer per state.
 */
type Ring = [number, number][]; // [lon, lat]
export interface CarProperty {
  code: string;
  uf: string;
  municipality: string;
  areaHa: number;
  status: string; // CAR analysis status, as published
  polygons: Ring[][]; // MultiPolygon: polygons → rings → [lon, lat]
  centroid: { lat: number; lon: number };
  bbox: [number, number, number, number]; // minLon, minLat, maxLon, maxLat
}

interface WfsFeature {
  properties: Record<string, unknown>;
  geometry: { type: 'Polygon' | 'MultiPolygon'; coordinates: unknown };
}

const SICAR = 'https://geoserver.car.gov.br/geoserver/sicar/wfs';
const UFS = ['ac', 'al', 'am', 'ap', 'ba', 'ce', 'df', 'es', 'go', 'ma', 'mg', 'ms', 'mt', 'pa', 'pb', 'pe', 'pi', 'pr', 'rj', 'rn', 'ro', 'rr', 'rs', 'sc', 'se', 'sp', 'to'];

/** Rough state bounding boxes [minLon, minLat, maxLon, maxLat] to know which SICAR layers to ask. */
const UF_BOX: Record<string, [number, number, number, number]> = {
  ac: [-74, -11.2, -66.6, -7.1], al: [-38.3, -10.6, -35.1, -8.8], am: [-73.8, -9.9, -56.1, 2.3], ap: [-54.9, -1.3, -49.8, 4.5],
  ba: [-46.7, -18.4, -37.3, -8.5], ce: [-41.5, -7.9, -37.2, -2.7], df: [-48.3, -16.1, -47.3, -15.5], es: [-41.9, -21.4, -39.6, -17.8],
  go: [-53.3, -19.5, -45.9, -12.4], ma: [-48.8, -10.3, -41.8, -1], mg: [-51.1, -22.9, -39.8, -14.2], ms: [-58.2, -24.1, -50.9, -17.1],
  mt: [-61.7, -18.1, -50.2, -7.3], pa: [-58.9, -9.9, -46, 2.6], pb: [-38.8, -8.4, -34.7, -6], pe: [-41.4, -9.5, -34.8, -7.2],
  pi: [-45.9, -10.9, -40.3, -2.7], pr: [-54.7, -26.8, -48, -22.5], rj: [-44.9, -23.4, -40.9, -20.7], rn: [-38.6, -6.99, -34.9, -4.8],
  ro: [-66.9, -13.7, -59.7, -7.9], rr: [-64.9, -1.6, -58.8, 5.3], rs: [-57.7, -33.8, -49.6, -27], sc: [-53.9, -29.4, -48.3, -25.9],
  se: [-38.3, -11.6, -36.3, -9.5], sp: [-53.2, -25.4, -44.1, -19.7], to: [-50.8, -13.5, -45.6, -5.1],
};

export function isCarCode(s: string): boolean {
  return /^[A-Z]{2}-\d{7}-[0-9A-F.]{32,40}$/i.test(s.trim());
}

function toPolygons(g: WfsFeature['geometry']): Ring[][] {
  return g.type === 'Polygon' ? [g.coordinates as Ring[]] : (g.coordinates as Ring[][]);
}

/** Shoelace centroid of the largest outer ring. */
function centroidOf(polys: Ring[][]): { lat: number; lon: number } {
  let best: Ring = polys[0][0];
  let bestA = 0;
  for (const p of polys) {
    const r = p[0];
    let a = 0;
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += r[j][0] * r[i][1] - r[i][0] * r[j][1];
    if (Math.abs(a) > bestA) {
      bestA = Math.abs(a);
      best = r;
    }
  }
  let cx = 0, cy = 0, a2 = 0;
  for (let i = 0, j = best.length - 1; i < best.length; j = i++) {
    const f = best[j][0] * best[i][1] - best[i][0] * best[j][1];
    cx += (best[j][0] + best[i][0]) * f;
    cy += (best[j][1] + best[i][1]) * f;
    a2 += f;
  }
  if (Math.abs(a2) < 1e-12) return { lon: best[0][0], lat: best[0][1] };
  return { lon: cx / (3 * a2), lat: cy / (3 * a2) };
}

function bboxOf(polys: Ring[][]): [number, number, number, number] {
  let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
  polys.forEach((p) => p.forEach((r) => r.forEach(([x, y]) => {
    a = Math.min(a, x); b = Math.min(b, y); c = Math.max(c, x); d = Math.max(d, y);
  })));
  return [a, b, c, d];
}

/** Ray-casting point-in-polygon over a MultiPolygon (holes respected). */
export function contains(polys: Ring[][], lon: number, lat: number): boolean {
  const inRing = (r: Ring) => {
    let inside = false;
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const [xi, yi] = r[i];
      const [xj, yj] = r[j];
      if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };
  return polys.some((p) => inRing(p[0]) && !p.slice(1).some(inRing));
}

function toProperty(f: WfsFeature): CarProperty {
  const p = f.properties;
  const polygons = toPolygons(f.geometry);
  return {
    code: String(p.cod_imovel),
    uf: String(p.uf ?? '').toUpperCase(),
    municipality: String(p.municipio ?? ''),
    areaHa: Number(p.area ?? 0),
    status: String(p.condicao ?? p.status_imovel ?? ''),
    polygons,
    centroid: centroidOf(polygons),
    bbox: bboxOf(polygons),
  };
}

export async function fetchCarByCode(code: string, signal?: AbortSignal): Promise<CarProperty | null> {
  const c = code.trim().toUpperCase();
  const uf = c.slice(0, 2).toLowerCase();
  if (!UFS.includes(uf)) return null;
  const url = `${SICAR}?service=WFS&version=1.0.0&request=GetFeature&typeName=sicar:sicar_imoveis_${uf}&outputFormat=application/json&maxFeatures=1&CQL_FILTER=${encodeURIComponent(`cod_imovel='${c.replace(/'/g, '')}'`)}`;
  const d = await fetchJson<{ features: WfsFeature[] }>(url, 30_000, signal);
  return d.features?.length ? toProperty(d.features[0]) : null;
}

/** The registered property under a point, if any (smallest one when registrations overlap). */
export async function fetchCarAtPoint(lat: number, lon: number, signal?: AbortSignal): Promise<CarProperty | null> {
  const ufs = Object.entries(UF_BOX).filter(([, [a, b, c, d]]) => lon >= a && lon <= c && lat >= b && lat <= d).map(([k]) => k);
  const e = 0.0005;
  const found: CarProperty[] = [];
  await Promise.all(
    ufs.map(async (uf) => {
      const url = `${SICAR}?service=WFS&version=1.0.0&request=GetFeature&typeName=sicar:sicar_imoveis_${uf}&outputFormat=application/json&maxFeatures=20&bbox=${lon - e},${lat - e},${lon + e},${lat + e},EPSG:4326`;
      try {
        const d = await fetchJson<{ features: WfsFeature[] }>(url, 30_000, signal);
        d.features?.forEach((f) => {
          const prop = toProperty(f);
          if (contains(prop.polygons, lon, lat)) found.push(prop);
        });
      } catch {
        /* one state failing must not hide the others */
      }
    }),
  );
  return found.sort((a, b) => a.areaHa - b.areaHa)[0] ?? null;
}

// ---------------------------------------------------------------- PRODES deforestation

export interface Deforestation {
  biomeLayers: string[];
  byYear: { year: number; ha: number }[];
  totalHa: number;
  /** Deforestation mapped in PRODES years ≥ 2021 (the EU deforestation-free cut-off is 31 Dec 2020). */
  after2020Ha: number;
}

/**
 * INPE PRODES yearly deforestation polygons (Legal Amazon and Cerrado) that fall inside the property.
 * A PRODES polygon counts when its centroid lies inside the boundary (good enough at farm scale).
 */
export async function fetchDeforestation(car: CarProperty, signal?: AbortSignal): Promise<Deforestation> {
  const [a, b, c, d] = car.bbox;
  const layers = ['prodes-legal-amz', 'prodes-cerrado-nb'];
  const byYear = new Map<number, number>();
  const used: string[] = [];
  await Promise.all(
    layers.map(async (ws) => {
      const url = `https://terrabrasilis.dpi.inpe.br/geoserver/${ws}/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=${ws}:yearly_deforestation&outputFormat=application/json&maxFeatures=2000&bbox=${a},${b},${c},${d},EPSG:4326`;
      try {
        const r = await fetchJson<{ features: WfsFeature[] }>(url, 40_000, signal);
        used.push(ws);
        r.features?.forEach((f) => {
          const polys = toPolygons(f.geometry);
          const cen = centroidOf(polys);
          if (!contains(car.polygons, cen.lon, cen.lat)) return;
          const year = Number(f.properties.year ?? String(f.properties.class_name ?? '').replace(/\D/g, ''));
          const ha = Number(f.properties.area_km ?? 0) * 100;
          if (year && ha) byYear.set(year, (byYear.get(year) ?? 0) + ha);
        });
      } catch {
        /* a biome layer can be down; report what we could check */
      }
    }),
  );
  const list = [...byYear.entries()].map(([year, ha]) => ({ year, ha })).sort((x, y) => x.year - y.year);
  return {
    biomeLayers: used,
    byYear: list,
    totalHa: list.reduce((s, x) => s + x.ha, 0),
    after2020Ha: list.filter((x) => x.year >= 2021).reduce((s, x) => s + x.ha, 0),
  };
}

// ---------------------------------------------------------------- MODIS NDVI over the whole property

const R = 6371007.181; // MODIS sinusoidal sphere radius
interface OrnlGrid {
  xllcorner: string;
  yllcorner: string;
  cellsize: number;
  nrows: number;
  ncols: number;
  subset: { calendar_date: string; data: number[] }[];
}

/**
 * Mean MODIS 250 m NDVI of the pixels whose centres fall inside the property, per 16-day date.
 * Averaging the whole field removes the edge and road pixels a single point can hit.
 */
export async function fetchPropertyNdvi(car: CarProperty, fromYear: number, signal?: AbortSignal): Promise<{ points: NdviPoint[]; pixels: number }> {
  const BASE = 'https://modis.ornl.gov/rst/api/v1/MOD13Q1';
  const { lat, lon } = car.centroid;
  const [a, b, c, d] = car.bbox;
  const halfKm = Math.max(((c - a) * 111.32 * Math.cos((lat * Math.PI) / 180)) / 2, ((d - b) * 110.57) / 2);
  const km = Math.min(4, Math.max(0, Math.ceil(halfKm)));
  const q = `latitude=${lat.toFixed(5)}&longitude=${lon.toFixed(5)}`;
  let all: { dates: { modis_date: string; calendar_date: string }[] } | null = null;
  for (let attempt = 0; attempt < 3 && !all; attempt++) {
    try {
      all = await fetchJson(`${BASE}/dates?${q}`, 60_000, signal);
    } catch (e) {
      if (signal?.aborted || attempt === 2) throw e;
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
    }
  }
  if (!all) return { points: [], pixels: 0 };
  const dates = all.dates.filter((x) => Number(x.calendar_date.slice(0, 4)) >= fromYear);
  const chunks: (typeof dates)[] = [];
  for (let i = 0; i < dates.length; i += 10) chunks.push(dates.slice(i, i + 10));
  const out: NdviPoint[] = [];
  let inside: number[] | null = null;
  const queue = [...chunks];
  const worker = async () => {
    while (queue.length) {
      const ch = queue.shift()!;
      const url = `${BASE}/subset?${q}&band=250m_16_days_NDVI&startDate=${ch[0].modis_date}&endDate=${ch[ch.length - 1].modis_date}&kmAboveBelow=${km}&kmLeftRight=${km}`;
      let g: OrnlGrid | null = null;
      for (let attempt = 0; attempt < 3 && !g; attempt++) {
        try {
          g = await fetchJson<OrnlGrid>(url, 90_000, signal);
        } catch (e) {
          if (signal?.aborted) throw e;
          await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
        }
      }
      if (!g) continue; // a missing chunk leaves a gap instead of failing the whole series
      if (!inside) {
        const xll = Number(g.xllcorner);
        const yll = Number(g.yllcorner);
        const idx: number[] = [];
        for (let r = 0; r < g.nrows; r++) {
          for (let k = 0; k < g.ncols; k++) {
            const x = xll + (k + 0.5) * g.cellsize;
            const y = yll + (g.nrows - r - 0.5) * g.cellsize; // rows run north to south
            const plat = (y / R) * (180 / Math.PI);
            const plon = (x / (R * Math.cos((plat * Math.PI) / 180))) * (180 / Math.PI);
            if (contains(car.polygons, plon, plat)) idx.push(r * g.ncols + k);
          }
        }
        // tiny properties: fall back to the centre pixel
        inside = idx.length ? idx : [Math.floor(g.nrows / 2) * g.ncols + Math.floor(g.ncols / 2)];
      }
      for (const s of g.subset) {
        const vals = inside.map((i) => s.data[i]).filter((v) => typeof v === 'number' && v > -2000);
        if (vals.length) out.push({ date: s.calendar_date, ndvi: (vals.reduce((p, v) => p + v, 0) / vals.length) * 0.0001 });
      }
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  return { points: out.sort((x, y) => x.date.localeCompare(y.date)), pixels: inside ? (inside as number[]).length : 0 };
}
