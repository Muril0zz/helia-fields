import type { Crop } from './types';

/**
 * Crop catalog. Water parameters follow FAO Irrigation & Drainage Paper 56
 * (Kc, stage lengths, depletion fraction p) and Paper 33 (yield response Ky).
 * Thermal time, prices and costs are indicative global values and are shown
 * to the farmer as information gaps to be replaced with local numbers.
 */
export const CROPS: Crop[] = [
  {
    id: 'soy', name: 'Soybean', roles: ['main', 'second'], family: 'legume',
    gdd: 1850, tbase: 10, topt: 30, minDays: 95, maxDays: 150,
    stages: [0.13, 0.25, 0.42, 0.2], kc: [0.4, 1.15, 0.5], ky: 0.85,
    theat: 36, tfrost: 0, tsow: 18, rootDepth: 1.3, p: 0.5,
    fixesN: true, nCredit: 25, residue: 3, yieldRef: 3.6, price: 400, cost: 560, forageValue: 0,
    note: 'Check soybean cyst and root-knot nematode history before repeating soybean.',
    color: '#3DDC84',
  },
  {
    id: 'maize', name: 'Maize', roles: ['main', 'second'], family: 'grass',
    gdd: 1650, tbase: 10, topt: 30, minDays: 100, maxDays: 240,
    stages: [0.16, 0.28, 0.32, 0.24], kc: [0.3, 1.2, 0.6], ky: 1.25,
    theat: 35, tfrost: 0, tsow: 16, rootDepth: 1.6, p: 0.55,
    fixesN: false, nCredit: 0, residue: 7, yieldRef: 6.5, price: 190, cost: 720, forageValue: 0,
    note: 'Second-season maize depends on the rain lasting through flowering; confirm sowing deadline locally.',
    color: '#FFC93C',
  },
  {
    id: 'sorghum', name: 'Grain sorghum', roles: ['main', 'second'], family: 'grass',
    gdd: 1550, tbase: 10, topt: 32, minDays: 95, maxDays: 150,
    stages: [0.17, 0.3, 0.35, 0.18], kc: [0.3, 1.0, 0.55], ky: 0.9,
    theat: 38, tfrost: 0, tsow: 18, rootDepth: 1.4, p: 0.55,
    fixesN: false, nCredit: 0, residue: 6, yieldRef: 4.0, price: 180, cost: 400, forageValue: 0,
    note: 'Sorghum tolerates late-season drought better than maize but needs a local buyer.',
    color: '#FF8A3D',
  },
  {
    id: 'pmillet', name: 'Pearl millet', roles: ['main', 'second'], family: 'grass',
    gdd: 1300, tbase: 10, topt: 34, minDays: 75, maxDays: 130,
    stages: [0.15, 0.3, 0.35, 0.2], kc: [0.3, 1.0, 0.3], ky: 0.8,
    theat: 42, tfrost: 0, tsow: 20, rootDepth: 1.8, p: 0.6,
    fixesN: false, nCredit: 0, residue: 5, yieldRef: 1.6, price: 300, cost: 180, forageValue: 0,
    note: 'Pearl millet is the hardiest grain for short, hot rainy seasons; watch birds and downy mildew.',
    color: '#D9F99D',
  },
  {
    id: 'cotton', name: 'Cotton', roles: ['main', 'second'], family: 'malvaceae', infra: 'cotton picker and gin',
    gdd: 2300, tbase: 12, topt: 32, minDays: 140, maxDays: 200,
    stages: [0.17, 0.29, 0.33, 0.21], kc: [0.35, 1.15, 0.6], ky: 0.85,
    theat: 38, tfrost: 0, tsow: 20, rootDepth: 1.4, p: 0.65,
    fixesN: false, nCredit: 0, residue: 3, yieldRef: 1.8, price: 1650, cost: 1900, forageValue: 0,
    note: 'Cotton needs boll-weevil management, ginning access and high working capital.',
    color: '#F2F2F7',
  },
  {
    id: 'wheat', name: 'Wheat', roles: ['main', 'second'], family: 'grass',
    gdd: 1900, tbase: 0, topt: 25, minDays: 100, maxDays: 280,
    stages: [0.15, 0.25, 0.4, 0.2], kc: [0.4, 1.15, 0.3], ky: 1.05,
    theat: 31, tfrost: -20, tsow: 6, rootDepth: 1.2, p: 0.55,
    fixesN: false, nCredit: 0, residue: 5, yieldRef: 4.0, price: 230, cost: 520, forageValue: 0,
    wetTol: 0.35,
    note: 'Pick a variety matched to local vernalization and frost timing; humid heat brings wheat blast.',
    color: '#E8B04B',
  },
  {
    id: 'rice', name: 'Rice (flooded)', roles: ['main'], family: 'grass',
    gdd: 1700, tbase: 10, topt: 32, minDays: 100, maxDays: 160,
    stages: [0.2, 0.25, 0.35, 0.2], kc: [1.05, 1.2, 0.9], ky: 1.1,
    theat: 35, tfrost: 2, tsow: 20, rootDepth: 0.5, p: 0.2,
    fixesN: false, nCredit: 0, residue: 5, yieldRef: 6.0, price: 320, cost: 950, forageValue: 0,
    needsIrrigation: true,
    note: 'Flooded rice uses the most water of any option and releases methane.',
    color: '#7DD3FC',
  },
  {
    id: 'bean', name: 'Common bean', roles: ['second'], family: 'legume',
    gdd: 1050, tbase: 10, topt: 28, minDays: 75, maxDays: 110,
    stages: [0.15, 0.27, 0.35, 0.23], kc: [0.4, 1.15, 0.35], ky: 1.15,
    theat: 32, tfrost: 0, tsow: 14, rootDepth: 0.7, p: 0.45,
    fixesN: true, nCredit: 20, residue: 1.5, yieldRef: 1.8, price: 800, cost: 720, forageValue: 0,
    wetTol: 0.42,
    note: 'Bean after soybean shares white mold and nematodes; check field history.',
    color: '#C084FC',
  },
  {
    id: 'cowpea', name: 'Cowpea', roles: ['main', 'second'], family: 'legume',
    gdd: 1100, tbase: 10, topt: 32, minDays: 75, maxDays: 110,
    stages: [0.15, 0.28, 0.35, 0.22], kc: [0.4, 1.05, 0.35], ky: 0.9,
    theat: 38, tfrost: 0, tsow: 18, rootDepth: 1.0, p: 0.55,
    fixesN: true, nCredit: 30, residue: 2.5, yieldRef: 1.2, price: 600, cost: 320, forageValue: 0,
    note: 'Cowpea is drought-hardy but has a thinner market than beans.',
    color: '#F472B6',
  },
  {
    id: 'sunflower', name: 'Sunflower', roles: ['second'], family: 'asteraceae',
    gdd: 1600, tbase: 6, topt: 30, minDays: 95, maxDays: 140,
    stages: [0.2, 0.3, 0.32, 0.18], kc: [0.35, 1.1, 0.35], ky: 0.95,
    theat: 36, tfrost: -2, tsow: 10, rootDepth: 1.5, p: 0.45,
    fixesN: false, nCredit: 0, residue: 4, yieldRef: 2.2, price: 420, cost: 460, forageValue: 0,
    wetTol: 0.42,
    note: 'Deep roots recycle nutrients; birds and sclerotinia need local monitoring.',
    color: '#FDE047',
  },
  {
    id: 'canola', name: 'Canola', roles: ['main', 'second'], family: 'brassica',
    gdd: 1500, tbase: 5, topt: 25, minDays: 110, maxDays: 260,
    stages: [0.18, 0.27, 0.35, 0.2], kc: [0.35, 1.1, 0.35], ky: 1.0,
    theat: 30, tfrost: -8, tsow: 6, rootDepth: 1.2, p: 0.6,
    fixesN: false, nCredit: 0, residue: 3, yieldRef: 2.2, price: 470, cost: 540, forageValue: 0,
    wetTol: 0.32,
    note: 'Canola breaks cereal disease cycles; needs a crusher nearby.',
    color: '#FACC15',
  },
  {
    id: 'chickpea', name: 'Chickpea', roles: ['main', 'second'], family: 'legume',
    gdd: 1400, tbase: 5, topt: 27, minDays: 95, maxDays: 160,
    stages: [0.15, 0.3, 0.35, 0.2], kc: [0.4, 1.0, 0.35], ky: 0.9,
    theat: 32, tfrost: -3, tsow: 8, rootDepth: 1.0, p: 0.5,
    fixesN: true, nCredit: 30, residue: 2, yieldRef: 1.5, price: 700, cost: 420, forageValue: 0,
    wetTol: 0.22,
    note: 'Chickpea suits cool dry seasons on stored soil water; watch Ascochyta blight.',
    color: '#FB7185',
  },
  {
    id: 'millet', name: 'Pearl millet (cover)', roles: ['cover'], family: 'grass',
    gdd: 1100, tbase: 10, topt: 33, minDays: 60, maxDays: 220,
    stages: [0.15, 0.3, 0.35, 0.2], kc: [0.3, 1.0, 0.3], ky: 0.8,
    theat: 42, tfrost: 0, tsow: 16, rootDepth: 1.6, p: 0.6,
    fixesN: false, nCredit: 0, residue: 8, yieldRef: 0, price: 0, cost: 70, forageValue: 120,
    note: 'Millet straw protects the soil for no-till soybean; desiccate before it sets seed.',
    color: '#A3E635',
  },
  {
    id: 'brachiaria', name: 'Brachiaria pasture (ICL)', roles: ['cover'], family: 'grass',
    gdd: 900, tbase: 10, topt: 33, minDays: 60, maxDays: 260,
    stages: [0.2, 0.3, 0.35, 0.15], kc: [0.5, 0.95, 0.85], ky: 0.6,
    theat: 42, tfrost: -1, tsow: 16, rootDepth: 2.0, p: 0.6,
    fixesN: false, nCredit: 0, residue: 10, yieldRef: 0, price: 0, cost: 60, forageValue: 260,
    note: 'Sow with the second crop; time desiccation so it does not compete with the next soybean.',
    color: '#22C55E',
  },
  {
    id: 'crotalaria', name: 'Sunn hemp (cover)', roles: ['cover'], family: 'legume',
    gdd: 1200, tbase: 10, topt: 32, minDays: 60, maxDays: 200,
    stages: [0.15, 0.3, 0.4, 0.15], kc: [0.4, 1.0, 0.8], ky: 0.7,
    theat: 40, tfrost: 0, tsow: 18, rootDepth: 1.5, p: 0.55,
    fixesN: true, nCredit: 110, residue: 7, yieldRef: 0, price: 0, cost: 95, forageValue: 0,
    note: 'Sunn hemp suppresses root-knot and lesion nematodes; seed supply can be tight.',
    color: '#E879F9',
  },
  {
    id: 'oat', name: 'Black oat (cover)', roles: ['cover'], family: 'grass',
    gdd: 1300, tbase: 0, topt: 22, minDays: 60, maxDays: 220,
    stages: [0.15, 0.3, 0.4, 0.15], kc: [0.4, 1.0, 0.5], ky: 0.7,
    theat: 32, tfrost: -8, tsow: 4, rootDepth: 1.0, p: 0.55,
    fixesN: false, nCredit: 0, residue: 6, yieldRef: 0, price: 0, cost: 80, forageValue: 150,
    note: 'Black oat is a cool-season cover and winter forage; graze lightly to keep straw.',
    color: '#BEF264',
  },
  {
    id: 'rye', name: 'Cereal rye (cover)', roles: ['cover'], family: 'grass',
    gdd: 1200, tbase: 0, topt: 20, minDays: 60, maxDays: 260,
    stages: [0.15, 0.3, 0.4, 0.15], kc: [0.4, 1.0, 0.5], ky: 0.7,
    theat: 30, tfrost: -30, tsow: 2, rootDepth: 1.2, p: 0.55,
    fixesN: false, nCredit: 0, residue: 6, yieldRef: 0, price: 0, cost: 90, forageValue: 90,
    note: 'Cereal rye survives hard winters; terminate early to avoid tying up nitrogen.',
    color: '#86EFAC',
  },
  {
    id: 'clover', name: 'Crimson clover (cover)', roles: ['cover'], family: 'legume',
    gdd: 1100, tbase: 2, topt: 22, minDays: 60, maxDays: 240,
    stages: [0.2, 0.3, 0.35, 0.15], kc: [0.4, 1.0, 0.8], ky: 0.7,
    theat: 30, tfrost: -12, tsow: 4, rootDepth: 0.8, p: 0.5,
    fixesN: true, nCredit: 80, residue: 4, yieldRef: 0, price: 0, cost: 100, forageValue: 110,
    note: 'Clover needs early autumn sowing to establish before frost.',
    color: '#F0ABFC',
  },
];

export const CROP_BY_ID: Record<string, Crop> = Object.fromEntries(CROPS.map((c) => [c.id, c]));

export function crop(id: string): Crop {
  const c = CROP_BY_ID[id];
  if (!c) throw new Error(`Unknown crop: ${id}`);
  return c;
}

/** Host-sharing pairs: planting B right after A keeps a pest or disease cycle alive. */
export const SHARED_PESTS: Record<string, string> = {
  'soy>soy': 'soybean cyst nematode, rust and stink bugs carry over',
  'soy>bean': 'white mold and root-knot nematodes shared by both legumes',
  'bean>soy': 'white mold and root-knot nematodes shared by both legumes',
  'maize>maize': 'corn leafhopper, stunt disease and rootworm carry over',
  'cotton>soy': 'reniform nematode builds up under cotton and soybean',
  'soy>cotton': 'reniform nematode builds up under cotton and soybean',
  'wheat>wheat': 'take-all and fusarium head blight build up',
  'rice>rice': 'blast and stem borers carry over between rice crops',
};
