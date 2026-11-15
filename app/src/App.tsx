import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { makeStrategy, type Constraints, type Priorities, type RotationYear, type Scenario, type SoilInfo } from './engine';
import { DEFAULT_SOIL } from './engine/soil';
import type { Lang } from './engine';
import { LangContext, initialLang } from './i18n';
import { DEMO_SITES, guessCurrent, loadField, type DemoSite, type FieldData } from './data/field';
import { SOIL_PRESETS } from './data/soil';
import { fetchCarAtPoint, fetchCarByCode, fetchDeforestation, fetchPropertyNdvi, type CarProperty, type Deforestation } from './data/car';
import { readCycles } from './data/modis';
import { Landing, TopBar } from './ui/Chrome';
import { Observatory } from './ui/Observatory';
import { framesFor, layerDef, type Frame, type LayerId } from './data/observatory';
import { Confetti } from './ui/Confetti';
import { FieldPanel } from './ui/FieldPanel';
import { CarCard } from './ui/CarCard';
import { ErrorBoundary } from './ui/ErrorBoundary';
import { LabPanel } from './ui/LabPanel';
import { SoilColumn } from './ui/SoilColumn';
import { RainComing } from './ui/RainComing';
import { STORY_SCENES, StoryMode } from './ui/StoryMode';
import { PricesCard } from './ui/PricesCard';
import { MoneyContext } from './ui/money';
import { DEMO_PLACES, localEconomics, placeAt, placeFromCar, type Overrides, type Place } from './data/prices';
import { CROPS } from './engine';
import { MapView, type MapFrames } from './ui/MapView';
import { EngineClient } from './worker/client';
import type { SimResult } from './worker/protocol';

const DEMO_SOIL: Record<string, string> = {
  'sorriso-br': 'clay', 'vilhena-br': 'clay', 'ames-us': 'silt loam', 'salina-us': 'silt loam', 'ludhiana-in': 'sandy loam', 'nakuru-ke': 'clay loam',
};

const REDUCED = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// One engine worker for the whole page (StrictMode would otherwise build two).
let engine: EngineClient | null = null;
function getEngine(): EngineClient {
  engine ??= new EngineClient();
  return engine;
}

/** Rain-limited (tropical) climate: monthly mean temperature varies by 10 °C or less. */
function rainLimited(f: FieldData): boolean {
  const sums = new Array(12).fill(0);
  const n = new Array(12).fill(0);
  f.series.dates.forEach((d, i) => {
    const m = Number(d.slice(5, 7)) - 1;
    sums[m] += (f.series.tmax[i] + f.series.tmin[i]) / 2;
    n[m]++;
  });
  const means = sums.map((s, m) => s / Math.max(1, n[m]));
  return Math.max(...means) - Math.min(...means) <= 10 || Math.min(...means) >= 15;
}

function readHash(): DemoSite | { lat: number; lon: number } | null {
  const h = new URLSearchParams(window.location.hash.slice(1));
  const site = h.get('site');
  if (site) return DEMO_SITES.find((s) => s.id === site) ?? null;
  const at = h.get('at');
  if (at) {
    const [lat, lon] = at.split(',').map(Number);
    if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon };
  }
  return null;
}

export default function App() {
  const client = getEngine();
  const [field, setField] = useState<FieldData | null>(null);
  const [target, setTarget] = useState<{ lat: number; lon: number } | null>(null);
  const [sources, setSources] = useState<FieldData['sources'] | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [ready, setReady] = useState(0); // bumps when a series is in the worker
  const [current, setCurrent] = useState<RotationYear[]>([{ main: 'soy', second: 'maize' }]);
  const [soil, setSoil] = useState<SoilInfo>(DEFAULT_SOIL);
  const [constraints, setConstraints] = useState<Constraints>({ irrigation: false, livestock: false });
  const [scenario, setScenario] = useState<Scenario>({ rainPct: 0, tempDelta: 0 });
  const [priorities, setPriorities] = useState<Priorities>({ water: 2, soil: 2, income: 2, risk: 2 });
  const [lang, setLang] = useState<Lang>(initialLang);
  const langRef = useRef(lang);
  langRef.current = lang;
  const [result, setResult] = useState<SimResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // ---- NASA observatory: themed layers, each a playable time series
  const [layer, setLayer] = useState<LayerId>('rainnow');
  const [frames, setFrames] = useState<Frame[]>([]);
  const [frameIndex, setFrameIndex] = useState(0);
  const [playing, setPlaying] = useState(!REDUCED);
  const [view, setView] = useState<{ zoom: number; seq: number; center?: [number, number] } | null>(null);
  // guided presentation: null = off, otherwise the scene index
  const [story, setStory] = useState<number | null>(null);
  const storyStarted = useRef(-1);
  const [mapFocus, setMapFocus] = useState(false);
  const [frameStatus, setFrameStatus] = useState<'idle' | 'loading' | 'ready' | 'empty'>('idle');
  const [celebrate, setCelebrate] = useState(0);
  const celebrated = useRef<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const userEdited = useRef(false);
  const rainLimitedRef = useRef(true);
  const annualRainRef = useRef(1000);
  const simSeq = useRef(0);
  const rankSeq = useRef(0);
  const simPending = useRef(false);
  const priRef = useRef(priorities);
  priRef.current = priorities;
  const [outlook, setOutlook] = useState(false);
  const outlookRef = useRef(outlook);
  outlookRef.current = outlook;
  const lastHash = useRef('');
  // ---- local prices and costs: place → official values → the farmer's own numbers
  const [place, setPlace] = useState<Place | null>(null);
  const [overrides, setOverrides] = useState<Overrides>({});
  const econ = useMemo(() => localEconomics(place, CROPS.map((c) => c.id), overrides), [place, overrides]);
  const econKey = JSON.stringify(econ.table);
  const moneyRef = useRef({ code: econ.currency, fx: econ.fx });
  moneyRef.current = { code: econ.currency, fx: econ.fx };

  const open = useCallback(
    async (lat: number, lon: number, demo: DemoSite | null) => {
      abort.current?.abort();
      const ctl = new AbortController();
      abort.current = ctl;
      // anything still in flight belongs to the previous field
      simSeq.current++;
      rankSeq.current++;
      simPending.current = false;
      setBusy(false);
      setTarget({ lat, lon });
      setLayer('hls');
      setPlaying(false);
      setLoading(true);
      setLoadError(null);
      setResult(null);
      setField(null);
      carCtl.current?.abort();
      setCar(null);
      setCarState('idle');
      setDeforestation(null);
      setPropertyPixels(null);
      setOverrides({});
      setPlace(demo ? DEMO_PLACES[demo.id] ?? null : null);
      if (!demo) placeAt(lat, lon, ctl.signal).then((p) => !ctl.signal.aborted && p && setPlace((prev) => prev ?? p));
      const hash = demo ? `#site=${demo.id}` : `#at=${lat.toFixed(4)},${lon.toFixed(4)}`;
      window.history.replaceState(null, '', hash);
      lastHash.current = hash;
      userEdited.current = false;
      // slow sources can land before the weather does: keep them until the field exists
      let fieldReady = false;
      const early: Partial<Pick<FieldData, 'cycles' | 'soilgrids' | 'slope'>> = {};
      try {
        const f = await loadField(
          lat,
          lon,
          demo,
          (s) => !ctl.signal.aborted && setSources((prev) => ({ ...(prev ?? { power: 'idle', modis: 'idle', terrain: 'idle', soil: 'idle' }), ...s })),
          (patch) => {
            if (ctl.signal.aborted) return;
            if (!fieldReady) {
              Object.assign(early, patch);
              return;
            }
            setField((prev) => (prev ? { ...prev, ...patch } : prev));
            if (patch.soilgrids) setSoil(patch.soilgrids);
            if (patch.cycles && !demo && !userEdited.current) setCurrent(guessCurrent(patch.cycles, rainLimitedRef.current, lat, annualRainRef.current));
          },
          ctl.signal,
        );
        if (ctl.signal.aborted) return;
        await client.load(f.series);
        if (ctl.signal.aborted) return;
        Object.assign(f, early);
        fieldReady = true;
        rainLimitedRef.current = rainLimited(f);
        annualRainRef.current = (f.series.prec.reduce((a, b) => a + b, 0) / f.series.prec.length) * 365.25;
        setField(f);
        if (demo) {
          setCurrent(demo.current);
          setConstraints({ irrigation: demo.irrigation, livestock: demo.livestock });
          setSoil(f.soilgrids ?? SOIL_PRESETS.find((p) => p.id === DEMO_SOIL[demo.id])?.soil ?? DEFAULT_SOIL);
        } else {
          setCurrent(guessCurrent(f.cycles, rainLimitedRef.current, lat, annualRainRef.current));
          setConstraints({ irrigation: false, livestock: false });
          setSoil(f.soilgrids ?? DEFAULT_SOIL);
        }
        setReady((r) => r + 1);
      } catch (e) {
        if (!ctl.signal.aborted) setLoadError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!ctl.signal.aborted) setLoading(false);
      }
    },
    [client],
  );

  // ---- the farmer's own property (Brazil's CAR registry)
  const [car, setCar] = useState<CarProperty | null>(null);
  const [carState, setCarState] = useState<'idle' | 'busy' | 'notfound' | 'error'>('idle');
  const [deforestation, setDeforestation] = useState<Deforestation | null | 'busy'>(null);
  const [propertyPixels, setPropertyPixels] = useState<number | null>(null);
  const carCtl = useRef<AbortController | null>(null);

  /** Boundary on the map, PRODES check and whole-property NDVI, all in the background. */
  const attachCar = useCallback((p: CarProperty, isDemo: boolean) => {
    carCtl.current?.abort();
    const ctl = new AbortController();
    carCtl.current = ctl;
    setCar(p);
    setCarState('idle');
    const fromCar = placeFromCar(p.code, p.municipality);
    if (fromCar) setPlace(fromCar);
    setDeforestation('busy');
    setPropertyPixels(null);
    fetchDeforestation(p, ctl.signal)
      .then((d) => !ctl.signal.aborted && setDeforestation(d))
      .catch(() => !ctl.signal.aborted && setDeforestation(null));
    fetchPropertyNdvi(p, 2022, ctl.signal)
      .then(({ points, pixels }) => {
        if (ctl.signal.aborted || points.length < 12) return;
        const cycles = readCycles(points);
        setPropertyPixels(pixels);
        setField((prev) => (prev ? { ...prev, cycles } : prev));
        if (!isDemo && !userEdited.current) setCurrent(guessCurrent(cycles, rainLimitedRef.current, p.centroid.lat, annualRainRef.current));
      })
      .catch(() => undefined); // the point NDVI stays in place
  }, []);

  const openCar = useCallback(
    async (code: string) => {
      setCarState('busy');
      try {
        const p = await fetchCarByCode(code);
        if (!p) {
          setCarState('notfound');
          return;
        }
        await open(p.centroid.lat, p.centroid.lon, null);
        window.history.replaceState(null, '', `#car=${p.code}`);
        lastHash.current = `#car=${p.code}`;
        attachCar(p, false);
      } catch {
        setCarState('error');
      }
    },
    [open, attachCar],
  );

  const findCarHere = useCallback(async () => {
    if (!field) return;
    setCarState('busy');
    try {
      const p = await fetchCarAtPoint(field.lat, field.lon);
      if (!p) setCarState('notfound');
      else attachCar(p, Boolean(field.demo));
    } catch {
      setCarState('error');
    }
  }, [field, attachCar]);

  // deep link (on load and when someone pastes a new #site= / #at= / #car= link)
  useEffect(() => {
    const go = () => {
      if (window.location.hash === lastHash.current) return;
      lastHash.current = window.location.hash;
      const carCode = new URLSearchParams(window.location.hash.slice(1)).get('car');
      if (carCode) {
        openCar(carCode);
        return;
      }
      const h = readHash();
      if (!h) return;
      if ('id' in h) open(h.lat, h.lon, h);
      else open(h.lat, h.lon, null);
    };
    go();
    window.addEventListener('hashchange', go);
    return () => window.removeEventListener('hashchange', go);
  }, [open, openCar]);

  // heavy simulation when anything physical changes (debounced for sliders)
  const slope = field?.slope?.slopePct;
  useEffect(() => {
    if (!ready || !field) return;
    const id = ++simSeq.current;
    simPending.current = true;
    setBusy(true);
    const t = setTimeout(() => {
      const sent = priRef.current;
      const sentLang = langRef.current;
      client
        .simulate({
          soil,
          site: { slopePct: slope ?? 3, slopeSource: slope === undefined ? 'default' : 'terrain' },
          constraints,
          scenario,
          current: makeStrategy(current),
          priorities: sent,
          lang: sentLang,
          outlook: outlookRef.current,
          prices: econ.table,
          money: moneyRef.current,
        })
        .then(async (r) => {
          if (id !== simSeq.current) return;
          // priorities moved while we were simulating: re-rank the fresh bundle
          if (JSON.stringify(sent) !== JSON.stringify(priRef.current) || sentLang !== langRef.current || r.outlook.active !== (outlookRef.current && r.outlook.used)) r = await client.rank(priRef.current, langRef.current, outlookRef.current, moneyRef.current);
          if (id !== simSeq.current) return;
          setResult(r);
          setError(null);
          const key = `${field.lat},${field.lon}`;
          if (celebrated.current !== key && r.recommendations.length) {
            celebrated.current = key;
            setCelebrate((c) => c + 1);
          }
        })
        .catch((e) => id === simSeq.current && setError(e.message))
        .finally(() => {
          if (id !== simSeq.current) return;
          simPending.current = false;
          setBusy(false);
        });
    }, 140);
    return () => clearTimeout(t);
    // priorities handled by the light re-rank below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, field, soil, slope, constraints, scenario, current, client, econKey]);

  // light re-rank when only priorities change
  const firstPriorities = useRef(true);
  useEffect(() => {
    if (firstPriorities.current) {
      firstPriorities.current = false;
      return;
    }
    if (!result || simPending.current) return; // a pending simulation will pick up the new priorities
    const id = ++rankSeq.current;
    client
      .rank(priorities, lang, outlook, moneyRef.current)
      .then((r) => id === rankSeq.current && !simPending.current && setResult(r))
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [priorities, lang, outlook]);

  // frames for the chosen layer (the 30 m scenes depend on the field)
  const hlsKey = layer === 'hls' && target ? `${target.lat.toFixed(3)},${target.lon.toFixed(3)}` : '';
  useEffect(() => {
    const ctl = new AbortController();
    setFrames([]);
    setFrameIndex(0);
    if (layer === 'none' || (layer === 'hls' && !target)) {
      setFrameStatus('idle');
      return;
    }
    setFrameStatus('loading');
    framesFor(layer, target, ctl.signal)
      .then((fr) => {
        if (ctl.signal.aborted) return;
        setFrames(fr);
        // rain and greenness play from the start; the field's photos open on the newest clear scene
        setFrameIndex(layer === 'hls' || layer === 'deep' || layer === 'soil' || layer === 'ndvi' ? Math.max(0, fr.length - 1) : 0);
        setFrameStatus(fr.length ? 'ready' : 'empty');
      })
      .catch(() => !ctl.signal.aborted && setFrameStatus('empty'));
    return () => ctl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layer, hlsKey]);

  // the player steps only after the current frame is on screen
  const [shown, setShown] = useState(-1);
  useEffect(() => {
    if (!playing || frameStatus !== 'ready' || frames.length < 2 || shown !== frameIndex) return;
    const def = layerDef(layer);
    const last = frameIndex === frames.length - 1;
    const t = setTimeout(() => setFrameIndex((i) => (i + 1) % frames.length), last ? 1600 : (def?.stepMs ?? 500));
    return () => clearTimeout(t);
  }, [playing, frameStatus, frames, shown, frameIndex, layer]);

  const mapFrames = useMemo<MapFrames | null>(() => {
    const def = layerDef(layer);
    if (!def || !frames.length) return null;
    return { key: `${layer}-${hlsKey}-${frames.length}`, urls: frames.map((f) => f.url), index: frameIndex, level: def.level, opacity: def.opacity, credit: def.credit };
  }, [layer, hlsKey, frames, frameIndex]);

  const home = () => {
    abort.current?.abort();
    simSeq.current++;
    rankSeq.current++;
    simPending.current = false;
    setBusy(false);
    lastHash.current = '#';
    setField(null);
    setTarget(null);
    setResult(null);
    setSources(null);
    setLoading(false);
    setLayer('rainnow');
    setPlaying(!REDUCED);
    setView((v) => ({ zoom: window.innerWidth > 1100 ? 2.25 : 1.4, center: [-48, -8], seq: (v?.seq ?? 0) + 1 }));
    window.history.replaceState(null, '', '#');
  };

  // each presentation scene puts the app in the state it talks about
  const SORRISO = DEMO_SITES.find((s) => s.id === 'sorriso-br')!;
  useEffect(() => {
    if (story === null) return;
    const bump = (z: number, center?: [number, number]) => setView((v) => ({ zoom: z, center, seq: (v?.seq ?? 0) + 1 }));
    if (story === 0) {
      if (target) home();
      setLayer('rainnow');
      setPlaying(!REDUCED);
      bump(2.25, [-50, -10]);
    } else if (story === 1) {
      if (!field || field.demo?.id !== SORRISO.id) open(SORRISO.lat, SORRISO.lon, SORRISO);
      else bump(12.6);
      setLayer('hls');
      setPlaying(false);
    } else if (story === 2) {
      setLayer('hls');
      storyStarted.current = -1;
    } else if (story <= 5) {
      setLayer('hls');
      setPlaying(false);
      if (story === 3) bump(12.6);
    } else {
      setLayer('rainnow');
      setPlaying(!REDUCED);
      bump(2.25, [-50, -10]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story]);
  // scene 3 plays the field's year from the first clear photo once the photos are in
  useEffect(() => {
    if (story === 2 && layer === 'hls' && frameStatus === 'ready' && storyStarted.current !== 2) {
      storyStarted.current = 2;
      setFrameIndex(0);
      setPlaying(!REDUCED);
    }
  }, [story, layer, frameStatus]);

  const showPanels = Boolean(target) && story === null && !mapFocus;
  return (
    <LangContext.Provider value={lang}>
    <MoneyContext.Provider value={{ code: econ.currency, fx: econ.fx }}>
    <div className={`app ${story !== null ? 'presenting' : ''}`}>
      <ErrorBoundary fallback={<div className="map" />}>
        <MapView target={target} frames={mapFrames} view={view} onFrameShown={setShown} onPick={(lat, lon) => open(lat, lon, null)} idle={!target} boundary={car} />
      </ErrorBoundary>
      <TopBar
        sources={sources}
        onHome={() => {
          setStory(null);
          home();
        }}
        onPresent={story === null ? () => setStory(0) : undefined}
        mapFocus={mapFocus}
        onMapFocus={target && story === null ? () => setMapFocus((v) => !v) : undefined}
        lang={lang}
        onLang={(l) => {
          setLang(l);
          document.documentElement.lang = l === 'pt' ? 'pt-BR' : 'en';
          try {
            localStorage.setItem('helia.lang', l);
          } catch {
            /* storage may be blocked */
          }
        }}
      />
      <AnimatePresence>
        {!target && story === null && (
          <motion.div key="landing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            <Landing onDemo={(s) => open(s.lat, s.lon, s)}>
              <CarCard
                car={car}
                state={carState}
                deforestation={deforestation}
                propertyPixels={propertyPixels}
                onLoad={openCar}
                onFindHere={findCarHere}
                canFindHere={false}
              />
            </Landing>
          </motion.div>
        )}
      </AnimatePresence>
      {showPanels && (
        <>
          <FieldPanel
            field={field}
            climate={result?.climate ?? null}
            soil={soil}
            onSoil={setSoil}
            current={current}
            onCurrent={(r) => {
              userEdited.current = true;
              setCurrent(r);
            }}
            constraints={constraints}
            onConstraints={setConstraints}
            loading={loading}
            modisBusy={sources?.modis === 'busy'}
            water={
              result && !loading && field ? (
                <>
                  <RainComing lat={field.lat} lon={field.lon} monthlyRain={result.climate.monthlyRain} />
                  <PricesCard
                    econ={econ}
                    ids={[...new Set([result.current, ...result.recommendations].flatMap((r) => r.strategy.years.flatMap((y) => [y.main, y.second, y.cover].filter(Boolean) as string[])))]}
                    onOverride={(id, f, v) => setOverrides((o) => ({ ...o, [id]: { ...o[id], [f]: v } }))}
                    onReset={() => setOverrides({})}
                  />
                  <SoilColumn client={client} result={result} ninoYears={result.outlook.years} />
                </>
              ) : null
            }
          >
            <CarCard
                car={car}
                state={carState}
                deforestation={deforestation}
                propertyPixels={propertyPixels}
                onLoad={openCar}
                onFindHere={findCarHere}
                canFindHere={Boolean(field) && !car}
              />
          </FieldPanel>
          <LabPanel
            result={result}
            busy={busy || loading}
            error={loadError ?? error}
            scenario={scenario}
            onScenario={setScenario}
            priorities={priorities}
            onPriorities={setPriorities}
            outlook={outlook}
            onOutlook={setOutlook}
          />
        </>
      )}
      {story !== null && (
        <StoryMode
          scene={story}
          onScene={(i) => setStory(Math.max(0, Math.min(STORY_SCENES - 1, i)))}
          onExit={() => setStory(null)}
          result={result}
          field={field}
          client={client}
          frameLabel={layer === 'hls' && frames[frameIndex] ? new Date(`${frames[frameIndex].t}T12:00:00Z`).toLocaleDateString(lang === 'pt' ? 'pt-BR' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : null}
        />
      )}
      {story === null && <Observatory
        layer={layer}
        onLayer={(l) => {
          setLayer(l);
          const d = layerDef(l);
          if (target && d) setView((v) => ({ zoom: d.view, seq: (v?.seq ?? 0) + 1 }));
          setPlaying(!REDUCED && (l === 'rainnow' || l === 'ndvi'));
        }}
        frames={frames}
        index={frameIndex}
        onIndex={setFrameIndex}
        playing={playing}
        onPlaying={setPlaying}
        status={frameStatus}
        hasField={Boolean(target)}
        beside={showPanels}
      />}
      <Confetti fire={celebrate} />
    </div>
    </MoneyContext.Provider>
    </LangContext.Provider>
  );
}
