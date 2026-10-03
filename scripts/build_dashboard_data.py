"""Genera el JSON con los datos reales que consume la app web (app/).

Uso: .venv/Scripts/python scripts/build_dashboard_data.py
Entrada: data/psi, data/ntrs/catalog.csv, data/taskbook/taskbook_combustion.csv
Salida:  app/public/data/dashboard.json
"""
import csv, glob, json, os, re

import numpy as np
import pandas as pd

BASE = os.path.join(os.path.dirname(__file__), "..")
PSI = os.path.join(BASE, "data", "psi")
OUT = os.path.join(BASE, "app", "public", "data")


def num(s):
    return pd.to_numeric(s, errors="coerce")


def flex_table():
    f = pd.read_csv(glob.glob(os.path.join(PSI, "PSI-69*", "Experimental table", "*.csv"))[0], encoding="cp1252")
    f.columns = ["n", "id", "date", "gmt", "fuel", "p", "o2", "n2", "co2", "he", "d0", "dext", "K", "tb", "end"]
    for c in ["p", "o2", "co2", "he", "d0", "dext", "K", "tb"]:
        f[c] = num(f[c])
    f = f[f.p > 0]
    r = lambda v, k=3: None if pd.isna(v) else round(float(v), k)
    return [{"n": int(x.n), "id": x.id, "date": x.date, "fuel": x.fuel, "P": r(x.p / 760), "o2": r(x.o2),
             "co2": r(x.co2), "he": r(x.he), "d0": r(x.d0), "dext": r(x.dext), "K": r(x.K), "tb": r(x.tb, 2),
             "end": x.end} for x in f.itertuples()]


def droplet_curves(max_pts=48):
    out = {}
    for p in glob.glob(os.path.join(PSI, "PSI-69_FLEX", "Raw Data", "**", "*DropletData.txt"), recursive=True):
        n = int(re.search(r"FLEX-(\d+)", p).group(1))
        lines = open(p, encoding="latin1").read().replace("\r\n", "\n").replace("\r", "\n").split("\n")[1:]
        a = np.array([[float(c[0]), float(c[1])] for c in (l.split("\t") for l in lines)
                      if len(c) > 1 and c[0] and c[1]])
        if len(a) < 5:
            continue
        a = a[a[:, 0] >= 0]  # desde la ignición
        if len(a) < 5:
            continue
        idx = np.unique(np.linspace(0, len(a) - 1, min(max_pts, len(a))).astype(int))
        out[n] = [[round(t, 2), round(d, 3)] for t, d in a[idx]]
    return out


def inventory():
    idx = list(csv.DictReader(open(os.path.join(PSI, "psi_index.csv"), encoding="utf-8")))
    rows = []
    for r in idx:
        tabs = glob.glob(os.path.join(PSI, r["folder"], "Experimental table", "*.csv"))
        n_rows = 0
        for t in tabs:
            df = pd.read_csv(t, encoding="cp1252", on_bad_lines="skip")
            n_rows += int(df.dropna(how="all").shape[0])
        inv = json.load(open(os.path.join(PSI, r["folder"], "investigation.json"), encoding="utf-8"))
        rows.append({"acc": r["accession"], "acr": r["acronym"] or "", "title": r["title"],
                     "area": inv.get("subResearchArea") or "", "start": inv.get("investigationStartDate", ""),
                     "end": inv.get("investigationEndDate", ""), "doi": r["doi"], "gb": float(r["gb_total"]),
                     "files": int(r["files_total"]), "got": int(r["files_downloaded"]),
                     "mb": float(r["mb_downloaded"]), "rows": n_rows})
    return rows


def library():
    ntrs = [{"src": "NTRS", "id": r["id"], "t": r["title"], "y": (r["date"] or "")[:4], "topic": r["topic"],
             "kind": r["sti_type"], "url": r["url"]}
            for r in csv.DictReader(open(os.path.join(BASE, "data", "ntrs", "catalog.csv"), encoding="utf-8"))]
    tb = [{"src": "Task Book", "id": r["taskid"][:8], "t": r["Project Title"],
           "y": (r["Start Date"] or "")[-4:], "topic": r["Principal Investigator/Affiliation"].split("/")[0]
           .replace("\xa0", " ").strip(), "kind": "PROYECTO", "url": r["url"]}
          for r in csv.DictReader(open(os.path.join(BASE, "data", "taskbook", "taskbook_combustion.csv"), encoding="utf-8"))]
    return ntrs + tb


def saffire():
    rows = []
    for acc, name in [("PSI-98", "Saffire-I"), ("PSI-99", "Saffire-II"), ("PSI-100", "Saffire-III")]:
        t = glob.glob(os.path.join(PSI, acc + "_*", "Experimental table", "*.csv"))[0]
        df = pd.read_csv(t, encoding="cp1252").dropna(how="all")
        df.columns = [c.strip() for c in df.columns]
        for _, x in df.iterrows():
            mat = str(x.get("Material", "")).strip()
            if not mat or mat == "nan" or mat.lower().startswith("pre-test"):
                continue
            rows.append({"exp": name, "sample": str(x.iloc[0]).strip(), "mat": mat,
                         "flow": str(x.get("Air Flow (cm/s)", x.get("Air Flow", ""))).strip(),
                         "dir": str(x.get("Flow Direction", x.get("Direction", ""))).strip(),
                         "burn": str(x.get("Burn Time (s)", "")).strip().replace("nan", ""),
                         "ug_len": str(x.get("?-g Burn Length", "")).strip().replace("nan", ""),
                         "g1_len": str(x.get("1-g Burn Length", "")).strip().replace("nan", "")})
    return rows


def main():
    os.makedirs(OUT, exist_ok=True)
    data = {"flex": flex_table(), "curves": droplet_curves(), "inventory": inventory(),
            "library": library(), "saffire": saffire(),
            "totals": {"ntrs": 277, "taskbook": 138, "psi": 24}}
    js = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    open(os.path.join(OUT, "dashboard.json"), "w", encoding="utf-8").write(js)
    print(f"flex={len(data['flex'])} curvas={len(data['curves'])} inventario={len(data['inventory'])} "
          f"biblioteca={len(data['library'])} saffire={len(data['saffire'])} -> {len(js)/1024:.0f} KB")


if __name__ == "__main__":
    main()
