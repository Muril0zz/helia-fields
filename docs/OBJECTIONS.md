# Hard questions a judge should ask, and our answers

We wrote down every objection we could think of, from agronomists, data scientists, investors and the
Space Apps criteria (Impact, Creativity, Validity, Relevance, Presentation). Each answer points to evidence
in the app or the repository. Where the honest answer is "not yet", we say so.

## Validity: does it work?

**1. "A simulation is not reality. How do you know it is right?"**
We compared it with what farms actually harvested. We used 38 region–crop series from three official
agencies (IBGE, Eurostat, Statistics Canada), 2007–2025, detrended. 36 of 38 correlations are positive,
and that happens by chance with probability below 1 in 10 million. The median r is 0.35, reaching
0.83–0.85 in southern Brazil and Hungary. In 24 of 38 series the worst real year is among the three worst
simulated. → [VALIDATION.md](VALIDATION.md), reproducible with two commands.

**2. "r = 0.35 is weak."**
For one ~50 km weather cell and a generic soil standing in for a whole municipality or province, it is
expected; the same model on a farm with a local gauge should do better. And we do not use it as a yield
forecast. We use it to compare rotations on the same 20 real seasons. Any bias that hits every option
equally cancels out in the comparison. The app never shows a yield promise without the 10th–90th percentile range.

**3. "Where does it fail?"**
It exaggerates drought losses (2024 is often the worst simulated year). It misses wet, disease-driven
losses (French wheat 2016) and heat waves at sensitive stages (Canada 2021). Goiás soybean is not
reproduced. All of this is written in VALIDATION.md and in the app's Gaps and Risks tabs.

**4. "You tuned the model to the validation data."**
Crop parameters come from FAO-56/FAO-33 tables. Sorriso and Vilhena were used during development. The
other 36 series were added afterwards and no parameter was changed to fit them. The only adjustment was
simulating maize as a second crop after soybean where IBGE counts it that way, which corrects how the
farm system was set up and does not fit the numbers. → `app/src/engine/validation-wide.test.ts`

**5. "NASA POWER is 50 km. A farm is 500 ha."**
Weather varies slowly in space and soil and plants do not. That is why the field-scale parts come from finer
data: MODIS NDVI at 250 m averaged over the farm's own registered boundary, terrain at ~30 m (SRTM), and
the soil the farmer selects. If the farmer's rain gauge disagrees with POWER, the what-if console shifts
rainfall from −40 % to +20 % and every number re-computes. The Gaps tab asks for exactly that.

**6. "Why not machine learning?"**
A farmer has to trust the reason, not just the score. A physical model (FAO-56 water balance,
degree-days) explains every number and works anywhere on Earth without local training data. Our team won
the ITU AI & Space Computing innovation award with a satellite-phenology ML model. That model was trained
in China and does not transfer, so we kept its method (reading crop cycles from the NDVI time series) and
not its weights.

**7. "Same input, different answer?"**
No. The engine is deterministic and pure, and a test locks it (`determinism.test.ts`). 15 unit tests run
on every Netlify build from Git: FAO-56 reference values, five real regions, ranking and the Portuguese output.

**8. "What about irrigation, pests, soil fertility?"**
Rainfed only, today. Pests enter as rotation rules (same-family and pest-cycle conflicts, e.g. soybean
after soybean, and soybean as a second crop blocked in the tropics because of the legal soybean-free period
and rust), and as a humid-season disease penalty. Fertility enters as nitrogen credit from legumes. A soil
lab test and irrigation are next steps, and the app says so.

**9. "The past 20 years are not the next 20. And what about next season?"**
For next season, the app reads NOAA's official ENSO outlook (12 Nov 2026: strong El Niño through Jan–Mar
2027, > 79 %). It re-ranks every rotation on the past seasons like that one (2009/10, 2015/16, 2023/24).
Official IBGE yields back it: in those harvests the centre-north lost 8–9 % against trend and the south
gained 7–8 %. For the long run, the console adds +1 to +3 °C and cuts rainfall by up to 40 %.

**9b. "Why not a weather forecast?"**
A 7–15 day forecast decides when to spray or sow, not which rotation to plant; the rotation is decided
months ahead. Seasonal ENSO outlooks are the forecast with proven skill at that horizon, so that is the one
we use. A sowing-day rain forecast is a natural next step.

**10. "The data APIs are slow or down during the demo."**
The demo regions ship with a snapshot of the NASA data and work offline. Live MODIS retries 3 times and
falls back to the point NDVI. SoilGrids gets 6 s and then lets the farmer choose. A failing map is isolated
and the rest of the app keeps working.

## Impact: does it help a real farmer?

**11. "Farmers already know their farm."**
They know their last 5 seasons. Helia replays 20, and it shows what they cannot see from the ground:
in Sorriso, the MODIS NDVI shows the field bare for 138 days a year. It also puts numbers on the
trade-off they feel: income, water, soil cover, risk in a bad year.

**12. "Nobody will switch to a crop with no buyer."**
That is why one of the three options is always the smallest change from what the farmer does today, often
just a cover crop or a shifted sowing date. Every option shows indicative margin, and a priority slider
lets income dominate.

**13. "Prices are global and wrong for my town."**
Not any more. Each crop takes the official number at the finest level that exists, in local currency:
the municipality's CONAB cost sheet (Sorriso: soybean R$ 4,347/ha variable cost), the state's CONAB
price received by farmers (MT soybean R$ 135/bag, Aug–Oct 2026), FAOSTAT producer prices for 40
countries, and the Banco Central PTAX rate. Each number shows its level and source, and the farmer can
type their own price or cost: the whole simulation re-runs with it. Cover-crop costs have no official
public source, so they stay marked as a global estimate. Reproduce: `python3 tools/fetch_prices.py`.

**14. "Farmers do not use web apps."**
Extension agents, cooperatives and agronomists do, and they advise thousands of farmers each. It runs on
a phone browser, in English and Portuguese. Next: the same answer on WhatsApp, which Brazilian farmers already use daily.

**15. "Does this already exist? Embrapa ZARC, FieldView, Aegro…"**
ZARC (Brazil's official climate-risk zoning) gives the safe sowing window for one crop in one municipality.
FieldView and Aegro record what happened on the farm. None of them compares whole rotations, like soybean
→ maize vs soybean → cotton → sunn hemp, through 20 real seasons for any point on Earth, free, with the
reasons shown. ZARC is a good input for us, not a competitor.

**16. "How big is the impact?"**
Bare soil between harvests is the problem the challenge names. In the Sorriso example, MODIS shows 138 bare days a
year today; each option's card shows its own bare days, rain on unprotected soil, residue and living-root
days side by side. The same question applies across ~47 million ha of Brazilian soybean and to any rainfed
field the globe can click.

## Relevance: is it Field Shift?

**17. "How does this answer challenge #7?"**
The challenge asks for resilient crop rotations from NASA data, explained to farmers. Helia uses
NASA POWER daily weather and root-zone wetness (GWETROOT), MODIS NDVI, GIBS layers (MODIS, GPM IMERG
rain, SMAP soil moisture) and SRTM terrain. It turns them into a rotation recommendation with the
trade-offs and uncertainty shown. Without NASA data there is no product.

**18. "Only Brazil?"**
No. Click anywhere: demo regions include Mato Grosso, Rondônia, Iowa, Kansas, Kenya and Punjab, and
validation covers Brazil, seven EU regions and Canada. The CAR boundary and deforestation check are the
Brazil extra.

**19. "Why not China, or US county yields?"**
China has no open regional yield API, so we did not fake one. USDA NASS needs a personal API key; we kept the
validation reproducible without credentials and used Statistics Canada for North America instead.
Adding NASS is a one-file change.

## Creativity and trust

**20. "Isn't this just a dashboard over open data?"**
No. The product is the engine: ~450 rotations screened and the best ~40 grown day by day through 20
real seasons, sowing on each year's real rain onset, with a crop variety matched to the season. On top of
that it reads the farm's own history from orbit and checks its deforestation status.

**21. "Deforestation: does this help farmers clear land?"**
No. With the CAR code, the app checks INPE PRODES inside the property and flags clearing after 2020, the
EU deforestation-regulation cut-off. A clean property is something a farmer can show a buyer or a bank.

**22. "Privacy of the farmer's data?"**
CAR boundaries and PRODES are public registries. Everything runs in the farmer's browser and nothing is
stored or sent to us: there is no backend, no login and no tracking. A strict Content-Security-Policy lists
every data host the app can call.

**23. "Did AI do the work?"**
We declare it in full in the submission: an AI assistant wrote much of the code and documentation under
our direction. The team chose the challenge, the scope, and every claim we make, and we checked them against
official data. We also say that work started before the official kickoff, and the commit history shows it.

**24. "Can it scale? What does it cost?"**
It is a static site with the engine in a Web Worker: the farmer's device does the computing and data comes
straight from NASA and public services. The hosting cost is close to zero per user. Free for farmers;
revenue from cooperatives, technical assistance and rural credit, who need resilient-rotation evidence
(and EUDR status) for their portfolios.

**25. "What happens next?"**
Field-level yields from a cooperative to calibrate, a rain gauge per farm, local prices, a soil lab test
upload, a disease module for wet seasons, and the WhatsApp assistant. Each one closes a gap listed above.
