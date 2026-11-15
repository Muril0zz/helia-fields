# Submission kit (copy into the Space Apps project page, all in English)

Fill the `[ ]` fields before submitting. Rules: demo ≤ 30 s video (subtitles in English if spoken in
another language) **or** ≤ 7 slides; every link public with no login.

## Project name
Helia: crop rotations planned from orbit

## High-level project summary (≈150 words)
Helia is a decision-support tool that helps farmers compare the crop rotation they run today with three
alternatives that protect the soil, save water and hold up as the climate shifts. It works on any field on
Earth: click a point and it pulls 21 years of NASA POWER weather and soil-moisture data, reads the field's real
cropping cycles from MODIS NDVI, and grows hundreds of candidate rotations day by day through every historical
season with the FAO-56 water balance, degree-day crop development and heat, frost and disease risks. The
farmer sets priorities (water, soil health, income, low risk) and gets the current rotation plus three
genuinely different options, each with why it was suggested, the evidence, the benefits, the information gaps
and the risks to check locally. A what-if console re-runs 20 years under less rain or more heat in a tenth of
a second. It supports, never replaces, the farmer and their agronomist.

## Link to project demo
Video (28 s, ready): docs/pitch/helia-demo-30s.mp4 — upload it to YouTube (unlisted) or Drive (anyone with the link) and paste that link here. Alternative: https://helia-fields.netlify.app/pitch/ (7 slides; PDF in docs/pitch/helia-deck.pdf). Only one demo is needed.

## Link to final project
https://helia-fields.netlify.app · https://github.com/Muril0zz/helia-fields (public)

## Detailed project description
**What it does.** (1) Reads the field: NASA POWER daily weather and GWETROOT root-zone wetness 2005–2025,
MODIS MOD13Q1 NDVI 2022–2025, SRTM slope, soil texture. (2) Detects today's rotation from NDVI green-up
peaks and bare months. (3) Screens every rotation the crop catalog can build (≈450) on the typical year
and grows the best ~40 through 19–20 real seasons. (4) Ranks by the farmer's priorities and explains each
option. (5) A what-if console changes rainfall (−40 % to +20 %) and temperature (+0 to +3 °C). (7) A NASA observatory: playable layers for every storm on Earth in the last 24 hours (GPM IMERG, 30-min), a year of cloud-free 30 m HLS photos of the field (Landsat + Sentinel-2, scenes found through NASA CMR and checked pixel by pixel for clouds over the field), crop greenness (MODIS NDVI), water at the roots (SMAP L4) and deep soil water (GLDAS). (8) Water under the field: an animated soil cross-section through a real season (rain filling the profile, roots drinking, drainage to groundwater), which follows NASA POWER root-zone wetness (r ≈ 0.9 in Sorriso), plus the 16-day rain forecast and the next sowing-rain day. (6) Next season: NOAA's official ENSO outlook (strong El Niño through Jan–Mar 2027) re-ranks every rotation on the past seasons like it (2009/10, 2015/16, 2023/24); official IBGE yields confirm those harvests were 8–9 % below trend in central Brazil and 7–8 % above in the south.

**How it works.** FAO-56 Penman–Monteith ET₀ from POWER radiation, temperature, humidity and wind; FAO-56
single-coefficient daily soil-water balance; thermal-time crop development; FAO-33 yield response to water;
heat-at-flowering, frost and humid-season disease penalties; sowing on each year's real rain onset; residue,
living-root days, rain on unprotected soil scaled by slope and soil erodibility; nitrogen credits, family
diversity and pest-cycle conflicts; indicative margins. Every metric is a 20-season distribution
(mean, 10th and 90th percentile, failure rate).

**Your own farm.** In Brazil a farmer pastes the public CAR registry code: the app draws the registered
boundary (SICAR), averages MODIS NDVI over the pixels inside it, and checks INPE PRODES deforestation inside
the property, flagging clearing after 2020 (the EU deforestation-regulation cut-off).

**Validation.** Against official yields 2007–2025 (detrended) from IBGE (12 Brazilian municipalities),
Eurostat (7 EU regions) and Statistics Canada (4 provinces), 38 region–crop series: 36 of 38 correlations
are positive (median r = 0.35, up to 0.83–0.85 in southern Brazil and Hungary), and in 24 of 38 the worst
real year is among the three worst simulated. Drought losses are overestimated and wet, disease-driven years
are missed. We report this as is (docs/VALIDATION.md): the tool ranks options and flags risky seasons; it is
not a yield forecast.

**Benefits.** Turns decades of NASA data into one decision a farmer actually makes every year; shows
trade-offs instead of a single "answer"; makes uncertainty and data gaps explicit; runs in a browser, free,
anywhere.

**Tools.** TypeScript, React, MapLibre GL (globe), Web Workers, Vitest; Python for data snapshots; NASA
POWER API, ORNL DAAC MODIS web service, NASA GIBS WMTS; Netlify.

**What we hope to achieve.** A free planning tool for farmers and extension agents, validated with
agronomists, with local prices, soil tests and field boundaries from public registries.

## Use of SI (AI)
An AI assistant (Claude, by Anthropic) was used heavily: to read the challenge, research past winners and
data services, propose and compare approaches, write the code and tests, tune crop parameters and draft
documentation. The team chose the challenge and the direction and reviewed the outputs. No AI-generated
images, audio or video; no NASA branding.
> Team: review this paragraph. The rules say SI should not be used to come up with the idea of how to
> solve the challenge. Describe your own contribution honestly here.

## NASA data
- NASA POWER daily point API, community AG: T2M_MAX, T2M_MIN, PRECTOTCORR, ALLSKY_SFC_SW_DWN, RH2M, WS2M, GWETROOT (2005–2025)
- MODIS Terra MOD13Q1 250 m 16-day NDVI via the ORNL DAAC MODIS web service
- NASA GIBS WMTS: HLS S30/L30 (30 m), GPM IMERG 30-min precipitation, MODIS Terra corrected reflectance, MODIS Terra L3 NDVI 16-day, SMAP L4 root-zone soil moisture, GLDAS underground soil moisture, Blue Marble
- NASA CMR (Common Metadata Repository): HLS scene search with cloud cover
- SRTM elevation (through AWS Terrain Tiles)

## Space agency partner data and other references
- ESA Copernicus Sentinel-2 cloudless 2023 mosaic by EOX (CC BY-NC-SA 4.0)
- ISRIC SoilGrids 250 m (when available)
- Brazil SICAR (Rural Environmental Registry) property boundaries, public WFS
- INPE TerraBrasilis PRODES yearly deforestation (Legal Amazon and Cerrado)
- Open-Meteo 16-day forecast (ECMWF, GFS and national models)
- Local prices and costs: CONAB (prices received by farmers by state; production cost sheets by municipality), FAOSTAT producer prices (40 countries), Banco Central do Brasil PTAX exchange rate; place from the CAR/IBGE code or OpenStreetMap Nominatim
- NOAA CPC Oceanic Niño Index (ONI) and ENSO Diagnostic Discussion (12 Nov 2026)
- Validation only: IBGE SIDRA table 1612, Eurostat apro_cpshr, Statistics Canada table 32-10-0359
- FAO Irrigation & Drainage Paper 56 (Allen et al., 1998) and Paper 33 (Doorenbos & Kassam, 1979)
- Open-source libraries: React, MapLibre GL JS, Framer Motion, Vite, Vitest (MIT/BSD licences)
- Code written by the team with AI assistance (see above); all code in the repository

## 30-second video script (screen recording of the app, voice-over, English subtitles)

| Time | Screen | Voice (EN) |
|---|---|---|
| 0:00–0:02 | Globe spinning | "We're [team], from Florianópolis." |
| 0:02–0:05 | Click Mato Grosso, camera flies to the field | "Field Shift: which crops should a farmer rotate?" |
| 0:05–0:10 | Title card "Helia" over the field | "Helia plans crop rotations from orbit." |
| 0:10–0:15 | MODIS NDVI curve, bare months highlighted | "NASA MODIS shows this field lies bare from July to October." |
| 0:15–0:20 | Four cards appear, best match glows | "Twenty years of NASA POWER weather test hundreds of rotations, day by day." |
| 0:20–0:25 | "Smallest change" card glows; drag warming +2 °C, numbers roll | "Keep your crops, add one cover: 85% less bare soil. And if it gets hotter? Re-run in a blink." |
| 0:25–0:30 | Pull back to the globe | "Any field on Earth, free, with the evidence and the risks." |
