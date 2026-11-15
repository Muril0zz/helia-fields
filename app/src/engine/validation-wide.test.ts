// Wide validation: does the simulation track real harvests across Brazil, Europe and Canada?
// Same method as validation.test.ts (observed yield / linear technology trend vs simulated
// yield factor, paired by harvest year), one single-crop rotation per site and crop.
// Data: python3 tools/fetch_validation.py  (IBGE PAM 1612, Eurostat apro_cpshr, StatCan 32-10-0359-01)
// Run: VALIDATE=1 npx vitest run src/engine/validation-wide.test.ts
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { it } from 'vitest';
import { makeStrategy, simulateAll } from './index';
import { DEFAULT_SOIL } from './soil';

const DIR = join(__dirname, '__fixtures__/validation');

interface SiteYields {
  name: string;
  region: string;
  source: string;
  lat: number;
  lon: number;
  crops: Record<string, Record<string, number>>;
}

function pearson(a: number[], b: number[]) {
  const n = a.length;
  const ma = a.reduce((x, y) => x + y, 0) / n;
  const mb = b.reduce((x, y) => x + y, 0) / n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) {
    num += (a[i] - ma) * (b[i] - mb);
    da += (a[i] - ma) ** 2;
    db += (b[i] - mb) ** 2;
  }
  return num / Math.sqrt(da * db);
}

/** Observed yield relative to its linear technology trend (1.0 = on trend). */
function detrend(series: Record<string, number>) {
  const ys = Object.keys(series).map(Number);
  const vs = ys.map((y) => series[y]);
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  const mv = vs.reduce((a, b) => a + b, 0) / vs.length;
  const slope = ys.reduce((a, y, i) => a + (y - my) * (vs[i] - mv), 0) / ys.reduce((a, y) => a + (y - my) ** 2, 0);
  const out: Record<number, number> = {};
  ys.forEach((y, i) => (out[y] = vs[i] / (mv + slope * (y - my))));
  return out;
}

const median = (xs: number[]) => {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

it.skipIf(!process.env.VALIDATE)('simulation vs official yields (Brazil, Europe, Canada)', { timeout: 600_000 }, () => {
  const yields = JSON.parse(readFileSync(join(DIR, 'yields.json'), 'utf8')) as Record<string, SiteYields>;
  const rows: { region: string; site: string; crop: string; n: number; r: number; hit: boolean; worstObs: number[]; worstSim: number[] }[] = [];
  const skipped: string[] = [];

  for (const [id, site] of Object.entries(yields)) {
    const file = join(DIR, `${id}.json`);
    if (!existsSync(file)) {
      skipped.push(`${id}: no weather file`);
      continue;
    }
    const series = JSON.parse(readFileSync(file, 'utf8'));
    for (const [cropId, observed] of Object.entries(site.crops)) {
      const b = simulateAll({
        series, soil: DEFAULT_SOIL, site: { slopePct: 2, slopeSource: 'default' },
        constraints: { irrigation: false, livestock: false }, scenario: { rainPct: 0, tempDelta: 0 },
        // Brazilian maize is mostly second-season (safrinha) after soybean: simulate it that way
        current: makeStrategy(site.region === 'Brazil' && cropId === 'maize' && !['cruz-alta-rs', 'passo-fundo-rs', 'cascavel-pr', 'toledo-pr', 'lem-ba'].includes(id) ? [{ main: 'soy', second: 'maize' }] : [{ main: cropId }]), priorities: { water: 2, soil: 2, income: 2, risk: 2 },
      });
      const obs = detrend(observed);
      const pairs: { year: number; sim: number; obs: number }[] = [];
      b.current.outcomes.forEach((o) =>
        o.runs.filter((r) => r.cropId === cropId).forEach((r) => {
          const year = Number(b.prep.dates[r.harvestIndex].slice(0, 4)); // official stats report by harvest year
          if (obs[year] !== undefined) pairs.push({ year, sim: r.yieldFactor, obs: obs[year] });
        }),
      );
      if (pairs.length < 5) {
        skipped.push(`${id} ${cropId}: only ${pairs.length} paired years`);
        continue;
      }
      const r = pearson(pairs.map((p) => p.sim), pairs.map((p) => p.obs));
      const worstObs = [...pairs].sort((a, z) => a.obs - z.obs).slice(0, 3).map((p) => p.year);
      const worstSim = [...pairs].sort((a, z) => a.sim - z.sim).slice(0, 3).map((p) => p.year);
      rows.push({ region: site.region, site: id, crop: cropId, n: pairs.length, r, hit: worstSim.includes(worstObs[0]), worstObs, worstSim });
    }
  }

  const pad = (s: string | number, w: number) => String(s).padEnd(w);
  const out = [
    `${pad('site', 24)}${pad('crop', 7)}${pad('n', 4)}${pad('r', 7)}${pad('worst?', 8)}${pad('worst obs', 17)}worst sim`,
    ...rows.map((x) =>
      `${pad(x.site, 24)}${pad(x.crop, 7)}${pad(x.n, 4)}${pad(Number.isFinite(x.r) ? x.r.toFixed(2) : 'nan', 7)}${pad(x.hit ? 'yes' : 'no', 8)}${pad(x.worstObs.join(','), 17)}${x.worstSim.join(',')}`,
    ),
    '',
  ];
  const finite = rows.filter((x) => Number.isFinite(x.r));
  for (const region of ['Brazil', 'Europe', 'Canada']) {
    const rs = finite.filter((x) => x.region === region);
    out.push(`${pad(region, 8)} median r ${median(rs.map((x) => x.r)).toFixed(2)}  (${rs.length} site-crops, ${rs.filter((x) => x.r > 0).length} with r>0, worst year caught ${rs.filter((x) => x.hit).length})`);
  }
  out.push(`${pad('Overall', 8)} median r ${median(finite.map((x) => x.r)).toFixed(2)}  share r>0 ${((100 * finite.filter((x) => x.r > 0).length) / finite.length).toFixed(0)}% of ${finite.length}, worst year caught ${finite.filter((x) => x.hit).length}`);
  if (rows.length !== finite.length) out.push(`NaN r (simulated yield constant): ${rows.filter((x) => !Number.isFinite(x.r)).map((x) => `${x.site} ${x.crop}`).join(', ')}`);
  if (skipped.length) out.push('skipped: ' + skipped.join('; '));
  console.log(out.join('\n'));
});
