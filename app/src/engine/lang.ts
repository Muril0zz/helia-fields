import { crop } from './crops';

export type Lang = 'en' | 'pt';

export const MONTHS: Record<Lang, string[]> = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  pt: ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'],
};

/** Portuguese crop names (Brazilian usage) and the always-on local-review notes. */
const PT: Record<string, { name: string; note: string }> = {
  soy: { name: 'Soja', note: 'Confira o histórico de nematoide de cisto e de galha antes de repetir soja.' },
  maize: { name: 'Milho', note: 'O milho safrinha depende de a chuva durar até a floração; confirme a data-limite de plantio na região.' },
  sorghum: { name: 'Sorgo granífero', note: 'O sorgo tolera melhor a seca de fim de ciclo que o milho, mas precisa de comprador na região.' },
  pmillet: { name: 'Milheto (grão)', note: 'O milheto é o grão mais rústico para estações curtas e quentes; atenção a pássaros e míldio.' },
  cotton: { name: 'Algodão', note: 'O algodão exige manejo do bicudo, acesso a algodoeira e muito capital de giro.' },
  wheat: { name: 'Trigo', note: 'Escolha cultivar adequada ao frio e às geadas locais; calor úmido traz brusone.' },
  rice: { name: 'Arroz (irrigado)', note: 'O arroz irrigado por inundação é a opção que mais usa água e emite metano.' },
  bean: { name: 'Feijão', note: 'Feijão depois de soja divide mofo-branco e nematoides; veja o histórico do talhão.' },
  cowpea: { name: 'Feijão-caupi', note: 'O caupi aguenta seca, mas tem mercado menor que o feijão comum.' },
  sunflower: { name: 'Girassol', note: 'Raiz profunda recicla nutrientes; pássaros e mofo-branco pedem monitoramento.' },
  canola: { name: 'Canola', note: 'A canola quebra o ciclo de doenças dos cereais; precisa de esmagadora perto.' },
  chickpea: { name: 'Grão-de-bico', note: 'O grão-de-bico vai bem em estação fresca e seca com água armazenada no solo; atenção à ascoquitose.' },
  millet: { name: 'Milheto (cobertura)', note: 'A palha do milheto protege o solo para o plantio direto da soja; desseque antes de granar.' },
  brachiaria: { name: 'Braquiária (ILP)', note: 'Semeie junto com a segunda safra; acerte a dessecação para não competir com a próxima soja.' },
  crotalaria: { name: 'Crotalária (cobertura)', note: 'A crotalária reduz nematoides de galha e das lesões; a oferta de semente pode ser curta.' },
  oat: { name: 'Aveia-preta (cobertura)', note: 'A aveia-preta é cobertura e forragem de inverno; pastoreie de leve para manter palha.' },
  rye: { name: 'Centeio (cobertura)', note: 'O centeio aguenta inverno rigoroso; encerre cedo para não imobilizar nitrogênio.' },
  clover: { name: 'Trevo-encarnado (cobertura)', note: 'O trevo precisa de plantio no começo do outono para se estabelecer antes da geada.' },
};

const PESTS_PT: Record<string, string> = {
  'soy>soy': 'nematoide de cisto, ferrugem e percevejos passam de uma safra para outra',
  'soy>bean': 'mofo-branco e nematoide de galha são comuns às duas leguminosas',
  'bean>soy': 'mofo-branco e nematoide de galha são comuns às duas leguminosas',
  'maize>maize': 'cigarrinha, enfezamento e larva-alfinete passam de uma safra para outra',
  'cotton>soy': 'nematoide reniforme se acumula sob algodão e soja',
  'soy>cotton': 'nematoide reniforme se acumula sob algodão e soja',
  'wheat>wheat': 'mal-do-pé e giberela se acumulam',
  'rice>rice': 'brusone e brocas passam de uma safra de arroz para outra',
};

export function cropName(id: string, lang: Lang): string {
  return lang === 'pt' ? (PT[id]?.name ?? crop(id).name) : crop(id).name;
}

/** Name without the "(cover)" style qualifier, for running text. */
export function cropLabel(id: string, lang: Lang): string {
  // grain millet and millet cover would read the same: keep the qualifier for them
  if (id === 'pmillet' || id === 'millet') return cropName(id, lang);
  return cropName(id, lang).replace(/ \(.*\)$/, '');
}

export function cropNote(id: string, lang: Lang): string {
  return lang === 'pt' ? (PT[id]?.note ?? crop(id).note) : crop(id).note;
}

export function pestWhy(key: string, en: string, lang: Lang): string {
  return lang === 'pt' ? (PESTS_PT[key] ?? en) : en;
}

export function monthName(doy: number, lang: Lang): string {
  const d = new Date(Date.UTC(2023, 0, 1) + (doy - 1) * 86_400_000);
  return MONTHS[lang][d.getUTCMonth()];
}

/** Rotation title in the chosen language: "Soja → Milho → pousio / …". */
export function rotationName(years: { main: string; second?: string; cover?: string }[], lang: Lang): string {
  const fallow = lang === 'pt' ? 'pousio' : 'fallow';
  return years
    .map((y) => {
      const parts = [cropLabel(y.main, lang)];
      if (y.second) parts.push(cropLabel(y.second, lang));
      parts.push(y.cover ? cropLabel(y.cover, lang) : fallow);
      return parts.join(' → ');
    })
    .join(' / ');
}

const TEXTURE_PT: Record<string, string> = {
  sand: 'arenoso', 'loamy sand': 'areia franca', 'sandy loam': 'franco-arenoso', loam: 'franco',
  'silt loam': 'franco-siltoso', 'sandy clay loam': 'franco-argilo-arenoso', 'clay loam': 'franco-argiloso', clay: 'argiloso',
};
export function textureName(t: string, lang: Lang): string {
  return lang === 'pt' ? (TEXTURE_PT[t] ?? t) : t;
}
