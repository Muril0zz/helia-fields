import { AnimatePresence, motion } from 'framer-motion';
import { useEffect } from 'react';
import { rotationName, type StrategyResult } from '../engine';
import { useLang } from '../i18n';
import type { EngineClient } from '../worker/client';
import type { SimResult } from '../worker/protocol';
import { OutlookCard } from './OutlookCard';
import { RainComing } from './RainComing';
import { RollingNumber } from './RollingNumber';
import { SoilColumn } from './SoilColumn';
import { useMoney } from './money';

export const STORY_SCENES = 7;

const TXT = {
  en: {
    exit: 'Exit',
    hint: '← → to move',
    s: [
      { eyebrow: 'NASA GPM · the last 24 hours', title: 'Every storm on Earth, right now.', body: 'Measured every 30 minutes by a constellation of NASA and partner satellites.' },
      { eyebrow: 'NASA HLS · Landsat + Sentinel-2 · 30 m', title: 'Sorriso, Mato Grosso.', body: 'The heart of Brazilian soybean. This is a real NASA photo of these fields.' },
      { eyebrow: 'One year from orbit', title: 'Soybean. Maize. Then nothing.', body: 'Watch the fields turn green twice, then lie bare and red through the dry season.' },
      { eyebrow: 'Under the field', title: 'The water the farmer never sees.', body: 'Rain fills the soil, roots drink it, bare months lose it. Our model follows NASA’s soil wetness day by day.' },
      { eyebrow: 'Next season · NOAA outlook', title: 'A strong El Niño is coming.', body: 'Helia replays the past seasons like it, and the 16 days of rain on the way.' },
      { eyebrow: 'The answer', title: 'Same crops. One cover more.', body: 'The smallest change a farmer can make next season, and what it buys.' },
      { eyebrow: 'Helia', title: 'Any field on Earth. One click. Free.', body: '20 years of NASA data, checked against 38 official harvest records on three continents.' },
    ],
    bare: 'days a year of bare soil',
    fewer: 'fewer days of bare soil, every year',
    marginNino: 'margin in strong El Niño seasons',
    today: 'Today',
    change: 'Smallest change',
    rows: { bare: 'Bare soil', rainBare: 'Rain on bare soil', straw: 'Straw left', n: 'Nitrogen left', margin: 'Indicative margin' },
    url: 'helia-fields.netlify.app',
  },
  pt: {
    exit: 'Sair',
    hint: '← → para navegar',
    s: [
      { eyebrow: 'NASA GPM · últimas 24 horas', title: 'Toda chuva da Terra, agora.', body: 'Medida a cada 30 minutos por uma constelação de satélites da NASA e parceiros.' },
      { eyebrow: 'NASA HLS · Landsat + Sentinel-2 · 30 m', title: 'Sorriso, Mato Grosso.', body: 'O coração da soja brasileira. Esta é uma foto real da NASA destes talhões.' },
      { eyebrow: 'Um ano visto da órbita', title: 'Soja. Milho. Depois, nada.', body: 'Os talhões ficam verdes duas vezes e depois ficam vermelhos, descobertos, a seca inteira.' },
      { eyebrow: 'Embaixo do talhão', title: 'A água que o produtor não vê.', body: 'A chuva enche o solo, a raiz bebe, o solo descoberto perde. Nosso modelo acompanha a umidade medida pela NASA, dia a dia.' },
      { eyebrow: 'Próxima safra · previsão NOAA', title: 'Vem aí um El Niño forte.', body: 'A Helia revive as safras parecidas e mostra a chuva dos próximos 16 dias.' },
      { eyebrow: 'A resposta', title: 'Mesmas culturas. Uma cobertura a mais.', body: 'A menor mudança que o produtor pode fazer na próxima safra, e o que ela rende.' },
      { eyebrow: 'Helia', title: 'Qualquer talhão da Terra. Um clique. De graça.', body: '20 anos de dados da NASA, conferidos com 38 séries oficiais de colheita em três continentes.' },
    ],
    bare: 'dias por ano de solo descoberto',
    fewer: 'dias a menos de solo descoberto, todo ano',
    marginNino: 'de margem nas safras de El Niño forte',
    today: 'Hoje',
    change: 'Menor mudança',
    rows: { bare: 'Solo descoberto', rainBare: 'Chuva em solo descoberto', straw: 'Palha deixada', n: 'Nitrogênio deixado', margin: 'Margem indicativa' },
    url: 'helia-fields.netlify.app',
  },
};

function Compare({ cur, alt, lang }: { cur: StrategyResult; alt: StrategyResult; lang: 'en' | 'pt' }) {
  const x = TXT[lang];
  const money = useMoney();
  const loc = lang === 'pt' ? 'pt-BR' : 'en-US';
  const rows: [string, number, number, string, number, 'low' | 'high'][] = [
    [x.rows.bare, cur.metrics.bareDays.mean, alt.metrics.bareDays.mean, lang === 'pt' ? 'd/ano' : 'd/yr', 0, 'low'],
    [x.rows.rainBare, cur.metrics.rainOnBareMm.mean, alt.metrics.rainOnBareMm.mean, 'mm', 0, 'low'],
    [x.rows.straw, cur.metrics.residueT.mean, alt.metrics.residueT.mean, 't/ha', 1, 'high'],
    [x.rows.n, cur.metrics.nCredit.mean, alt.metrics.nCredit.mean, 'kg/ha', 0, 'high'],
    [x.rows.margin, money.local(cur.metrics.margin.mean), money.local(alt.metrics.margin.mean), money.perHa, 0, 'high'],
  ];
  return (
    <div className="story-compare">
      <div className="story-compare-head">
        <span />
        <span>{x.today}<small>{rotationName(cur.strategy.years, lang)}</small></span>
        <span className="alt">{x.change}<small>{rotationName(alt.strategy.years, lang)}</small></span>
      </div>
      {rows.map(([k, a, b, unit, dec, better]) => {
        const good = better === 'low' ? b < a : b > a;
        return (
          <div className="story-compare-row" key={k}>
            <span>{k}</span>
            <span className="v">{a.toLocaleString(loc, { maximumFractionDigits: dec })} <small>{unit}</small></span>
            <span className={`v ${good ? 'good' : 'bad'}`}>
              <RollingNumber value={b} decimals={dec} /> <small>{unit}</small>
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Full-screen guided presentation: one idea per scene, the map does the talking. */
export function StoryMode({
  scene,
  onScene,
  onExit,
  result,
  field,
  client,
  frameLabel,
}: {
  scene: number;
  onScene: (i: number) => void;
  onExit: () => void;
  result: SimResult | null;
  field: { lat: number; lon: number } | null;
  client: EngineClient;
  frameLabel: string | null;
}) {
  const lang = useLang();
  const x = TXT[lang];
  const s = x.s[scene];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (['ArrowRight', 'PageDown', ' ', 'Enter'].includes(e.key)) {
        e.preventDefault();
        onScene(Math.min(STORY_SCENES - 1, scene + 1));
      } else if (['ArrowLeft', 'PageUp', 'Backspace'].includes(e.key)) {
        e.preventDefault();
        onScene(Math.max(0, scene - 1));
      } else if (e.key === 'Escape') onExit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [scene, onScene, onExit]);

  const cur = result?.current;
  const alt = result?.recommendations[0];
  const ninoDelta = result?.outlook.analog && result.outlook.all.margin ? (100 * (result.outlook.analog.margin - result.outlook.all.margin)) / Math.abs(result.outlook.all.margin) : null;

  return (
    <div className="story" role="region" aria-label="Presentation">
      <div className="story-top">
        <div className="story-dots" role="tablist">
          {Array.from({ length: STORY_SCENES }, (_, i) => (
            <button key={i} role="tab" aria-selected={i === scene} aria-label={`${i + 1}`} className={i === scene ? 'on' : i < scene ? 'past' : ''} onClick={() => onScene(i)} />
          ))}
        </div>
        <button className="story-exit" onClick={onExit}>{x.exit} · Esc</button>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={`cap-${scene}-${lang}`}
          className="story-caption"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
        >
          <div className="story-eyebrow">{s.eyebrow}{scene === 1 && frameLabel ? ` · ${frameLabel}` : ''}</div>
          <h1 className="story-title">{s.title}</h1>
          <p className="story-body">{s.body}</p>
          {scene === 2 && cur && (
            <div className="story-stat bad">
              <RollingNumber value={cur.metrics.bareDays.mean} />
              <span>{x.bare}</span>
            </div>
          )}
          {scene === 4 && ninoDelta !== null && (
            <div className="story-stat bad">
              <RollingNumber value={ninoDelta} signed suffix=" %" />
              <span>{x.marginNino}</span>
            </div>
          )}
          {scene === 5 && cur && alt && (
            <div className="story-stat good">
              <RollingNumber value={alt.metrics.bareDays.mean - cur.metrics.bareDays.mean} signed />
              <span>{x.fewer}</span>
            </div>
          )}
          {scene === 6 && <div className="story-url">{x.url}</div>}
        </motion.div>
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {result && field && scene >= 3 && scene <= 5 && (
          <motion.aside
            key={`spot-${scene}`}
            className="story-spot"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 16 }}
            transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
          >
            {scene === 3 && <SoilColumn client={client} result={result} ninoYears={result.outlook.years} autoPlay />}
            {scene === 4 && (
              <>
                <OutlookCard result={result} on={false} onToggle={() => undefined} />
                <RainComing lat={field.lat} lon={field.lon} monthlyRain={result.climate.monthlyRain} />
              </>
            )}
            {scene === 5 && cur && alt && <Compare cur={cur} alt={alt} lang={lang} />}
          </motion.aside>
        )}
      </AnimatePresence>

      <div className="story-nav">
        <button onClick={() => onScene(Math.max(0, scene - 1))} disabled={scene === 0} aria-label="Previous">←</button>
        <span>{scene + 1} / {STORY_SCENES}</span>
        <button onClick={() => onScene(Math.min(STORY_SCENES - 1, scene + 1))} disabled={scene === STORY_SCENES - 1} aria-label="Next">→</button>
      </div>
    </div>
  );
}
