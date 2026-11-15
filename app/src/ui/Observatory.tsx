import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { LAYERS, layerDef, type Frame, type LayerGroup, type LayerId } from '../data/observatory';
import { useLang, useT } from '../i18n';

const GROUPS: LayerGroup[] = ['image', 'veg', 'water'];

function frameLabel(f: Frame, timed: boolean, lang: 'en' | 'pt'): string {
  const d = new Date(f.t.length > 10 ? f.t : `${f.t}T12:00:00Z`);
  const loc = lang === 'pt' ? 'pt-BR' : 'en-US';
  return timed
    ? d.toLocaleString(loc, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString(loc, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** The NASA observatory dock: themed layers, each a time series that can be scrubbed or played. */
export function Observatory({
  layer,
  onLayer,
  frames,
  index,
  onIndex,
  playing,
  onPlaying,
  status,
  hasField,
  beside,
}: {
  layer: LayerId;
  onLayer: (l: LayerId) => void;
  frames: Frame[];
  index: number;
  onIndex: (i: number) => void;
  playing: boolean;
  onPlaying: (p: boolean) => void;
  status: 'idle' | 'loading' | 'ready' | 'empty';
  hasField: boolean;
  beside: boolean;
}) {
  const t = useT();
  const lang = useLang();
  const def = layerDef(layer);
  const f = frames[index];
  // beside the panels the dock starts compact so the map stays visible
  const [open, setOpen] = useState(!beside);
  useEffect(() => setOpen(!beside), [beside]);
  return (
    <div className={`obs ${beside ? 'beside' : ''} ${open ? '' : 'compact'}`} role="toolbar" aria-label={t.obs.title}>
      <div className="obs-row">
        <button className="obs-title" onClick={() => setOpen(!open)} aria-expanded={open}>
          {t.obs.title} <span aria-hidden="true">{open ? '▾' : '▴'}</span>
        </button>
        {!open && def && <span className="obs-current">{t.obs.names[def.id]}</span>}
        {open && GROUPS.map((g) => (
          <div className="obs-group" key={g}>
            <span className="obs-group-name">{t.obs.groups[g]}</span>
            {LAYERS.filter((l) => l.group === g).map((l) => {
              const disabled = l.needsField && !hasField;
              return (
                <button
                  key={l.id}
                  className={`obs-chip ${layer === l.id ? 'on' : ''}`}
                  aria-pressed={layer === l.id}
                  disabled={disabled}
                  title={disabled ? t.obs.pickField : t.obs.about[l.id]}
                  onClick={() => onLayer(layer === l.id ? 'none' : l.id)}
                >
                  {t.obs.names[l.id]}
                </button>
              );
            })}
          </div>
        ))}
        {open && layer !== 'none' && (
          <button className="obs-chip off" onClick={() => onLayer('none')}>
            {t.obs.off}
          </button>
        )}
      </div>

      {def && (
        <motion.div className="obs-player" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
          <button
            className="obs-play"
            onClick={() => onPlaying(!playing)}
            disabled={status !== 'ready' || frames.length < 2}
            aria-label={playing ? t.obs.pause : t.obs.play}
          >
            {playing ? (
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><rect x="2" y="1" width="3.5" height="12" rx="1" fill="currentColor" /><rect x="8.5" y="1" width="3.5" height="12" rx="1" fill="currentColor" /></svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 1.5v11l9.5-5.5z" fill="currentColor" /></svg>
            )}
          </button>
          <div className="obs-time">
            <div className="obs-date">
              {status === 'loading' ? t.obs.loading : status === 'empty' ? t.obs.none : f ? frameLabel(f, Boolean(def.timed), lang) : ''}
              {f?.note && status === 'ready' && <span className="obs-note">{f.note}</span>}
            </div>
            <input
              type="range"
              min={0}
              max={Math.max(0, frames.length - 1)}
              value={Math.min(index, Math.max(0, frames.length - 1))}
              onChange={(e) => {
                onPlaying(false);
                onIndex(Number(e.target.value));
              }}
              disabled={status !== 'ready'}
              aria-label={t.obs.names[def.id]}
            />
          </div>
          {def.legend.length > 0 && (
            <div className="obs-legend" aria-hidden="true">
              <span>{t.obs.low[def.id]}</span>
              <i style={{ background: `linear-gradient(90deg, ${def.legend.join(', ')})` }} />
              <span>{t.obs.high[def.id]}</span>
            </div>
          )}
          {open && <p className="obs-about">{t.obs.about[def.id]}</p>}
        </motion.div>
      )}
    </div>
  );
}
