import type { DailySeries } from '../engine';
import { fetchJson } from './fetchJson';

const PARAMS = 'T2M_MAX,T2M_MIN,PRECTOTCORR,ALLSKY_SFC_SW_DWN,RH2M,WS2M,GWETROOT';
export const POWER_START = 2005;
export const POWER_END = 2025;

interface PowerResponse {
  geometry?: { coordinates?: number[] };
  properties: { parameter: Record<string, Record<string, number>> };
}

const cache = new Map<string, Promise<DailySeries>>();

/** NASA POWER daily point data (community AG), 2005–2025, straight from the browser. */
export function fetchPower(lat: number, lon: number, signal?: AbortSignal): Promise<DailySeries> {
  const key = `${lat.toFixed(3)},${lon.toFixed(3)}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const url =
    'https://power.larc.nasa.gov/api/temporal/daily/point' +
    `?parameters=${PARAMS}&community=AG&longitude=${lon.toFixed(4)}&latitude=${lat.toFixed(4)}` +
    `&start=${POWER_START}0101&end=${POWER_END}1231&format=JSON`;
  const p = fetchJson<PowerResponse>(url, 45_000, signal).then((d) => toSeries(d, lat, lon));
  cache.set(key, p);
  p.catch(() => cache.get(key) === p && cache.delete(key));
  // an aborted request must never be handed to the next caller
  signal?.addEventListener('abort', () => cache.get(key) === p && cache.delete(key), { once: true });
  return p;
}

export function toSeries(d: PowerResponse, lat: number, lon: number): DailySeries {
  const p = d.properties.parameter;
  const keys = Object.keys(p.T2M_MAX).sort();
  const col = (name: string, fallback: number) => {
    let last = fallback;
    return keys.map((k) => {
      const v = p[name]?.[k];
      if (v === undefined || v === null || v === -999) return last;
      last = v;
      return v;
    });
  };
  const z = d.geometry?.coordinates?.[2];
  return {
    dates: keys.map((k) => `${k.slice(0, 4)}-${k.slice(4, 6)}-${k.slice(6, 8)}`),
    tmax: col('T2M_MAX', 25),
    tmin: col('T2M_MIN', 15),
    prec: col('PRECTOTCORR', 0),
    rad: col('ALLSKY_SFC_SW_DWN', 18),
    rh: col('RH2M', 70),
    wind: col('WS2M', 2),
    gwetRoot: col('GWETROOT', 0.5),
    lat,
    lon,
    elevation: typeof z === 'number' ? z : 300,
  };
}
