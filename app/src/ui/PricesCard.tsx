import { useState } from 'react';
import { cropName } from '../engine';
import { priceUnit, type LocalEconomics, type Valued } from '../data/prices';
import { useLang } from '../i18n';
import { symbolOf } from './money';

const TXT = {
  en: {
    title: 'Local prices and costs',
    crop: 'Crop',
    price: 'Price',
    cost: 'Cost /ha',
    levels: { farmer: 'yours', municipality: 'municipality', state: 'state', country: 'country', global: 'global estimate' } as Record<Valued['level'], string>,
    edit: 'Type your own price or cost: the whole simulation re-runs with it.',
    reset: 'Use official values',
    where: 'Place',
    unknown: 'Locating…',
    note: (d: string | null) => `Official sources at the finest level available${d ? `, table of ${d}` : ''}. Margins are indicative: check with your co-op or agronomist.`,
  },
  pt: {
    title: 'Preços e custos locais',
    crop: 'Cultura',
    price: 'Preço',
    cost: 'Custo /ha',
    levels: { farmer: 'seu', municipality: 'município', state: 'estado', country: 'país', global: 'estimativa global' } as Record<Valued['level'], string>,
    edit: 'Digite o seu preço ou custo: a simulação inteira roda de novo com ele.',
    reset: 'Usar valores oficiais',
    where: 'Local',
    unknown: 'Localizando…',
    note: (d: string | null) => `Fontes oficiais no nível mais fino disponível${d ? `, tabela de ${d}` : ''}. Margens indicativas: confira com sua cooperativa ou agrônomo.`,
  },
};

function Cell({ v, unit, perT, onChange, lang, symbol }: { v: Valued; unit: string; perT: number; onChange: (x: number | undefined) => void; lang: 'en' | 'pt'; symbol: string }) {
  const x = TXT[lang];
  const loc = lang === 'pt' ? 'pt-BR' : 'en-US';
  const shown = v.value / perT;
  const [draft, setDraft] = useState<string | null>(null);
  const tip = [v.source, v.period, v.where].filter(Boolean).join(' · ');
  return (
    <div className="pc-cell">
      <label className="pc-input">
        <span>{symbol}</span>
        <input
          inputMode="decimal"
          value={draft ?? shown.toLocaleString(loc, { maximumFractionDigits: shown < 100 ? 2 : 0 })}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            if (draft === null) return;
            // pt-BR: 1.234,5 · en: 1,234.5
            const clean = lang === 'pt' ? draft.replace(/\./g, '').replace(',', '.') : draft.replace(/,/g, '');
            const n = Number(clean.replace(/[^\d.]/g, ''));
            setDraft(null);
            if (Number.isFinite(n) && n > 0) onChange(n * perT);
          }}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          aria-label={unit}
        />
        <small>/{unit}</small>
      </label>
      <span className={`pc-level ${v.level}`} title={tip}>
        {x.levels[v.level]}
      </span>
    </div>
  );
}

/** Where the money numbers come from, and the farmer's chance to correct them. */
export function PricesCard({
  econ,
  ids,
  onOverride,
  onReset,
}: {
  econ: LocalEconomics;
  ids: string[];
  onOverride: (id: string, field: 'price' | 'cost', localValue: number | undefined) => void;
  onReset: () => void;
}) {
  const lang = useLang();
  const x = TXT[lang];
  const symbol = symbolOf(econ.currency, lang);
  const anyFarmer = Object.values(econ.crops).some((c) => c.price.level === 'farmer' || c.cost.level === 'farmer');
  return (
    <div className="section pc">
      <div className="section-label">
        {x.title} <span>{econ.currency}</span>
      </div>
      <p className="pc-place">
        <span>{x.where}</span> {econ.place?.label ?? x.unknown}
      </p>
      <div className="pc-head">
        <span>{x.crop}</span>
        <span>{x.price}</span>
        <span>{x.cost}</span>
      </div>
      {ids.map((id) => {
        const c = econ.crops[id];
        if (!c) return null;
        const u = priceUnit(id, econ.currency);
        const isCover = c.price.value === 0;
        return (
          <div className="pc-row" key={id}>
            <span className="pc-crop">{cropName(id, lang)}</span>
            {isCover ? <span className="pc-none">—</span> : <Cell v={c.price} unit={u.label} perT={u.perT} onChange={(v) => onOverride(id, 'price', v)} lang={lang} symbol={symbol} />}
            <Cell v={c.cost} unit="ha" perT={1} onChange={(v) => onOverride(id, 'cost', v)} lang={lang} symbol={symbol} />
          </div>
        );
      })}
      <p className="hint" style={{ margin: '8px 0 0' }}>
        {x.edit} {anyFarmer && <button className="linkish" onClick={onReset}>{x.reset}</button>}
      </p>
      <p className="hint" style={{ margin: '4px 0 0' }}>{x.note(econ.generated)}</p>
    </div>
  );
}
