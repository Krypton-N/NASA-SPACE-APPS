"""Familia 'droplet': combustión de gotas aisladas (FLEX, CFI)."""
import re

from .common import (MMHG_PER_ATM, NAN, Campaign, Rec, col, fnum, is_nan, parse_date, parse_fuel,
                     read_table, table_path)

FLEX = Campaign("PSI-69", "FLEX", "droplet")
CFI = Campaign("PSI-39", "CFI", "droplet")
END_MODES = {"extinction": "extinction", "disruption": "disruption", "completion": "completion"}


def _composition(r, o2, n2, co2, he):
    r["x_o2"], r["x_n2"], r["x_co2"], r["x_he"] = fnum(o2), fnum(n2), fnum(co2), fnum(he)
    parts = [r["x_o2"], r["x_n2"], r["x_co2"], r["x_he"]]
    if not any(is_nan(p) for p in parts) and abs(sum(parts) - 1) > 0.02:
        r.flag("x_o2", "fracciones_no_suman_1")
    r["diluent"] = "+".join(k for k, v in (("N2", r["x_n2"]), ("CO2", r["x_co2"]), ("He", r["x_he"]))
                            if not is_nan(v) and v > 0) or None


def flex():
    rows, src, _ = read_table(table_path(FLEX.acc))
    c = {k: col(rows, *kw) for k, kw in {
        "n": ("test #",), "id": ("identifier",), "date": ("test date",), "gmt": ("test gmt",), "fuel": ("fuel",),
        "p": ("pressure",), "o2": ("^o initial",), "n2": ("^n initial",), "co2": ("^co initial",),
        "he": ("^he initial",), "d0": ("initial diameter",), "dext": ("extinction diameter",),
        "K": ("burning rate",), "tb": ("burn time",), "end": ("test end",)}.items()}
    out = []
    for x in rows:
        r = Rec(FLEX, src, x["_line"], test_id=x[c["id"]], test_number=int(x[c["n"]]))
        r["date"] = parse_date(x[c["date"]], "%m/%d/%Y", "%m/%d/%y")
        if r["date"] is None:
            r.flag("date", "fecha_ilegible")
        r["time_gmt"] = x[c["gmt"]]
        r["fuel"] = parse_fuel(x[c["fuel"]])[0]
        p = fnum(x[c["p"]])
        r["pressure_atm"] = p / MMHG_PER_ATM if p and p > 0 else NAN
        if p == 0:
            r.flag("pressure_atm", "cero")
        # En el CSV original se perdieron los subíndices: 'O', 'N', 'CO' y 'He' son O2, N2, CO2 y He.
        _composition(r, x[c["o2"]], x[c["n2"]], x[c["co2"]], x[c["he"]])
        r["d0_mm"] = fnum(x[c["d0"]])
        r["d_ext_mm"] = fnum(x[c["dext"]])
        # El encabezado dice 'mm' pero es la constante de evaporación K de la ley d², en mm²/s.
        r["burning_rate_mm2_s"] = fnum(x[c["K"]])
        r["burn_time_s"] = fnum(x[c["tb"]])
        end = (x[c["end"]] or "").lower()
        r["end_mode"] = END_MODES.get(end)
        r["extinguished"] = (end == "extinction") if end else None
        r["ignited"] = True if not is_nan(r["burn_time_s"]) and r["burn_time_s"] > 0 else None
        if not is_nan(r["d_ext_mm"]) and not is_nan(r["d0_mm"]) and r["d_ext_mm"] >= r["d0_mm"]:
            r.flag("d_ext_mm", "mayor_que_d0")
        if r["end_mode"] == "extinction" and is_nan(r["d_ext_mm"]):
            r.flag("d_ext_mm", "falta_con_extincion")
        out.append(r.done())
    return out


def cfi():
    rows, src, _ = read_table(table_path(CFI.acc))
    c = {k: col(rows, kw) for k, kw in {
        "n": "flex number", "date": "test date", "time": "local time", "cir": "cir", "p": "pressure",
        "o2": "oxygen", "n2": "nitrogen", "he": "helium", "fiber": "fiber", "fuel": "fuel"}.items()}
    out = []
    for x in rows:
        r = Rec(CFI, src, x["_line"], test_id=x[c["cir"]], test_number=int(x[c["n"]]))
        r["date"] = parse_date(x[c["date"]], "%d-%b-%y")
        r["time_local"] = x[c["time"]]
        r.num("pressure_atm", x[c["p"]])  # '1.25 atm'
        _composition(r, x[c["o2"]], x[c["n2"]], 0, x[c["he"]])
        fuel = x[c["fuel"]] or ""
        r["fuel"] = parse_fuel(fuel)[0]
        m = re.match(r"\[(\.\d+)\]/\[(\.\d+)\]", fuel)  # '[.75]/[.25] C12H26/iso-dodecane'
        r["fuel_blend"] = f"{float(m.group(1)):.2f}/{float(m.group(2)):.2f}" if m else "1.00"
        r["fiber_supported"] = {"yes": True, "no": False}.get((x[c["fiber"]] or "").lower())
        out.append(r.done())
    return out


def build():
    return flex() + cfi()
