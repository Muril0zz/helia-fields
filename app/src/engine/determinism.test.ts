import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { makeStrategy, rank, simulateAll } from './index';
import type { SoilInfo } from './types';

const clay: SoilInfo = { texture: 'clay', clayPct: 50, sandPct: 20, socGkg: null, ph: null, source: 'farmer' };

it('is deterministic and slope only moves erosion, not money', () => {
  const series = JSON.parse(readFileSync(join(__dirname, '../../public/demo/sorriso-br.json'), 'utf8')).series;
  const run = (slopePct: number) => {
    const b = simulateAll({
      series, soil: clay, site: { slopePct, slopeSource: 'terrain' }, constraints: { irrigation: false, livestock: false },
      scenario: { rainPct: 0, tempDelta: 0 }, current: makeStrategy([{ main: 'soy', second: 'maize' }]),
      priorities: { water: 2, soil: 2, income: 2, risk: 2 },
    });
    return rank(b, { water: 2, soil: 2, income: 2, risk: 2 });
  };
  const a = run(1);
  const b = run(1);
  const c = run(3);
  expect(a.current.metrics.margin.mean).toBe(b.current.metrics.margin.mean);
  expect(a.current.metrics.margin.mean).toBe(c.current.metrics.margin.mean);
  console.log('margin', a.current.metrics.margin.mean, 'straw', a.current.metrics.residueT.mean, 'rainOnBare', a.current.metrics.rainOnBareMm.mean, c.current.metrics.rainOnBareMm.mean);
});
