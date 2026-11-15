import type { ReactNode } from 'react';
import { CROPS, MONTHS, cropName, textureName, type Constraints, type RotationYear, type SoilInfo } from '../engine';
import type { FieldData } from '../data/field';
import { SOIL_PRESETS } from '../data/soil';
import { placeName, useLang, useT } from '../i18n';
import type { ClimateSummary } from '../worker/protocol';
import { NdviSpark, WaterBudget } from './Charts';
import { RollingNumber } from './RollingNumber';

function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <div className="toggle">
      <span>{label}</span>
      <button className="switch" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} />
    </div>
  );
}

function CropSelect({
  value,
  role,
  onChange,
  allowNone,
}: {
  value: string | undefined;
  role: 'main' | 'second' | 'cover';
  onChange: (v: string | undefined) => void;
  allowNone: boolean;
}) {
  const t = useT();
  const lang = useLang();
  const options = CROPS.filter((c) => c.roles.includes(role) || (role === 'second' && c.roles.includes('main') && c.id !== 'rice'));
  return (
    <select className="select" value={value ?? ''} onChange={(e) => onChange(e.target.value || undefined)} aria-label={`${role} crop`}>
      {allowNone && <option value="">{role === 'cover' ? t.noneFallow : t.none}</option>}
      {options.map((c) => (
        <option key={c.id} value={c.id}>
          {cropName(c.id, lang)}
        </option>
      ))}
    </select>
  );
}

export function FieldPanel({
  field,
  climate,
  soil,
  onSoil,
  current,
  onCurrent,
  constraints,
  onConstraints,
  loading,
  modisBusy,
  children,
  water,
}: {
  children?: ReactNode;
  /** The animated soil-water cross-section, shown under the climate summary. */
  water?: ReactNode;
  modisBusy: boolean;
  field: FieldData | null;
  climate: ClimateSummary | null;
  soil: SoilInfo;
  onSoil: (s: SoilInfo) => void;
  current: RotationYear[];
  onCurrent: (r: RotationYear[]) => void;
  constraints: Constraints;
  onConstraints: (c: Constraints) => void;
  loading: boolean;
}) {
  const t = useT();
  const lang = useLang();
  const MONTH = MONTHS[lang];
  const setYear = (k: number, patch: Partial<RotationYear>) => onCurrent(current.map((y, i) => (i === k ? { ...y, ...patch } : y)));
  const dryMonths = climate ? climate.monthlyRain.map((r, i) => (r < climate.monthlyEt0[i] * 0.5 ? MONTH[i] : null)).filter(Boolean) : [];
  return (
    <section className="panel panel-left" aria-label={t.field}>
      <header className="panel-head">
        <div style={{ minWidth: 0 }}>
          <div className="eyebrow">{t.field}</div>
          <h2 className="title" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {field ? placeName(field.name, lang) : t.loadingField}
          </h2>
          {field && (
            <p className="sub">
              {field.lat.toFixed(4)}, {field.lon.toFixed(4)}
              {field.slope ? ` · ${Math.round(field.slope.elevation)} m` : ''}
            </p>
          )}
        </div>
      </header>
      <div className="panel-scroll">
        {children}
        <div className="section">
          <div className="section-label">
            {t.climateFrom} {climate && <span>{climate.years.first}–{climate.years.last}</span>}
          </div>
          {!climate || loading ? (
            <div className="tiles">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="tile">
                  <div className="sk" style={{ height: 10, width: '60%' }} />
                  <div className="sk" style={{ height: 22, width: '80%', marginTop: 8 }} />
                </div>
              ))}
            </div>
          ) : (
            <>
              <div className="tiles">
                <div className="tile">
                  <div className="tile-k"><i className="swatch" style={{ background: 'var(--water)' }} />{t.rain}</div>
                  <div className="tile-v"><RollingNumber value={climate.annualRain} /><small>{t.mmyr}</small></div>
                  <div className="tile-s">GPM-corrected MERRA-2</div>
                </div>
                <div className="tile">
                  <div className="tile-k"><i className="swatch" style={{ background: 'var(--warn)' }} />{t.demand}</div>
                  <div className="tile-v"><RollingNumber value={climate.annualEt0} /><small>{t.mmyr}</small></div>
                  <div className="tile-s">FAO-56 ET₀</div>
                </div>
                <div className="tile">
                  <div className="tile-k">{t.hottest}</div>
                  <div className="tile-v"><RollingNumber value={climate.hottestTmax} decimals={1} /><small>°C</small></div>
                  <div className="tile-s">{t.coldest(climate.coldestTmin.toFixed(1))}</div>
                </div>
                <div className="tile">
                  <div className="tile-k">{t.slope}</div>
                  <div className="tile-v">
                    {field?.slope ? <><RollingNumber value={field.slope.slopePct} decimals={1} /><small>%</small></> : <small>n/a</small>}
                  </div>
                  <div className="tile-s">{t.slopeSrc}</div>
                </div>
              </div>
              <div style={{ marginTop: 10 }}>
                <WaterBudget rain={climate.monthlyRain} et0={climate.monthlyEt0} />
                <p className="hint" style={{ marginTop: 2 }}>
                  <i className="swatch" style={{ background: 'var(--water)', display: 'inline-block' }} /> {t.rainLegend} &nbsp;
                  <i className="swatch" style={{ background: 'var(--warn)', display: 'inline-block' }} /> {t.demandLegend}
                  {dryMonths.length ? t.dryMonths(dryMonths.join(', ')) : ''}
                </p>
              </div>
            </>
          )}
        </div>

        {water}

        <div className="section">
          <div className="section-label">{t.modisSees}</div>
          {field?.cycles ? (
            <>
              <NdviSpark points={field.cycles.points} peaks={field.cycles.peaks} />
              <p className="hint" style={{ color: 'var(--text)' }}>{t.cycles(field.cycles)}</p>
              {field.cycles.bareMonths.length > 0 && <p className="hint">{t.modisBare(field.cycles.bareMonths.map((m) => MONTH[m]).join(', '))}</p>}
              <p className="hint">{t.modisSrc}</p>
            </>
          ) : loading || modisBusy ? (
            <>
              <div className="sk" style={{ height: 70 }} />
              <p className="hint">{t.modisReading}</p>
            </>
          ) : (
            <p className="hint">{t.modisNone}</p>
          )}
        </div>

        <div className="section">
          <div className="section-label">{t.rotationToday}</div>
          {current.map((y, k) => (
            <div key={k} style={{ marginBottom: 8 }}>
              {current.length > 1 && <div className="hint" style={{ margin: '0 0 4px' }}>{t.year(k + 1)}</div>}
              <div className="select-row"><label>{t.main}</label><CropSelect value={y.main} role="main" allowNone={false} onChange={(v) => v && setYear(k, { main: v })} /></div>
              <div className="select-row"><label>{t.then}</label><CropSelect value={y.second} role="second" allowNone onChange={(v) => setYear(k, { second: v })} /></div>
              <div className="select-row"><label>{t.offSeason}</label><CropSelect value={y.cover} role="cover" allowNone onChange={(v) => setYear(k, { cover: v })} /></div>
            </div>
          ))}
          <div className="seg">
            {current.length === 1 ? (
              <button onClick={() => onCurrent([...current, { main: current[0].main === 'soy' ? 'maize' : 'soy' }])}>{t.addYear}</button>
            ) : (
              <button onClick={() => onCurrent(current.slice(0, 1))}>{t.singleYear}</button>
            )}
          </div>
        </div>

        <div className="section">
          <div className="section-label">
            {t.soil} {field?.soilgrids ? <span>SoilGrids: {textureName(field.soilgrids.texture, lang)}</span> : <span>{t.yourKnowledge}</span>}
          </div>
          <div className="seg" role="group" aria-label={t.soil}>
            {field?.soilgrids && (
              <button aria-pressed={soil.source === 'SoilGrids'} onClick={() => onSoil(field.soilgrids!)}>
                {t.fromSoilGrids}
              </button>
            )}
            {SOIL_PRESETS.map((p) => (
              <button key={p.id} aria-pressed={soil.source !== 'SoilGrids' && soil.texture === p.soil.texture} onClick={() => onSoil(p.soil)}>
                {t.soilPresets[p.id] ?? p.label}
              </button>
            ))}
          </div>
          <p className="hint">{t.soilHint}</p>
        </div>

        <div className="section">
          <div className="section-label">{t.yourFarm}</div>
          <Switch label={t.irrigation} on={constraints.irrigation} onChange={(v) => onConstraints({ ...constraints, irrigation: v })} />
          <Switch label={t.livestock} on={constraints.livestock} onChange={(v) => onConstraints({ ...constraints, livestock: v })} />
          <Switch label={t.newEquipment} on={Boolean(constraints.newEquipment)} onChange={(v) => onConstraints({ ...constraints, newEquipment: v })} />
        </div>
      </div>
    </section>
  );
}
