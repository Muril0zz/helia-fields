// Debug: full ranking for one site. Run: SITE=ludhiana-in IRR=1 RANKING=1 npx vitest run src/engine/ranking.test.ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { it } from 'vitest';
import { makeStrategy, simulateAll } from './index';
import { score } from './strategy';
import { DEFAULT_SOIL } from './soil';

it.skipIf(!process.env.RANKING)('ranking', () => {
  const id = process.env.SITE ?? 'ludhiana-in';
  const series = JSON.parse(readFileSync(join(__dirname, '../../public/demo', `${id}.json`), 'utf8')).series;
  const b = simulateAll({
    series, soil: DEFAULT_SOIL, site: { slopePct: 1, slopeSource: 'default' },
    constraints: { irrigation: !!process.env.IRR, livestock: true }, scenario: { rainPct: 0, tempDelta: 0 },
    current: makeStrategy(process.env.TWO ? [{ main: 'maize' }, { main: 'soy' }] : [{ main: process.env.MAIN ?? 'rice', second: process.env.SECOND || undefined }]),
    priorities: { water: 2, soil: 2, income: 2, risk: 2 },
  });
  const p = { water: 2, soil: 2, income: 2, risk: 2 };
  const rows = b.candidates
    .map((c) => ({ c, s: score(c, b.clim.annualRain, p) }))
    .sort((a, z) => z.s.total - a.s.total)
    .slice(0, 25)
    .map(({ c, s }) => `${s.total.toFixed(1)}  W${s.water.toFixed(0)} S${s.soil.toFixed(0)} $${s.income.toFixed(0)} R${s.risk.toFixed(0)}  margin ${c.metrics.margin.mean.toFixed(0)} irr ${c.metrics.irrigationMm.mean.toFixed(0)}  ${c.strategy.name}`);
  const sow = ['maize', 'wheat', 'rice', 'soy', 'sorghum'].map((k) => `${k}@${b.planner.plan(k).doy} y${b.planner.plan(k).yieldFactor.toFixed(2)}`);
  console.log(sow.join('  ') + '\n' + rows.join('\n'));
});
