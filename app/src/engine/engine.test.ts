import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { climatology, extraterrestrialRad, penmanMonteith, prepare } from './climate';
import { makeStrategy, rank, simulateAll } from './index';
import { DEFAULT_SOIL, textureFrom } from './soil';
import type { DailySeries, Priorities } from './types';

function load(id: string): DailySeries {
  const raw = JSON.parse(readFileSync(join(__dirname, '../../public/demo', `${id}.json`), 'utf8'));
  return raw.series as DailySeries;
}

const balanced: Priorities = { water: 1, soil: 1, income: 1, risk: 1 };
const noIrr = { irrigation: false, livestock: false };
const flat = { slopePct: 3, slopeSource: 'default' as const };

describe('FAO-56 physics', () => {
  it('matches the FAO-56 worked example for extraterrestrial radiation', () => {
    // FAO-56 example 8: 20°S on 3 September (doy 246) → Ra = 32.2 MJ/m²/day
    expect(extraterrestrialRad(-20, 246)).toBeCloseTo(32.2, 0);
  });
  it('gives a plausible tropical reference ET', () => {
    const et0 = penmanMonteith(32, 21, 20, 70, 2, -12.5, 280, 380);
    expect(et0).toBeGreaterThan(3.5);
    expect(et0).toBeLessThan(6.5);
  });
  it('classifies soil texture', () => {
    expect(textureFrom(45, 20)).toBe('clay');
    expect(textureFrom(10, 88)).toBe('sand');
    expect(textureFrom(15, 40)).toBe('loam');
  });
});

describe('Sorriso, Mato Grosso (soy + second-season maize belt)', () => {
  const series = load('sorriso-br');
  const prep = prepare(series, { rainPct: 0, tempDelta: 0 });
  const clim = climatology(prep);

  it('sees a wet season (MERRA-2 corrected rain ≈ 1,450 mm) and a dry winter', () => {
    expect(clim.annualRain).toBeGreaterThan(1200);
    expect(clim.annualRain).toBeLessThan(2500);
    const jul = clim.monthly.prec[6];
    const jan = clim.monthly.prec[0];
    expect(jul).toBeLessThan(30);
    expect(jan).toBeGreaterThan(200);
  });

  const current = makeStrategy([{ main: 'soy', second: 'maize' }]);
  const bundle = simulateAll({
    series, soil: DEFAULT_SOIL, site: flat, constraints: noIrr,
    scenario: { rainPct: 0, tempDelta: 0 }, current, priorities: balanced,
  });

  it('sows soybean at the onset of the rains (Sep–Nov)', () => {
    const doy = bundle.planner.plan('soy').doy;
    expect(doy).toBeGreaterThanOrEqual(244);
    expect(doy).toBeLessThanOrEqual(335);
  });

  it('simulates ~20 seasons with soybean well watered', () => {
    expect(bundle.current.outcomes.length).toBeGreaterThanOrEqual(18);
    const soy = bundle.current.outcomes.flatMap((o) => o.runs).filter((r) => r.cropId === 'soy');
    const mean = soy.reduce((a, r) => a + r.yieldFactor, 0) / soy.length;
    expect(mean).toBeGreaterThan(0.75);
  });

  it('leaves the field bare in the dry season under soy → maize → fallow', () => {
    expect(bundle.current.metrics.bareDays.mean).toBeGreaterThan(60);
  });

  it('recommends three distinct rotations that cover the soil better', () => {
    const r = rank(bundle, balanced);
    expect(r.recommendations).toHaveLength(3);
    const ids = new Set(r.recommendations.map((x) => x.strategy.id));
    expect(ids.size).toBe(3);
    for (const rec of r.recommendations) {
      expect(rec.explanation.why.length).toBeGreaterThan(0);
      expect(rec.explanation.evidence.length).toBeGreaterThan(2);
      expect(rec.explanation.gaps.length).toBeGreaterThan(0);
      expect(rec.explanation.risks.length).toBeGreaterThan(0);
    }
    const best = r.recommendations[0];
    expect(best.scores.soil).toBeGreaterThan(r.current.scores.soil);
  });

  it('explains every option in Portuguese too, with the same numbers', () => {
    const en = rank(bundle, balanced, 3, 'en');
    const pt = rank(bundle, balanced, 3, 'pt');
    expect(pt.recommendations.map((r) => r.strategy.id)).toEqual(en.recommendations.map((r) => r.strategy.id));
    for (const r of [pt.current, ...pt.recommendations]) {
      const e = r.explanation;
      for (const k of ['why', 'evidence', 'benefits', 'gaps', 'risks'] as const) expect(e[k].length).toBeGreaterThan(0);
      const all = [e.headline, ...e.why, ...e.evidence, ...e.benefits, ...e.gaps, ...e.risks].join(' ');
      expect(all).not.toMatch(/\b(Bare soil|Simulated over|Indicative margin|Weather is a|Ranked for)\b/);
    }
    expect(pt.current.explanation.headline).toMatch(/^Hoje: \d+ dias/);
  });

  it('a drier, hotter scenario hurts the second crop', () => {
    const dry = simulateAll({
      series, soil: DEFAULT_SOIL, site: flat, constraints: noIrr,
      scenario: { rainPct: -30, tempDelta: 2 }, current, priorities: balanced,
    });
    const yf = (b: typeof bundle) => {
      const runs = b.current.outcomes.flatMap((o) => o.runs).filter((x) => x.role === 'second');
      return runs.reduce((a, x) => a + x.yieldFactor, 0) / runs.length;
    };
    expect(yf(dry)).toBeLessThan(yf(bundle));
  });

  it('runs fast enough for live sliders', () => {
    expect(bundle.ms).toBeLessThan(4000);
  });
});

describe('other climates', () => {
  it('Kansas: summer crops sown in spring, wheat in autumn', () => {
    const series = load('salina-us');
    const b = simulateAll({
      series, soil: DEFAULT_SOIL, site: flat, constraints: noIrr, scenario: { rainPct: 0, tempDelta: 0 },
      current: makeStrategy([{ main: 'wheat' }]), priorities: balanced,
    });
    const maizeDoy = b.planner.plan('maize').doy;
    expect(maizeDoy).toBeGreaterThan(90);
    expect(maizeDoy).toBeLessThan(170);
    const wheatDoy = b.planner.plan('wheat').doy;
    expect(wheatDoy > 230 || wheatDoy < 30).toBe(true);
    expect(rank(b, balanced).recommendations.length).toBeGreaterThan(0);
  });

  it('Iowa corn belt: maize and soybean succeed most years (season-matched varieties)', () => {
    const series = load('ames-us');
    const b = simulateAll({
      series, soil: DEFAULT_SOIL, site: flat, constraints: noIrr, scenario: { rainPct: 0, tempDelta: 0 },
      current: makeStrategy([{ main: 'maize' }, { main: 'soy' }]), priorities: balanced,
    });
    const runs = b.current.outcomes.flatMap((o) => o.runs);
    const mean = (id: string) => {
      const r = runs.filter((x) => x.cropId === id);
      return r.reduce((a, x) => a + x.yieldFactor, 0) / r.length;
    };
    expect(mean('maize')).toBeGreaterThan(0.6);
    expect(mean('soy')).toBeGreaterThan(0.6);
    expect(runs.filter((r) => r.frostHit).length).toBe(0);
    expect(b.current.metrics.failureRate).toBeLessThan(0.35);
  });

  it('Punjab: irrigated rice → wheat is feasible', () => {
    const series = load('ludhiana-in');
    const b = simulateAll({
      series, soil: DEFAULT_SOIL, site: flat, constraints: { irrigation: true, livestock: false },
      scenario: { rainPct: 0, tempDelta: 0 }, current: makeStrategy([{ main: 'rice', second: 'wheat' }]), priorities: balanced,
    });
    expect(b.current.feasible).toBe(true);
    expect(b.current.metrics.irrigationMm.mean).toBeGreaterThan(300);
  });
});
