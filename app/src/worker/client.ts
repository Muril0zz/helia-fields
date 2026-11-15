import type { DailySeries, Lang, Priorities } from '../engine';
import type { FromWorker, SimRequest, SimResult, ToWorker } from './protocol';
import type { WaterTrace } from '../engine/water';

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/** Promise wrapper around the engine worker; newer requests supersede older ones. */
export class EngineClient {
  private worker = new Worker(new URL('./engine.worker.ts', import.meta.url), { type: 'module' });
  private seq = 0;
  private pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();

  constructor() {
    this.worker.onmessage = (e: MessageEvent<FromWorker>) => {
      const m = e.data;
      const p = this.pending.get(m.id);
      if (!p) return;
      this.pending.delete(m.id);
      if (m.type === 'error') p.reject(new Error(m.message));
      else if (m.type === 'result') p.resolve(m.result);
      else if (m.type === 'trace') p.resolve(m.trace);
      else p.resolve(undefined);
    };
  }

  private send<T>(msg: DistributiveOmit<ToWorker, 'id'>): Promise<T> {
    const id = ++this.seq;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
      this.worker.postMessage({ ...msg, id } as ToWorker);
    });
  }

  private lastSeries: DailySeries | null = null;

  load(series: DailySeries) {
    this.lastSeries = series;
    return this.send<void>({ type: 'load', series });
  }
  async simulate(req: SimRequest): Promise<SimResult> {
    try {
      return await this.send<SimResult>({ type: 'simulate', req });
    } catch (e) {
      // a restarted worker has lost the series: hand it back once and retry
      if (this.lastSeries && e instanceof Error && e.message.includes('no weather series')) {
        await this.send<void>({ type: 'load', series: this.lastSeries });
        return this.send<SimResult>({ type: 'simulate', req });
      }
      throw e;
    }
  }
  trace(strategyId: string, year: number) {
    return this.send<WaterTrace & { year: number; years: number[] }>({ type: 'trace', strategyId, year });
  }
  rank(priorities: Priorities, lang: Lang = 'en', outlook = false, money?: { code: string; fx: number }) {
    return this.send<SimResult>({ type: 'rank', priorities, lang, outlook, money });
  }
}
