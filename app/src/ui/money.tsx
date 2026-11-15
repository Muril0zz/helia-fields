import { createContext, useContext } from 'react';
import { useLang } from '../i18n';

/** Currency the farmer thinks in, and how many units of it make one US dollar. */
export interface Money {
  code: string; // ISO 4217, e.g. BRL
  fx: number; // local units per USD
}

export const USD: Money = { code: 'USD', fx: 1 };
export const MoneyContext = createContext<Money>(USD);

export function symbolOf(code: string, lang: 'en' | 'pt'): string {
  const parts = new Intl.NumberFormat(lang === 'pt' ? 'pt-BR' : 'en-US', { style: 'currency', currency: code, currencyDisplay: 'narrowSymbol' }).formatToParts(0);
  const s = parts.find((p) => p.type === 'currency')?.value ?? code;
  return code === 'USD' ? 'US$' : s;
}

/** Format engine values (USD) in the local currency. */
export function useMoney() {
  const m = useContext(MoneyContext);
  const lang = useLang();
  const loc = lang === 'pt' ? 'pt-BR' : 'en-US';
  const symbol = symbolOf(m.code, lang);
  return {
    ...m,
    symbol,
    perHa: `${symbol}/ha`,
    /** USD → local number */
    local: (usd: number) => usd * m.fx,
    fmt: (usd: number, signed = false) => {
      const v = usd * m.fx;
      const s = `${symbol} ${Math.abs(Math.round(v)).toLocaleString(loc)}`;
      return signed ? `${v < 0 ? '−' : '+'}${s}` : v < 0 ? `−${s}` : s;
    },
  };
}
