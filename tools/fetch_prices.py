#!/usr/bin/env python3
"""Build app/src/data/prices.json from official open data (stdlib only).

Sources (no API keys):
  * CONAB Portal de Informacoes, open-data text files (";"-separated, latin-1):
      - PrecosMensalUF.txt         producer prices by state, monthly, R$/kg
      - PrecosMensalMunicipio.txt  producer prices by municipality, monthly, R$/kg
      - CustoProducao.txt          production cost sheets by municipality, R$/ha
    File list comes from the portal's own API:
      https://barramento.conab.gov.br/portal-informacao-api/api/v1/download?size=10000
  * FAOSTAT bulk download, domain PP (Producer Prices), element 5532
    "Producer Price (USD/tonne)", annual values:
      https://bulks-faostat.fao.org/production/Prices_E_All_Data_(Normalized).zip
    (the FAOSTAT REST API at fenixservices.fao.org answered 521 and the newer
    faostatservices.fao.org API requires an Authorization header, so we use bulk.)
  * Banco Central do Brasil PTAX (olinda.bcb.gov.br), BRL per USD, selling rate
    of the latest business day.

Rules
  * Only numbers read from a source are written; a missing series is omitted.
  * CONAB prices are "PRECO RECEBIDO P/ PRODUTOR" (price received by farmers).
    They are published per kg, so R$/t = R$/kg x 1000. (CONAB's cost sheets use
    sacas of 60 kg as commercial unit, but we only use the per-hectare columns,
    so no saca conversion is needed there. If you ever use a per-saca value,
    R$/t = R$/saca x 1000 / 60.)
  * State price = mean of the monthly means of the latest (up to) 3 months with
    data, within the 6 months ending at the newest month in the file. A series
    whose newest month is more than 2 months older than the file's newest month
    is treated as stale and omitted.
  * Municipality prices follow the same rule against the state file's newest
    month. If stale (in Nov/2026 CONAB's municipal "received" series stops in
    Dec/2025) the last values are kept only as price_last* fields, never as
    "price", so the app falls back to the fresher state price.
  * Cost = CONAB "custo variavel" (R$/ha): custeio (inputs, operations, labour)
    + other variable expenses + financial expenses. Also written:
    cost_operational = custo variavel + custo fixo (depreciation + other fixed
    costs), i.e. CONAB "custo operacional". Land/capital remuneration
    ("renda de fatores") is excluded. Only "AGRICULTURA EMPRESARIAL" sheets with
    reference month >= COST_MIN_REF are used.
  * State cost = arithmetic mean of that state's municipal sheets (stated in
    cost_source with the municipality names).

Usage:  python3 tools/fetch_prices.py [--cache DIR] [--refresh]
"""
from __future__ import annotations

import argparse
import csv
import datetime as dt
import io
import json
import os
import sys
import tempfile
import urllib.request
import zipfile
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "app", "src", "data", "prices.json")

CONAB_API = "https://barramento.conab.gov.br/portal-informacao-api/api/v1/download?size=10000"
CONAB_BASE = "https://portaldeinformacoes.conab.gov.br/downloads/arquivos/"
CONAB_FILES = {
    "uf": "PrecosMensalUF.txt",
    "muni": "PrecosMensalMunicipio.txt",
    "cost": "CustoProducao.txt",
}
FAO_URL = "https://bulks-faostat.fao.org/production/Prices_E_All_Data_(Normalized).zip"
FAO_PAGE = "https://www.fao.org/faostat/en/#data/PP"
PTAX = ("https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/"
        "CotacaoDolarPeriodo(dataInicial=@dataInicial,dataFinalCotacao=@dataFinalCotacao)"
        "?@dataInicial='{ini}'&@dataFinalCotacao='{fim}'&$format=json"
        "&$select=cotacaoCompra,cotacaoVenda,dataHoraCotacao")

RECEIVED = "PREÇO RECEBIDO P/ PRODUTOR"
COST_MIN_REF = 202501          # ignore cost sheets older than Jan/2025
FAO_MIN_YEAR = 2018            # ignore FAOSTAT values older than this

# app crop id -> list of (CONAB produto, classificacao) in order of preference.
CONAB_PRICE_MAP = {
    "soy": [("SOJA", "EM GRÃOS")],
    "maize": [("MILHO", "EM GRÃOS")],
    "sorghum": [("SORGO GRANIFERO", "EM GRÃOS")],
    "cotton": [("ALGODAO EM CAROCO", None)],             # seed cotton (app unit)
    "cotton_lint": [("ALGODAO EM PLUMA", None)],         # lint, for reference only
    "wheat": [("TRIGO", "PÃO, PH 78, TIPO 1"), ("TRIGO", "PÃO, PH 80, TIPO 1"),
              ("TRIGO", "PÃO, PH 75, TIPO 2"), ("TRIGO", "MELHORADOR, PH 78, T")],
    "rice": [("ARROZ", "LONGO FINO EM CASCA"), ("ARROZ", "LONGO FINO TIPO 1 58")],  # paddy
    "bean": [("FEIJAO", "COMUM CORES"), ("FEIJAO", "COMUM PRETO")],
    "cowpea": [("FEIJAO", "CAUPI")],
    "sunflower": [("GIRASSOL", None)],
    "canola": [("CANOLA", "EM GRÃOS")],
}
# CONAB cost produto -> app crop id
CONAB_COST_MAP = {
    "SOJA": "soy", "MILHO": "maize", "SORGO GRANIFERO": "sorghum",
    "ALGODAO EM PLUMA": "cotton", "TRIGO": "wheat", "ARROZ": "rice",
    "FEIJAO COMUM CORES": "bean",
}

PRIORITY_UF = ["MT", "GO", "PR", "RS", "BA", "MA", "RO", "MS", "TO", "PI", "MG", "SP"]
# Municipalities always emitted (others are added when CONAB has a cost sheet).
TARGET_MUNIS = {
    "5107925": "Sorriso", "5218805": "Rio Verde", "4104808": "Cascavel",
    "4306106": "Cruz Alta", "4314100": "Passo Fundo",
    "2919553": "Luís Eduardo Magalhães", "2101400": "Balsas", "1100304": "Vilhena",
}

# FAOSTAT item code -> app crop id
FAO_ITEMS = {
    "236": "soy", "56": "maize", "83": "sorghum",
    "79": "pmillet",        # FAO "Millet" = all millets, not only pearl millet
    "328": "cotton",        # Seed cotton, unginned
    "767": "cotton_lint",   # Cotton lint, ginned
    "15": "wheat", "27": "rice",   # Rice = paddy
    "176": "bean",          # Beans, dry (Phaseolus and others)
    "195": "cowpea", "267": "sunflower",
    "270": "canola",        # Rape or colza seed
    "191": "chickpea",
}
# M49 code (as in FAOSTAT area file) -> ISO 3166-1 alpha-2
FAO_COUNTRIES = {
    "076": "BR", "840": "US", "356": "IN", "404": "KE", "250": "FR", "724": "ES",
    "616": "PL", "642": "RO", "348": "HU", "380": "IT", "124": "CA", "032": "AR",
    "600": "PY", "036": "AU", "156": "CN", "710": "ZA", "566": "NG", "231": "ET",
    "484": "MX", "804": "UA",
    # extra coverage
    "276": "DE", "826": "GB", "643": "RU", "792": "TR", "818": "EG", "834": "TZ",
    "800": "UG", "360": "ID", "704": "VN", "764": "TH", "586": "PK", "050": "BD",
    "858": "UY", "068": "BO", "170": "CO", "604": "PE", "152": "CL", "554": "NZ",
    "504": "MA", "288": "GH", "894": "ZM", "508": "MZ", "398": "KZ", "608": "PH",
}


# ----------------------------------------------------------------- download
def fetch(url: str, cache: str, name: str, refresh: bool) -> bytes:
    path = os.path.join(cache, name)
    if not refresh and os.path.exists(path) and os.path.getsize(path) > 0:
        with open(path, "rb") as f:
            return f.read()
    # NB: CONAB's CDN answers 403 to HTTP Range requests; plain GET works.
    req = urllib.request.Request(url, headers={"User-Agent": "helia-fetch-prices/1.0"})
    with urllib.request.urlopen(req, timeout=600) as r:
        data = r.read()
    with open(path, "wb") as f:
        f.write(data)
    return data


def conab_rows(raw: bytes):
    text = raw.decode("latin-1")
    rd = csv.reader(io.StringIO(text), delimiter=";")
    header = [h.strip() for h in next(rd)]
    for row in rd:
        if len(row) != len(header):
            continue
        yield dict(zip(header, (c.strip() for c in row)))


def num(s: str) -> float | None:
    try:
        return float(s.replace(",", "."))
    except (ValueError, AttributeError):
        return None


def ym_index(y: int, m: int) -> int:
    return y * 12 + (m - 1)


def ym_str(i: int) -> str:
    return f"{i // 12}-{i % 12 + 1:02d}"


# ----------------------------------------------------------------- CONAB prices
def build_series(rows, key_fields):
    """{(key..., produto, classif): {ym_index: [R$/kg, ...]}} for producer prices."""
    s = defaultdict(lambda: defaultdict(list))
    for r in rows:
        if r.get("dsc_nivel_comercializacao", "")[:20] != RECEIVED[:20]:
            continue
        v = num(r["valor_produto_kg"])
        if v is None or v <= 0:
            continue
        k = tuple(r[f] for f in key_fields) + (r["produto"], r["classificao_produto"])
        s[k][ym_index(int(r["ano"]), int(r["mes"]))].append(v)
    return s


def pick_price(series, key, crop, ref):
    """Return (fresh, info) for crop at key; info has R$/t and period."""
    for produto, classif in CONAB_PRICE_MAP[crop]:
        cands = [k for k in series if k[:-2] == key and k[-2] == produto
                 and (classif is None or k[-1] == classif)]
        if not cands:
            continue
        k = max(cands, key=lambda c: (max(series[c]), len(series[c])))
        months = sorted(series[k])
        last = months[-1]
        if last >= ref - 2:      # fresh
            window = [m for m in months if ref - 5 <= m <= ref][-3:]
            fresh = True
        else:                    # stale: keep last (up to) 3 months for reference
            window = months[-3:]
            fresh = False
        # mean of monthly means; R$/kg x 1000 = R$/t
        monthly = [sum(series[k][m]) / len(series[k][m]) for m in window]
        price_t = round(sum(monthly) / len(monthly) * 1000, 1)
        period = ym_str(window[0]) if len(window) == 1 else f"{ym_str(window[0])}..{ym_str(window[-1])}"
        return fresh, {"price": price_t, "period": period, "n_months": len(window),
                       "product": f"{produto} / {k[-1]}"}
    return None, None


# ----------------------------------------------------------------- main
def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--cache", default=os.path.join(tempfile.gettempdir(), "helia_prices_cache"))
    ap.add_argument("--refresh", action="store_true", help="re-download even if cached")
    args = ap.parse_args()
    os.makedirs(args.cache, exist_ok=True)
    today = dt.date.today()

    # --- verify CONAB file list via the portal API (files can move)
    urls = {}
    try:
        lst = json.loads(fetch(CONAB_API, args.cache, "conab_downloads.json", args.refresh))
        for item in lst.get("data", []):
            for k, fn in CONAB_FILES.items():
                if item.get("url", "").endswith("/" + fn):
                    urls[k] = item["url"]
    except Exception as e:  # noqa: BLE001
        print("warn: CONAB download list unavailable:", e, file=sys.stderr)
    for k, fn in CONAB_FILES.items():
        urls.setdefault(k, CONAB_BASE + fn)

    raw = {k: fetch(u, args.cache, CONAB_FILES[k], args.refresh) for k, u in urls.items()}
    print("CONAB files:", {k: len(v) for k, v in raw.items()}, file=sys.stderr)

    # --- FX (PTAX, selling rate, latest business day in the last 10 days)
    fx = None
    ini = (today - dt.timedelta(days=10)).strftime("%m-%d-%Y")
    fim = today.strftime("%m-%d-%Y")
    try:
        js = json.loads(fetch(PTAX.format(ini=ini, fim=fim), args.cache, f"ptax_{fim}.json", True))
        last = max(js["value"], key=lambda v: v["dataHoraCotacao"])
        fx = {"BRL": last["cotacaoVenda"], "BRL_buy": last["cotacaoCompra"],
              "source": "Banco Central do Brasil, PTAX closing rate (selling), "
                        "https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarPeriodo",
              "date": last["dataHoraCotacao"][:10]}
    except Exception as e:  # noqa: BLE001
        print("warn: PTAX unavailable:", e, file=sys.stderr)

    # --- CONAB prices
    uf_rows = list(conab_rows(raw["uf"]))
    uf_series = build_series(uf_rows, ["uf"])
    ref = max(m for s in uf_series.values() for m in s)  # newest month in state file
    muni_rows = list(conab_rows(raw["muni"]))
    muni_series = build_series(muni_rows, ["cod_ibge"])
    muni_names = {r["cod_ibge"]: (r["nom_municipio"], r["uf"]) for r in muni_rows}

    src_uf = f"CONAB Preços Agropecuários, mensal por UF, preço recebido pelo produtor ({urls['uf']})"
    src_mu = f"CONAB Preços Agropecuários, mensal por município, preço recebido pelo produtor ({urls['muni']})"

    # --- CONAB costs: latest sheet per (municipality, product, season)
    latest = {}
    for r in conab_rows(raw["cost"]):
        if r["empreendimento"] != "AGRICULTURA EMPRESARIAL" or r["produto"] not in CONAB_COST_MAP:
            continue
        refm = int(r["ano_mes"])
        if refm < COST_MIN_REF:
            continue
        k = (r["cod_ibge"], r["produto"], r["safra"])
        if k not in latest or refm > int(latest[k]["ano_mes"]):
            latest[k] = r
    src_cost = f"CONAB Custos de Produção, agricultura empresarial ({urls['cost']})"
    muni_cost = defaultdict(dict)   # ibge -> crop -> fields
    muni_meta = {}
    for (ibge, produto, safra), r in sorted(latest.items()):
        crop = CONAB_COST_MAP[produto]
        cv, cf = num(r["vlr_custo_variavel_ha"]), num(r["vlr_custo_fixo_ha"])
        if cv is None:
            continue
        refm = r["ano_mes"]
        f = {"cost": round(cv, 2), "cost_period": f"{refm[:4]}-{refm[4:]} (CONAB reference month)",
             "cost_basis": "custo variável R$/ha", "cost_source": src_cost}
        if cf is not None:
            f["cost_operational"] = round(cv + cf, 2)
        note = [f"CONAB sheet: {produto.title()}"]
        if safra != "TODAS":
            note.append(safra.lower())
        if crop == "cotton":
            note.append("cost per ha of the whole cotton crop (sheet sold in lint)")
        f["cost_note"] = ", ".join(note)
        prev = muni_cost[ibge].get(crop)
        # if two seasons exist, keep 2nd-season maize as main (Helia's typical safrinha)
        if prev is None:
            muni_cost[ibge][crop] = f
        elif "2ª" in safra:
            f["cost_other_season"] = prev["cost"]
            f["cost_note"] += f"; other season sheet: {prev['cost_note']}"
            muni_cost[ibge][crop] = f
        else:
            prev["cost_other_season"] = f["cost"]
            prev["cost_note"] += f"; other season sheet: {f['cost_note']}"
        name = r["municipio"].rsplit("-", 1)[0].strip().title()
        muni_meta[ibge] = (name, r["uf"])

    regions = []

    # --- states
    all_ufs = sorted({k[0] for k in uf_series})
    ufs = PRIORITY_UF + [u for u in all_ufs if u not in PRIORITY_UF]
    for uf in ufs:
        crops = {}
        for crop in CONAB_PRICE_MAP:
            fresh, info = pick_price(uf_series, (uf,), crop, ref)
            if info and fresh:
                crops[crop] = {"price": info["price"], "price_period": info["period"],
                               "price_note": f"{info['n_months']}-month mean; {info['product']}; R$/kg x 1000",
                               "price_source": src_uf}
        # state cost = mean of municipal sheets in the state
        by_crop = defaultdict(list)
        for ibge, cc in muni_cost.items():
            if muni_meta[ibge][1] == uf:
                for crop, f in cc.items():
                    by_crop[crop].append((muni_meta[ibge][0], f))
        for crop, lst in by_crop.items():
            c = crops.setdefault(crop, {})
            c["cost"] = round(sum(f["cost"] for _, f in lst) / len(lst), 2)
            ops = [f["cost_operational"] for _, f in lst if "cost_operational" in f]
            if len(ops) == len(lst):
                c["cost_operational"] = round(sum(ops) / len(ops), 2)
            periods = sorted({f["cost_period"][:7] for _, f in lst})
            c["cost_period"] = "/".join(periods) + " (CONAB reference month)"
            c["cost_basis"] = "custo variável R$/ha"
            c["cost_source"] = (f"mean of {len(lst)} CONAB municipal sheet(s): "
                                + ", ".join(n for n, _ in lst) + f" — {src_cost}")
        if crops:
            regions.append({"level": "state", "country": "BR", "state": uf, "currency": "BRL",
                            "unit_note": "price per t (cotton = seed cotton, cotton_lint = lint), cost per ha",
                            "crops": crops})

    # --- municipalities (cost sheets + targets)
    ibges = list(TARGET_MUNIS) + sorted(set(muni_cost) - set(TARGET_MUNIS))
    for ibge in ibges:
        name, uf = muni_meta.get(ibge) or (
            (muni_names[ibge][0].rsplit("-", 1)[0].strip().title(), muni_names[ibge][1])
            if ibge in muni_names else (TARGET_MUNIS.get(ibge), None))
        if ibge in TARGET_MUNIS:
            name = TARGET_MUNIS[ibge]
        crops = {k: dict(v) for k, v in muni_cost.get(ibge, {}).items()}
        for crop in CONAB_PRICE_MAP:
            fresh, info = pick_price(muni_series, (ibge,), crop, ref)
            if not info:
                continue
            c = crops.setdefault(crop, {})
            if fresh:
                c.update({"price": info["price"], "price_period": info["period"],
                          "price_note": f"{info['n_months']}-month mean; {info['product']}; R$/kg x 1000",
                          "price_source": src_mu})
            else:
                c.update({"price_last": info["price"], "price_last_period": info["period"],
                          "price_last_note": f"stale (> 2 months older than {ym_str(ref)}); "
                                             f"use the state price; {info['product']}; R$/kg x 1000",
                          "price_last_source": src_mu})
        if not crops:
            continue
        regions.append({"level": "municipality", "country": "BR", "state": uf, "municipality": name,
                        "ibge": ibge, "currency": "BRL",
                        "unit_note": "price per t (cotton = seed cotton, cotton_lint = lint), cost per ha",
                        "crops": crops})

    # --- FAOSTAT countries (USD/t, latest year per item)
    fao_raw = fetch(FAO_URL, args.cache, "Prices_E_All_Data_(Normalized).zip", args.refresh)
    z = zipfile.ZipFile(io.BytesIO(fao_raw))
    member = next(n for n in z.namelist() if "All_Data" in n and n.endswith(".csv"))
    best = {}
    names = {}
    with z.open(member) as fh:
        rd = csv.DictReader(io.TextIOWrapper(fh, encoding="utf-8", errors="replace"))
        for r in rd:
            if r["Element Code"] != "5532" or r["Months Code"] != "7021":   # 7021 = annual value
                continue
            m49 = r["Area Code (M49)"].lstrip("'")
            if m49 not in FAO_COUNTRIES or r["Item Code"] not in FAO_ITEMS:
                continue
            v = num(r["Value"])
            y = int(r["Year"])
            if v is None or v <= 0 or y < FAO_MIN_YEAR:
                continue
            k = (m49, r["Item Code"])
            names[m49] = r["Area"]
            if k not in best or y > best[k][0]:
                best[k] = (y, v, r["Flag"])
    for m49, iso in FAO_COUNTRIES.items():
        crops = {}
        for (mm, item), (y, v, flag) in best.items():
            if mm != m49:
                continue
            crops[FAO_ITEMS[item]] = {
                "price": round(v, 1), "price_period": str(y),
                "price_source": f"FAOSTAT PP, Producer Price (USD/tonne), item {item}, flag {flag or '-'} "
                                f"({FAO_PAGE}; bulk {FAO_URL})"}
        if crops:
            regions.append({"level": "country", "country": iso, "name": names.get(m49),
                            "currency": "USD", "unit_note": "price per t (FAOSTAT annual farm-gate)",
                            "crops": dict(sorted(crops.items()))})

    out = {"generated": today.isoformat()}
    if fx:
        out["fx"] = fx
    out["notes"] = [
        "CONAB prices: preço recebido pelo produtor, R$/kg x 1000 = R$/t; state price = mean of the latest up to 3 monthly means.",
        "CONAB cost = custo variável (custeio + outras despesas + despesas financeiras), R$/ha; cost_operational adds custo fixo (depreciação + outros fixos); renda de fatores excluded.",
        "cotton = seed cotton (algodão em caroço); cotton_lint = ginned lint (algodão em pluma). Cotton cost sheets are per ha of the whole crop.",
        "Municipal 'price_last' fields are stale and must not be used as current price; fall back to state.",
        "FAOSTAT 'pmillet' is item 79 Millet (all millets); 'bean' is item 176 Beans, dry; 'canola' is item 270 Rape or colza seed.",
        "FAOSTAT flags: A official figure, E estimated, I imputed, X from international organisation. FAOSTAT has no crop USD prices for IN (index only) or AR (none since 2017).",
        "No official source found for cover-crop costs (millet, brachiaria, crotalaria, oat, rye, clover); none written.",
    ]
    out["regions"] = regions
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
        f.write("\n")
    lv = defaultdict(int)
    for r in regions:
        lv[r["level"]] += 1
    print(f"wrote {OUT} ({os.path.getsize(OUT) // 1024} KB): {dict(lv)}; ref month {ym_str(ref)}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
