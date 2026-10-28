"""Familia 'solid': combustión y propagación de llama sobre materiales sólidos (SAFFIRE I-III, BASS, BASS-II)."""
import re

from .common import (INCH_MM, NAN, NUM, Campaign, Rec, add_note, col, doy_of, fnum, is_nan, parse_date,
                     read_table, skip, table_path)

SAFFIRE = [Campaign("PSI-98", "SAFFIRE-I", "solid"), Campaign("PSI-99", "SAFFIRE-II", "solid"),
           Campaign("PSI-100", "SAFFIRE-III", "solid")]
BASS = Campaign("PSI-26", "BASS", "solid")
BASS2 = Campaign("PSI-25", "BASS-II", "solid")


# ---------------------------------------------------------------- descripción del material

def parse_material(s):
    """Texto libre de BASS/BASS-II/SAFFIRE -> material, geometría y dimensiones.
    '1/4" black rod' -> PMMA (inferido), rod, diámetro 6.35 mm, negro;
    '100 micron PMMA film 2 cm wide' -> PMMA, film, 0.1 mm, 2 cm."""
    t = s.lower().replace("2ide", "wide").replace("oppsed", "opposed").replace("parrafin", "paraffin")
    out = {"material": None, "geometry": None, "thickness_mm": NAN, "width_cm": NAN, "diameter_mm": NAN,
           "rod_color": None, "sides_burning": NAN, "ignition_note": None, "flow_direction": None}
    flags = []
    if "sibal" in t:
        out["material"] = "SIBAL"
    elif "nomex" in t and "pmma" in t:
        out["material"] = "PMMA+Nomex"
    elif "nomex" in t:
        out["material"] = "Nomex"
    elif "ultem" in t:
        out["material"] = "Ultem"
    elif "silicone" in t:
        out["material"] = "silicone"
    elif "japan" in t:
        out["material"] = "Japan wax"
    elif "paraffin" in t:
        out["material"] = "paraffin wax"
    elif "wax" in t or "candle" in t:
        out["material"] = "wax"
    elif "pmma" in t:
        out["material"] = "PMMA"
    elif re.search(r"sphere|spherical|rod|film|slab|micron", t):
        # En BASS/BASS-II las esferas, barras y películas sin material declarado son de PMMA.
        out["material"] = "PMMA"
        flags.append("material:inferido")

    if "spherical section" in t:
        out["geometry"] = "spherical_section"
    elif "sphere" in t:
        out["geometry"] = "sphere"
    elif "rod" in t:
        out["geometry"] = "rod"
    elif "candle" in t:
        out["geometry"] = "candle"
    elif "film" in t:
        out["geometry"] = "film"
    elif "slab" in t or "sheet" in t:
        out["geometry"] = "slab"
    elif out["material"] in ("SIBAL", "Nomex") or "fabric" in t or "fiberglass" in t:
        out["geometry"] = "fabric"

    if out["geometry"] in ("sphere", "spherical_section"):
        m = re.search(rf"({NUM})\s*cm", t)
        out["diameter_mm"] = float(m.group(1)) * 10 if m else NAN
    elif out["geometry"] == "rod":
        m = re.search(r"(\d+)\s*/\s*(\d+)", t) or re.search(rf"({NUM})\s*\"", t)
        if m:
            inches = int(m.group(1)) / int(m.group(2)) if m.lastindex == 2 else float(m.group(1))
            out["diameter_mm"] = round(inches * INCH_MM, 3)
        out["rod_color"] = "black" if "blac" in t else "clear" if "clear" in t else None
    else:
        m = re.search(rf"({NUM})\s*micron", t)
        mm = re.search(rf"({NUM})\s*mm", t)
        if m:
            out["thickness_mm"] = float(m.group(1)) / 1000
        elif mm:
            out["thickness_mm"] = float(mm.group(1))
        w = re.search(rf"({NUM})\s*cm\s*wide", t) or re.search(rf"({NUM})\s*cm\b", t)
        out["width_cm"] = float(w.group(1)) if w else NAN
        if out["material"] == "PMMA" and out["geometry"] is None and "micron" in t:
            out["geometry"] = "film"
        elif out["material"] == "PMMA" and out["geometry"] is None and not is_nan(out["thickness_mm"]):
            out["geometry"] = "slab" if out["thickness_mm"] >= 1 else "film"
            flags.append("geometry:inferida_del_espesor")

    m = re.search(r"([12])\s*sided", t)
    out["sides_burning"] = float(m.group(1)) if m else NAN
    notes = [n for n in ("wake", "moved igniter", "top side ign") if n in t]
    out["ignition_note"] = ", ".join(notes) or None
    out["flow_direction"] = "opposed" if "opposed" in t else None
    return out, flags


def _apply_material(r, raw):
    info, flags = parse_material(raw)
    r.update(info)
    for f in flags:
        k, why = f.split(":")
        r.flag(k, why)


# ---------------------------------------------------------------- SAFFIRE

def _text_or_none(s):
    """'n/a (Nomex)' y 'Note 4' no son valores: -> None."""
    if s is None or re.match(r"^(n/a|note \d)", s.lower()) or s.lower().startswith("see "):
        return None
    return re.sub(r"\((?:note \d|nomex)\)", "", s, flags=re.I).strip()


def saffire():
    out = []
    for camp in SAFFIRE:
        rows, src, _ = read_table(table_path(camp.acc))
        g = lambda *k: col(rows, *k, required=False)
        # SAFFIRE-II escribe 'Samle Thickness': se busca solo 'thick'.
        c = {"id": g("^sample number"), "mat": g("^material"), "thick": g("thick"),
             "len": g("^sample length"), "wid": g("^sample width"), "flow": g("^air flow"),
             "o2": g("percent o2"), "pow": g("ignition power"), "itime": g("ignition time"),
             "burn": g("^burn time"), "dir": g("direction"), "ug_len": g("^ug burn length"),
             "ug_rate": g("^ug spread"), "g1_len": g("^1-g burn length"), "g1_rate": g("^1-g spread rate"),
             "cam1": g("camera 1"), "cam2": g("camera 2")}
        get = lambda x, k: x.get(c[k]) if c[k] else None
        thick_unit = "cm" if c["thick"] and "(cm)" in c["thick"] else "mm"
        prev_mat = None
        for x in rows:
            sid = get(x, "id") or ""
            if sid.lower().startswith("note"):
                add_note(camp.acc, sid)
                continue
            if "flow visulation" in (get(x, "mat") or "").lower():
                skip(camp.acc, src, x, "visualizacion_de_flujo_pre_ensayo")
                continue
            r = Rec(camp, src, x["_line"], test_id=sid)
            mat = get(x, "mat")
            if mat is None and prev_mat:
                mat = prev_mat
                r.flag("material", "relleno_desde_fila_anterior")
            prev_mat = mat
            r["material_raw"] = mat
            _apply_material(r, mat or "")
            r["thickness_raw"] = get(x, "thick")
            r.length("thickness_mm", _text_or_none(get(x, "thick")), thick_unit)
            r.length("length_cm", get(x, "len"), "cm", to="cm")
            r.length("width_cm", get(x, "wid"), "cm", to="cm")
            if r["length_cm"] < r["width_cm"]:
                # La muestra de Saffire mide 94 cm de largo por 40.6 cm de ancho; aquí venían invertidos.
                r["length_cm"], r["width_cm"] = r["width_cm"], r["length_cm"]
                r.flag("length_cm", "largo_y_ancho_invertidos")
            r.num("flow_cm_s", get(x, "flow"))
            r.num("x_o2", get(x, "o2"), 0.01)
            r.num("ignition_power_W", get(x, "pow"))
            r.num("ignition_time_s", get(x, "itime"))
            burn = get(x, "burn")
            if burn and burn.lower() == "insignificant":
                r["burn_time_s"] = 0.0
                r.flag("burn_time_s", "insignificante")
            else:
                r.num("burn_time_s", burn)
            r["flow_direction"] = (get(x, "dir") or "").lower() or r["flow_direction"]
            r.length("ug_burn_length_cm", _text_or_none(get(x, "ug_len")), "cm", to="cm")
            r.num("ug_spread_rate_mm_s", _text_or_none(get(x, "ug_rate")))
            g1 = get(x, "g1_len")
            if g1 and g1.lower() == "complete":
                r["g1_burn_length_cm"] = r["length_cm"]
                r.flag("g1_burn_length_cm", "completa")
            else:
                r.length("g1_burn_length_cm", _text_or_none(g1), "cm", to="cm")
            g1r = get(x, "g1_rate")
            if g1r and g1r.lower() == "acceleratory":
                r["g1_spread_rate_mm_s"] = NAN
                r["g1_spread_mode"] = "acceleratory"
            else:
                r.num("g1_spread_rate_mm_s", _text_or_none(g1r))
                r["g1_spread_mode"] = "steady" if not is_nan(r["g1_spread_rate_mm_s"]) else None
            ug, burn = r.get("ug_burn_length_cm", NAN), r.get("burn_time_s", NAN)
            if not is_nan(burn) and burn > 0:
                r["ignited"] = True
            else:
                r["ignited"] = None if is_nan(ug) else bool(ug > 0.5)
            r["video_ids"] = ", ".join(v for v in (get(x, "cam1"), get(x, "cam2")) if v and v != "n/a") or None
            out.append(r)
    _check_thickness_across_campaigns(out)
    return [r.done() for r in out]


def _check_thickness_across_campaigns(recs):
    """El mismo material no debería cambiar 10x de espesor entre vuelos. Pasa con SIBAL:
    SAFFIRE-I/III dicen ~0.35 cm y SAFFIRE-II 0.37 mm. Se marca; no se decide cuál es el correcto."""
    by_mat = {}
    for r in recs:
        if r.get("material") and not is_nan(r.get("thickness_mm", NAN)):
            by_mat.setdefault(r["material"], {}).setdefault(r["campaign"], []).append(r["thickness_mm"])
    for mat, camps in by_mat.items():
        meds = [sorted(v)[len(v) // 2] for v in camps.values()]
        if len(meds) > 1 and max(meds) / min(meds) > 5:
            for r in recs:
                if r.get("material") == mat and r["campaign"] in camps:
                    r.flag("thickness_mm", "inconsistente_entre_campanas")


# ---------------------------------------------------------------- BASS y BASS-II

def _check_doy(r, gmt):
    doy = fnum(gmt)
    r["day_of_year"] = doy
    if r["date"] and not is_nan(doy) and doy_of(r["date"]) != int(doy):
        r.flag("date", "no_coincide_con_dia_gmt")


def bass():
    rows, src, _ = read_table(table_path(BASS.acc))
    out = []
    for x in rows:
        mat = x["Fuel Sample Material"] or ""
        if "cleaning" in mat.lower():
            skip(BASS.acc, src, x, "no_es_ensayo")
            continue
        run = x["As Run Test #"]
        r = Rec(BASS, src, x["_line"], test_id=run or f"L{x['_line']}")
        if run is None:
            r.flag("test_id", "sin_numero_de_ensayo")
        r["planned_test"] = x["Test #"]
        r["sample_id"] = x["Sample #"]
        r["date"] = parse_date(x["Date"], "%m/%d/%Y")
        _check_doy(r, x["GMT"])
        r["material_raw"] = mat
        _apply_material(r, mat)
        out.append(r.done())
    return out


def _flow_history(text):
    """Historial de flujo de BASS-II ('5 4 3 2 1', '10 max', '5 down to ext', '<1') -> números en cm/s."""
    if not text:
        return []
    t = re.sub(r"\(.*?\)", " ", text.lower())
    return [float(v) for v in re.findall(NUM, t)]


def bass2():
    rows, src, _ = read_table(table_path(BASS2.acc))
    out = []
    for x in rows:
        r = Rec(BASS2, src, x["_line"], test_id=x["Test #"])
        r["pi"] = x["PI"]
        r["sample_id"] = x["Sample #"]
        r["date"] = parse_date(x["Date"], "%m/%d/%Y")
        _check_doy(r, x["GMT"])
        mat = x["Fuel Sample Material"] or ""
        r["material_raw"] = mat
        _apply_material(r, mat)
        r["flow_restrictor"] = fnum(x["Flow restrictor"])
        air, fan = x["Air display"], x["Fan display"]
        r["flow_history_raw"], r["fan_history_raw"] = air, fan
        flows = _flow_history(air)
        if flows:
            r["flow_cm_s"] = flows[0]
            r["flow_min_cm_s"], r["flow_max_cm_s"] = min(flows), max(flows)
            if air.strip().startswith("<"):
                r.flag("flow_cm_s", "cota")
            if max(flows) > 25:
                r.flag("flow_max_cm_s", "posible_lectura_del_ventilador")
        else:
            r["flow_cm_s"] = r["flow_min_cm_s"] = r["flow_max_cm_s"] = NAN
        events = f"{air or ''} {fan or ''}".lower()
        r["extinguished"] = True if re.search(r"ext|extinguish|\bout\b", events) else None
        r["blowoff"] = True if "blowoff" in events else None
        # Solo se sabe con certeza cuando la bitácora dice que no encendió ('no ign at any flow').
        r["ignited"] = False if "no ign" in events else None
        r.num("x_o2", x["Calibrated initial O2 % by vol"], 0.01)
        r.num("x_o2_final", x["Calibrated final O2 % by vol"], 0.01)
        if not is_nan(r["x_o2"]) and not is_nan(r["x_o2_final"]) and r["x_o2"] - r["x_o2_final"] > 0.03:
            r.flag("x_o2_final", "caida_de_o2_inverosimil")
        r.num("co2_initial_pct", x["Initial CO2 % by vol"])
        r.num("co2_final_pct", x["Final CO2 % by vol"])
        r.num("co_initial_ppm", x["Initial CO (ppm)"])
        r.num("co_final_ppm", x["Final CO (ppm)"])
        for k in ("co_initial_ppm", "co_final_ppm"):
            if not is_nan(r[k]) and r[k] < 0:
                r.flag(k, "negativo")
        r["frames_shot"] = fnum(x["Total Frames Shot"])
        out.append(r.done())
    return out


def build():
    return saffire() + bass() + bass2()
