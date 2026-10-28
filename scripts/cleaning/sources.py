"""De dónde sale cada dato: ficha de cada investigación de PSI y sus publicaciones, enlazadas a NTRS."""
import csv, json, os, re

from .common import BASE, PSI, TABLE_NOTES, parse_date, read_table, table_path

PSI_URL = "https://psi.nasa.gov/physci/repo/data/studies/{}"

# Qué contiene la tabla experimental de cada investigación.
TABLE_KIND = {
    "PSI-69": "ensayos", "PSI-159": "ensayos", "PSI-107": "ensayos", "PSI-98": "ensayos", "PSI-99": "ensayos",
    "PSI-100": "ensayos", "PSI-25": "ensayos", "PSI-101": "ensayos", "PSI-102": "ensayos",
    "PSI-39": "condiciones", "PSI-10": "condiciones", "PSI-26": "condiciones", "PSI-47": "condiciones",
    "PSI-20": "bitacora", "PSI-21": "bitacora", "PSI-22": "bitacora", "PSI-23": "bitacora", "PSI-106": "bitacora",
    "PSI-68": "matriz_de_diseno", "PSI-142": "indice_de_figuras",
}
# Carpeta temática de data/ntrs con los papers relacionados.
NTRS_TOPIC = {
    "PSI-69": "flex", "PSI-68": "flex", "PSI-39": "droplet_coolflame", "PSI-142": "droplet_coolflame",
    "PSI-117": "droplet_coolflame", "PSI-10": "acme", "PSI-159": "acme", "PSI-20": "acme", "PSI-21": "acme",
    "PSI-22": "acme", "PSI-23": "acme", "PSI-107": "spice_slice", "PSI-106": "spice_slice", "PSI-60": "spice_slice",
    "PSI-26": "bass", "PSI-25": "bass", "PSI-62": "bass", "PSI-98": "saffire", "PSI-99": "saffire",
    "PSI-100": "saffire", "PSI-102": "same_smoke", "PSI-101": "same_smoke", "PSI-115": "same_smoke",
    "PSI-47": "detection_atmosphere",
}


def _norm(t):
    return re.sub(r"[^a-z0-9]+", " ", (t or "").lower()).strip()


def _doi_url(doi):
    doi = (doi or "").strip()
    if not doi:
        return None
    return doi if doi.startswith("http") else f"https://doi.org/{doi}"


def _index():
    return list(csv.DictReader(open(os.path.join(PSI, "psi_index.csv"), encoding="utf-8")))


def _investigation(folder):
    return json.load(open(os.path.join(PSI, folder, "investigation.json"), encoding="utf-8"))


def campaigns(stats, names):
    """stats: accession -> {family, rows, flagged, excluded}; names: accession -> nombre corto."""
    out = []
    for r in _index():
        acc = r["accession"]
        inv = _investigation(r["folder"])
        s = stats.get(acc, {})
        out.append({
            "accession": acc, "campaign": names.get(acc) or r["acronym"] or acc, "title": r["title"],
            "family": s.get("family"), "table_kind": TABLE_KIND.get(acc, "sin_tabla"),
            "n_rows": s.get("rows", 0), "n_flagged": s.get("flagged", 0), "n_excluded": s.get("excluded", 0),
            "sub_area": inv.get("subResearchArea") or None, "mission": inv.get("missionName") or None,
            "start": parse_date(inv.get("investigationStartDate"), "%m-%d-%Y"),
            "end": parse_date(inv.get("investigationEndDate"), "%m-%d-%Y"),
            "doi": r["doi"] or None, "doi_url": _doi_url(r["doi"]), "psi_url": PSI_URL.format(acc),
            "ntrs_topic": NTRS_TOPIC.get(acc), "n_publications": len(inv.get("publications") or []),
            "table_notes": " | ".join(TABLE_NOTES.get(acc, [])) or None,
        })
    return out


def publications():
    ntrs = {_norm(c["title"]): c for c in csv.DictReader(open(os.path.join(BASE, "data", "ntrs", "catalog.csv"),
                                                                encoding="utf-8"))}
    out = []
    for r in _index():
        for p in _investigation(r["folder"]).get("publications") or []:
            hit = ntrs.get(_norm(p.get("title")))
            out.append({"accession": r["accession"], "title": (p.get("title") or "").strip() or None,
                        "authors": (p.get("authorList") or "").strip() or None, "doi": p.get("doi") or None,
                        "doi_url": _doi_url(p.get("doi")), "ntrs_id": hit["id"] if hit else None,
                        "ntrs_url": hit["url"] if hit else None, "origin": "investigation.json"})
    # PSI-142 no trae ensayos: su tabla es un índice figura -> publicación. Se aprovecha como fuente.
    rows, _, _ = read_table(table_path("PSI-142"))
    for x in rows:
        out.append({"accession": "PSI-142", "title": f"{x['Data Description']} (fig. {x['Figure ID in Reference']})",
                    "authors": None, "doi": None, "doi_url": x["Reference Publication Link"], "ntrs_id": None,
                    "ntrs_url": None, "origin": "tabla_experimental"})
    return out
