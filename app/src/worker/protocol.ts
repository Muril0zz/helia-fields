import type {
  Constraints,
  DailySeries,
  Lang,
  Priorities,
  PriceTable,
  Scenario,
  SiteInfo,
  SoilInfo,
  Strategy,
  StrategyResult,
} from '../engine';
import type { WaterTrace } from '../engine/water';

export interface SimRequest {
  soil: SoilInfo;
  site: SiteInfo;
  constraints: Constraints;
  scenario: Scenario;
  current: Strategy;
  priorities: Priorities;
  lang?: Lang;
  /** Rank on past seasons matching NOAA's ENSO outlook instead of all seasons. */
  outlook?: boolean;
  /** Local prices and costs, already in USD. */
  prices?: PriceTable;
  /** Currency for texts: code and local units per USD. */
  money?: { code: string; fx: number };
}

export type ToWorker =
  | { type: 'load'; id: number; series: DailySeries }
  | { type: 'simulate'; id: number; req: SimRequest }
  | { type: 'rank'; id: number; priorities: Priorities; lang?: Lang; outlook?: boolean; money?: { code: string; fx: number } }
  | { type: 'trace'; id: number; strategyId: string; year: number };

export interface ClimateSummary {
  annualRain: number;
  annualEt0: number;
  monthlyRain: number[];
  monthlyEt0: number[];
  monthlyTmean: number[];
  hottestTmax: number;
  coldestTmin: number;
  years: { first: number; last: number };
  gwetAtSowing: number | null;
  rainLimited: boolean;
}

/** How today's rotation fared in past seasons like the one NOAA forecasts. */
export interface OutlookSummary {
  /** Analog seasons (sowing year) and whether there were enough to rank on. */
  years: number[];
  /** Number of seasons in the full record. */
  total: number;
  used: boolean;
  /** true when the cards below are ranked on the analog seasons only. */
  active: boolean;
  all: { margin: number; failRate: number; waterMet: number };
  analog: { margin: number; failRate: number; waterMet: number } | null;
  /** Best option for the analog seasons (always computed, even when not active). */
  best: Strategy | null;
  bestMargin: number | null;
}

export interface SimResult {
  outlook: OutlookSummary;
  current: StrategyResult;
  recommendations: StrategyResult[];
  climate: ClimateSummary;
  sowing: Record<string, number>;
  evaluated: number;
  simulated: number;
  ms: number;
}

export type FromWorker =
  | { type: 'loaded'; id: number }
  | { type: 'result'; id: number; result: SimResult }
  | { type: 'trace'; id: number; trace: WaterTrace & { year: number; years: number[] } }
  | { type: 'error'; id: number; message: string };
