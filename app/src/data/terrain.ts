/**
 * Terrain slope from Terrarium elevation tiles (AWS Open Data; SRTM-based at this scale).
 * Elevation = R·256 + G + B/256 − 32768 metres.
 */
const Z = 12;
const URL = (x: number, y: number) => `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${Z}/${x}/${y}.png`;

function tileXY(lat: number, lon: number) {
  const n = 2 ** Z;
  const x = ((lon + 180) / 360) * n;
  const r = (lat * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n;
  return { x, y };
}

async function loadTile(x: number, y: number): Promise<ImageData> {
  // fetch + ImageBitmap avoids <img> cache entries without CORS, which taint the canvas
  const res = await fetch(URL(x, y), { mode: 'cors' });
  if (!res.ok) throw new Error(`terrain ${res.status}`);
  const img = await createImageBitmap(await res.blob());
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0);
  return ctx.getImageData(0, 0, 256, 256);
}

export async function fetchSlope(lat: number, lon: number): Promise<{ slopePct: number; elevation: number } | null> {
  try {
    const { x, y } = tileXY(lat, lon);
    const tx = Math.floor(x);
    const ty = Math.floor(y);
    const data = await loadTile(tx, ty);
    const px = Math.min(250, Math.max(5, Math.floor((x - tx) * 256)));
    const py = Math.min(250, Math.max(5, Math.floor((y - ty) * 256)));
    const elev = (i: number, j: number) => {
      const k = (j * 256 + i) * 4;
      return data.data[k] * 256 + data.data[k + 1] + data.data[k + 2] / 256 - 32768;
    };
    const step = 4; // ~150 m baseline at mid latitudes: field scale
    const metresPerPx = (156543.03 * Math.cos((lat * Math.PI) / 180)) / 2 ** Z;
    const dzdx = (elev(px + step, py) - elev(px - step, py)) / (2 * step * metresPerPx);
    const dzdy = (elev(px, py + step) - elev(px, py - step)) / (2 * step * metresPerPx);
    return { slopePct: 100 * Math.hypot(dzdx, dzdy), elevation: elev(px, py) };
  } catch {
    return null;
  }
}
