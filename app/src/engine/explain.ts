import { crop } from './crops';
import { cropLabel, cropNote, monthName, pestWhy, textureName, type Lang } from './lang';
import type { SimulatedStrategy } from './strategy';
import { pestConflicts, strategyCrops } from './strategy';
import type { Constraints, Explanation, Priorities, SoilInfo } from './types';

/** English month abbreviation for a day of year (kept for callers outside the explainer). */
export function monthOfDoy(doy: number): string {
  return monthName(doy, 'en');
}

/** Human description of the longest bare stretch in the typical calendar. */
export function bareWindow(sim: SimulatedStrategy, lang: Lang = 'en'): { from: string; to: string; days: number } | null {
  const bare = sim.calendar.filter((b) => b.role === 'bare').sort((a, b) => b.days - a.days)[0];
  if (!bare || bare.days < 15) return null;
  return { from: monthName(bare.startDoy, lang), to: monthName(((bare.startDoy + bare.days - 2) % 365) + 1, lang), days: Math.round(bare.days) };
}

const r0 = (v: number) => Math.round(v);
let MONEY = { code: 'USD', fx: 1 };
/** Currency for explanation texts (engine values stay in USD). */
export function setMoney(m: { code: string; fx: number } | undefined) {
  MONEY = m ?? { code: 'USD', fx: 1 };
}
const money = (v: number) => {
  const local = v * MONEY.fx;
  const sym = MONEY.code === 'USD' ? 'US$' : MONEY.code === 'BRL' ? 'R$ ' : `${MONEY.code} `;
  return `${local < 0 ? '−' : ''}${sym}${Math.abs(Math.round(local / 10) * 10).toLocaleString(MONEY.code === 'BRL' ? 'pt-BR' : 'en-US')}`;
};
const list = (items: string[], lang: Lang) =>
  items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} ${lang === 'pt' ? 'e' : 'and'} ${items[items.length - 1]}`;

export interface ExplainInput {
  sim: SimulatedStrategy;
  current: SimulatedStrategy;
  isCurrent: boolean;
  priorities: Priorities;
  constraints: Constraints;
  soil: SoilInfo;
  years: { first: number; last: number };
  gwetAtSowing: number | null;
  lang?: Lang;
}

/** Every sentence the explainer can say, in both languages, with the same numbers. */
const T = {
  en: {
    current: 'This is the rotation you run today, simulated on the same weather so every option is compared fairly.',
    fillsGap: (f: string, t: string, d: number) => `Fills the ${f}–${t} gap when your field now sits bare (${d} days).`,
    roots: (d: number) => `Keeps living roots in the soil ${d} more days a year.`,
    legume: (names: string) => `Adds a nitrogen-fixing legume (${names}).`,
    pestBreak: 'Breaks a pest and disease cycle that your current sequence keeps alive.',
    margin: (m: string) => `Raises indicative margin by ${m}/ha a year.`,
    fails: 'Fails less often in bad years.',
    prio: { water: 'saving water', soil: 'soil health', income: 'income', risk: 'lower risk' },
    top: (p: string) => `Ranked for your top priority: ${p}.`,
    tops: (p: string) => `Ranked for your priorities: ${p}.`,
    balance: 'Ranked for a balance of water, soil, income and risk.',
    shift: (main: string, days: number, second: string) => `Sows ${main} about ${days} days earlier than its best single-crop date so ${second} fits after it.`,
    simulated: (n: number, p: string) => `Simulated over ${n} seasons of NASA POWER daily weather (${p}), FAO-56 water balance.`,
    sowing: (s: string) => `Typical sowing: ${s} (each year follows its own rain onset).`,
    bare: (v: number, now: number | null) => `Bare soil ${v} days/yr${now === null ? '' : ` (now ${now})`}.`,
    rainBare: (v: number, now: number | null) => `Rain hitting unprotected soil ${v} mm/yr${now === null ? '' : ` (now ${now})`}.`,
    water: (v: number, w: number) => `Crop water demand met ${v}% on average; worst decile ${w}%.`,
    second: (ok: number, n: number) => `Second crop reaches ≥60% of potential in ${ok} of ${n} seasons.`,
    gwet: (v: number) => `Root-zone soil wetness at sowing ${v}% (NASA GWETROOT, MERRA-2).`,
    soil: (t: string, c: number) => `Soil ${t}, ${c}% clay (ISRIC SoilGrids 250 m).`,
    nLeft: (v: number) => `~${v} kg N/ha a year left for the next crop.`,
    straw: (v: string) => `${v} t/ha of straw a year builds organic matter for no-till.`,
    cut: (v: number) => `Cuts rain on exposed soil by ${v}%, the main driver of erosion and crusting.`,
    families: (n: number) => `${n} plant families in the sequence: more root types, fewer shared pests.`,
    sunn: 'Sunn hemp suppresses root-knot and lesion nematodes.',
    pasture: 'Dry-season pasture for cattle (integrated crop-livestock).',
    marginVs: (m: string, d: string) => `Indicative margin ${m}/ha (${d} vs now).`,
    marginNow: (m: string) => `Indicative margin ${m}/ha a year.`,
    irrigation: (v: number) => `Needs ~${v} mm/yr of irrigation.`,
    gapWeather: 'Weather is a ~50 km NASA POWER grid cell: local rain can differ; add your own rain-gauge records.',
    gapSoil: 'Soil texture is modelled, not measured: confirm with a lab soil test.',
    gapPrice: 'Prices and costs are indicative global values: replace with your local quotes.',
    gapSeed: (names: string) => `No local data on seed supply or buyers for ${names}.`,
    gapPest: 'Pest and disease pressure is not observed from space; history of this field matters.',
    frost: (y: number, n: number) => `Frost hit a crop in ${y} of ${n} seasons.`,
    heat: (n: number) => `Heat above the crop limit during flowering in ${n} crop-seasons.`,
    failRate: (v: number) => `At least one crop fell below 60% of potential in ${v}% of seasons.`,
    headNow: (b: number, w: number) => `Today: ${b} bare days a year, ${w}% of water demand met.`,
    hBare: (d: number) => `${d} fewer bare days`,
    hN: (n: number) => `+${n} kg N/ha`,
    hFail: (v: number) => `${v} pts fewer failed seasons`,
    hWater: (v: number) => `${v}% more water demand met`,
    hSimilar: 'Similar outcome, more diversity',
  },
  pt: {
    current: 'Esta é a rotação que você faz hoje, simulada no mesmo clima para comparar todas as opções de forma justa.',
    fillsGap: (f: string, t: string, d: number) => `Ocupa a janela de ${f} a ${t} em que o talhão hoje fica descoberto (${d} dias).`,
    roots: (d: number) => `Mantém raiz viva no solo ${d} dias a mais por ano.`,
    legume: (names: string) => `Inclui uma leguminosa que fixa nitrogênio (${names}).`,
    pestBreak: 'Quebra um ciclo de pragas e doenças que a sequência atual mantém vivo.',
    margin: (m: string) => `Aumenta a margem indicativa em ${m}/ha por ano.`,
    fails: 'Falha menos nos anos ruins.',
    prio: { water: 'economizar água', soil: 'saúde do solo', income: 'renda', risk: 'menos risco' },
    top: (p: string) => `Ranqueada pela sua prioridade principal: ${p}.`,
    tops: (p: string) => `Ranqueada pelas suas prioridades: ${p}.`,
    balance: 'Ranqueada pelo equilíbrio entre água, solo, renda e risco.',
    shift: (main: string, days: number, second: string) => `Planta ${main} cerca de ${days} dias antes da melhor data isolada, para ${second} caber depois.`,
    simulated: (n: number, p: string) => `Simulada em ${n} safras do clima diário da NASA POWER (${p}), balanço hídrico FAO-56.`,
    sowing: (s: string) => `Plantio típico: ${s} (cada ano segue a chegada real da chuva).`,
    bare: (v: number, now: number | null) => `Solo descoberto ${v} dias/ano${now === null ? '' : ` (hoje ${now})`}.`,
    rainBare: (v: number, now: number | null) => `Chuva caindo em solo desprotegido ${v} mm/ano${now === null ? '' : ` (hoje ${now})`}.`,
    water: (v: number, w: number) => `Demanda de água da cultura atendida ${v}% em média; pior 10% dos anos ${w}%.`,
    second: (ok: number, n: number) => `A segunda safra chega a ≥60% do potencial em ${ok} de ${n} safras.`,
    gwet: (v: number) => `Umidade do solo na zona das raízes no plantio ${v}% (NASA GWETROOT, MERRA-2).`,
    soil: (t: string, c: number) => `Solo ${t}, ${c}% de argila (ISRIC SoilGrids 250 m).`,
    nLeft: (v: number) => `~${v} kg de N/ha por ano deixados para a próxima cultura.`,
    straw: (v: string) => `${v} t/ha de palha por ano formam matéria orgânica para o plantio direto.`,
    cut: (v: number) => `Reduz em ${v}% a chuva sobre solo exposto, principal causa de erosão e encrostamento.`,
    families: (n: number) => `${n} famílias de plantas na sequência: mais tipos de raiz, menos pragas em comum.`,
    sunn: 'A crotalária reduz nematoides de galha e das lesões.',
    pasture: 'Pasto de seca para o gado (integração lavoura-pecuária).',
    marginVs: (m: string, d: string) => `Margem indicativa ${m}/ha (${d} em relação a hoje).`,
    marginNow: (m: string) => `Margem indicativa ${m}/ha por ano.`,
    irrigation: (v: number) => `Precisa de ~${v} mm/ano de irrigação.`,
    gapWeather: 'O clima vem de uma célula de ~50 km da NASA POWER: a chuva local pode diferir; inclua seus registros de pluviômetro.',
    gapSoil: 'A textura do solo é modelada, não medida: confirme com análise de solo em laboratório.',
    gapPrice: 'Preços e custos são valores globais indicativos: troque pelas cotações da sua região.',
    gapSeed: (names: string) => `Sem dados locais de oferta de semente ou de compradores para ${names}.`,
    gapPest: 'A pressão de pragas e doenças não é vista do espaço; o histórico do talhão importa.',
    frost: (y: number, n: number) => `Geada atingiu uma cultura em ${y} de ${n} safras.`,
    heat: (n: number) => `Calor acima do limite da cultura na floração em ${n} safras-cultura.`,
    failRate: (v: number) => `Pelo menos uma cultura ficou abaixo de 60% do potencial em ${v}% das safras.`,
    headNow: (b: number, w: number) => `Hoje: ${b} dias de solo descoberto por ano, ${w}% da demanda de água atendida.`,
    hBare: (d: number) => `${d} dias a menos de solo descoberto`,
    hN: (n: number) => `+${n} kg N/ha`,
    hFail: (v: number) => `${v} pts a menos de safras ruins`,
    hWater: (v: number) => `${v}% a mais de água atendida`,
    hSimilar: 'Resultado parecido, mais diversidade',
  },
};

export function explain(x: ExplainInput): Explanation {
  const lang: Lang = x.lang ?? 'en';
  const t = T[lang];
  const { sim, current, isCurrent } = x;
  const m = sim.metrics;
  const c = current.metrics;
  const n = sim.outcomes.length;
  const period = `${x.years.first}–${x.years.last}`;
  const why: string[] = [];
  const evidence: string[] = [];
  const benefits: string[] = [];
  const gaps: string[] = [];
  const risks: string[] = [];
  const ids = strategyCrops(sim.strategy);
  const curIds = new Set(strategyCrops(current.strategy));
  const added = [...new Set(ids)].filter((id) => !curIds.has(id));
  const label = (id: string) => cropLabel(id, lang);

  // ---- why
  if (isCurrent) {
    why.push(t.current);
  } else {
    const bareCut = c.bareDays.mean - m.bareDays.mean;
    if (bareCut > 20) {
      const w = bareWindow(current, lang);
      why.push(w ? t.fillsGap(w.from, w.to, w.days) : t.roots(r0(bareCut)));
    }
    if (added.some((id) => crop(id).fixesN)) why.push(t.legume(list(added.filter((id) => crop(id).fixesN).map(label), lang)));
    if (c.pestBreaks > m.pestBreaks) why.push(t.pestBreak);
    if (m.margin.mean - c.margin.mean > 60) why.push(t.margin(money(m.margin.mean - c.margin.mean)));
    if (m.failureRate < c.failureRate - 0.08) why.push(t.fails);
    const entries = Object.entries(x.priorities) as [keyof Priorities, number][];
    const max = Math.max(...entries.map((e) => e[1]));
    const tops = entries.filter((e) => e[1] === max && max > 0).map((e) => e[0]);
    if (tops.length === 1) why.push(t.top(t.prio[tops[0]]));
    else if (tops.length < 4) why.push(t.tops(list(tops.map((k) => t.prio[k]), lang)));
    else why.push(t.balance);
  }
  const shifted = sim.strategy.years.find((y) => y.sowShift && y.second);
  if (shifted && !isCurrent) why.push(t.shift(label(shifted.main), shifted.sowShift!, label(shifted.second!)));

  // ---- evidence (numbers, with sources)
  const sowMonths = sim.calendar.filter((b) => b.role !== 'bare' && b.cropId).map((b) => `${label(b.cropId!)} ${monthName(b.startDoy, lang)}`);
  evidence.push(t.simulated(n, period));
  if (sowMonths.length) evidence.push(t.sowing([...new Set(sowMonths)].join(' · ')));
  evidence.push(t.bare(r0(m.bareDays.mean), isCurrent ? null : r0(c.bareDays.mean)));
  evidence.push(t.rainBare(r0(m.rainOnBareMm.mean), isCurrent ? null : r0(c.rainOnBareMm.mean)));
  evidence.push(t.water(r0(m.waterStress.mean * 100), r0(Math.min(m.waterStress.p10, m.waterStress.mean) * 100)));
  const secondRuns = sim.outcomes.flatMap((o) => o.runs.filter((r) => r.role === 'second'));
  if (secondRuns.length) evidence.push(t.second(secondRuns.filter((r) => r.yieldFactor >= 0.6).length, secondRuns.length));
  if (x.gwetAtSowing !== null) evidence.push(t.gwet(r0(x.gwetAtSowing * 100)));
  if (x.soil.source === 'SoilGrids') evidence.push(t.soil(textureName(x.soil.texture, lang), r0(x.soil.clayPct)));

  // ---- benefits
  if (m.nCredit.mean > 15) benefits.push(t.nLeft(r0(m.nCredit.mean)));
  if (m.residueT.mean > 6) benefits.push(t.straw(m.residueT.mean.toFixed(1)));
  if (!isCurrent && c.rainOnBareMm.mean > 0) {
    const cut = 1 - m.rainOnBareMm.mean / c.rainOnBareMm.mean;
    if (cut > 0.15) benefits.push(t.cut(r0(cut * 100)));
  }
  if (m.families >= 3) benefits.push(t.families(m.families));
  if (ids.includes('crotalaria')) benefits.push(t.sunn);
  if (ids.includes('brachiaria') && x.constraints.livestock) benefits.push(t.pasture);
  if (!isCurrent) {
    const d = m.margin.mean - c.margin.mean;
    benefits.push(t.marginVs(money(m.margin.mean), `${d >= 0 ? '+' : ''}${money(d)}`));
  } else benefits.push(t.marginNow(money(m.margin.mean)));
  if (m.irrigationMm.mean > 1) benefits.push(t.irrigation(r0(m.irrigationMm.mean)));

  // ---- information gaps
  gaps.push(t.gapWeather);
  if (x.soil.source !== 'farmer') gaps.push(t.gapSoil);
  gaps.push(t.gapPrice);
  const newCrops = added.filter((id) => crop(id).yieldRef === 0 || crop(id).price < 500);
  if (newCrops.length) gaps.push(t.gapSeed(list(newCrops.map(label), lang)));
  gaps.push(t.gapPest);

  // ---- risks that need local review
  const frostYears = sim.outcomes.filter((o) => o.runs.some((r) => r.frostHit && r.role !== 'cover')).length;
  if (frostYears) risks.push(t.frost(frostYears, n));
  const heat = sim.outcomes.flatMap((o) => o.runs).filter((r) => r.heatDays >= 3 && r.role !== 'cover').length;
  if (heat) risks.push(t.heat(heat));
  if (m.failureRate > 0.15) risks.push(t.failRate(r0(m.failureRate * 100)));
  pestConflicts(sim.strategy).forEach((p) => risks.push(`${label(p.a)} → ${label(p.b)}: ${pestWhy(p.key, p.why, lang)}.`));
  [...new Set(ids)].forEach((id) => risks.push(cropNote(id, lang)));

  const headline = isCurrent ? t.headNow(r0(m.bareDays.mean), r0(m.waterStress.mean * 100)) : headlineFor(m, c, lang);
  return { headline, why, evidence, benefits, gaps, risks };
}

function headlineFor(m: SimulatedStrategy['metrics'], c: SimulatedStrategy['metrics'], lang: Lang): string {
  const t = T[lang];
  const parts: { v: number; text: string }[] = [];
  const bare = c.bareDays.mean - m.bareDays.mean;
  if (bare > 10) parts.push({ v: bare / 3, text: t.hBare(r0(bare)) });
  const money2 = m.margin.mean - c.margin.mean;
  if (Math.abs(money2) > 40) parts.push({ v: Math.abs(money2) / 20, text: `${money2 > 0 ? '+' : '−'}US$${Math.abs(Math.round(money2 / 10) * 10)}/ha` });
  const nn = m.nCredit.mean - c.nCredit.mean;
  if (nn > 15) parts.push({ v: nn / 4, text: t.hN(r0(nn)) });
  const fail = c.failureRate - m.failureRate;
  if (fail > 0.05) parts.push({ v: fail * 100, text: t.hFail(r0(fail * 100)) });
  const water = (m.waterStress.mean - c.waterStress.mean) * 100;
  if (water > 3) parts.push({ v: water, text: t.hWater(r0(water)) });
  parts.sort((a, b) => b.v - a.v);
  return parts.length ? parts.slice(0, 2).map((p) => p.text).join(' · ') : t.hSimilar;
}
