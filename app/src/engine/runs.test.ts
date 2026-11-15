// Debug: per-season crop runs. Run: SITE=ames-us RUNS=1 npx vitest run src/engine/runs.test.ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { it } from 'vitest';
import { makeStrategy, simulateAll } from './index';
import { DEFAULT_SOIL } from './soil';

it.skipIf(!process.env.RUNS)('runs', () => {
  const id = process.env.SITE ?? 'ames-us';
  const series = JSON.parse(readFileSync(join(__dirname, '../../public/demo', `${id}.json`), 'utf8')).series;
  const b = simulateAll({
    series, soil: DEFAULT_SOIL, site: { slopePct: 2, slopeSource: 'default' },
    constraints: { irrigation: false, livestock: false }, scenario: { rainPct: 0, tempDelta: 0 },
    current: makeStrategy([{ main: 'maize' }, { main: 'soy' }]), priorities: { water: 1, soil: 1, income: 1, risk: 1 },
  });
  const lines = b.current.outcomes.flatMap((o) =>
    o.runs.map((r) =>
      `${b.prep.dates[r.sowIndex]} ${r.cropId.padEnd(6)} days ${String(r.days).padStart(3)} yf ${r.yieldFactor.toFixed(2)} water ${r.waterFactor.toFixed(2)} ETa/ETc ${(r.eta / Math.max(1, r.etc)).toFixed(2)} heat ${r.heatDays} frost ${r.frostHit} mat ${r.matured} wet ${r.wetPenalty.toFixed(2)}`,
    ),
  );
  console.log(`maize plan ${JSON.stringify(b.planner.plan('maize'))} soy ${JSON.stringify(b.planner.plan('soy'))}\n` + lines.join('\n'));
});
