# Does the simulation track real harvests?

**38 region–crop series, 3 continents, 3 official statistics agencies.** Crop parameters come from FAO
tables; Sorriso and Vilhena were looked at during development, the other 36 series were added afterwards
and no parameter was changed to fit them (the only adjustment was simulating maize as the second crop
where IBGE counts it that way).

Each season Helia simulates is compared with the official yield of the same harvest year:
**IBGE** (Brazil, municipal, Produção Agrícola Municipal table 1612), **Eurostat** (EU NUTS-2 regions,
`apro_cpshr`, production ÷ area) and **Statistics Canada** (provinces, table 32-10-0359).
Official yields rise with technology, so each series is divided by its own linear trend: what is compared
is whether a year was **better or worse than normal**, which is what a rotation plan has to survive.
Weather is the NASA POWER cell over a farming area of each region; soil is a generic clay loam; crops are
rainfed. In central Brazil maize is simulated as a second crop after soybean (that is what IBGE mostly
counts there); in the south and in western Bahia it is a main-season crop.

Reproduce everything:

```bash
python3 tools/fetch_validation.py                                   # official yields + NASA POWER, 23 sites
cd app && VALIDATE=1 npx vitest run src/engine/validation-wide.test.ts
```

## Summary

| Region | Series | Median r | r > 0 | Worst real year among the 3 worst simulated |
|---|---|---|---|---|
| Brazil (12 municipalities, soybean + maize) | 24 | 0.37 | 22 / 24 | 14 / 24 |
| Europe (7 NUTS-2 regions, wheat + maize) | 9 | 0.37 | 9 / 9 | 8 / 9 |
| Canada (4 provinces, wheat, maize, soybean) | 5 | 0.15 | 5 / 5 | 2 / 5 |
| **All** | **38** | **0.35** | **36 / 38 (95 %)** | **24 / 38 (63 %)** |

If the simulation had no skill, each correlation would be positive or negative by chance; 36 of 38
positive has a probability below 1 in 10 million (two-sided sign test). Individual correlations are weak
to moderate, because one ~50 km weather cell and a generic soil stand in for a whole municipality or region.

## Full table

| Site | Crop | n | r | Worst real years | Worst simulated years |
|---|---|---|---|---|---|
| Sorriso MT | soybean | 19 | 0.41 | 2016, 2021, 2024 | 2024, 2021, 2016 |
| Sorriso MT | maize (2nd) | 19 | 0.48 | 2016, 2021, 2007 | 2011, 2016, 2015 |
| Sapezal MT | soybean | 19 | 0.65 | 2024, 2013, 2010 | 2024, 2025, 2007 |
| Sapezal MT | maize (2nd) | 19 | 0.25 | 2010, 2011, 2007 | 2008, 2022, 2023 |
| Campo Novo do Parecis MT | soybean | 19 | 0.66 | 2024, 2013, 2016 | 2024, 2018, 2020 |
| Campo Novo do Parecis MT | maize (2nd) | 19 | 0.52 | 2011, 2016, 2010 | 2016, 2022, 2008 |
| Nova Mutum MT | soybean | 19 | 0.50 | 2024, 2016, 2015 | 2024, 2021, 2025 |
| Nova Mutum MT | maize (2nd) | 19 | 0.38 | 2016, 2011, 2021 | 2018, 2022, 2011 |
| Rio Verde GO | soybean | 19 | −0.02 | 2015, 2014, 2019 | 2024, 2023, 2021 |
| Rio Verde GO | maize (2nd) | 19 | 0.36 | 2016, 2022, 2007 | 2024, 2016, 2018 |
| Cristalina GO | soybean | 19 | 0.02 | 2015, 2013, 2019 | 2024, 2015, 2009 |
| Cristalina GO | maize (2nd) | 19 | 0.26 | 2016, 2023, 2018 | 2022, 2025, 2011 |
| Cascavel PR | soybean | 19 | 0.36 | 2022, 2012, 2009 | 2012, 2024, 2013 |
| Cascavel PR | maize | 19 | 0.49 | 2009, 2022, 2021 | 2022, 2009, 2025 |
| Toledo PR | soybean | 19 | 0.11 | 2022, 2012, 2019 | 2025, 2012, 2024 |
| Toledo PR | maize | 19 | −0.22 | 2021, 2020, 2011 | 2025, 2013, 2024 |
| Cruz Alta RS | soybean | 19 | 0.83 | 2012, 2022, 2023 | 2022, 2012, 2023 |
| Cruz Alta RS | maize | 19 | 0.33 | 2012, 2024, 2009 | 2022, 2023, 2021 |
| Passo Fundo RS | soybean | 19 | 0.84 | 2022, 2025, 2020 | 2022, 2012, 2023 |
| Passo Fundo RS | maize | 19 | 0.83 | 2022, 2020, 2012 | 2022, 2012, 2023 |
| Luís Eduardo Magalhães BA | soybean | 19 | 0.09 | 2016, 2013, 2014 | 2017, 2021, 2020 |
| Luís Eduardo Magalhães BA | maize | 19 | 0.62 | 2017, 2019, 2016 | 2017, 2020, 2021 |
| Balsas MA | soybean | 19 | 0.32 | 2016, 2017, 2014 | 2007, 2019, 2016 |
| Balsas MA | maize (2nd) | 19 | 0.33 | 2016, 2018, 2012 | 2016, 2019, 2025 |
| Centre-Val de Loire FR | wheat | 18 | 0.05 | 2016, 2020, 2024 | 2011, 2010, 2022 |
| Castilla y León ES | wheat | 15 | 0.37 | 2017, 2023, 2022 | 2021, 2017, 2012 |
| Lubelskie PL | wheat | 18 | 0.06 | 2013, 2012, 2019 | 2013, 2014, 2010 |
| Sud-Est RO | wheat | 18 | 0.73 | 2020, 2007, 2009 | 2020, 2012, 2010 |
| Sud-Est RO | maize | 19 | 0.77 | 2007, 2012, 2020 | 2024, 2007, 2022 |
| Dél-Alföld HU | maize | 15 | 0.85 | 2022, 2012, 2024 | 2024, 2022, 2012 |
| Dél-Alföld HU | wheat | 18 | 0.39 | 2022, 2010, 2012 | 2022, 2012, 2009 |
| Veneto IT | maize | 10 | 0.35 | 2022, 2019, 2017 | 2022, 2023, 2015 |
| Aquitaine FR | maize | 18 | 0.22 | 2022, 2013, 2020 | 2022, 2012, 2015 |
| Saskatchewan CA | wheat | 19 | 0.11 | 2021, 2007, 2017 | 2018, 2017, 2015 |
| Alberta CA | wheat | 19 | 0.19 | 2021, 2007, 2023 | 2019, 2011, 2015 |
| Manitoba CA | wheat | 19 | 0.06 | 2021, 2011, 2017 | 2018, 2006, 2012 |
| Ontario CA | maize | 19 | 0.26 | 2007, 2019, 2009 | 2007, 2021, 2022 |
| Ontario CA | soybean | 19 | 0.15 | 2007, 2019, 2009 | 2007, 2022, 2021 |

## Where it is strong, where it is weak, and why

- **Strong where drought decides the year:** southern Brazil (Cruz Alta, Passo Fundo 0.83–0.84),
  Romania and Hungary (0.73–0.85), Mato Grosso soybean (0.41–0.66, the 2023/24 El Niño season caught
  everywhere it happened).
- **Weak where losses come from what the model does not simulate:** French wheat 2016 was a wet,
  disease-driven loss; the 2021 Canadian heat dome hit at a stage our degree-day model treats coarsely;
  Goiás soybean losses are not reproduced at all.
- **Drought losses are exaggerated:** 2024 is often the worst simulated year, even where the
  municipality lost little. Farmers re-sow and adapt; a municipal average smooths field losses.
- A province (Canada) or a NUTS-2 region (EU) is far larger than one weather cell; skill drops accordingly.

## What this means for the product

Helia is good at **ranking options and flagging risky seasons** on the real weather of the last
20 years. It is **not a yield forecast**, and the app says so. Next steps to earn more trust: field-level
yields from cooperatives, farmer rain-gauge data to correct the grid cell, a disease module for wet
seasons, and per-region calibration of drought and heat responses (on held-out years, to avoid overfitting).

## Next season: does El Niño show up in real harvests?

The app's "next season" mode re-ranks rotations using only past seasons like the one NOAA forecasts. For
2026/27 that is a strong El Niño (CPC, 12 Nov 2026: strong-to-very strong through Jan–Mar 2027, > 79 %),
and the analogs are seasons whose mean ONI over the 6 months after sowing was ≥ +1.0 °C. In Brazil those
are 2009/10, 2015/16 and 2023/24. Official IBGE yields, detrended, in those harvests:

| Zone (IBGE municipalities) | Crop | Strong El Niño harvests | La Niña harvests | Other years |
|---|---|---|---|---|
| Centre-north: 8 in MT, GO, BA, MA | soybean | **−8.3 %** | +5.0 % | −0.4 % |
| Centre-north | maize | **−8.9 %** | +0.3 % | +2.4 % |
| South: 4 in PR, RS | soybean | **+8.1 %** | −12.0 % | +4.7 % |
| South | maize | **+6.7 %** | −10.5 % | +4.2 % |

This is the north–south ENSO dipole: El Niño hurts the centre-north and helps the south, La Niña the
reverse. The simulation reproduces it in direction: in Sorriso and Vilhena today's soybean → maize earns
19–26 % less in the strong El Niño seasons, and in Kansas El Niño seasons are better for wheat, as in the
US record. With fewer than 3 strong analogs in a record (Kenya, Iowa) the app says so and keeps all seasons.
Three analog seasons is a small sample; the outlook shifts the odds, it does not guarantee a season.
Reproduce: `REPORT=1 npx vitest run src/engine/enso.test.ts`.
