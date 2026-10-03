"""Descarga el subconjunto útil de las investigaciones de Combustion Science del NASA PSI.

Baja: metadatos, tablas experimentales, documentos (PDF/DOCX/PPT) y archivos tabulares
de datos reducidos. NO baja video/imágenes crudas (~13 TB en total); quedan listados en
cada files_manifest.csv con su ruta para bajarlos a mano si hacen falta.

Uso: python scripts/download_psi.py [--doc-mb 40] [--raw-mb 2] [--workers 8]
"""
import argparse, csv, json, os, re, sys, urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed

sys.path.insert(0, os.path.dirname(__file__))
from psi_common import UA, combustion_investigations, file_tree, investigation, presigned_url, walk

ROOT = os.path.join(os.path.dirname(__file__), "..", "data", "psi")
TAB = {".csv", ".txt", ".dat", ".xls", ".xlsx", ".asc", ".rtf"}
DOC = {".pdf", ".docx", ".doc", ".pptx", ".ppt"}
RAW_CATS = {"raw data", "calibration"}


def safe(s):
    return re.sub(r'[<>:"|?*]', "_", s).strip() or "_"


def wanted(acc, cat_path, key, size, a):
    ext = os.path.splitext(key)[1].lower()
    raw = cat_path.split("/")[0].lower() in RAW_CATS
    if "/metadata/" in key:
        return True
    if acc == "PSI-106" and ext == ".dat":  # SLICE: ~23k matrices de imagen, 7 GB
        return False
    if ext in DOC:
        return size <= a.doc_mb * 1e6
    if ext in TAB:
        return size <= (a.raw_mb if raw else a.doc_mb) * 1e6
    return False


def download(acc, key, dest):
    if os.path.exists(dest):
        return "cached"
    url = presigned_url(acc, key)
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    tmp = dest + ".part"
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=300) as r, open(tmp, "wb") as f:
        while chunk := r.read(1 << 20):
            f.write(chunk)
    os.replace(tmp, dest)
    return "ok"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--doc-mb", type=float, default=40)
    ap.add_argument("--raw-mb", type=float, default=2)
    ap.add_argument("--workers", type=int, default=8)
    a = ap.parse_args()

    summary = []
    for s in combustion_investigations():
        acc = s["Accession"]
        inv = investigation(acc)
        name = safe(f"{acc}_{inv.get('investigationAcronym') or s.get('Title', '')[:40]}".replace("/", "-").replace(" ", "_"))
        base = os.path.join(ROOT, name)
        os.makedirs(base, exist_ok=True)
        with open(os.path.join(base, "investigation.json"), "w", encoding="utf-8") as f:
            json.dump(inv, f, ensure_ascii=False, indent=1)

        files = list(walk(file_tree(acc, inv.get("version", 1))))
        jobs, manifest = {}, []
        for path, fobj in files:
            cat = "/".join(path)
            key, size = fobj["key"], fobj.get("bytes_size", 0) or 0
            rel = os.path.join(*[safe(p) for p in path], safe(key.split("/")[-1])) if path else safe(key.split("/")[-1])
            take = not fobj.get("restricted") and wanted(acc, cat, key, size, a)
            manifest.append({"category": cat, "file": key.split("/")[-1], "bytes": int(size),
                             "restricted": fobj.get("restricted"), "downloaded": take, "local_path": rel if take else "", "s3_key": key})
            if take:
                jobs[(key, os.path.join(base, rel))] = size

        ok = err = 0
        with ThreadPoolExecutor(a.workers) as ex:
            futs = {ex.submit(download, acc, k, d): (k, d) for (k, d) in jobs}
            for fu in as_completed(futs):
                try:
                    fu.result(); ok += 1
                except Exception as e:
                    err += 1
                    print(f"[ERR] {acc} {futs[fu][0]}: {e}", file=sys.stderr)
        with open(os.path.join(base, "files_manifest.csv"), "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=list(manifest[0]) if manifest else ["file"])
            w.writeheader(); w.writerows(manifest)
        mb = sum(jobs.values()) / 1e6
        total_gb = sum(m["bytes"] for m in manifest) / 1e9
        print(f"{acc:8} {name[:40]:40} bajados={ok:5} err={err:3} ({mb:8.1f} MB) de {len(manifest)} archivos / {total_gb:.1f} GB", flush=True)
        summary.append({"accession": acc, "folder": name, "title": inv.get("title"), "acronym": inv.get("investigationAcronym"),
                        "sub_area": inv.get("subResearchArea"), "doi": inv.get("doi"), "license": inv.get("licenseName"),
                        "files_total": len(manifest), "gb_total": round(total_gb, 2), "files_downloaded": ok, "mb_downloaded": round(mb, 1),
                        "url": f"https://psi.nasa.gov/physci/repo/data/studies/{acc}"})
    with open(os.path.join(ROOT, "psi_index.csv"), "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(summary[0])); w.writeheader(); w.writerows(summary)


if __name__ == "__main__":
    main()
