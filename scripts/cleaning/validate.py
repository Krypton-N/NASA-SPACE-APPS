"""Validación de las tablas limpias. Nunca borra ni corrige: solo agrega marcas a qc_flags."""
import numpy as np
import pandas as pd

# Rangos físicamente posibles (no "típicos"): salirse de aquí casi seguro es un error de captura.
RANGES = {
    "pressure_atm": (0.05, 10), "x_o2": (0.01, 1), "x_o2_final": (0, 1), "x_n2": (0, 1), "x_co2": (0, 1),
    "x_he": (0, 1), "x_fuel": (0, 1), "x_fuel_final": (0, 1), "d0_mm": (0.3, 8), "d_ext_mm": (0, 8),
    "burning_rate_mm2_s": (0.05, 3), "burn_time_s": (0, 3600), "duration_s": (0, 3600), "t_ad_K": (300, 4000),
    "z_st": (0, 1), "peak_burner_T_K": (250, 1500), "fuel_rate_mg_s": (0, 50), "air_velocity_cm_s": (0, 100),
    "flow_cm_s": (0, 100), "thickness_mm": (0, 50), "ug_spread_rate_mm_s": (0, 50), "nozzle_mm": (0.1, 10),
}
# Variables de resultado donde se buscan atípicos dentro de cada campaña.
OUTLIER_COLS = ["burning_rate_mm2_s", "burn_time_s", "d0_mm", "d_ext_mm", "fuel_rate_mg_s", "duration_s",
                "peak_burner_T_K", "air_velocity_cm_s"]
ROBUST_Z = 6.0
MIN_GROUP = 20


def validate(df):
    flags = [[f for f in s.split("; ") if f] if isinstance(s, str) else [] for s in df["qc_flags"]]

    def add(mask, label):
        for i in np.flatnonzero(mask.fillna(False).to_numpy(dtype=bool)):
            flags[i].append(label)

    for c, (lo, hi) in RANGES.items():
        if c in df:
            v = pd.to_numeric(df[c], errors="coerce")
            add((v < lo) | (v > hi), f"{c}:fuera_de_rango")

    add(df.duplicated(["accession", "test_id"], keep=False), "test_id:id_duplicado")

    # Atípico robusto: |x - mediana| / (1.4826 · MAD) > 6 dentro de la misma campaña (y tipo de llama).
    keys = ["accession", "flame_type"] if "flame_type" in df else ["accession"]
    for c in OUTLIER_COLS:
        if c not in df:
            continue
        v = pd.to_numeric(df[c], errors="coerce")
        grp = v.groupby([df[k].fillna("") for k in keys])
        med = grp.transform("median")
        mad = (v - med).abs().groupby([df[k].fillna("") for k in keys]).transform("median") * 1.4826
        n = grp.transform("count")
        add((n >= MIN_GROUP) & (mad > 0) & ((v - med).abs() / mad > ROBUST_Z), f"{c}:atipico")

    df = df.copy()
    df["qc_flags"] = ["; ".join(dict.fromkeys(f)) or None for f in flags]
    df["n_flags"] = [len(dict.fromkeys(f)) for f in flags]

    # Filas copiadas y pegadas (idénticas salvo la línea de origen): se excluye la copia, no la primera.
    data_cols = [c for c in df.columns if c not in ("uid", "source_line", "qc_flags", "n_flags", "excluded",
                                                    "exclude_reason")]
    copy = df.duplicated(data_cols, keep="first")
    df.loc[copy, "excluded"] = True
    df.loc[copy, "exclude_reason"] = "fila_duplicada"

    # uid único aunque la tabla original repita el identificador del ensayo.
    n = df.groupby("uid").cumcount()
    df["uid"] = df["uid"].where(n == 0, df["uid"] + "#" + (n + 1).astype(str))
    return df
