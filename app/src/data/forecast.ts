/** 16-day rain forecast for the field (Open-Meteo: ECMWF, GFS and national weather models blended). */
export interface RainForecast {
  days: { date: string; mm: number; prob: number }[];
  /** First day of a sowing rain (≥ 25 mm over 3 days, the rule the engine uses), if any. */
  sowingRain: string | null;
}

export async function fetchRainForecast(lat: number, lon: number, signal?: AbortSignal): Promise<RainForecast> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(3)}&longitude=${lon.toFixed(3)}` +
    `&daily=precipitation_sum,precipitation_probability_max&forecast_days=16&timezone=auto`;
  const r = await fetch(url, { signal });
  if (!r.ok) throw new Error(`forecast ${r.status}`);
  const j = (await r.json()) as { daily: { time: string[]; precipitation_sum: (number | null)[]; precipitation_probability_max: (number | null)[] } };
  const days = j.daily.time.map((date, i) => ({ date, mm: j.daily.precipitation_sum[i] ?? 0, prob: j.daily.precipitation_probability_max[i] ?? 0 }));
  let sowingRain: string | null = null;
  for (let i = 0; i + 2 < days.length; i++) {
    if (days[i].mm + days[i + 1].mm + days[i + 2].mm >= 25) {
      sowingRain = days[i].date;
      break;
    }
  }
  return { days, sowingRain };
}
