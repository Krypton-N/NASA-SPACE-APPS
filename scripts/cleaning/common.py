"""Utilidades compartidas por los adaptadores: lectura robusta, parseo de números con unidades,
fechas, combustibles y la fila limpia `Rec`, que va acumulando sus marcas de calidad."""
import glob, io, math, os, re
from datetime import date, datetime, timedelta

import pandas as pd

BASE = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", ".."))
PSI = os.path.join(BASE, "data", "psi")
NAN = float("nan")

# Celdas que significan "sin dato".
NULLS = {"", "nan", "n/a", "na", "-", "--", "none", "null"}
MMHG_PER_ATM = 760.0
BAR_PER_ATM = 1.01325
INCH_MM = 25.4


# ---------------------------------------------------------------- lectura

def table_path(acc, pattern="*.csv"):
    hits = glob.glob(os.path.join(PSI, f"{acc}_*", "Experimental table", pattern))
    if len(hits) != 1:
        raise FileNotFoundError(f"{acc}: se esperaba 1 tabla con '{pattern}', hay {len(hits)}")
    return hits[0]


def clean_cell(v):
    if not isinstance(v, str):
        return None
    s = re.sub(r"\s+", " ", v.replace("\xa0", " ")).strip()
    return None if s.lower() in NULLS else s


def norm_header(h):
    h = h.replace("﻿", "").replace("?-g", "ug")
    return re.sub(r"\s+", " ", h).strip()


def read_table(path):
    """Lee una tabla de PSI como texto: detecta la codificación, normaliza encabezados y celdas,
    descarta filas vacías y conserva el número de línea original (`_line`) para rastrear cada dato."""
    raw = open(path, "rb").read()
    for enc in ("utf-8-sig", "cp1252"):
        try:
            text = raw.decode(enc)
            break
        except UnicodeDecodeError:
            continue
    df = pd.read_csv(io.StringIO(text), dtype=str, keep_default_na=False)
    df.columns = [norm_header(c) for c in df.columns]
    rows = []
    for i, rec in enumerate(df.to_dict("records")):
        rec = {k: clean_cell(v) for k, v in rec.items()}
        if any(v is not None for v in rec.values()):
            rec["_line"] = i + 2  # línea 1 = encabezado
            rows.append(rec)
    rel = os.path.relpath(path, BASE).replace("\\", "/")
    return rows, rel, enc


def col(rows, *keys, required=True):
    """Nombre de la única columna que contiene todas las palabras clave (sin distinguir mayúsculas).
    Una clave que empieza con '^' se toma como expresión regular."""
    def hit(k, c):
        return re.search(k, c, re.I) if k.startswith("^") else k.lower() in c.lower()

    names = [c for c in rows[0] if c != "_line" and all(hit(k, c) for k in keys)]
    if len(names) == 1:
        return names[0]
    if not names and not required:
        return None
    raise KeyError(f"columna {keys}: {names}")


# Lo que no es una fila de ensayo pero no se puede perder: notas de la tabla y filas descartadas.
TABLE_NOTES = {}   # accession -> [texto]
SKIPPED = []       # {accession, source_file, source_line, reason, raw}


def add_note(acc, text):
    TABLE_NOTES.setdefault(acc, [])
    if text and text not in TABLE_NOTES[acc]:
        TABLE_NOTES[acc].append(text)


def skip(acc, source, x, reason):
    SKIPPED.append({"accession": acc, "source_file": source, "source_line": x["_line"], "reason": reason,
                    "raw": " | ".join(v for k, v in x.items() if k != "_line" and v)})


# ---------------------------------------------------------------- números

NUM = r"(?:\d+\.?\d*|\.\d+)"
LENGTH_MM = {"micron": 1e-3, "um": 1e-3, "µm": 1e-3, "mm": 1.0, "cm": 10.0, "m": 1000.0, '"': INCH_MM, "in": INCH_MM}


def text_reason(t):
    """Motivo de que una celda numérica traiga texto: error de Excel, sensor saturado u otro."""
    t = t.lower().strip()
    if t.startswith("#"):
        return "error_excel"
    if t in ("or", "over", "over range"):
        return "fuera_de_escala_del_sensor"
    if t == "low o2":
        return "o2_bajo_sin_valor"
    return "no_numerico"


def parse_number(s):
    """Texto -> (valor, marcas). Reconoce aproximados ('~ 21.5'), cotas ('<1'), rangos
    ('21.5 - 21.7', '22.1 to 22.0' -> promedio), varios valores (toma el primero) y el
    decimal perdido de Excel ('037' -> 0.37). Ignora unidades pegadas al número."""
    if s is None:
        return NAN, []
    t = s.lower().strip()
    nums = re.findall(NUM, t)
    if not nums:
        return NAN, [text_reason(t)]
    flags = []
    if t.startswith("~"):
        flags.append("aprox")
    if t[0] in "<>":
        flags.append("cota")
    vals = [float(x) for x in nums]
    if len(vals) > 1 and re.search(rf"{NUM}\s*(?:-|to)\s*{NUM}", t):
        v = (vals[0] + vals[1]) / 2
        flags.append("rango_promediado")
    elif len(vals) > 1:
        v = vals[0]
        flags.append("varios_valores")
    else:
        v = vals[0]
    if re.fullmatch(r"0\d+", nums[0]):
        v = float("0." + nums[0][1:])
        flags.append("decimal_faltante")
    if re.match(rf"^-\s*{NUM}", t):
        v = -v
    return v, flags


def parse_length_mm(s, default_unit):
    """Longitud con unidad opcional en el texto ('0.27 mm', '.33 cm', '100 micron') -> mm."""
    v, flags = parse_number(s)
    if math.isnan(v):
        return v, flags
    m = re.search(rf"{NUM}\s*(micron|µm|um|mm|cm|m\b|\"|in\b)", s.lower())
    unit = m.group(1) if m else default_unit
    return v * LENGTH_MM[unit], flags


def fnum(s):
    """Número simple: None o texto no numérico -> NaN."""
    try:
        return float(s)
    except (TypeError, ValueError):
        return NAN


def is_nan(v):
    return v is None or (isinstance(v, float) and math.isnan(v))


# ---------------------------------------------------------------- fechas

MONTHS = {m: i + 1 for i, m in enumerate(["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"])}


def parse_date(s, *formats):
    if s is None:
        return None
    for f in formats:
        try:
            return datetime.strptime(s.strip(), f).date().isoformat()
        except ValueError:
            pass
    return None


def from_doy(year, doy):
    return (date(int(year), 1, 1) + timedelta(days=int(doy) - 1)).isoformat()


def from_yyddd(s):
    """Día de prueba ACME 'YYDDD' (año + día del año GMT) -> fecha ISO."""
    if s is None or not re.fullmatch(r"\d{5}", s.strip()):
        return None
    return from_doy(2000 + int(s[:2]), int(s[2:]))


def month_number(s):
    return MONTHS.get((s or "").strip().lower()[:3]) if s and not s.strip().isdigit() else (int(s) if s else None)


def doy_of(iso):
    return datetime.fromisoformat(iso).timetuple().tm_yday if iso else None


# ---------------------------------------------------------------- combustibles

FUELS = {
    "methanol": "methanol", "heptane": "n-heptane", "n-heptane": "n-heptane", "c12h26": "n-dodecane",
    "iso-dodecane": "iso-dodecane", "iso-dodecan": "iso-dodecane", "isooctane": "iso-octane", "n-octane": "n-octane",
    "decane": "n-decane", "ethanol": "ethanol", "propanol": "propanol", "glycerol": "glycerol",
    "methane": "methane", "ch4": "methane", "ethane": "ethane", "c2h6": "ethane", "propane": "propane",
    "c3h8": "propane", "butane": "n-butane", "ethylene": "ethylene", "c2h4": "ethylene",
    "propylene": "propylene", "h2": "hydrogen",
}
INERTS = {"n2": "N2", "he": "He", "co2": "CO2"}
# Especies válidas; cualquier otra 'CHn'/'Nn' es un autorrelleno de Excel (N2 -> N3, N4...).
VALID_FORMULAS = {"CH4", "C2H4", "C2H6", "C3H8", "H2", "N2", "He", "CO2", "O2", "C12H26"}


FORMULA_TAIL = re.compile(r"^(.*?\b(?:C\d*H|N))(\d+)\b(.*)$")


def fix_autofill(values):
    """Corrige una columna donde Excel incrementó la fórmula al arrastrar la celda:
    '40% CH4', '40% CH5', '40% CH6'... -> todas '40% CH4'. También '100% C2H4' -> 'C2H5'... 'C2H11',
    donde C2H6 (etano) parece válido pero es parte de la serie. Se reconoce la serie porque el número
    final sube de 1 en 1 respecto de la fila anterior con el mismo texto. Como respaldo, cualquier
    'CHn' o 'Nn' que no exista se restaura a CH4 / N2. Devuelve [(texto, ¿se corrigió?)]."""
    out, prev = [], None   # prev = (prefijo, número, texto ancla)
    for s in values:
        m = FORMULA_TAIL.match(s or "")
        if m and prev and m.group(1) == prev[0] and int(m.group(2)) == prev[1] + 1:
            prev = (prev[0], int(m.group(2)), prev[2])
            out.append((f"{m.group(1)}{prev[2]}{m.group(3)}", True))
            continue
        fixed = False

        def sub(t):
            nonlocal fixed
            if t.group(0) in VALID_FORMULAS:
                return t.group(0)
            fixed = True
            return "CH4" if t.group(0).startswith("CH") else "N2"

        clean = re.sub(r"\b(?:CH|N)\d+\b", sub, s) if s else s
        anchor = FORMULA_TAIL.match(clean or "")
        prev = (m.group(1), int(m.group(2)), anchor.group(2)) if m and anchor else None
        out.append((clean, fixed))
    return out


def parse_fuel(s):
    """'75 % Propylene' -> ('propylene', 0.75, None); '40% CH4 (balance N2)' -> ('methane', 0.4, 'N2');
    '25% H2, 20% CH4, with He' -> ('hydrogen+methane', 0.45, 'He'). Fracción = combustible en la botella."""
    if not s:
        return None, NAN, None
    t = s.replace("%C", "% C").lower()
    found, total = [], 0.0
    for m in re.finditer(r"(?:(\d+\.?\d*)\s*%\s*)?([a-z][a-z0-9\-]*)", t):
        name = FUELS.get(m.group(2))
        if name and name not in found:
            found.append(name)
            if m.group(1):
                total += float(m.group(1)) / 100
    inert = next((INERTS[k] for k in INERTS if re.search(rf"\b{k}\b", t)), None)
    frac = total if total else (1.0 if found and inert is None else NAN)
    return ("+".join(found) or None), frac, inert


# ---------------------------------------------------------------- fila limpia

class Rec(dict):
    """Fila limpia. Guarda de dónde viene (archivo y línea) y las marcas de calidad 'columna:motivo'."""

    def __init__(self, campaign, source, line, **kw):
        super().__init__(accession=campaign.acc, campaign=campaign.name, family=campaign.family, **kw)
        self.flags = []
        self.excluded = None
        self.meta = {"source_file": source, "source_line": line}

    def flag(self, col, why):
        self.flags.append(f"{col}:{why}")

    def num(self, key, raw, scale=1.0):
        v, fl = parse_number(raw)
        for f in fl:
            self.flag(key, f)
        self[key] = v * scale if not math.isnan(v) else NAN
        return self[key]

    def length(self, key, raw, default_unit, to="mm"):
        v, fl = parse_length_mm(raw, default_unit)
        for f in fl:
            self.flag(key, f)
        self[key] = v / LENGTH_MM[to] if not math.isnan(v) else NAN
        return self[key]

    def exclude(self, why):
        self.excluded = why

    def done(self):
        self["uid"] = f"{self['accession']}:{self.get('test_id')}"
        self["qc_flags"] = "; ".join(dict.fromkeys(self.flags)) or None
        self["excluded"] = self.excluded is not None
        self["exclude_reason"] = self.excluded
        self.update(self.meta)
        return self


class Campaign:
    def __init__(self, acc, name, family):
        self.acc, self.name, self.family = acc, name, family
