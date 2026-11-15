import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { makeStrategy, rank, simulateAll } from './index';
import { OUTLOOK_SPEC, phaseOf, seasonOni } from './enso';
import { DEFAULT_SOIL } from './soil';
import type { RotationYear } from './types';

it('labels known ENSO seasons from NOAA ONI', () => {
  expect(phaseOf(seasonOni('2015-10-15'))).toBe('elnino'); // 2015/16 super El Niño
  expect(phaseOf(seasonOni('2023-10-15'))).toBe('elnino'); // 2023/24 El Niño
  expect(phaseOf(seasonOni('2010-10-15'))).toBe('lanina'); // 2010/11 La Niña
  expect(phaseOf(seasonOni('2013-10-15'))).toBe('neutral');
});

const SITES: [string, RotationYear[], boolean][] = [
  ['sorriso-br', [{ main: 'soy', second: 'maize' }], false],
  ['vilhena-br', [{ main: 'soy', second: 'maize' }], false],
  ['salina-us', [{ main: 'wheat' }], false],
  ['nakuru-ke', [{ main: 'maize' }], false],
  ['ames-us', [{ main: 'maize' }, { main: 'soy' }], false],
];

it('re-ranks on El Niño analog seasons', () => {
  const P = { water: 1, soil: 1, income: 1, risk: 1 };
  for (const [id, cur, irr] of SITES) {
    const series = JSON.parse(readFileSync(join(__dirname, '../../public/demo', `${id}.json`), 'utf8')).series;
    const b = simulateAll({
      series, soil: DEFAULT_SOIL, site: { slopePct: 3, slopeSource: 'default' },
      constraints: { irrigation: irr, livestock: true }, scenario: { rainPct: 0, tempDelta: 0 },
      current: makeStrategy(cur), priorities: P,
    });
    const all = rank(b, P);
    const nino = rank(b, P, 3, 'en', OUTLOOK_SPEC);
    expect(nino.analog?.phase).toBe('elnino');
    expect(nino.recommendations.length).toBeGreaterThan(0);
    if (process.env.REPORT) {
      const f = (r: typeof all.current) => `${r.strategy.name} margin ${Math.round(r.metrics.margin.mean)} fail ${Math.round(r.metrics.failureRate * 100)}% total ${Math.round(r.scores.total)}`;
      console.log(
        `\n=== ${id} seasons: ${all.seasons.map((s) => `${s.year}${s.phase === 'elnino' ? 'N' : s.phase === 'lanina' ? 'L' : ''}`).join(' ')}` +
          `\n El Niño analogs: ${nino.analog?.years.join(', ')} (used: ${nino.analog?.used})` +
          `\n ALL   current: ${f(all.current)}\n       best:    ${f(all.recommendations[0])}` +
          `\n NINO  current: ${f(nino.current)}\n       ${nino.recommendations.map(f).join('\n       ')}`,
      );
    }
  }
});
