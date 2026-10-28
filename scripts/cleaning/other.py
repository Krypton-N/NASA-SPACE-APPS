"""Tablas que no son ensayos de combustión individuales:
  'aerosol' -> envejecimiento de humo y polvo (SAME, SAME-R, DAFT): materiales calentados, no quemados.
  'session' -> bitácoras por día de prueba (ACME BRE, CLD, E-FIELD, s-Flame y SLICE): cuántas llamas se
               encendieron ese día y con qué botellas, sin el detalle de cada ensayo."""
import re

from .common import (NAN, NUM, Campaign, Rec, add_note, fix_autofill, fnum, from_doy, from_yyddd, month_number,
                     parse_date, parse_fuel, read_table, table_path)

SAME = Campaign("PSI-102", "SAME", "aerosol")
SAME_R = Campaign("PSI-101", "SAME-R", "aerosol")
DAFT = Campaign("PSI-47", "DAFT", "aerosol")
BRE = Campaign("PSI-20", "ACME BRE", "session")
CLD = Campaign("PSI-21", "ACME CLD Flame", "session")
EFIELD = Campaign("PSI-22", "ACME E-FIELD", "session")
SFLAME = Campaign("PSI-23", "ACME s-Flame", "session")
SLICE = Campaign("PSI-106", "SLICE", "session")


# ---------------------------------------------------------------- aerosoles

def same():
    rows, src, _ = read_table(table_path(SAME.acc))
    out = []
    for x in rows:
        r = Rec(SAME, src, x["_line"], test_id=x["Sample #"])
        mat = x["Sample Material"]
        m = re.match(r"(.*?):\s*(same conditions as .*)", mat or "", re.I)
        r["material"] = (m.group(1) if m else mat).strip()
        r["description"] = m.group(2) if m else None
        if m:
            r.flag("flow_cm_s", "condiciones_en_otra_fila")
        r["flow_cm_s"] = fnum(x["Air Flow (cm/s)"])
        r["weight_loss_mg_min"] = fnum(x["Weight loss rate (mg/min)"])
        r["aging_s"] = fnum(x["Aging Duration (minutes)"]) * 60
        out.append(r.done())
    return out


def same_r():
    rows, src, _ = read_table(table_path(SAME_R.acc))
    out = []
    for x in rows:
        r = Rec(SAME_R, src, x["_line"], test_id=x["SAME Test #"])
        r["material"] = x["Sample Type"]
        r["description"] = x["Description"]
        # '21-Jul' sin año: se guarda tal cual en date_raw y no se inventa el año.
        r["date"] = None
        r["date_raw"] = x["Date"]
        r["flow_cm_s"] = fnum(x["Inlet velocity (cm/s)"])
        r["rt_r0"] = fnum(x["Rt/R0"])
        r["duration_s"] = fnum(x["Duration (sec)"])
        r["primary_aging_s"] = fnum(x["Primary aging time (sec)"])
        r["primary_mixing_s"] = fnum(x["Primary mixing time (sec)"])
        r["aging_s"] = fnum(x["Net aging time (sec)"])
        out.append(r.done())
    return out


def daft():
    rows, src, _ = read_table(table_path(DAFT.acc))
    out = []
    for x in rows:
        r = Rec(DAFT, src, x["_line"], test_id=x["Session Name"])
        m = re.match(r"GMT (\d+) \((\d{4})\)", x["Actual Day"] or "")
        r["date"] = from_doy(m.group(2), m.group(1)) if m else None
        r["material"] = "Arizona Road Dust" if "arizona" in (x["Sample Material"] or "").lower() else x["Sample Material"]
        r["description"] = f"{x['Hardware Description']}. {x['Sampled Location']}"
        out.append(r.done())
    return out


# ---------------------------------------------------------------- bitácoras de sesión

def _session(camp, src, x, day, date):
    r = Rec(camp, src, x["_line"], test_id=day)
    r["date"] = date
    if day and date is None:
        r.flag("date", "fecha_ilegible")
    return r


def _fix_autofill_col(rows, key):
    """Corrige en sitio el autorrelleno de Excel en la columna `key` (ver common.fix_autofill)
    y deja en `_autofill_<key>` si esa fila se corrigió."""
    values = [(x[key] or "").replace("%C", "% C") or None for x in rows]
    for x, (text, fixed) in zip(rows, fix_autofill(values)):
        x[key], x[f"_autofill_{key}"] = text, fixed


def _fuel(r, bottle, fixed=False):
    if fixed:
        r.flag("fuel_bottle", "autorrelleno_excel")
    r["fuel_bottle"] = bottle or None
    r["fuel"], r["x_fuel_bottle"], r["fuel_diluent"] = parse_fuel(bottle)


def _percent_list(s, r, key):
    """'21; 26.5; 40' -> '0.21;0.265;0.40'. '3400%' es 34 con formato de porcentaje de Excel."""
    if not s:
        return None
    vals = []
    for v in re.findall(rf"{NUM}%?", s):
        num = float(v.rstrip("%"))
        if v.endswith("%") and num > 100:
            num /= 100
            r.flag(key, "formato_porcentaje_excel")
        vals.append(f"{num / 100:.3f}")
    return ";".join(vals) or None


def _date_ymd(y, mo, d):
    mon = month_number(mo)
    return f"{int(y):04d}-{mon:02d}-{int(d):02d}" if y and mon and d else None


def _table_notes(camp, rows, key="Notes"):
    for x in rows:
        add_note(camp.acc, x.get(key))


def bre():
    rows, src, _ = read_table(table_path(BRE.acc))
    _table_notes(BRE, rows)
    _fix_autofill_col(rows, "Fuel Bottle")
    out = []
    for x in rows:
        date = _date_ymd(x["Year"], x["Month"], x["Date"])
        r = _session(BRE, src, x, date, date)
        r["burner_mm"] = fnum(x["Burner Size (mm)"])
        _fuel(r, x["Fuel Bottle"], x["_autofill_Fuel Bottle"])
        r["x_o2_values"] = _percent_list(x["Oxygen Conc (percent)"], r, "x_o2_values")
        r["flames_ignited"] = fnum(x["Flames Ignited"])
        out.append(r.done())
    return out


def cld():
    rows, src, _ = read_table(table_path(CLD.acc))
    _table_notes(CLD, rows)
    _fix_autofill_col(rows, "Fuel Bottle")
    out = []
    for x in rows:
        r = _session(CLD, src, x, x["Test Day"], from_yyddd(x["Test Day"]))
        r["test_type"] = x["Test Type"]
        _fuel(r, x["Fuel Bottle"], x["_autofill_Fuel Bottle"])
        r["fuel_mfc"], r["n2_mfc"] = fnum(x["Fuel MFC"]), fnum(x["N2 MFC"])
        r["x_fuel_values"] = _percent_list(x["Fuel conc. Range"], r, "x_fuel_values")
        r["flames_ignited"] = fnum(x["Flames ignited"])
        out.append(r.done())
    return out


def efield():
    rows, src, _ = read_table(table_path(EFIELD.acc))
    _table_notes(EFIELD, rows)
    _fix_autofill_col(rows, "Fuel Bottle")
    out, seen, current = [], {}, None
    for x in rows:
        if x["Test Day"] is None:
            # Fila de continuación: otra concentración de combustible del mismo día.
            if current is not None and x["Fuel Conc"]:
                extra = _percent_list(x["Fuel Conc"], current, "x_fuel_values")
                current["x_fuel_values"] = ";".join(filter(None, [current["x_fuel_values"], extra]))
            continue
        key = tuple(v for k, v in x.items() if k not in ("_line", "Notes"))
        if key in seen:
            # El mismo día aparece dos veces, idéntico: se conserva el primero y se ignora la copia.
            seen[key].flag("test_id", "bloque_duplicado_en_tabla")
            current = None
            continue
        date = _date_ymd(x["Year"], x["Month"], x["Date"])
        r = _session(EFIELD, src, x, x["Test Day"], date)
        if date != from_yyddd(x["Test Day"]):
            r.flag("date", "no_coincide_con_test_day")
        r["test_type"] = x["Test Type"]
        r["mesh_polarity"] = x["Mesh Polarity"]
        _fuel(r, x["Fuel Bottle"], x["_autofill_Fuel Bottle"])
        r["x_fuel_values"] = _percent_list(x["Fuel Conc"], r, "x_fuel_values")
        r["flames_ignited"] = fnum(x["Flames Ignited"])
        seen[key] = current = r
        out.append(r)
    return [r.done() for r in out]


def sflame():
    rows, src, _ = read_table(table_path(SFLAME.acc))
    _table_notes(SFLAME, rows)
    _fix_autofill_col(rows, "Fuel Bottle")
    _fix_autofill_col(rows, "Atmosphere*")
    out = []
    for x in rows:
        r = _session(SFLAME, src, x, x["Test Day*"], from_yyddd(x["Test Day*"]))
        if r["date"] != _date_ymd(x["Year"], x["Month"], x["Date"]):
            r.flag("date", "no_coincide_con_test_day")
        r["test_type"] = x["Test Type"]
        atm = x["Atmosphere*"]
        if x["_autofill_Atmosphere*"]:
            r.flag("atmosphere", "autorrelleno_excel")
        r["atmosphere"] = atm
        r["x_o2_values"] = _percent_list(re.sub(r"%\s*", " ", atm.split("O2")[0]), r, "x_o2_values")
        r["ambient_diluent"] = "He" if "He" in atm else "N2" if "N2" in atm else None
        _fuel(r, x["Fuel Bottle"], x["_autofill_Fuel Bottle"])
        r["flames_ignited"] = fnum(x["Flames Ignited*"])
        out.append(r.done())
    return out


def slice_():
    rows, src, _ = read_table(table_path(SLICE.acc))
    out = []
    for x in rows:
        m = re.match(r"(\d{4}-[A-Z]{3}-\d{2})\s*(.*)", x["Test Date"] or "")
        date = parse_date(m.group(1).title(), "%Y-%b-%d") if m else None
        r = _session(SLICE, src, x, date, date)
        fuel_txt = x["Fuel Type"]
        _fuel(r, re.split(r"\s(?:including|where)\s", fuel_txt)[0])
        notes = [m.group(2) if m else None, fuel_txt if re.search(r"including|where", fuel_txt) else None]
        r["notes"] = " | ".join(n for n in notes if n) or None
        r["flames_ignited"] = NAN
        out.append(r.done())
    return out


def build_aerosols():
    return same() + same_r() + daft()


def build_sessions():
    return bre() + cld() + efield() + sflame() + slice_()
