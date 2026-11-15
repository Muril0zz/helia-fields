// Live check against SICAR, TerraBrasilis and ORNL. Run: CAR=1 npx vitest run src/data/car.test.ts
import { expect, it } from 'vitest';
import { fetchCarAtPoint, fetchCarByCode, fetchDeforestation, fetchPropertyNdvi, isCarCode } from './car';

it.skipIf(!process.env.CAR)('loads a real CAR property, its PRODES record and field NDVI', async () => {
  const code = 'MT-5107925-3457E7D71CFC4DAAB29587924CE28F7B';
  expect(isCarCode(code)).toBe(true);
  const car = await fetchCarByCode(code);
  expect(car?.municipality).toBe('Sorriso');
  console.log('by code', car?.code, car?.areaHa, car?.status, car?.centroid, car?.bbox);
  const here = await fetchCarAtPoint(car!.centroid.lat, car!.centroid.lon);
  console.log('at point', here?.code, here?.areaHa);
  const def = await fetchDeforestation(car!);
  console.log('prodes', JSON.stringify(def));
  const ndvi = await fetchPropertyNdvi(car!, 2025);
  console.log('ndvi pixels', ndvi.pixels, 'points', ndvi.points.length, ndvi.points.slice(0, 4));
  expect(ndvi.points.length).toBeGreaterThan(5);
}, 180_000);
