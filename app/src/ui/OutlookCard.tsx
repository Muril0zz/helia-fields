import { OUTLOOK, rotationName } from '../engine';
import { useLang, useT } from '../i18n';
import type { SimResult } from '../worker/protocol';
import { RollingNumber } from './RollingNumber';
import { useMoney } from './money';

/** NOAA's ENSO outlook for the coming season, read through this field's own past seasons. */
export function OutlookCard({
  result,
  on,
  onToggle,
}: {
  result: SimResult;
  on: boolean;
  onToggle: (v: boolean) => void;
}) {
  const t = useT();
  const lang = useLang();
  const money = useMoney();
  const o = result.outlook;
  // seasons sown in the second half of the year span two calendar years (2015/16)
  const mainDoy = result.sowing[result.current.strategy.years[0].main] ?? 300;
  const label = (y: number) => (mainDoy > 180 ? `${y}/${String((y + 1) % 100).padStart(2, '0')}` : String(y));
  const seasons = o.years.map(label).join(', ');
  const delta = o.analog && o.all.margin ? (100 * (o.analog.margin - o.all.margin)) / Math.abs(o.all.margin) : 0;

  return (
    <section className="outlook" aria-label={t.enso.title}>
      <div className="outlook-head">
        <div>
          <div className="eyebrow outlook-eyebrow">
            <a href={OUTLOOK.url} target="_blank" rel="noreferrer">{t.enso.eyebrow}</a>
          </div>
          <h3 className="outlook-title">{t.enso.title}</h3>
        </div>
        <span className="outlook-prob">{t.enso.prob}</span>
      </div>

      {o.used && o.analog ? (
        <>
          <p className="outlook-past">{t.enso.past(seasons)}</p>
          <div className="outlook-stats">
            <div>
              <div className="outlook-k">{t.enso.margin}</div>
              <div className={`outlook-v ${delta < -3 ? 'bad' : delta > 3 ? 'good' : ''}`}>
                <RollingNumber value={delta} signed suffix=" %" />
              </div>
              <div className="outlook-sub">
                {money.fmt(o.analog.margin)} {t.enso.vsAll} {money.fmt(o.all.margin)}
              </div>
            </div>
            <div>
              <div className="outlook-k">{t.enso.fail}</div>
              <div className={`outlook-v ${o.analog.failRate > o.all.failRate + 0.05 ? 'bad' : ''}`}>
                <RollingNumber value={o.analog.failRate * 100} suffix=" %" />
              </div>
              <div className="outlook-sub">
                {Math.round(o.all.failRate * 100)} % {t.enso.vsAll}
              </div>
            </div>
            <div>
              <div className="outlook-k">{t.enso.water}</div>
              <div className="outlook-v">
                <RollingNumber value={o.analog.waterMet * 100} suffix=" %" />
              </div>
              <div className="outlook-sub">
                {Math.round(o.all.waterMet * 100)} % {t.enso.vsAll}
              </div>
            </div>
          </div>
          {o.best && <p className="outlook-best">{t.enso.best(rotationName(o.best.years, lang))}</p>}
          <div className="outlook-toggle">
            <span className="outlook-k">{t.enso.rankOn}</span>
            <div className="seg" role="group" aria-label={t.enso.rankOn}>
              <button aria-pressed={!on} onClick={() => onToggle(false)}>{t.enso.allSeasons(o.total)}</button>
              <button aria-pressed={on} onClick={() => onToggle(true)}>{t.enso.ninoSeasons(o.years.length)}</button>
            </div>
          </div>
        </>
      ) : (
        <p className="outlook-past">{t.enso.tooFew(o.years.length)}</p>
      )}
      <p className="outlook-note">{t.enso.note}</p>
    </section>
  );
}
