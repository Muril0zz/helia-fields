import { useState } from 'react';
import type { CarProperty, Deforestation } from '../data/car';
import { isCarCode } from '../data/car';
import { useLang, useT } from '../i18n';

/** The farmer's own property from Brazil's public rural registry (CAR), with its PRODES record. */
export function CarCard({
  car,
  state,
  deforestation,
  propertyPixels,
  onLoad,
  onFindHere,
  canFindHere,
}: {
  car: CarProperty | null;
  state: 'idle' | 'busy' | 'notfound' | 'error';
  deforestation: Deforestation | null | 'busy';
  propertyPixels: number | null;
  onLoad: (code: string) => void;
  onFindHere: () => void;
  canFindHere: boolean;
}) {
  const t = useT();
  const lang = useLang();
  const [code, setCode] = useState('');
  const fmt = (v: number, d = 0) => v.toLocaleString(lang === 'pt' ? 'pt-BR' : 'en-US', { maximumFractionDigits: d, minimumFractionDigits: d });
  const valid = isCarCode(code);
  return (
    <div className="section">
      <div className="section-label">{t.car.title}</div>
      <form
        className="car-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) onLoad(code.trim());
        }}
      >
        <input
          className="select"
          style={{ backgroundImage: 'none', fontFamily: 'var(--mono)', fontSize: 12 }}
          placeholder="MT-5107925-3457E7D7…"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          aria-label={t.car.title}
          spellCheck={false}
        />
        <button className="cta" type="submit" disabled={!valid || state === 'busy'} style={{ padding: '8px 12px', opacity: valid ? 1 : 0.5 }}>
          {t.car.load}
        </button>
      </form>
      {canFindHere && (
        <div className="seg" style={{ marginTop: 6 }}>
          <button onClick={onFindHere} disabled={state === 'busy'}>{t.car.findHere}</button>
        </div>
      )}
      {state === 'busy' && <p className="hint">{t.car.busy}</p>}
      {state === 'notfound' && <p className="hint">{t.car.notFound}</p>}
      {state === 'error' && <p className="error">{t.car.error}</p>}
      {car && (
        <div className="tile" style={{ marginTop: 8 }}>
          <div className="tile-k" style={{ fontFamily: 'var(--mono)', fontSize: 10, wordBreak: 'break-all' }}>{car.code}</div>
          <div className="tile-v">
            {fmt(car.areaHa, 1)}
            <small> ha · {car.municipality}/{car.uf}</small>
          </div>
          <div className="tile-s">{car.status}</div>
          <div style={{ marginTop: 8, fontSize: 12 }}>
            {deforestation === 'busy' ? (
              <span className="hint">{t.car.prodesBusy}</span>
            ) : deforestation === null ? (
              <span className="hint">{t.car.prodesNone}</span>
            ) : deforestation.after2020Ha > 0.05 ? (
              <span className="delta-bad">{t.car.after2020(fmt(deforestation.after2020Ha, 1))}</span>
            ) : (
              <span className="delta-good">{t.car.clean(deforestation.totalHa > 0.05 ? fmt(deforestation.totalHa, 1) : null)}</span>
            )}
            {deforestation && deforestation !== 'busy' && deforestation.byYear.length > 0 && (
              <div className="hint" style={{ marginTop: 4 }}>
                PRODES: {deforestation.byYear.map((x) => `${x.year} ${fmt(x.ha, 1)} ha`).join(' · ')}
              </div>
            )}
          </div>
          <p className="hint" style={{ marginTop: 6 }}>
            {propertyPixels ? t.car.ndviPixels(propertyPixels) : t.car.ndviPoint}
          </p>
        </div>
      )}
    </div>
  );
}
