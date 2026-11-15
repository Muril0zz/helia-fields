# Helia: crop rotations planned from orbit

**NASA Space Apps Challenge 2026 · Field Shift: Adapting Farms with NASA Data**

Helia is a decision-support tool that helps a farmer compare the crop rotation they run today with
three alternatives that could protect the soil, save water and hold up better as the climate shifts.
It works on **any field on Earth**: click a point and it pulls 21 years of NASA data for that spot,
grows every candidate rotation day by day through every one of those years, and explains each option
with its evidence, its information gaps and the risks a local agronomist should check.

## What it does

1. **Reads the field.** Daily weather and root-zone soil wetness from **NASA POWER** (2005–2025),
   the field's real cropping cycles from **MODIS NDVI** (MOD13Q1, 250 m, 16-day), terrain slope from
   **SRTM**, and soil texture from SoilGrids or the farmer.
2. **Detects today's rotation.** Green-up peaks in the MODIS NDVI series show whether the field carries
   one, two or three crops a year and in which months it lies bare.
3. **Simulates every rotation the crop catalog can build** (≈400–500 per field) on the typical year,
   then grows the most promising ~40 through all 19–20 historical seasons:
   - FAO-56 Penman–Monteith reference evapotranspiration from NASA POWER radiation, temperature, humidity and wind;
   - FAO-56 daily soil-water balance with crop coefficients and depletion fractions;
   - thermal-time (degree-day) crop development, so warming shortens cycles;
   - FAO-33 yield response to water, heat at flowering, frost, and humid-season disease penalties;
   - sowing that follows each year's real rain onset (first 25 mm in 3 days), like farmers do;
   - residue, living-root days and **rain falling on unprotected soil** (an erosion proxy, scaled by slope and soil);
   - nitrogen left by legumes, plant-family diversity and pest-cycle conflicts;
   - an indicative margin (clearly flagged as needing local prices).
4. **Ranks by the farmer's priorities** (water, soil health, income, low risk) and shows the current
   rotation plus three genuinely different alternatives, each with **Why · Evidence · Benefits · Gaps · Risks**.
5. **A "smallest change" option.** One of the three slots is reserved for the rotation that keeps the
   farmer's crops and only fills the off-season (e.g. soybean → maize + sunn hemp in Mato Grosso,
   maize/soybean + cereal rye in Iowa), the easiest change to adopt.
6. **Season-matched varieties and realistic calendars.** Each crop's cycle is fitted to the degree-days
   available before the typical first frost; main crops may be sown earlier when that lets a second crop fit.
7. **A report for the agronomist.** "Save report (PDF)" prints the field, the four rotations and every
   explanation on a light, printable layout.
8. **What-if console.** Rainfall −40 % … +20 % and warming +0 … +3 °C re-run the whole 20-year
   simulation live (≈100 ms in a Web Worker).
9. **Uncertainty is shown, not hidden.** Every number is a 20-season distribution; charts show the
   1-in-10 bad and good years, and each option lists the share of seasons where a crop failed.

The tool supports, and never replaces, the farmer's judgement and local agronomic advice.
The whole interface and every explanation are available in **English and Brazilian Portuguese** (EN | PT toggle).

Demo regions (with offline NASA data snapshots): Mato Grosso and Rondônia (Brazil), Iowa and Kansas (USA),
Nakuru (Kenya); Punjab (India) by link. Any other point on Earth runs live.

## NASA data used

| Data | How it is used |
|---|---|
| **NASA POWER** daily (T2M_MAX, T2M_MIN, PRECTOTCORR, ALLSKY_SFC_SW_DWN, RH2M, WS2M, GWETROOT), community AG, 2005–2025 | Weather for the crop simulation, FAO-56 ET₀, sowing onset, heat/frost risk, soil wetness at sowing |
| **MODIS Terra MOD13Q1** 250 m 16-day NDVI (ORNL DAAC web service) | Detects the field's current cropping cycles and bare months |
| **NASA GIBS**: MODIS true colour, MODIS NDVI 16-day, GPM IMERG precipitation, SMAP L4 root-zone soil moisture, Blue Marble | Time-enabled map layers to explore the season around the field |
| **SRTM** elevation (via AWS Terrain Tiles) | Field slope for the erosion factor and 3D terrain |

Partner and other data: Copernicus Sentinel-2 cloudless mosaic (ESA, by EOX) as the field-scale basemap;
ISRIC SoilGrids (when its service responds); FAO-56 and FAO-33 crop parameters.

## Run it

```bash
cd app
npm install
npm run dev        # http://localhost:5173
npm test           # 15 engine tests (FAO-56 checks, 6 real sites, Portuguese explanations)
npm run build      # production build in app/dist
```

`python3 tools/fetch_demo_sites.py` refreshes the offline snapshots of NASA data for the five demo
sites (Mato Grosso and Rondônia in Brazil, Kansas, Punjab, Kenya), so the demo works even without network.
Any other point is fetched live from NASA in the browser.

## Architecture

```
app/src/engine   pure TypeScript crop & rotation engine (tested, no UI)
app/src/worker   engine in a Web Worker so sliders stay smooth
app/src/data     NASA POWER, MODIS (ORNL), SoilGrids, SRTM terrain clients
app/src/ui       MapLibre globe + GIBS layers, field panel, rotation lab
tools/           demo data snapshot script
```

## Validation against real harvests

Simulated season-to-season swings were compared with official yields (2007–2025, detrended) from
**IBGE** (12 Brazilian municipalities), **Eurostat** (7 EU regions) and **Statistics Canada** (4 provinces):
38 region–crop series. 36 of 38 correlations are positive (median r = 0.35; 0.83–0.85 in southern Brazil
and Hungary), and in 24 of 38 the worst real year is among the three worst simulated. Drought losses are
exaggerated and wet/disease years are missed. It ranks options and flags risky seasons; it is not a yield
forecast. Full table, method and reproduction: [docs/VALIDATION.md](docs/VALIDATION.md).
Judge-style objections and our answers: [docs/OBJECTIONS.md](docs/OBJECTIONS.md).

## Your own farm (Brazil)

Paste a CAR code (Rural Environmental Registry) or click "find the property here": Helia loads the
registered boundary from SICAR, averages MODIS NDVI over the pixels inside it, and checks INPE PRODES
deforestation inside the property (after 2020 = the EUDR cut-off). Deep link: `#car=<code>`.

## Known limitations (also shown inside the app)

- NASA POWER is a ~50 km grid; local rain can differ. MERRA-2 rainfall is lower than gauges in parts of the Cerrado.
- Soil is modelled or chosen by the farmer; a lab test is better.
- Prices and costs are indicative global values.
- Pests, diseases (beyond a humidity proxy), markets and policy rules are not observed from space.
- Crop parameters are generic; local varieties differ.
- Each main crop's sowing window is optimised on its own, not for the whole rotation. Where heat pushes a
  crop's best window late (e.g. kharif maize in Punjab), double-crop systems like maize → wheat can be missed.
  Optimising sowing over the full rotation is the next engine step.

Live: **https://helia-fields.netlify.app** · slides: **https://helia-fields.netlify.app/pitch/**

## Use of AI

An AI assistant (Claude, by Anthropic) was used heavily: to read the challenge, research past winners and
data services, propose and compare approaches, write the code and tests, tune crop parameters and draft
this documentation. The team chose the challenge and the direction (a field-scale tool that works anywhere,
built on our earlier satellite crop-phenology work) and reviewed the outputs. All code is in this repository.
No AI-generated images, audio or video are used. No NASA logos or branding are used.

## License

MIT for the code. Data remain under their providers' terms (NASA open data; Sentinel-2 cloudless by EOX, CC BY-NC-SA 4.0).
