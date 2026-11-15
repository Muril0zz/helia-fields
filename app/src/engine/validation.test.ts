// Does the simulation track real harvests? Compares simulated yield factors with IBGE
// municipal yields (PAM table 1612), after removing the technology trend from IBGE.
// Run: VALIDATE=1 npx vitest run src/engine/validation.test.ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { it } from 'vitest';
import { makeStrategy, simulateAll } from './index';
import { textureFrom } from './soil';
import type { SoilInfo } from './types';

const ibge = JSON.parse(readFileSync(join(__dirname, '__fixtures__/ibge-yields.json'), 'utf8')).data as Record<string, Record<string, Record<string, number>>>;

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

it.skipIf(!process.env.VALIDATE)('simulation vs IBGE municipal yields', () => {
  const lines: string[] = [];
  for (const site of ['sorriso-br', 'vilhena-br']) {
    const file = JSON.parse(readFileSync(join(__dirname, '../../public/demo', `${site}.json`), 'utf8'));
    const sg = file.soilgrids;
    const soil: SoilInfo = { texture: textureFrom(sg.clay, sg.sand), clayPct: sg.clay, sandPct: sg.sand, socGkg: null, ph: null, source: 'SoilGrids' };
    const b = simulateAll({
      series: file.series, soil, site: { slopePct: 1, slopeSource: 'terrain' }, constraints: { irrigation: false, livestock: false },
      scenario: { rainPct: 0, tempDelta: 0 }, current: makeStrategy([{ main: 'soy', second: 'maize' }]),
      priorities: { water: 2, soil: 2, income: 2, risk: 2 },
    });
    for (const cropId of ['soy', 'maize']) {
      const obs = detrend(ibge[site][cropId]);
      const pairs: { year: number; sim: number; obs: number }[] = [];
      b.current.outcomes.forEach((o) =>
        o.runs.filter((r) => r.cropId === cropId).forEach((r) => {
          const year = Number(b.prep.dates[r.harvestIndex].slice(0, 4)); // PAM reports by harvest year
          if (obs[year] !== undefined) pairs.push({ year, sim: r.yieldFactor, obs: obs[year] });
        }),
      );
      const r = pearson(pairs.map((p) => p.sim), pairs.map((p) => p.obs));
      const worstObs = [...pairs].sort((a, z) => a.obs - z.obs).slice(0, 3).map((p) => p.year);
      const worstSim = [...pairs].sort((a, z) => a.sim - z.sim).slice(0, 3).map((p) => p.year);
      lines.push(
        `${site} ${cropId}: n=${pairs.length} r=${r.toFixed(2)} | worst real ${worstObs.join(',')} | worst simulated ${worstSim.join(',')}\n` +
          pairs.map((p) => `   ${p.year} sim ${p.sim.toFixed(2)} obs/trend ${p.obs.toFixed(2)}`).join('\n'),
      );
    }
  }
  console.log(lines.join('\n'));
});
