"""Familia 'gas_flame': llamas de difusión de combustible gaseoso (ACME Flame Design, ACME CFI-G, SPICE).

Convención para llamas normales e inversas:
  normal  -> el combustible sale del quemador y el O2 está en la cámara.
  inverse -> el oxidante sale del quemador y el combustible está en la cámara.
x_o2 es siempre la fracción de O2 del lado oxidante y x_fuel la del lado combustible."""
import re
from datetime import datetime

from .common import (BAR_PER_ATM, NAN, Campaign, Rec, fnum, from_yyddd, is_nan, parse_fuel, read_table,
                     table_path, text_reason)

FLAME_DESIGN = Campaign("PSI-10", "ACME Flame Design", "gas_flame")
CFI_G = Campaign("PSI-159", "ACME CFI-G", "gas_flame")
SPICE = Campaign("PSI-107", "SPICE", "gas_flame")

END_MODES = {"se": "self_extinction", "ft": "flow_termination"}
IGNITION = {"yes": "yes", "no": "no", "flash": "flash"}


def _put(r, key, raw, scale=1.0):
    """Número simple con dos casos especiales: 'RAMPED' (flujo en rampa, sin valor fijo) y texto no numérico."""
    if raw is not None and raw.strip().upper().startswith("RAMP"):
        r["ramped"] = True
        r.flag(key, "rampa")
        r[key] = NAN
        return NAN
    v = fnum(raw)
    if raw is not None and is_nan(v):
        r.flag(key, text_reason(raw))
    r[key] = v * scale
    return r[key]


def _acme_test(r, test):
    """'21196 A1' -> test_id '21196A1' y fecha a partir del prefijo YYDDD."""
    r["test_id"] = re.sub(r"\s+", "", test)
    r["date"] = from_yyddd(r["test_id"][:5])


def flame_design():
    out = []
    for kind in ("Normal", "Inverse"):
        rows, src, _ = read_table(table_path(FLAME_DESIGN.acc, f"*{kind} Flame.csv"))
        for x in rows:
            r = Rec(FLAME_DESIGN, src, x["_line"], flame_type=kind.lower(), ramped=False)
            _acme_test(r, x["Test"])
            r["test_day"] = int(x["Day"])
            if kind == "Normal":
                r["fuel"] = parse_fuel(x["Fuel"])[0]
                _put(r, "x_fuel", x["Xfuel"])
                _put(r, "fuel_rate_mg_s", x["mfuel (mg/s)"])
                _put(r, "x_o2", x["XO2 (init)"])
                _put(r, "x_o2_final", x["XO2 (final)"])
            else:
                r["fuel"] = "ethylene"
                _put(r, "x_o2", x["XO2"])
                _put(r, "o2_rate_mg_s", x["mO2 (mg/s)"])
                _put(r, "x_fuel", x["XC2H4 initial"])
                _put(r, "x_fuel_final", x["XC2H4 final"])
            _put(r, "n2_rate_mg_s", x["mN2 (mg/s)"])
            _put(r, "total_rate_mg_s", x["mtot (mg/s)"])
            p = fnum(x["pmean (atm)"])
            r["pressure_atm"] = p if not is_nan(p) else fnum(x["pinit (atm)"])
            _put(r, "z_st", x["mean Zst"])
            _put(r, "t_ad_K", x["Tad (K)"])
            out.append(r.done())
    return out


def cfi_g():
    out = []
    for kind in ("Normal", "Inverse"):
        rows, src, _ = read_table(table_path(CFI_G.acc, f"*{kind} Flames.csv"))
        for x in rows:
            r = Rec(CFI_G, src, x["_line"], flame_type=kind.lower())
            _acme_test(r, x["Test"])
            r["test_day"] = int(x["Day"])
            r["fuel_raw"] = x["Fuel"]
            r["fuel"] = parse_fuel(x["Fuel"])[0]
            _put(r, "pressure_atm", x["approx p (bar)"], 1 / BAR_PER_ATM)
            r["tfp"] = {"yes": True, "no": False}.get((x["TFP"] or "").lower())
            _put(r, "t_ad_K", x["Tad (K)"])
            _put(r, "z_st", x["Zst"])
            if kind == "Normal":
                _put(r, "x_fuel", x["Xf"])
                _put(r, "x_o2", x["XO2 before test"])
                _put(r, "x_o2_final", x["XO2 after test"])
                _put(r, "fuel_rate_mg_s", x["mHC (mg/s)"])
                cool = (x["Cool flame?"] or "").lower()
                r["cool_flame"] = cool.startswith("yes") if cool else None
                peak_c = fnum(x["Peak burner T (C )"])
                r["peak_burner_T_K"] = peak_c + 273.15
                end = x["Self-ext or flow term"]
            else:
                _put(r, "x_fuel", x["Xf before test"])
                _put(r, "x_fuel_final", x["Xf after test"])
                _put(r, "x_o2", x["XO2"])
                _put(r, "fuel_rate_mg_s", x["HC burnrate (mg/s)"])
                _put(r, "o2_rate_mg_s", x["O2 flow rate (mg/s)"])
                peak_c, peak_k = fnum(x["Peak burner Temp (C)"]), fnum(x["Peak burner temp (K)"])
                r["peak_burner_T_K"] = peak_k if not is_nan(peak_k) else peak_c + 273.15
                if not is_nan(peak_c) and not is_nan(peak_k) and abs(peak_k - peak_c - 273.15) > 1:
                    r.flag("peak_burner_T_K", "c_y_k_no_coinciden")
                color = (x["Color"] or "").lower().replace(" then ", "-")
                r["flame_color"] = color or None
                end = x["Self -ext or flow term"]
            ign = (x["Hot ignition"] or "").lower()
            r["ignition"] = IGNITION.get(ign)
            r["ignited"] = {"yes": True, "no": False, "flash": False}.get(ign)
            r["burn_time_s"] = fnum(x["burn time (sec)"])
            r["end_mode"] = END_MODES.get((end or "").lower())
            r["extinguished"] = (r["end_mode"] == "self_extinction") if r["end_mode"] else None
            r["comments"] = x["Comments"]
            if r["ignited"] is False and not is_nan(r["burn_time_s"]) and r["burn_time_s"] > 5:
                r.flag("burn_time_s", "sin_ignicion_pero_con_tiempo")
            if r["ignited"] and r["end_mode"] is None:
                r.flag("end_mode", "falta_con_ignicion")
            out.append(r.done())
    return out


def _clock(r, key, t):
    """'14:37:08', '14.34.57' o '1744' -> datetime. 'LOS' / 'Ku LOS' (pérdida de señal) -> None con marca."""
    if not t:
        return None
    if re.search(r"\blos\b|no ku", t.lower()):
        r.flag(key, "perdida_de_senal")
        return None
    s = t.replace(".", ":")
    if re.fullmatch(r"\d{4}", s):
        s = f"{s[:2]}:{s[2:]}:00"
        r.flag(key, "sin_segundos")
    try:
        v = datetime.strptime(s, "%H:%M:%S")
    except ValueError:
        r.flag(key, "hora_ilegible")
        return None
    if "." in t:
        r.flag(key, "separador_corregido")
    return v


def spice():
    rows, src, _ = read_table(table_path(SPICE.acc))
    out, seen = [], {}
    for x in rows:
        r = Rec(SPICE, src, x["_line"], flame_type="coflow")
        doy = int(x["GMT date"])
        tid = f"{doy:03d}-{x['GMT ignition'] or 'na'}"
        seen[tid] = seen.get(tid, 0) + 1
        r["test_id"] = tid if seen[tid] == 1 else f"{tid}#{seen[tid]}"
        # La tabla solo da el día del año (GMT), sin año: no se inventa la fecha.
        r["date"] = None
        r["day_of_year"] = doy
        on, off = _clock(r, "time_gmt", x["GMT ignition"]), _clock(r, "duration_s", x["GMT Flame Off"])
        r["time_gmt"] = on.strftime("%H:%M:%S") if on else x["GMT ignition"]
        r["duration_s"] = NAN
        if on and off:
            d = (off - on).total_seconds()
            if d >= 0:
                r["duration_s"] = d
            elif d + 86400 < 3600:
                r["duration_s"] = d + 86400
                r.flag("duration_s", "cruza_medianoche")
            else:
                r.flag("duration_s", "apagado_antes_de_ignicion")
        r["fuel_raw"] = x["Fuel"]
        r["fuel"], frac, _ = parse_fuel(x["Fuel"])
        r["x_fuel"] = frac
        if frac < 1:
            r.flag("x_fuel", "diluyente_no_especificado")
        _put(r, "nozzle_mm", x["Nozzle (mm)"])
        _put(r, "fuel_rate_sccm", x["Fuel Rate (sccm)"])
        rate, hc = fnum(x["Fuel Rate (mg/s)"]), fnum(x["HC Fuel Rate (mg/s)"])
        r["fuel_rate_mg_s"] = rate if not is_nan(rate) else hc
        if is_nan(rate) and not is_nan(hc):
            r.flag("fuel_rate_mg_s", "tomado_de_hc_rate")
        if not is_nan(rate) and not is_nan(hc) and abs(rate - hc) > 1e-3:
            r["hc_fuel_rate_mg_s"] = hc
        _put(r, "air_velocity_cm_s", x["Air Rate (cm/s)"])
        r["ignited"] = True if on else None
        out.append(r.done())
    return out


def build():
    return flame_design() + cfi_g() + spice()
