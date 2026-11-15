// Prints a human-readable report per demo site. Run: npx vitest run src/engine/report.test.ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { it } from 'vitest';
import { makeStrategy, rank, simulateAll, monthOfDoy } from './index';
import { DEFAULT_SOIL } from './soil';
import type { RotationYear } from './types';

const SITES: [string, RotationYear[], boolean][] = [
  ['sorriso-br', [{ main: 'soy', second: 'maize' }], false],
  ['vilhena-br', [{ main: 'soy', second: 'maize' }], false],
  ['salina-us', [{ main: 'wheat' }], false],
  ['ludhiana-in', [{ main: 'rice', second: 'wheat' }], true],
  ['nakuru-ke', [{ main: 'maize' }], false],
  ['ames-us', [{ main: 'maize' }, { main: 'soy' }], false],
];

it.skipIf(!process.env.REPORT)('report', () => {
  for (const [id, cur, irr] of SITES) {
    const series = JSON.parse(readFileSync(join(__dirname, '../../public/demo', `${id}.json`), 'utf8')).series;
    const b = simulateAll({
      series, soil: DEFAULT_SOIL, site: { slopePct: 3, slopeSource: 'default' },
      constraints: { irrigation: irr, livestock: true }, scenario: { rainPct: 0, tempDelta: 0 },
      current: makeStrategy(cur), priorities: { water: 1, soil: 1, income: 1, risk: 1 },
    });
    const r = rank(b, { water: 1, soil: 1, income: 1, risk: 1 });
    const lines: string[] = [];
    lines.push(`\n=== ${id}  rain ${Math.round(b.clim.annualRain)} mm  et0 ${Math.round(b.clim.annualEt0)} mm  ${Math.round(b.ms)} ms, ${b.candidates.length} simulated`);
    const show = (x: typeof r.current) => {
      const m = x.metrics;
      lines.push(
        `${x.strategy.name}\n   scores W${Math.round(x.scores.water)} S${Math.round(x.scores.soil)} $${Math.round(x.scores.income)} R${Math.round(x.scores.risk)} = ${Math.round(x.scores.total)} | bare ${Math.round(m.bareDays.mean)}d rainOnBare ${Math.round(m.rainOnBareMm.mean)}mm residue ${m.residueT.mean.toFixed(1)}t N ${Math.round(m.nCredit.mean)} margin ${Math.round(m.margin.mean)} [${Math.round(m.margin.p10)}..${Math.round(m.margin.p90)}] water ${Math.round(m.waterStress.mean * 100)}% irr ${Math.round(m.irrigationMm.mean)} fail ${Math.round(m.failureRate * 100)}%`,
      );
      lines.push('   cal: ' + x.calendar.map((c) => `${c.cropId ?? 'BARE'}@${monthOfDoy(c.startDoy)}(${Math.round(c.days)}d)`).join(' '));
      const yf: Record<string, number[]> = {};
      x.outcomes.flatMap((o) => o.runs).forEach((run) => (yf[run.cropId] ??= []).push(run.yieldFactor));
      lines.push('   yield: ' + Object.entries(yf).map(([k, v]) => `${k} ${(v.reduce((a, c) => a + c, 0) / v.length).toFixed(2)}`).join(', '));
      lines.push('   >> ' + x.explanation.headline);
    };
    lines.push('CURRENT:');
    show(r.current);
    r.recommendations.forEach((x, i) => {
      lines.push(`REC ${i + 1}:`);
      show(x);
    });
    console.log(lines.join('\n'));
  }
});
