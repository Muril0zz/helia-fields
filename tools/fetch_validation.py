"""Download weather + official yields for the wide validation (validation-wide.test.ts).

Weather: NASA POWER daily point series per site, written in the DailySeries shape to
  app/src/engine/__fixtures__/validation/<site-id>.json
Yields: official statistics, written to
  app/src/engine/__fixtures__/validation/yields.json
  as {site-id: {name, source, lat, lon, crops: {cropId: {year: yield}}}}

Sources (all keyless):
  - IBGE SIDRA table 1612 (PAM), variable 112 rendimento medio, kg/ha, by municipality
  - Eurostat apro_cpshr (crop production in EU standard humidity, NUTS 2). The
    published yield item is empty at NUTS 2, so yield = harvested production / main
    area (falling back to area) in t/ha.
  - Statistics Canada table 32-10-0359-01 via the WDS REST API, average yield kg/ha.

Usage: python3 tools/fetch_validation.py [--yields-only] [site-id ...]
"""
import json
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "app" / "src" / "engine" / "__fixtures__" / "validation"
PARAMS = "T2M_MAX,T2M_MIN,PRECTOTCORR,ALLSKY_SFC_SW_DWN,RH2M,WS2M,GWETROOT"
START, END = "20050101", "20251231"
FIRST_YEAR, LAST_YEAR = 2005, 2025
UA = "helia-validation/0.1"

# IBGE products (c81) and StatCan crop members (dimension 3)
IBGE_CROPS = {"2713": "soy", "2711": "maize"}
EU_CROPS = {"wheat": "C1110", "maize": "C1500"}
STATCAN_GEO = {"Saskatchewan": 10, "Alberta": 11, "Manitoba": 9, "Ontario": 7}
STATCAN_CROPS = {"wheat": 1, "maize": 11, "soy": 15}  # Wheat all, Corn for grain, Soybeans
STATCAN_KG_HA = 18  # "Average yield (kilograms per hectare)"

SITES = [
    # Brazil, IBGE municipalities
    {"id": "sorriso-mt", "region": "Brazil", "code": "5107925", "name": "Sorriso (MT)", "lat": -12.62, "lon": -55.86, "crops": ["soy", "maize"]},
    {"id": "sapezal-mt", "region": "Brazil", "code": "5107875", "name": "Sapezal (MT)", "lat": -13.54, "lon": -58.82, "crops": ["soy", "maize"]},
    {"id": "campo-novo-parecis-mt", "region": "Brazil", "code": "5102637", "name": "Campo Novo do Parecis (MT)", "lat": -13.67, "lon": -57.89, "crops": ["soy", "maize"]},
    {"id": "nova-mutum-mt", "region": "Brazil", "code": "5106224", "name": "Nova Mutum (MT)", "lat": -13.83, "lon": -56.08, "crops": ["soy", "maize"]},
    {"id": "rio-verde-go", "region": "Brazil", "code": "5218805", "name": "Rio Verde (GO)", "lat": -17.79, "lon": -50.92, "crops": ["soy", "maize"]},
    {"id": "cristalina-go", "region": "Brazil", "code": "5206206", "name": "Cristalina (GO)", "lat": -16.77, "lon": -47.61, "crops": ["soy", "maize"]},
    {"id": "cascavel-pr", "region": "Brazil", "code": "4104808", "name": "Cascavel (PR)", "lat": -24.95, "lon": -53.46, "crops": ["soy", "maize"]},
    {"id": "toledo-pr", "region": "Brazil", "code": "4127700", "name": "Toledo (PR)", "lat": -24.72, "lon": -53.74, "crops": ["soy", "maize"]},
    {"id": "cruz-alta-rs", "region": "Brazil", "code": "4306106", "name": "Cruz Alta (RS)", "lat": -28.64, "lon": -53.61, "crops": ["soy", "maize"]},
    {"id": "passo-fundo-rs", "region": "Brazil", "code": "4314100", "name": "Passo Fundo (RS)", "lat": -28.26, "lon": -52.41, "crops": ["soy", "maize"]},
    {"id": "lem-ba", "region": "Brazil", "code": "2919553", "name": "Luís Eduardo Magalhães (BA)", "lat": -12.09, "lon": -45.80, "crops": ["soy", "maize"]},
    {"id": "balsas-ma", "region": "Brazil", "code": "2101400", "name": "Balsas (MA)", "lat": -7.53, "lon": -46.04, "crops": ["soy", "maize"]},
    # Europe, Eurostat NUTS 2
    {"id": "frb0-centre", "region": "Europe", "code": "FRB0", "name": "Centre-Val de Loire", "lat": 48.0, "lon": 1.6, "crops": ["wheat"]},
    {"id": "es41-castilla-leon", "region": "Europe", "code": "ES41", "name": "Castilla y León", "lat": 41.8, "lon": -4.7, "crops": ["wheat"]},
    {"id": "pl81-lubelskie", "region": "Europe", "code": "PL81", "name": "Lubelskie", "lat": 51.0, "lon": 22.9, "crops": ["wheat"]},
    {"id": "ro22-sud-est", "region": "Europe", "code": "RO22", "name": "Sud-Est", "lat": 45.2, "lon": 27.6, "crops": ["wheat", "maize"]},
    {"id": "hu33-del-alfold", "region": "Europe", "code": "HU33", "name": "Dél-Alföld", "lat": 46.4, "lon": 20.3, "crops": ["maize", "wheat"]},
    {"id": "ith3-veneto", "region": "Europe", "code": "ITH3", "name": "Veneto", "lat": 45.4, "lon": 11.9, "crops": ["maize"]},
    {"id": "fri1-aquitaine", "region": "Europe", "code": "FRI1", "name": "Aquitaine", "lat": 44.0, "lon": -0.4, "crops": ["maize"]},
    # Canada, StatCan provinces
    {"id": "sk-saskatchewan", "region": "Canada", "code": "Saskatchewan", "name": "Saskatchewan", "lat": 52.1, "lon": -106.6, "crops": ["wheat"]},
    {"id": "ab-alberta", "region": "Canada", "code": "Alberta", "name": "Alberta", "lat": 52.3, "lon": -113.8, "crops": ["wheat"]},
    {"id": "mb-manitoba", "region": "Canada", "code": "Manitoba", "name": "Manitoba", "lat": 49.8, "lon": -98.0, "crops": ["wheat"]},
    {"id": "on-ontario", "region": "Canada", "code": "Ontario", "name": "Ontario", "lat": 42.9, "lon": -81.3, "crops": ["maize", "soy"]},
]


def request(url: str, data: bytes | None = None, timeout: int = 120, retries: int = 4):
    headers = {"Accept": "application/json", "User-Agent": UA}
    if data is not None:
        headers["Content-Type"] = "application/json"
    last = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, data=data, headers=headers)
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return json.loads(r.read())
        except Exception as e:  # network hiccups, 429/5xx
            last = e
            wait = 3 * 2**attempt
            print(f"  retry {attempt + 1}/{retries} in {wait}s: {e}", flush=True)
            time.sleep(wait)
    raise RuntimeError(f"failed after {retries} tries: {last}")


def power(lat: float, lon: float) -> dict:
    """Same conversion as tools/fetch_demo_sites.py power()."""
    url = (
        "https://power.larc.nasa.gov/api/temporal/daily/point"
        f"?parameters={PARAMS}&community=AG&longitude={lon}&latitude={lat}"
        f"&start={START}&end={END}&format=JSON"
    )
    d = request(url, timeout=180)
    p = d["properties"]["parameter"]
    keys = sorted(p["T2M_MAX"].keys())

    def series(name: str, fallback: float):
        out, last = [], fallback
        for k in keys:
            v = p[name][k]
            if v is None or v == -999:
                v = last  # carry the last valid value over rare gaps
            out.append(round(float(v), 2))
            last = v
        return out

    elev = d.get("geometry", {}).get("coordinates", [lon, lat, 0])
    return {
        "dates": [f"{k[:4]}-{k[4:6]}-{k[6:]}" for k in keys],
        "tmax": series("T2M_MAX", 25),
        "tmin": series("T2M_MIN", 15),
        "prec": series("PRECTOTCORR", 0),
        "rad": series("ALLSKY_SFC_SW_DWN", 18),
        "rh": series("RH2M", 70),
        "wind": series("WS2M", 2),
        "gwetRoot": series("GWETROOT", 0.5),
        "lat": lat,
        "lon": lon,
        "elevation": float(elev[2]) if len(elev) > 2 and elev[2] is not None else 300.0,
    }


def in_range(year) -> bool:
    return FIRST_YEAR <= int(year) <= LAST_YEAR


def ibge(sites: list[dict]) -> dict:
    codes = ",".join(s["code"] for s in sites)
    url = f"https://apisidra.ibge.gov.br/values/t/1612/n6/{codes}/v/112/p/all/c81/{','.join(IBGE_CROPS)}"
    rows = request(url, timeout=180)[1:]  # first row is the header
    out: dict = {}
    for r in rows:
        crop = IBGE_CROPS.get(r["D4C"])
        try:
            v = float(r["V"])
        except ValueError:
            continue  # "...", "-", "X" = missing / suppressed
        if crop and in_range(r["D3N"]) and v > 0:
            out.setdefault(r["D1C"], {"name": r["D1N"], "crops": {}})["crops"].setdefault(crop, {})[r["D3N"]] = v
    return out


def eurostat(geo: str, code: str):
    url = (
        "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/apro_cpshr"
        f"?format=JSON&geo={geo}&crops={code}&lang=en"
    )
    d = request(url)
    dims = d["dimension"]
    sp = dims["strucpro"]["category"]["index"]
    tm = dims["time"]["category"]["index"]
    nt, v = len(tm), d.get("value", {})
    # dimension order freq, crops, strucpro, geo, time with singleton freq/crops/geo
    assert d["id"] == ["freq", "crops", "strucpro", "geo", "time"], d["id"]

    def get(item, t):
        return v.get(str(sp[item] * nt + tm[t])) if item in sp else None

    out = {}
    for t in tm:
        if not in_range(t):
            continue
        y = get("YLD_HUMD_EU_T_HA", t)
        if y is None:
            prod, area = get("HPRD_HUMD_EU_THS_T", t), get("MAR_THS_HA", t) or get("AR_THS_HA", t)
            y = prod / area if prod and area else None
        if y:
            out[t] = round(y, 3)
    return dims["geo"]["category"]["label"][geo], out


def statcan(geo: int, crop: int) -> dict:
    coord = f"{geo}.{STATCAN_KG_HA}.{crop}.0.0.0.0.0.0.0"
    body = json.dumps([{"productId": 32100359, "coordinate": coord, "latestN": 40}]).encode()
    d = request("https://www150.statcan.gc.ca/t1/wds/rest/getDataFromCubePidCoordAndLatestNPeriods", data=body)[0]
    if d.get("status") != "SUCCESS":
        raise RuntimeError(d)
    out = {}
    for p in d["object"]["vectorDataPoint"]:
        year = p["refPer"][:4]
        if p["value"] is not None and in_range(year) and p["value"] > 0:
            out[year] = float(p["value"])
    return out


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    yields_only = "--yields-only" in sys.argv
    OUT.mkdir(parents=True, exist_ok=True)
    sites = [s for s in SITES if not args or s["id"] in args]
    yields: dict = {}
    failures = []

    def add(s, source, name, crop, series):
        if len(series) < 5:
            failures.append(f"{s['id']} {crop}: only {len(series)} years from {source}")
            return
        e = yields.setdefault(s["id"], {"name": name, "region": s["region"], "source": source, "lat": s["lat"], "lon": s["lon"], "crops": {}})
        e["crops"][crop] = dict(sorted(series.items()))

    br = [s for s in sites if s["region"] == "Brazil"]
    if br:
        print("IBGE SIDRA 1612 ...", flush=True)
        try:
            got = ibge(br)
            for s in br:
                g = got.get(s["code"])
                if not g:
                    failures.append(f"{s['id']}: no IBGE rows")
                    continue
                for crop in s["crops"]:
                    add(s, "IBGE PAM 1612 (kg/ha)", g["name"], crop, g["crops"].get(crop, {}))
        except Exception as e:
            failures.append(f"IBGE: {e}")
    for s in sites:
        if s["region"] == "Europe":
            for crop in s["crops"]:
                print("Eurostat", s["code"], crop, flush=True)
                try:
                    name, series = eurostat(s["code"], EU_CROPS[crop])
                    add(s, "Eurostat apro_cpshr production/area (t/ha)", f"{name} ({s['code']})", crop, series)
                except Exception as e:
                    failures.append(f"{s['id']} {crop}: Eurostat {e}")
        elif s["region"] == "Canada":
            for crop in s["crops"]:
                print("StatCan", s["code"], crop, flush=True)
                try:
                    add(s, "StatCan 32-10-0359-01 (kg/ha)", s["name"], crop, statcan(STATCAN_GEO[s["code"]], STATCAN_CROPS[crop]))
                except Exception as e:
                    failures.append(f"{s['id']} {crop}: StatCan {e}")

    path = OUT / "yields.json"
    if args and path.exists():  # partial refresh keeps the other sites
        yields = {**json.loads(path.read_text()), **yields}
    path.write_text(json.dumps(yields, indent=1, ensure_ascii=False))
    print(f"yields for {len(yields)} sites -> {path}")

    if not yields_only:
        for s in sites:
            if s["id"] not in yields:
                continue  # no official data, skip the weather too
            f = OUT / f"{s['id']}.json"
            print("POWER", s["id"], flush=True)
            try:
                t = time.time()
                series = power(s["lat"], s["lon"])
                f.write_text(json.dumps(series, separators=(",", ":")))
                print(f"  {len(series['dates'])} days, {time.time() - t:.1f}s")
            except Exception as e:
                failures.append(f"{s['id']}: POWER {e}")
    if failures:
        print("FAILURES:\n  " + "\n  ".join(failures))
    return 0


if __name__ == "__main__":
    sys.exit(main())
