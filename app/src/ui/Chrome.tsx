import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import type { FieldData, SourceState } from '../data/field';
import { DEMO_SITES, type DemoSite } from '../data/field';
import { placeName, useLang, useT } from '../i18n';
import type { Lang } from '../engine';

export function BrandMark({ size = 30 }: { size?: number }) {
  return (
    <svg className="brand-mark" width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <ellipse cx="32" cy="12.5" rx="5.2" ry="8.6" fill="#FFC23D" transform="rotate(0 32 32)"/>
      <ellipse cx="32" cy="12.5" rx="5.2" ry="8.6" fill="#3DDC84" transform="rotate(45 32 32)"/>
      <ellipse cx="32" cy="12.5" rx="5.2" ry="8.6" fill="#FFC23D" transform="rotate(90 32 32)"/>
      <ellipse cx="32" cy="12.5" rx="5.2" ry="8.6" fill="#FFC23D" transform="rotate(135 32 32)"/>
      <ellipse cx="32" cy="12.5" rx="5.2" ry="8.6" fill="#FFC23D" transform="rotate(180 32 32)"/>
      <ellipse cx="32" cy="12.5" rx="5.2" ry="8.6" fill="#FFC23D" transform="rotate(225 32 32)"/>
      <ellipse cx="32" cy="12.5" rx="5.2" ry="8.6" fill="#FFC23D" transform="rotate(270 32 32)"/>
      <ellipse cx="32" cy="12.5" rx="5.2" ry="8.6" fill="#FFC23D" transform="rotate(315 32 32)"/>
      <circle cx="32" cy="32" r="9.2" fill="#FFC23D"/>
      <circle cx="32" cy="32" r="4.2" fill="#050A18"/>
    </svg>
  );
}


const DOT: Record<SourceState, string> = { idle: '', busy: 'busy', live: 'live', cache: 'cache', off: 'off' };

function UtcClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return <span className="clock">{now.toISOString().slice(11, 19)} UTC</span>;
}

export function TopBar({
  sources,
  onHome,
  lang,
  onLang,
  onPresent,
  mapFocus,
  onMapFocus,
}: {
  mapFocus?: boolean;
  onMapFocus?: () => void;
  onPresent?: () => void;
  sources: FieldData['sources'] | null;
  onHome: () => void;
  lang: Lang;
  onLang: (l: Lang) => void;
}) {
  const t = useT();
  const LABEL = t.state;
  const s = sources ?? { power: 'idle', modis: 'idle', terrain: 'idle', soil: 'idle' };
  const items: [string, SourceState][] = [
    ['NASA POWER', s.power],
    ['MODIS NDVI', s.modis],
    ['SRTM terrain', s.terrain],
    ['SoilGrids', s.soil],
  ];
  return (
    <header className="topbar">
      <button className="brand" onClick={onHome} style={{ background: 'none', border: 0, padding: 0, textAlign: 'left' }} aria-label="Helia home">
        <BrandMark />
        <span style={{ display: 'grid' }}>
          <span className="brand-name">HELIA</span>
          <span className="brand-tag">{t.tag}</span>
        </span>
      </button>
      <span className="topbar-spacer" />
      <div className="sources" aria-label="Data sources">
        {items.map(([k, v]) => (
          <span className="chip" key={k} title={`${k}: ${LABEL[v]}`}>
            <i className={`dot ${DOT[v]}`} />
            {k}
            <span style={{ color: 'var(--faint)' }}>{LABEL[v]}</span>
          </span>
        ))}
      </div>
      {onMapFocus && (
        <button className="ghost focus-btn" onClick={onMapFocus} aria-pressed={mapFocus}>
          {mapFocus ? (lang === 'pt' ? 'Mostrar painéis' : 'Show panels') : lang === 'pt' ? 'Ver mapa' : 'Map only'}
        </button>
      )}
      {onPresent && (
        <button className="present" onClick={onPresent}>
          <svg width="12" height="12" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 1.5v11l9.5-5.5z" fill="currentColor" /></svg>
          {lang === 'pt' ? 'Apresentar' : 'Present'}
        </button>
      )}
      <div className="seg lang" role="group" aria-label="Language / Idioma">
        <button aria-pressed={lang === 'en'} onClick={() => onLang('en')}>EN</button>
        <button aria-pressed={lang === 'pt'} onClick={() => onLang('pt')}>PT</button>
      </div>
      <UtcClock />
    </header>
  );
}

export function Landing({ onDemo, children }: { onDemo: (s: DemoSite) => void; children?: ReactNode }) {
  const t = useT();
  const lang = useLang();
  return (
    <section className="panel hero" aria-label="Start">
      <div className="eyebrow">{t.heroEyebrow}</div>
      <h1>{t.heroTitle}</h1>
      <p>{t.heroBody}</p>
      <div className="hero-actions">
        {DEMO_SITES.filter((s) => s.featured !== false).map((s, i) => (
          <button key={s.id} className={i === 0 ? 'cta' : 'ghost'} onClick={() => onDemo(s)} title={s.story}>
            {placeName(s.short, lang)}
          </button>
        ))}
      </div>
      <p className="hint" style={{ marginTop: 12 }}>{t.heroOr}</p>
      {children}
    </section>
  );
}
