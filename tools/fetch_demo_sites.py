"""Download NASA POWER daily series (and SoilGrids soil) for the demo sites.

Writes app/public/demo/<id>.json in the DailySeries shape the app uses, so the
demo keeps working offline or if an API is down during judging.

Usage: python3 tools/fetch_demo_sites.py
"""
import json
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "app" / "public" / "demo"
PARAMS = "T2M_MAX,T2M_MIN,PRECTOTCORR,ALLSKY_SFC_SW_DWN,RH2M,WS2M,GWETROOT"
START, END = "20050101", "20251231"

SITES = [
    # points chosen on cropland pixels (MODIS NDVI shows clear crop cycles)
    {"id": "sorriso-br", "name": "Sorriso, Mato Grosso, Brazil", "lat": -12.62, "lon": -55.86},
    {"id": "vilhena-br", "name": "Vilhena, Rondônia, Brazil", "lat": -12.55, "lon": -60.05},
    {"id": "salina-us", "name": "Salina, Kansas, USA", "lat": 38.95, "lon": -97.45},
    {"id": "ludhiana-in", "name": "Ludhiana, Punjab, India", "lat": 30.95, "lon": 75.95},
    {"id": "nakuru-ke", "name": "Nakuru, Kenya", "lat": -0.25, "lon": 35.9},
    {"id": "ames-us", "name": "Ames, Iowa, USA", "lat": 42.06, "lon": -93.55},
]


def get_json(url: str, timeout: int = 120):
    req = urllib.request.Request(url, headers={"Accept": "application/json", "User-Agent": "helia-demo/0.1"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read())


def power(lat: float, lon: float) -> dict:
    url = (
        "https://power.larc.nasa.gov/api/temporal/daily/point"
        f"?parameters={PARAMS}&community=AG&longitude={lon}&latitude={lat}"
        f"&start={START}&end={END}&format=JSON"
    )
    d = get_json(url)
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


def soilgrids(lat: float, lon: float):
    url = (
        "https://rest.isric.org/soilgrids/v2.0/properties/query"
        f"?lon={lon}&lat={lat}&property=clay&property=sand&property=soc&property=phh2o"
        "&depth=0-5cm&depth=5-15cm&depth=15-30cm&value=mean"
    )
    try:
        d = get_json(url, timeout=15)
    except Exception as e:  # SoilGrids is often slow; the app falls back to a default soil
        print("  soilgrids failed:", e)
        return None
    out = {}
    for layer in d["properties"]["layers"]:
        name = layer["name"]
        factor = layer["unit_measure"]["d_factor"]
        vals = [x["values"]["mean"] for x in layer["depths"] if x["values"]["mean"] is not None]
        if vals:
            out[name] = sum(vals) / len(vals) / factor
    return out or None


def modis_ndvi(lat: float, lon: float, from_year: int = 2022):
    """MOD13Q1 250 m 16-day NDVI for the pixel under the point (ORNL DAAC web service)."""
    base = "https://modis.ornl.gov/rst/api/v1/MOD13Q1"
    q = f"latitude={lat}&longitude={lon}"
    dates = [d for d in get_json(f"{base}/dates?{q}")["dates"] if int(d["calendar_date"][:4]) >= from_year]
    out = []
    for i in range(0, len(dates), 10):
        ch = dates[i : i + 10]
        url = (
            f"{base}/subset?{q}&band=250m_16_days_NDVI&startDate={ch[0]['modis_date']}"
            f"&endDate={ch[-1]['modis_date']}&kmAboveBelow=0&kmLeftRight=0"
        )
        for s in get_json(url, timeout=90)["subset"]:
            v = s["data"][0]
            if v is not None and v > -2000:
                out.append({"date": s["calendar_date"], "ndvi": round(v * 0.0001, 4)})
    return sorted(out, key=lambda p: p["date"])


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    index = []
    only = set(sys.argv[1:])
    for s in SITES:
        if only and s["id"] not in only:
            index.append(s)
            continue
        print("fetching", s["name"], flush=True)
        t = time.time()
        data = power(s["lat"], s["lon"])
        soil = soilgrids(s["lat"], s["lon"])
        try:
            ndvi = modis_ndvi(s["lat"], s["lon"])
        except Exception as e:
            print("  modis failed:", e)
            ndvi = []
        payload = {"site": s, "series": data, "soilgrids": soil, "ndvi": ndvi}
        (OUT / f"{s['id']}.json").write_text(json.dumps(payload, separators=(",", ":")))
        print(f"  {len(data['dates'])} days, soil={soil}, {time.time() - t:.1f}s")
        index.append(s)
    (OUT / "index.json").write_text(json.dumps(index, indent=1))
    return 0


if __name__ == "__main__":
    sys.exit(main())
