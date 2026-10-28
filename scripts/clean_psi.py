"""Limpia y unifica las tablas experimentales de PSI en tablas por familia física.

Uso: .venv/Scripts/python scripts/clean_psi.py
Entrada: data/psi/*/Experimental table/*.csv, investigation.json, psi_index.csv, data/ntrs/catalog.csv
Salida (data/clean/):
  droplets.csv, gas_flames.csv, solids.csv   ensayos de combustión, una fila por ensayo
  aerosols.csv                                 envejecimiento de humo y polvo (SAME, SAME-R, DAFT)
  sessions.csv                                 bitácoras por día de prueba (ACME BRE/CLD/E-FIELD/s-Flame, SLICE)
  experiments_all.csv                          columnas comunes de todos los ensayos + enlaces a la fuente
  campaigns.csv, publications.csv              ficha de cada investigación y sus papers (DOI / NTRS)
  skipped_rows.csv                             filas de las tablas originales que no son ensayos
  data_dictionary.md, qc_report.md             qué es cada columna y qué se encontró al limpiar

Nada se corrige en silencio: cada interpretación queda en qc_flags como 'columna:motivo', y cada fila
apunta a su archivo y línea de origen (source_file, source_line).
"""
import os, sys
from collections import Counter

import pandas as pd

from cleaning import droplets, gas, other, solids
from cleaning.common import BASE, SKIPPED
from cleaning.schema import COLUMNS, FLAG_REASONS
from cleaning.sources import campaigns, publications
from cleaning.validate import validate

OUT = os.path.join(BASE, "data", "clean")
FIRST = ["uid", "accession", "campaign", "family", "test_id", "date"]
LAST = ["n_flags", "qc_flags", "excluded", "exclude_reason", "source_file", "source_line"]
COMMON = ["uid", "accession", "campaign", "family", "test_id", "date", "fuel_or_material", "pressure_atm", "x_o2",
          "flow_cm_s", "ignited", "extinguished", "end_mode", "burn_time_s", "n_flags", "qc_flags", "excluded",
          "psi_url", "doi_url"]


def frame(records):
    df = pd.DataFrame(records)
    df = validate(df)
    mid = [c for c in df.columns if c not in FIRST + LAST]
    return df[FIRST + mid + LAST]


def common_view(df, camp):
    v = pd.DataFrame(index=df.index)
    for c in COMMON:
        v[c] = df[c] if c in df else None
    v["fuel_or_material"] = df["fuel"] if "fuel" in df else df.get("material")
    if "air_velocity_cm_s" in df:
        v["flow_cm_s"] = v["flow_cm_s"].fillna(df["air_velocity_cm_s"]) if "flow_cm_s" in df else df["air_velocity_cm_s"]
    links = camp.set_index("accession")
    v["psi_url"] = df["accession"].map(links["psi_url"])
    v["doi_url"] = df["accession"].map(links["doi_url"])
    return v[COMMON]


def write(df, name):
    df.to_csv(os.path.join(OUT, name), index=False, encoding="utf-8")


def dictionary(tables):
    lines = ["# Diccionario de datos — data/clean",
             "", "Generado por `scripts/clean_psi.py`. Unidades SI o de uso común en combustión; "
             "fracciones molares entre 0 y 1.", ""]
    for name, df in tables.items():
        lines += [f"## {name}", "", "| Columna | Unidad | Descripción |", "|---|---|---|"]
        for c in df.columns:
            unit, desc = COLUMNS[c]
            lines.append(f"| `{c}` | {unit} | {desc} |")
        lines.append("")
    lines += ["## Marcas de calidad (`qc_flags`)", "",
              "Formato `columna:motivo`, separadas por `; `. Una marca no invalida la fila: avisa que el valor "
              "se interpretó, se completó o es sospechoso. `excluded = true` sí indica que la fila no debe "
              "usarse para entrenar.", "", "| Motivo | Significado |", "|---|---|"]
    lines += [f"| `{k}` | {v} |" for k, v in FLAG_REASONS.items()]
    return "\n".join(lines) + "\n"


# Interpretaciones que el script deja marcadas pero sin resolver. Se mantienen tal cual mientras nadie
# las confirme con los papers; si alguna resulta relevante para el modelo, decidir aquí y en el adaptador.
OPEN_QUESTIONS = [
    ("Espesor del SIBAL en SAFFIRE", "`thickness_mm:inconsistente_entre_campanas`",
     "SAFFIRE-I y III dicen 0.37 y 0.33 **cm**; SAFFIRE-II dice `037 mm` (0.37 **mm**). Una de las dos unidades "
     "está mal (10x). Se conservan ambos valores. Verificar en los papers de Saffire antes de usar el espesor."),
    ("Material inferido en BASS / BASS-II", "`material:inferido`",
     "Descripciones como `2 cm sphere` o `1/4\" black rod` no dicen el material; se asumió PMMA porque es el "
     "único material de esas geometrías en ambas campañas. Confirmar con la documentación de BASS."),
    ("Diluyente de los combustibles de SPICE", "`x_fuel:diluyente_no_especificado`",
     "`75% Propylene` y `50% Propylene` no dicen con qué se diluyó (¿N2? ¿propano?). Se guarda la fracción "
     "pero `fuel` queda como propylene. Revisar el paper de SPICE si se usa SPICE para entrenar."),
]


def report(tables, camp, skipped):
    lines = ["# Reporte de calidad — limpieza de tablas PSI", "",
             "Generado por `scripts/clean_psi.py`.", "",
             "## Decisiones abiertas", "",
             "Interpretaciones que no se resolvieron: los datos quedan marcados y la limpieza continúa. "
             "Solo importan si esas columnas se usan para entrenar o se muestran como dato firme.", "",
             "| Tema | Marca | Situación |", "|---|---|---|"]
    lines += [f"| {t} | {f} | {d} |" for t, f, d in OPEN_QUESTIONS]
    lines += ["", "## Filas por campaña", "",
             "| Campaña | Familia | Tipo de tabla | Filas | Con marcas | Excluidas |", "|---|---|---|---:|---:|---:|"]
    for _, c in camp.sort_values(["family", "campaign"], na_position="last").iterrows():
        family = c.family if isinstance(c.family, str) else "—"
        lines.append(f"| {c.campaign} ({c.accession}) | {family} | {c.table_kind} | {c.n_rows} | "
                     f"{c.n_flagged} | {c.n_excluded} |")
    for name, df in tables.items():
        flags = Counter(f for s in df["qc_flags"].dropna() for f in s.split("; "))
        nulls = df.drop(columns=FIRST + LAST, errors="ignore").isna().mean().sort_values(ascending=False)
        lines += ["", f"## {name} ({len(df)} filas)", "", "Marcas más frecuentes:", ""]
        lines += [f"- `{k}` × {v}" for k, v in flags.most_common(15)] or ["- (ninguna)"]
        lines += ["", "Columnas con más datos faltantes:", ""]
        lines += [f"- `{k}`: {v:.0%}" for k, v in nulls.items() if v > 0][:12] or ["- (ninguna)"]
    lines += ["", "## Filas descartadas de las tablas originales", "", "| Archivo | Línea | Motivo |", "|---|---:|---|"]
    lines += [f"| {s['source_file']} | {s['source_line']} | {s['reason']} |" for s in skipped]
    return "\n".join(lines) + "\n"


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    os.makedirs(OUT, exist_ok=True)
    tables = {
        "droplets.csv": frame(droplets.build()),
        "gas_flames.csv": frame(gas.build()),
        "solids.csv": frame(solids.build()),
        "aerosols.csv": frame(other.build_aerosols()),
        "sessions.csv": frame(other.build_sessions()),
    }
    stats, names = {}, {}
    for df in tables.values():
        for acc, g in df.groupby("accession"):
            stats[acc] = {"family": g["family"].iloc[0], "rows": len(g), "flagged": int((g["n_flags"] > 0).sum()),
                          "excluded": int(g["excluded"].sum())}
            names[acc] = g["campaign"].iloc[0]
    camp = pd.DataFrame(campaigns(stats, names))
    pubs = pd.DataFrame(publications())
    skipped = pd.DataFrame(SKIPPED)
    tests = [n for n in tables if n != "sessions.csv"]
    allx = pd.concat([common_view(tables[n], camp) for n in tests], ignore_index=True)

    for name, df in tables.items():
        write(df, name)
    write(allx, "experiments_all.csv")
    write(camp, "campaigns.csv")
    write(pubs, "publications.csv")
    write(skipped, "skipped_rows.csv")

    documented = {**tables, "experiments_all.csv": allx, "campaigns.csv": camp, "publications.csv": pubs,
                  "skipped_rows.csv": skipped}
    missing = sorted({c for df in documented.values() for c in df.columns if c not in COLUMNS})
    if missing:
        raise SystemExit(f"Columnas sin documentar en cleaning/schema.py: {missing}")
    unknown = sorted({f.split(":", 1)[1] for df in tables.values() for s in df["qc_flags"].dropna()
                      for f in s.split("; ")} - set(FLAG_REASONS))
    if unknown:
        raise SystemExit(f"Motivos de qc_flags sin documentar en cleaning/schema.py: {unknown}")
    open(os.path.join(OUT, "data_dictionary.md"), "w", encoding="utf-8").write(dictionary(documented))
    open(os.path.join(OUT, "qc_report.md"), "w", encoding="utf-8").write(report(tables, camp, SKIPPED))

    for name, df in tables.items():
        print(f"{name:16} {len(df):5} filas  {int((df['n_flags'] > 0).sum()):4} con marcas  "
              f"{int(df['excluded'].sum()):3} excluidas")
    print(f"experiments_all  {len(allx):5} filas | campañas {len(camp)} | publicaciones {len(pubs)} "
          f"({pubs['ntrs_url'].notna().sum()} enlazadas a NTRS) | descartadas {len(skipped)}")


if __name__ == "__main__":
    main()
