/** Daily weather series for one location (NASA POWER, community=AG). */
export interface DailySeries {
  /** ISO dates, YYYY-MM-DD, consecutive days. */
  dates: string[];
  tmax: number[]; // °C
  tmin: number[]; // °C
  prec: number[]; // mm/day (PRECTOTCORR)
  rad: number[]; // MJ/m²/day (ALLSKY_SFC_SW_DWN)
  rh: number[]; // % (RH2M)
  wind: number[]; // m/s at 2 m (WS2M)
  gwetRoot: number[]; // 0–1 root-zone soil wetness (GWETROOT)
  lat: number;
  lon: number;
  elevation: number; // m
}

export type SoilTexture =
  | 'sand'
  | 'loamy sand'
  | 'sandy loam'
  | 'loam'
  | 'silt loam'
  | 'sandy clay loam'
  | 'clay loam'
  | 'clay';

export interface SoilInfo {
  texture: SoilTexture;
  clayPct: number;
  sandPct: number;
  socGkg: number | null; // soil organic carbon g/kg (0–30 cm)
  ph: number | null;
  source: 'SoilGrids' | 'farmer' | 'default';
}

export interface SiteInfo {
  slopePct: number; // terrain slope, %
  slopeSource: 'terrain' | 'default';
}

export type CropRole = 'main' | 'second' | 'cover';
export type Family =
  | 'legume'
  | 'grass'
  | 'malvaceae'
  | 'brassica'
  | 'asteraceae';

export interface Crop {
  id: string;
  name: string;
  roles: CropRole[];
  family: Family;
  /** Thermal time to maturity, °C·day above tbase (temperature capped at topt). */
  gdd: number;
  tbase: number;
  topt: number;
  minDays: number;
  maxDays: number;
  /** FAO-56 stage fractions: initial, development, mid, late (sum 1). */
  stages: [number, number, number, number];
  kc: [number, number, number]; // ini, mid, end
  /** FAO-33 yield response factor to water. */
  ky: number;
  /** Daily Tmax above which flowering is hurt. */
  theat: number;
  /** Tmin at or below which the crop is killed/damaged (2 m air). */
  tfrost: number;
  /** Minimum mean temperature to sow. */
  tsow: number;
  rootDepth: number; // m
  /** FAO-56 depletion fraction before stress. */
  p: number;
  fixesN: boolean;
  /** Typical N fixed or left for the next crop, kg N/ha. */
  nCredit: number;
  /** Above-ground residue returned at full growth, t dry matter/ha. */
  residue: number;
  /** Reference rainfed yield, t/ha (0 for pure cover crops). */
  yieldRef: number;
  /** Indicative farm-gate price, USD/t. */
  price: number;
  /** Indicative operating cost, USD/ha. */
  cost: number;
  /** Forage value when grazed (integrated crop-livestock), USD/ha at full growth. */
  forageValue: number;
  needsIrrigation?: boolean;
  /** Machinery or processing a farm must buy before growing it (e.g. cotton picker and gin). */
  infra?: string;
  /**
   * Share of rainy days (>2 mm) in the cycle above which foliar disease cuts yield
   * (crops bred for dry or cool seasons). Omitted = humidity-tolerant.
   */
  wetTol?: number;
  /** Short local-review note that always applies. */
  note: string;
  color: string;
}

/** One year in a rotation: a main crop, optional second crop, optional cover/forage. */
export interface RotationYear {
  main: string;
  second?: string;
  cover?: string;
  /** Sow the main crop this many days before its single-crop optimum, so a second crop fits. */
  sowShift?: number;
}

export interface Strategy {
  id: string;
  name: string;
  years: RotationYear[];
}

export interface Priorities {
  water: number; // 0–1 weights
  soil: number;
  income: number;
  risk: number;
}

export interface Constraints {
  irrigation: boolean;
  livestock: boolean; // can graze forage (integrated crop-livestock)
  /** The farmer accepts crops that need new machinery or processing (cotton). Default: no. */
  newEquipment?: boolean;
}

/** Local prices and costs (USD; the app converts from local currency), overriding the indicative catalog values. */
export type PriceTable = Record<string, { price?: number; cost?: number }>;

export interface Scenario {
  rainPct: number; // e.g. -20 means 20 % less rain
  tempDelta: number; // °C added to tmax and tmin
}

/** One crop run in one historical year. */
export interface CropRun {
  cropId: string;
  role: CropRole;
  year: number;
  sowIndex: number; // index in series
  harvestIndex: number;
  days: number;
  etc: number; // mm crop demand
  eta: number; // mm actual
  irrigation: number; // mm applied
  heatDays: number;
  frostHit: boolean;
  /** Yield lost to humid-season foliar disease, 0–1. */
  wetPenalty: number;
  matured: boolean;
  yieldFactor: number; // 0–1
  waterFactor: number;
}

export interface YearOutcome {
  year: number;
  runs: CropRun[];
  bareDays: number;
  livingRootDays: number;
  rainOnBareMm: number; // rain falling on unprotected soil
  erosivityIndex: number;
  residueT: number;
  nCredit: number;
  margin: number; // USD/ha
  waterStress: number; // 0–1 (1 = no stress)
  irrigationMm: number;
  failures: number; // crops with yieldFactor < 0.6
}

export interface MetricBand {
  mean: number;
  p10: number;
  p90: number;
}

export interface StrategyResult {
  strategy: Strategy;
  feasible: boolean;
  outcomes: YearOutcome[];
  /** Calendar for the first rotation year, day-of-year offsets from main sowing. */
  calendar: CalendarBlock[];
  metrics: {
    bareDays: MetricBand;
    rainOnBareMm: MetricBand;
    residueT: MetricBand;
    nCredit: MetricBand;
    margin: MetricBand;
    waterStress: MetricBand;
    irrigationMm: MetricBand;
    failureRate: number; // share of years with ≥1 crop failure
    livingRootDays: MetricBand;
    families: number;
    pestBreaks: number;
  };
  scores: { water: number; soil: number; income: number; risk: number; total: number };
  explanation: Explanation;
  /** 'easiest' = keeps today's crops and only fills the off-season. */
  tag?: 'easiest';
}

export interface CalendarBlock {
  cropId: string | null; // null = bare soil
  role: CropRole | 'bare';
  startDoy: number; // calendar day-of-year (1–365)
  days: number;
  yearIndex: number;
}

export interface Explanation {
  headline: string;
  why: string[];
  evidence: string[];
  benefits: string[];
  gaps: string[];
  risks: string[];
}
