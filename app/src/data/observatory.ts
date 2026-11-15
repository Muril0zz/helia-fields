/**
 * The NASA observatory: every map layer is a list of dated frames that can be scrubbed or played.
 * Tiles come from NASA GIBS (WMTS, Web Mercator); 30 m scenes are found through NASA CMR.
 */
const GIBS = 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best';
const DAY = 86_400_000;

export type LayerId = 'none' | 'rainnow' | 'hls' | 'truecolor' | 'ndvi' | 'soil' | 'deep';
export type LayerGroup = 'image' | 'veg' | 'water';

export interface Frame {
  /** ISO date or date-time the frame shows. */
  t: string;
  /** XYZ tile template. */
  url: string;
  /** Extra note, e.g. the satellite and its cloud cover. */
  note?: string;
}

export interface LayerDef {
  id: Exclude<LayerId, 'none'>;
  group: LayerGroup;
  /** Native max zoom of the tiles (MapLibre over-zooms beyond it). */
  level: number;
  opacity: number;
  /** Milliseconds per frame while playing. */
  stepMs: number;
  /** Whether the frame time includes hours (shown in local time). */
  timed?: boolean;
  needsField?: boolean;
  credit: string;
  /** Legend colours, low → high, matching the GIBS palette. */
  legend: string[];
  /** Map zoom that suits this layer once a field is open (regional data at regional scale). */
  view: number;
}

export const LAYERS: LayerDef[] = [
  { id: 'rainnow', view: 5.2, group: 'water', level: 6, opacity: 0.85, stepMs: 380, timed: true, credit: 'GPM IMERG 30-min · NASA GIBS', legend: ['#00764e', '#68cb00', '#ffd400', '#ff6522', '#960000'] },
  { id: 'hls', view: 12.6, group: 'image', level: 12, opacity: 1, stepMs: 900, needsField: true, credit: 'NASA HLS (Landsat 8/9 + Sentinel-2) 30 m · GIBS', legend: [] },
  { id: 'truecolor', view: 8, group: 'image', level: 9, opacity: 0.95, stepMs: 700, credit: 'MODIS Terra true colour · NASA GIBS', legend: [] },
  { id: 'ndvi', view: 9.5, group: 'veg', level: 9, opacity: 0.8, stepMs: 600, credit: 'MODIS Terra NDVI 16-day · NASA GIBS', legend: ['#dfcec2', '#b09b8a', '#965a47', '#78ad01', '#3e8a01', '#086701'] },
  { id: 'soil', view: 5.2, group: 'water', level: 6, opacity: 0.75, stepMs: 450, credit: 'SMAP L4 root-zone soil moisture · NASA GIBS', legend: ['#ffa200', '#ffe500', '#acd500', '#068200', '#00d3a8', '#00b2ff', '#000cff', '#0000a1'] },
  { id: 'deep', view: 4.6, group: 'water', level: 6, opacity: 0.75, stepMs: 650, credit: 'GLDAS underground soil moisture (monthly) · NASA GIBS', legend: ['#ef6644', '#fba45c', '#fdd884', '#e6f598', '#abdda4', '#66c2a5', '#5e4fa2'] },
];

export const layerDef = (id: LayerId) => LAYERS.find((l) => l.id === id) ?? null;

const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const tile = (layer: string, time: string, level: number, ext: string) =>
  `${GIBS}/${layer}/default/${time}/GoogleMapsCompatible_Level${level}/{z}/{y}/{x}.${ext}`;

/** Probe one coarse tile: GIBS answers 404 for times it has not processed yet. */
async function exists(url: string, signal?: AbortSignal): Promise<boolean> {
  try {
    const r = await fetch(url.replace('{z}/{y}/{x}', '1/0/0'), { signal });
    return r.ok;
  } catch {
    return false;
  }
}

/** Latest processed date for a daily layer, stepping back from today. */
async function latestDaily(layer: string, level: number, ext: string, maxBack: number, signal?: AbortSignal) {
  const today = Date.now();
  for (let k = 0; k <= maxBack; k++) {
    const d = iso(today - k * DAY);
    if (await exists(tile(layer, d, level, ext), signal)) return today - k * DAY;
  }
  return today - maxBack * DAY;
}

/** Rain right now: the last 24 hours of half-hourly GPM IMERG, one frame per hour. */
async function rainNow(signal?: AbortSignal): Promise<Frame[]> {
  const L = 'IMERG_Precipitation_Rate_30min';
  const step = 30 * 60_000;
  let t = Math.floor((Date.now() - 3.5 * 3_600_000) / step) * step;
  // processing lags 4–8 hours; find the newest half-hour that exists
  for (let k = 0; k < 16; k++, t -= step) {
    const s = new Date(t).toISOString().slice(0, 19) + 'Z';
    if (await exists(tile(L, s, 6, 'png'), signal)) break;
  }
  const frames: Frame[] = [];
  for (let h = 23; h >= 0; h--) {
    const s = new Date(t - h * 3_600_000).toISOString().slice(0, 19) + 'Z';
    frames.push({ t: s, url: tile(L, s, 6, 'png') });
  }
  return frames;
}

/** MODIS NDVI composites start every 16 days from 1 January. */
function ndviDates(count: number): string[] {
  const out: string[] = [];
  let d = new Date(Date.now() - 20 * DAY); // composites are published ~2–3 weeks after their start
  while (out.length < count) {
    const jan1 = Date.UTC(d.getUTCFullYear(), 0, 1);
    const doy = Math.floor((d.getTime() - jan1) / DAY);
    const start = jan1 + Math.floor(doy / 16) * 16 * DAY;
    const s = iso(start);
    if (!out.includes(s)) out.push(s);
    d = new Date(start - DAY);
  }
  return out.reverse();
}

export async function framesFor(id: LayerId, field: { lat: number; lon: number } | null, signal?: AbortSignal): Promise<Frame[]> {
  switch (id) {
    case 'none':
      return [];
    case 'rainnow':
      return rainNow(signal);
    case 'truecolor': {
      const end = Date.now() - DAY;
      return Array.from({ length: 14 }, (_, k) => {
        const d = iso(end - (13 - k) * DAY);
        return { t: d, url: tile('MODIS_Terra_CorrectedReflectance_TrueColor', d, 9, 'jpg') };
      });
    }
    case 'ndvi':
      // the last two years: two full crop seasons
      return ndviDates(46).map((d) => ({ t: d, url: tile('MODIS_Terra_L3_NDVI_16Day', d, 9, 'png') }));
    case 'soil': {
      const end = await latestDaily('SMAP_L4_Analyzed_Root_Zone_Soil_Moisture', 6, 'png', 10, signal);
      return Array.from({ length: 40 }, (_, k) => {
        const d = iso(end - (39 - k) * 3 * DAY);
        return { t: d, url: tile('SMAP_L4_Analyzed_Root_Zone_Soil_Moisture', d, 6, 'png') };
      });
    }
    case 'deep': {
      // GLDAS monthly runs ~5 months behind
      const out: Frame[] = [];
      const now = new Date();
      for (let k = 29; k >= 5; k--) {
        const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - k, 1));
        const s = iso(d.getTime());
        out.push({ t: s, url: tile('GLDAS_Underground_Soil_Moisture_Monthly', s, 6, 'png') });
      }
      return out;
    }
    case 'hls':
      return field ? hlsScenes(field.lat, field.lon, signal) : [];
  }
}

interface CmrEntry {
  time_start: string;
  cloud_cover?: string | number;
}

/** Clear 30 m scenes over the field from the last year (Landsat 8/9 and Sentinel-2, harmonized by NASA). */
export async function hlsScenes(lat: number, lon: number, signal?: AbortSignal): Promise<Frame[]> {
  const end = new Date();
  const start = new Date(end.getTime() - 365 * DAY);
  const q = async (shortName: string) => {
    const url =
      `https://cmr.earthdata.nasa.gov/search/granules.json?short_name=${shortName}&version=2.0` +
      `&point=${lon.toFixed(4)},${lat.toFixed(4)}&temporal=${start.toISOString()},${end.toISOString()}` +
      `&cloud_cover=0,60&page_size=200&sort_key=start_date`;
    const r = await fetch(url, { signal });
    if (!r.ok) throw new Error(`CMR ${r.status}`);
    const j = (await r.json()) as { feed: { entry: CmrEntry[] } };
    return j.feed.entry.map((e) => ({ date: e.time_start.slice(0, 10), cloud: Number(e.cloud_cover ?? 100), sensor: shortName }));
  };
  const all = (await Promise.all([q('HLSS30'), q('HLSL30')])).flat();
  // one frame per date: the clearer of the two satellites
  const best = new Map<string, (typeof all)[number]>();
  for (const s of all) {
    const b = best.get(s.date);
    if (!b || s.cloud < b.cloud) best.set(s.date, s);
  }
  const scenes = [...best.values()].sort((a, b) => a.date.localeCompare(b.date));
  // the tile-level cloud cover can still be high over this exact field: keep the clearest ~2 per month
  const byMonth = new Map<string, typeof scenes>();
  for (const s of scenes) {
    const m = s.date.slice(0, 7);
    byMonth.set(m, [...(byMonth.get(m) ?? []), s]);
  }
  const keep = [...byMonth.values()].flatMap((list) => [...list].sort((a, b) => a.cloud - b.cloud).slice(0, 4)).sort((a, b) => a.date.localeCompare(b.date));
  const frames = keep.map((s) => ({
    t: s.date,
    url: tile(s.sensor === 'HLSS30' ? 'HLS_S30_Nadir_BRDF_Adjusted_Reflectance' : 'HLS_L30_Nadir_BRDF_Adjusted_Reflectance', s.date, 12, 'png'),
    sensor: s.sensor === 'HLSS30' ? 'Sentinel-2' : 'Landsat',
  }));
  // look at the pixels around the field itself: drop scenes with clouds or no data there
  const checked = await mapLimit(frames, 6, async (f) => ({ f, sky: await skyOverField(f.url, lat, lon, signal) }));
  const clear = checked.filter((c) => c.sky && c.sky.cloud < 0.12 && c.sky.empty < 0.1);
  // two clearest per month keep the time-lapse even
  const perMonth = new Map<string, typeof clear>();
  for (const c of clear) perMonth.set(c.f.t.slice(0, 7), [...(perMonth.get(c.f.t.slice(0, 7)) ?? []), c]);
  return [...perMonth.values()]
    .flatMap((l) => [...l].sort((a, b) => a.sky!.cloud - b.sky!.cloud).slice(0, 2))
    .sort((a, b) => a.f.t.localeCompare(b.f.t))
    .map((c) => ({ t: c.f.t, url: c.f.url, note: c.f.sensor }));
}

async function mapLimit<T, R>(items: T[], n: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

/** Share of cloud-white and empty pixels in a ~2.5 km window around the field (zoom-12 tile). */
async function skyOverField(url: string, lat: number, lon: number, signal?: AbortSignal): Promise<{ cloud: number; empty: number } | null> {
  const z = 12;
  const n = 2 ** z;
  const fx = ((lon + 180) / 360) * n;
  const r = (lat * Math.PI) / 180;
  const fy = ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n;
  const x = Math.floor(fx);
  const y = Math.floor(fy);
  try {
    const res = await fetch(url.replace('{z}', String(z)).replace('{y}', String(y)).replace('{x}', String(x)), { signal });
    if (!res.ok) return null;
    const bmp = await createImageBitmap(await res.blob());
    const c = new OffscreenCanvas(bmp.width, bmp.height);
    const g = c.getContext('2d');
    if (!g) return null;
    g.drawImage(bmp, 0, 0);
    const px = Math.round((fx - x) * bmp.width);
    const py = Math.round((fy - y) * bmp.height);
    const w = 64;
    const x0 = Math.max(0, Math.min(bmp.width - w, px - w / 2));
    const y0 = Math.max(0, Math.min(bmp.height - w, py - w / 2));
    const d = g.getImageData(x0, y0, w, w).data;
    let cloud = 0;
    let empty = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 20) empty++;
      else if (d[i] > 175 && d[i + 1] > 175 && d[i + 2] > 175) cloud++;
    }
    const total = d.length / 4;
    return { cloud: cloud / total, empty: empty / total };
  } catch {
    return null;
  }
}
