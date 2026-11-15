import maplibregl, { type Map as MlMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef } from 'react';
import type { CarProperty } from '../data/car';

const GIBS = 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best';

/** What the observatory wants on the map: a key for the layer, its frames and which one to show. */
export interface MapFrames {
  key: string;
  urls: string[];
  index: number;
  level: number;
  opacity: number;
  credit: string;
}

export function MapView({
  target,
  frames,
  view,
  onFrameShown,
  onPick,
  idle,
  boundary,
}: {
  boundary?: CarProperty | null;
  target: { lat: number; lon: number } | null;
  frames: MapFrames | null;
  /** Zoom to frame the chosen layer around the field; changes when `seq` does. */
  view?: { zoom: number; seq: number; center?: [number, number] } | null;
  /** Called once a frame's tiles are on screen (the player waits for it before stepping). */
  onFrameShown?: (index: number) => void;
  onPick: (lat: number, lon: number) => void;
  idle: boolean;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<MlMap | null>(null);
  const marker = useRef<maplibregl.Marker | null>(null);
  const pickRef = useRef(onPick);
  pickRef.current = onPick;
  const styleReady = useRef(false);
  const spinning = useRef(idle);
  spinning.current = idle;

  useEffect(() => {
    if (!el.current) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const m = new maplibregl.Map({
      container: el.current,
      center: [-48, -8],
      zoom: window.innerWidth > 1100 ? 2.25 : 1.4,
      maxPitch: 70,
      attributionControl: { compact: true },
      style: {
        version: 8,
        projection: { type: 'globe' },
        sky: {
          'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 5, 1, 7, 0],
        },
        sources: {
          bluemarble: {
            type: 'raster',
            tiles: [`${GIBS}/BlueMarble_ShadedRelief_Bathymetry/default/2004-08-01/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg`],
            tileSize: 256,
            maxzoom: 8,
            attribution: 'NASA Blue Marble · GIBS',
          },
          s2: {
            type: 'raster',
            tiles: ['https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2023_3857/default/g/{z}/{y}/{x}.jpg'],
            tileSize: 256,
            minzoom: 6,
            maxzoom: 15,
            attribution: 'Sentinel-2 cloudless 2023 by EOX (Copernicus data)',
          },
          dem: {
            type: 'raster-dem',
            tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
            encoding: 'terrarium',
            tileSize: 256,
            maxzoom: 13,
            attribution: 'Terrain: SRTM via AWS Terrain Tiles',
          },
        },
        layers: [
          { id: 'bg', type: 'background', paint: { 'background-color': '#050A18' } },
          { id: 'bluemarble', type: 'raster', source: 'bluemarble' },
          {
            id: 's2', type: 'raster', source: 's2', minzoom: 6,
            paint: { 'raster-opacity': ['interpolate', ['linear'], ['zoom'], 6, 0, 8, 1] },
          },
          {
            id: 'hillshade', type: 'hillshade', source: 'dem', minzoom: 8,
            paint: { 'hillshade-exaggeration': 0.35, 'hillshade-shadow-color': '#050A18', 'hillshade-highlight-color': '#ffffff' },
          },
        ],
      },
    });
    map.current = m;
    if (import.meta.env.DEV) (window as unknown as { __map?: MlMap }).__map = m;
    // keep the globe clear of the intro card on wide screens
    if (window.innerWidth > 1100) m.setPadding({ left: 520, right: 0, top: 60, bottom: 0 });
    m.on('click', (e) => {
      const ll = e.lngLat.wrap();
      pickRef.current(Math.max(-89.9, Math.min(89.9, ll.lat)), ll.lng);
    });
    m.getCanvas().style.cursor = 'crosshair';
    let raf = 0;
    let last = performance.now();
    const spin = (t: number) => {
      // ambient motion: slow drift, ~30 fps, only while idle and allowed
      if (t - last > 33) {
        if (spinning.current && !reduce && !document.hidden && m.isStyleLoaded() && !m.isMoving()) {
          const c = m.getCenter();
          m.setCenter([c.lng + 0.06, c.lat]);
        }
        last = t;
      }
      raf = requestAnimationFrame(spin);
    };
    raf = requestAnimationFrame(spin);
    m.on('load', () => {
      styleReady.current = true;
      m.on('zoomend', () => {
        if (m.getZoom() > 9.5 && !m.getTerrain()) m.setTerrain({ source: 'dem', exaggeration: 1.4 });
        if (m.getZoom() < 8 && m.getTerrain()) m.setTerrain(null);
      });
    });
    return () => {
      cancelAnimationFrame(raf);
      m.remove();
      map.current = null;
    };
  }, []);

  // observatory frames: show one, preload the next two, drop the rest (no flicker while playing)
  const shownRef = useRef(onFrameShown);
  shownRef.current = onFrameShown;
  const live = useRef<{ key: string; ids: Map<number, string> }>({ key: '', ids: new Map() });
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    let cancel = () => {};
    const apply = () => {
      const st = live.current;
      const drop = (id: string) => {
        if (m.getLayer(id)) m.removeLayer(id);
        if (m.getSource(id)) m.removeSource(id);
      };
      if (!frames || frames.key !== st.key) {
        st.ids.forEach(drop);
        st.ids.clear();
        st.key = frames?.key ?? '';
      }
      if (!frames || !frames.urls.length) return;
      const n = frames.urls.length;
      const want = [0, 1, 2, 3, 4].map((k) => (frames.index + k) % n);
      st.ids.forEach((id, i) => {
        if (!want.includes(i)) {
          drop(id);
          st.ids.delete(i);
        }
      });
      const below = m.getLayer('hillshade') ? 'hillshade' : undefined;
      for (const i of want) {
        if (st.ids.has(i)) continue;
        const id = `obs-${frames.key}-${i}`;
        m.addSource(id, { type: 'raster', tiles: [frames.urls[i]], tileSize: 256, maxzoom: frames.level, attribution: frames.credit });
        m.addLayer(
          { id, type: 'raster', source: id, paint: { 'raster-opacity': 0, 'raster-fade-duration': 0 } },
          below,
        );
        st.ids.set(i, id);
      }
      const target = st.ids.get(frames.index)!;
      const reveal = () => {
        if (live.current.key !== frames.key) return;
        st.ids.forEach((id, i) => {
          if (m.getLayer(id)) m.setPaintProperty(id, 'raster-opacity', i === frames.index ? frames.opacity : 0);
        });
        shownRef.current?.(frames.index);
      };
      // wait for this frame's tiles, but never longer than 2.5 s (missing tiles must not stall the player)
      let done = false;
      const onData = () => {
        if (!done && m.getSource(target) && m.isSourceLoaded(target)) finish();
      };
      const finish = () => {
        if (done) return;
        done = true;
        m.off('sourcedata', onData);
        clearTimeout(timer);
        reveal();
      };
      const timer = setTimeout(finish, 2500);
      cancel = () => {
        done = true;
        m.off('sourcedata', onData);
        clearTimeout(timer);
      };
      m.on('sourcedata', onData);
      onData();
    };
    const safe = () => {
      try {
        apply();
      } catch (e) {
        console.warn('observatory layer failed', e);
      }
    };
    if (styleReady.current) safe();
    else m.once('load', safe);
    return () => cancel();
  }, [frames]);

  // reframe when a layer asks for a different scale (regional rain vs. the 30 m field)
  useEffect(() => {
    const m = map.current;
    if (!m || !view) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (view.center) {
      m.flyTo({ center: view.center, zoom: view.zoom, pitch: 0, bearing: 0, duration: reduce ? 0 : 2600, padding: { left: 0, right: 0, top: 0, bottom: 0 }, essential: true });
      return;
    }
    if (!target) return;
    m.easeTo({
      center: [target.lon, target.lat],
      zoom: view.zoom,
      pitch: view.zoom > 10 ? 52 : 20,
      duration: reduce ? 0 : 1400,
      padding: { left: 380, right: Math.min(780, window.innerWidth * 0.5), top: 60, bottom: 60 },
      essential: true,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view?.seq]);

  // fly to the chosen field
  useEffect(() => {
    const m = map.current;
    if (!m || !target) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    m.flyTo({ center: [target.lon, target.lat], zoom: 12.6, pitch: 52, bearing: -18, duration: reduce ? 0 : 3200, essential: true, padding: { left: 380, right: Math.min(780, window.innerWidth * 0.5), top: 60, bottom: 60 } });
    if (!marker.current) {
      const div = document.createElement('div');
      div.className = 'marker';
      marker.current = new maplibregl.Marker({ element: div });
    }
    marker.current.setLngLat([target.lon, target.lat]).addTo(m);
  }, [target]);

  // the farmer's registered property (CAR boundary)
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const apply = () => {
      if (m.getLayer('car-line')) m.removeLayer('car-line');
      if (m.getLayer('car-fill')) m.removeLayer('car-fill');
      if (m.getSource('car')) m.removeSource('car');
      if (!boundary) return;
      m.addSource('car', {
        type: 'geojson',
        data: { type: 'Feature', properties: {}, geometry: { type: 'MultiPolygon', coordinates: boundary.polygons } },
      });
      m.addLayer({ id: 'car-fill', type: 'fill', source: 'car', paint: { 'fill-color': '#FFC23D', 'fill-opacity': 0.08 } });
      m.addLayer({ id: 'car-line', type: 'line', source: 'car', paint: { 'line-color': '#FFC23D', 'line-width': 2.5 } });
      // fitBounds breaks under the globe projection, so frame the property by its size
      const [a, b, c, d] = boundary.bbox;
      const lat = (b + d) / 2;
      const spanKm = Math.max((c - a) * 111.32 * Math.cos((lat * Math.PI) / 180), (d - b) * 110.57, 0.3);
      const zoom = Math.max(10, Math.min(15.5, 14.2 - Math.log2(spanKm / 1.2)));
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      m.flyTo({
        center: [(a + c) / 2, lat],
        zoom,
        pitch: 45,
        duration: reduce ? 0 : 1800,
        padding: { left: 400, right: Math.min(780, window.innerWidth * 0.5), top: 60, bottom: 60 },
        essential: true,
      });
    };
    const safe = () => {
      try {
        apply();
      } catch (e) {
        console.warn('property boundary could not be drawn', e);
      }
    };
    if (styleReady.current) safe();
    else m.once('load', safe);
  }, [boundary]);

  return <div ref={el} className="map" aria-label="Map: click any field on Earth" />;
}
