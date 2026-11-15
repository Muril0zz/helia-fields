import type { DailySeries, Scenario } from './types';

/** Day of year (1–366) for an ISO date. */
export function doyOf(iso: string): number {
  const d = new Date(`${iso}T00:00:00Z`);
  const start = Date.UTC(d.getUTCFullYear(), 0, 1);
  return Math.floor((d.getTime() - start) / 86_400_000) + 1;
}

const satVp = (t: number) => 0.6108 * Math.exp((17.27 * t) / (t + 237.3));

/** Extraterrestrial radiation Ra, MJ/m²/day (FAO-56 eq. 21). */
export function extraterrestrialRad(latDeg: number, doy: number): number {
  const phi = (latDeg * Math.PI) / 180;
  const dr = 1 + 0.033 * Math.cos(((2 * Math.PI) / 365) * doy);
  const delta = 0.409 * Math.sin(((2 * Math.PI) / 365) * doy - 1.39);
  const ws = Math.acos(Math.max(-1, Math.min(1, -Math.tan(phi) * Math.tan(delta))));
  return (
    ((24 * 60) / Math.PI) *
    0.082 *
    dr *
    (ws * Math.sin(phi) * Math.sin(delta) + Math.cos(phi) * Math.cos(delta) * Math.sin(ws))
  );
}

/**
 * FAO-56 Penman–Monteith reference evapotranspiration, mm/day.
 * Inputs come straight from NASA POWER daily point data.
 */
export function penmanMonteith(
  tmax: number,
  tmin: number,
  rs: number,
  rh: number,
  u2raw: number,
  latDeg: number,
  doy: number,
  elevation: number,
): number {
  const t = (tmax + tmin) / 2;
  const u2 = Math.max(0.5, u2raw); // reanalysis wind under canopies is unrealistically low
  const delta = (4098 * satVp(t)) / (t + 237.3) ** 2;
  const p = 101.3 * ((293 - 0.0065 * elevation) / 293) ** 5.26;
  const gamma = 0.000665 * p;
  const es = (satVp(tmax) + satVp(tmin)) / 2;
  const ea = Math.max(0.05, (Math.min(100, Math.max(1, rh)) / 100) * es);
  const ra = extraterrestrialRad(latDeg, doy);
  const rso = Math.max(0.1, (0.75 + 2e-5 * elevation) * ra);
  const rns = (1 - 0.23) * rs;
  const sigma = 4.903e-9;
  // FAO-56 limits Rs/Rso to 0.25–1 so dark or overcast days never turn longwave into a gain
  const ratio = Math.max(0.25, Math.min(1, rs / rso));
  const rnl =
    sigma *
    (((tmax + 273.16) ** 4 + (tmin + 273.16) ** 4) / 2) *
    (0.34 - 0.14 * Math.sqrt(ea)) *
    (1.35 * ratio - 0.35);
  const rn = rns - rnl;
  const et0 = (0.408 * delta * rn + gamma * (900 / (t + 273)) * u2 * (es - ea)) / (delta + gamma * (1 + 0.34 * u2));
  return Math.max(0, et0);
}

/** Weather after applying a what-if scenario, plus derived daily ET0. */
export interface PreparedSeries {
  dates: string[];
  doy: number[];
  year: number[];
  tmax: number[];
  tmin: number[];
  prec: number[];
  et0: number[];
  gwetRoot: number[];
  lat: number;
}

export function prepare(series: DailySeries, scenario: Scenario): PreparedSeries {
  const n = series.dates.length;
  const rainK = 1 + scenario.rainPct / 100;
  const dT = scenario.tempDelta;
  const out: PreparedSeries = {
    dates: series.dates,
    doy: new Array(n),
    year: new Array(n),
    tmax: new Array(n),
    tmin: new Array(n),
    prec: new Array(n),
    et0: new Array(n),
    gwetRoot: series.gwetRoot,
    lat: series.lat,
  };
  for (let i = 0; i < n; i++) {
    const doy = doyOf(series.dates[i]);
    const tx = series.tmax[i] + dT;
    const tn = series.tmin[i] + dT;
    out.doy[i] = doy;
    out.year[i] = Number(series.dates[i].slice(0, 4));
    out.tmax[i] = tx;
    out.tmin[i] = tn;
    out.prec[i] = Math.max(0, series.prec[i] * rainK);
    out.et0[i] = penmanMonteith(tx, tn, series.rad[i], series.rh[i], series.wind[i], series.lat, doy, series.elevation);
  }
  return out;
}

export interface Climatology {
  /** 365 values, index 0 = 1 January, smoothed with a 31-day window. */
  prec: number[];
  et0: number[];
  tmean: number[];
  tmin: number[];
  tmax: number[];
  annualRain: number;
  annualEt0: number;
  /** Month means (12). */
  monthly: { prec: number[]; et0: number[]; tmean: number[] };
}

export function climatology(s: PreparedSeries): Climatology {
  const sum = { prec: new Array(365).fill(0), et0: new Array(365).fill(0), tmean: new Array(365).fill(0), tmin: new Array(365).fill(0), tmax: new Array(365).fill(0) };
  const count = new Array(365).fill(0);
  for (let i = 0; i < s.dates.length; i++) {
    const k = Math.min(365, s.doy[i]) - 1;
    sum.prec[k] += s.prec[i];
    sum.et0[k] += s.et0[i];
    sum.tmean[k] += (s.tmax[i] + s.tmin[i]) / 2;
    sum.tmin[k] += s.tmin[i];
    sum.tmax[k] += s.tmax[i];
    count[k]++;
  }
  const raw = (arr: number[]) => arr.map((v, k) => (count[k] ? v / count[k] : 0));
  const smooth = (arr: number[]) =>
    arr.map((_, k) => {
      let acc = 0;
      for (let j = -15; j <= 15; j++) acc += arr[(k + j + 365) % 365];
      return acc / 31;
    });
  const prec = smooth(raw(sum.prec));
  const et0 = smooth(raw(sum.et0));
  const tmean = smooth(raw(sum.tmean));
  const tmin = smooth(raw(sum.tmin));
  const tmax = smooth(raw(sum.tmax));
  const monthStarts = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334, 365];
  const monthMean = (arr: number[], total: boolean) =>
    monthStarts.slice(0, 12).map((m, i) => {
      const seg = arr.slice(m, monthStarts[i + 1]);
      const s2 = seg.reduce((a, b) => a + b, 0);
      return total ? s2 : s2 / seg.length;
    });
  return {
    prec, et0, tmean, tmin, tmax,
    annualRain: prec.reduce((a, b) => a + b, 0),
    annualEt0: et0.reduce((a, b) => a + b, 0),
    monthly: { prec: monthMean(prec, true), et0: monthMean(et0, true), tmean: monthMean(tmean, false) },
  };
}
