import { fetchJson } from './fetchJson';

export interface NdviPoint {
  date: string; // YYYY-MM-DD
  ndvi: number;
}

export interface CycleReading {
  points: NdviPoint[];
  cyclesPerYear: number;
  peaks: NdviPoint[];
  /** Months (0–11) in which the field is typically bare (NDVI < 0.35). */
  bareMonths: number[];
  kind: 'single' | 'double' | 'triple' | 'perennial' | 'sparse';
  label: string;
}

interface OrnlDates {
  dates: { modis_date: string; calendar_date: string }[];
}
interface OrnlSubset {
  subset: { calendar_date: string; data: number[] }[];
}

const BASE = 'https://modis.ornl.gov/rst/api/v1/MOD13Q1';

/**
 * MODIS Terra 250 m 16-day NDVI (MOD13Q1) for the pixel under a point,
 * through the ORNL DAAC web service (10 dates per request).
 */
export async function fetchNdvi(lat: number, lon: number, fromYear: number, signal?: AbortSignal): Promise<NdviPoint[]> {
  const q = `latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}`;
  const all = await fetchJson<OrnlDates>(`${BASE}/dates?${q}`, 20_000, signal);
  const dates = all.dates.filter((d) => Number(d.calendar_date.slice(0, 4)) >= fromYear);
  const chunks: (typeof dates)[] = [];
  for (let i = 0; i < dates.length; i += 10) chunks.push(dates.slice(i, i + 10));
  const out: NdviPoint[] = [];
  const queue = [...chunks];
  const worker = async () => {
    while (queue.length) {
      const ch = queue.shift()!;
      const url = `${BASE}/subset?${q}&band=250m_16_days_NDVI&startDate=${ch[0].modis_date}&endDate=${ch[ch.length - 1].modis_date}&kmAboveBelow=0&kmLeftRight=0`;
      const d = await fetchJson<OrnlSubset>(url, 30_000, signal);
      d.subset.forEach((s) => {
        const v = s.data[0];
        if (typeof v === 'number' && v > -2000) out.push({ date: s.calendar_date, ndvi: v * 0.0001 });
      });
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/** Reads cropping cycles from an NDVI time series (green-up peaks per year). */
export function readCycles(points: NdviPoint[]): CycleReading {
  if (points.length < 12) {
    return { points, cyclesPerYear: 0, peaks: [], bareMonths: [], kind: 'sparse', label: 'Not enough clear MODIS observations' };
  }
  // 3-point median to remove cloud dips
  const v = points.map((p, i) => {
    const w = [points[i - 1]?.ndvi ?? p.ndvi, p.ndvi, points[i + 1]?.ndvi ?? p.ndvi].sort((a, b) => a - b);
    return w[1];
  });
  const peaks: NdviPoint[] = [];
  let lastMin = v[0];
  for (let i = 1; i < v.length - 1; i++) {
    lastMin = Math.min(lastMin, v[i]);
    if (v[i] >= v[i - 1] && v[i] > v[i + 1] && v[i] >= 0.55) {
      // prominence: must rise from a trough and fall after
      let after = v[i];
      for (let j = i + 1; j < Math.min(v.length, i + 8); j++) after = Math.min(after, v[j]);
      if (v[i] - lastMin >= 0.12 && v[i] - after >= 0.12) {
        peaks.push({ date: points[i].date, ndvi: v[i] });
        lastMin = v[i];
      }
    }
  }
  const spanYears = (Date.parse(points[points.length - 1].date) - Date.parse(points[0].date)) / (365.25 * 86_400_000);
  const cyclesPerYear = spanYears > 0 ? peaks.length / spanYears : 0;
  const monthLow = new Array(12).fill(0);
  const monthN = new Array(12).fill(0);
  points.forEach((p, i) => {
    const m = Number(p.date.slice(5, 7)) - 1;
    monthN[m]++;
    if (v[i] < 0.35) monthLow[m]++;
  });
  const bareMonths = monthLow.map((c, m) => (monthN[m] && c / monthN[m] >= 0.5 ? m : -1)).filter((m) => m >= 0);
  const minV = Math.min(...v);
  let kind: CycleReading['kind'];
  let label: string;
  if (minV > 0.5 && peaks.length / Math.max(1, spanYears) < 0.8) {
    kind = 'perennial';
    label = 'Green all year: perennial pasture, forest or sugarcane';
  } else if (cyclesPerYear >= 2.5) {
    kind = 'triple';
    label = `${cyclesPerYear.toFixed(1)} green-up cycles a year: three crops`;
  } else if (cyclesPerYear >= 1.5) {
    kind = 'double';
    label = `${cyclesPerYear.toFixed(1)} green-up cycles a year: two crops (e.g. soybean + second crop)`;
  } else if (cyclesPerYear >= 0.5) {
    kind = 'single';
    label = `${cyclesPerYear.toFixed(1)} green-up cycles a year: one crop, then fallow`;
  } else {
    kind = 'sparse';
    label = 'No clear crop cycles: rangeland, dry land or mixed pixel';
  }
  return { points, cyclesPerYear, peaks, bareMonths, kind, label };
}
