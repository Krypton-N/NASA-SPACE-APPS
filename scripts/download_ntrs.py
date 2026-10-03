"""Descarga el corpus de NTRS (PDF + texto completo + metadatos) por experimento.

Uso: python scripts/download_ntrs.py [--per-query 20] [--max-mb 60]
Salida: data/ntrs/<tema>/<id>.pdf|.txt  y  data/ntrs/catalog.csv / catalog.jsonl
"""
import argparse, csv, json, os, sys, time, urllib.parse, urllib.request

API = "https://ntrs.nasa.gov/api/citations/search"
BASE = "https://ntrs.nasa.gov"
ROOT = os.path.join(os.path.dirname(__file__), "..", "data", "ntrs")

TOPICS = {
    "saffire": ["Saffire spacecraft fire experiment", "Spacecraft Fire Safety Demonstration Cygnus"],
    "flex": ["FLEX flame extinguishment droplet combustion", "cool flame droplet International Space Station"],
    "bass": ["Burning and Suppression of Solids BASS"],
    "spice_slice": ["Smoke Point In Co-flow Experiment SPICE", "Structure and Liftoff In Combustion Experiment SLICE"],
    "same_smoke": ["Smoke Aerosol Measurement Experiment SAME", "smoke detection spacecraft microgravity aerosol"],
    "sofie": ["Solid Fuel Ignition and Extinction SoFIE", "SoFIE Growth and Extinction Limit",
              "Material Ignition and Suppression Test MIST", "Confined Combustion microgravity"],
    "acme": ["Advanced Combustion via Microgravity Experiments ACME"],
    "flammability_general": ["microgravity flame spread spacecraft fire safety",
                             "exploration atmosphere flammability oxygen concentration",
                             "NASA-STD-6001 material flammability microgravity"],
    "psi": ["Physical Sciences Informatics combustion"],
    "flame_spread": ["opposed flow flame spread microgravity", "concurrent flame spread microgravity solid fuel",
                     "flame spread thin fuel low speed flow", "Narrow Channel Apparatus flammability"],
    "droplet_coolflame": ["droplet combustion microgravity", "cool flame microgravity"],
    "smolder_suppression": ["smoldering combustion microgravity", "fire suppression spacecraft",
                            "water mist fire suppression microgravity", "fire extinguisher spacecraft carbon dioxide"],
    "detection_atmosphere": ["spacecraft fire detection", "oxygen enriched atmosphere flammability spacecraft",
                             "reduced pressure elevated oxygen material flammability", "spacecraft fire safety risk"],
    "laminar_flames_soot": ["laminar diffusion flame microgravity soot", "Burning Rate Emulator microgravity"],
}


def get(url, timeout=60):
    req = urllib.request.Request(url, headers={"User-Agent": "SpaceApps2026-research/1.0"})
    return urllib.request.urlopen(req, timeout=timeout)


def search(q, n):
    url = f"{API}?{urllib.parse.urlencode({'q': q, 'page.size': n})}"
    with get(url) as r:
        return json.load(r)["results"]


def fetch(url, dest, max_bytes):
    if os.path.exists(dest):
        return "cached"
    with get(url, timeout=180) as r:
        size = int(r.headers.get("Content-Length") or 0)
        if size and size > max_bytes:
            return f"skip ({size/1e6:.0f} MB)"
        data = r.read(max_bytes + 1)
    if len(data) > max_bytes:
        return "skip (too big)"
    with open(dest, "wb") as f:
        f.write(data)
    return f"{len(data)/1e6:.1f} MB"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--per-query", type=int, default=20)
    ap.add_argument("--max-mb", type=int, default=60)
    a = ap.parse_args()
    max_bytes = a.max_mb * 1_000_000

    seen, rows = set(), []
    for topic, queries in TOPICS.items():
        os.makedirs(os.path.join(ROOT, topic), exist_ok=True)
        for q in queries:
            try:
                results = search(q, a.per_query)
            except Exception as e:
                print(f"[ERR search] {q}: {e}", file=sys.stderr)
                continue
            for r in results:
                rid = str(r["id"])
                if rid in seen or r.get("distribution") != "PUBLIC" or not r.get("downloadsAvailable"):
                    continue
                seen.add(rid)
                dl = next((d for d in r.get("downloads", []) if d.get("mimetype") == "application/pdf"), None)
                if not dl:
                    continue
                links = dl["links"]
                pdf = os.path.join(ROOT, topic, f"{rid}.pdf")
                txt = os.path.join(ROOT, topic, f"{rid}.txt")
                try:
                    s_pdf = fetch(BASE + links["pdf"], pdf, max_bytes)
                    s_txt = fetch(BASE + links["fulltext"], txt, max_bytes) if links.get("fulltext") else "n/a"
                except Exception as e:
                    s_pdf = s_txt = f"error: {e}"
                authors = "; ".join(x["meta"]["author"]["name"] for x in r.get("authorAffiliations", []))
                row = {
                    "id": rid, "topic": topic, "query": q, "title": r.get("title"),
                    "authors": authors, "date": (r.get("publications") or [{}])[0].get("publicationDate") or r.get("distributionDate"),
                    "sti_type": r.get("stiType"), "center": (r.get("center") or {}).get("name"),
                    "keywords": "; ".join(r.get("keywords") or []),
                    "url": f"{BASE}/citations/{rid}", "pdf": os.path.relpath(pdf, ROOT) if os.path.exists(pdf) else "",
                    "txt": os.path.relpath(txt, ROOT) if os.path.exists(txt) else "",
                    "abstract": r.get("abstract"),
                }
                rows.append(row)
                print(f"[{topic}] {rid} pdf={s_pdf} txt={s_txt} :: {row['title'][:70]}")
                time.sleep(0.3)

    with open(os.path.join(ROOT, "catalog.jsonl"), "w", encoding="utf-8") as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")
    with open(os.path.join(ROOT, "catalog.csv"), "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=[k for k in rows[0] if k != "abstract"], extrasaction="ignore")
        w.writeheader(); w.writerows(rows)
    print(f"\nTotal documentos: {len(rows)}")


if __name__ == "__main__":
    main()
