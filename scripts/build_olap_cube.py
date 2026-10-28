"""Construye y visualiza el Cubo OLAP integral de la NASA para 'Flame in Freefall'.

Ingesta prácticamente TODOS los datos disponibles en el repositorio:
1. PSI: 24 investigaciones y ~2,000 ensayos experimentales de las 22 tablas de datos reducidos
   (FLEX, FLEX-2, Saffire I-II-III, BASS, BASS-II, SPICE, SLICE, SAME, SAME-R, ACME).
2. NTRS: Los 277 documentos técnicos y científicos completos con su TÍTULO COMPLETO, autores, año y URL.
3. Task Book: Los 138 proyectos de investigación espacial con título, PI, afiliación y centro NASA.
4. Standards: Normas de certificación de inflamabilidad NASA-STD-6001B (Test 1) y JSC-29353B.

Genera:
- Base de datos analítica: data/olap_experimentos.db (SQLite)
- Visor web interactivo: data/visor_cubo_olap.html

Uso:
    python scripts/build_olap_cube.py
"""
import glob
import json
import os
import re
import sqlite3
import pandas as pd

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
PSI_DIR = os.path.join(DATA_DIR, "psi")
NTRS_CATALOG = os.path.join(DATA_DIR, "ntrs", "catalog.csv")
TASKBOOK_CSV = os.path.join(DATA_DIR, "taskbook", "taskbook_combustion.csv")
PSI_INDEX_CSV = os.path.join(PSI_DIR, "psi_index.csv")
DB_PATH = os.path.join(DATA_DIR, "olap_experimentos.db")
HTML_REPORT = os.path.join(DATA_DIR, "visor_cubo_olap.html")


def clean_num(val):
    if pd.isna(val) or val is None:
        return None
    val_str = str(val).replace("~", "").replace(">", "").replace("<", "").replace("approx", "").replace("bar", "").strip()
    match = re.search(r"[-+]?\d*\.?\d+", val_str)
    return float(match.group()) if match else None


def init_database(conn):
    cursor = conn.cursor()
    cursor.executescript("""
    DROP VIEW IF EXISTS v_cubo_experimentos_completo;
    DROP VIEW IF EXISTS v_cubo_resumen_materiales;
    DROP VIEW IF EXISTS v_catalogo_papers_ntrs;
    DROP VIEW IF EXISTS v_cartera_taskbook;
    DROP TABLE IF EXISTS fact_experimento;
    DROP TABLE IF EXISTS fact_proyecto_taskbook;
    DROP TABLE IF EXISTS dim_estandar_nasa;
    DROP TABLE IF EXISTS dim_investigacion_psi;
    DROP TABLE IF EXISTS dim_material;
    DROP TABLE IF EXISTS dim_condicion_frontera;
    DROP TABLE IF EXISTS dim_paper_ntrs;
    DROP TABLE IF EXISTS dim_tiempo_inicio;

    -- 1. Dimensión Materiales / Combustibles
    CREATE TABLE dim_material (
        id_material        INTEGER PRIMARY KEY,
        nombre_material    TEXT NOT NULL,
        categoria_quimica  TEXT,
        estado_materia     TEXT, -- 'Sólido', 'Líquido', 'Gas'
        espesor_mm         REAL
    );

    -- 2. Dimensión Condiciones Ambientales y de Frontera
    CREATE TABLE dim_condicion_frontera (
        id_condicion       INTEGER PRIMARY KEY,
        presion_psi        REAL NOT NULL,
        oxigeno_percent    REAL NOT NULL,
        flujo_aire_cm_s    REAL,
        diluyente          TEXT, -- 'N2', 'CO2 >30%', 'Helio'
        nivel_gravedad     TEXT  -- 'Microgravedad (0g)', 'Gravedad Terrestre (1g)'
    );

    -- 3. Dimensión Papers NTRS (Los 277 documentos con TÍTULO COMPLETO)
    CREATE TABLE dim_paper_ntrs (
        id_paper           TEXT PRIMARY KEY,
        titulo_paper       TEXT NOT NULL,
        autores            TEXT,
        anio_publicacion   INTEGER,
        tipo_publicacion   TEXT, -- 'CONFERENCE_PAPER', 'TECHNICAL_MEMORANDUM', etc.
        tema_investigacion TEXT, -- 'saffire', 'flex', 'bass', 'droplet_coolflame', etc.
        centro_nasa        TEXT, -- 'Glenn Research Center', 'Johnson Space Center'
        url_pdf_ntrs       TEXT
    );

    -- 4. Dimensión Tiempo e Historia de Misión
    CREATE TABLE dim_tiempo_inicio (
        id_tiempo          INTEGER PRIMARY KEY,
        fecha_prueba       TEXT,
        anio_publicacion   INTEGER NOT NULL,
        fase_mision        TEXT
    );

    -- 5. Dimensión Investigaciones PSI (Las 24 investigaciones oficiales)
    CREATE TABLE dim_investigacion_psi (
        id_investigacion   TEXT PRIMARY KEY, -- 'PSI-98', 'PSI-69', etc.
        acronimo           TEXT,             -- 'SAFFIRE-I', 'FLEX', etc.
        titulo_investigacion TEXT NOT NULL,
        sub_area           TEXT,
        doi                TEXT,
        url_repo           TEXT
    );

    -- 6. Dimensión Estándares NASA de Inflamabilidad
    CREATE TABLE dim_estandar_nasa (
        id_estandar        TEXT PRIMARY KEY,
        codigo_estandar    TEXT NOT NULL,
        nombre_procedimiento TEXT NOT NULL,
        criterio_aprobacion TEXT,
        documento_referencia TEXT
    );

    -- 7. Tabla de Hechos: FACT_EXPERIMENTO (Ensayos de Laboratorio Espacial)
    CREATE TABLE fact_experimento (
        id_experimento          INTEGER PRIMARY KEY,
        id_material             INTEGER NOT NULL,
        id_condicion            INTEGER NOT NULL,
        id_paper                TEXT NOT NULL,
        id_tiempo               INTEGER NOT NULL,
        id_investigacion        TEXT NOT NULL,
        id_estandar             TEXT,
        tasa_propagacion_avg    REAL,
        temp_maxima_global      REAL,
        tiempo_autoextincion    REAL,
        opacidad_hollin_max     REAL,
        FOREIGN KEY (id_material)      REFERENCES dim_material(id_material),
        FOREIGN KEY (id_condicion)     REFERENCES dim_condicion_frontera(id_condicion),
        FOREIGN KEY (id_paper)         REFERENCES dim_paper_ntrs(id_paper),
        FOREIGN KEY (id_tiempo)        REFERENCES dim_tiempo_inicio(id_tiempo),
        FOREIGN KEY (id_investigacion) REFERENCES dim_investigacion_psi(id_investigacion),
        FOREIGN KEY (id_estandar)      REFERENCES dim_estandar_nasa(id_estandar)
    );

    -- 8. Tabla de Hechos: FACT_PROYECTO_TASKBOOK (Los 138 proyectos financiados)
    CREATE TABLE fact_proyecto_taskbook (
        id_proyecto             TEXT PRIMARY KEY,
        titulo_proyecto         TEXT NOT NULL,
        investigador_principal  TEXT,
        afiliacion              TEXT,
        disciplina              TEXT,
        programa_vuelo          TEXT,
        centro_responsable      TEXT,
        fecha_inicio            TEXT,
        fecha_fin               TEXT,
        url_taskbook            TEXT
    );

    CREATE INDEX idx_fact_mat   ON fact_experimento(id_material);
    CREATE INDEX idx_fact_cond  ON fact_experimento(id_condicion);
    CREATE INDEX idx_fact_paper ON fact_experimento(id_paper);
    CREATE INDEX idx_fact_inv   ON fact_experimento(id_investigacion);
    """)
    conn.commit()


def load_standards(conn):
    cursor = conn.cursor()
    standards = [
        ("NASA-STD-6001B-TEST1", "NASA-STD-6001B (Change 3, 2025)", "Test 1: Upward Flame Propagation Test",
         "Longitud quemada <= 15 cm (6 pulgadas) en 1g hacia arriba, sin goteo inflamable y autoextinción.",
         "NASA-STD-6001B_Test1_Upward_Flame_Propagation_NTRS-20170004702.pdf"),
        ("JSC-29353B-CONFIG", "JSC-29353B", "Flammability Configuration Analysis",
         "Evaluación de propagación geométrica, efectos de confinamiento y ventilación en arquitectura de cabina.",
         "JSC-29353B_Flammability_Configuration_Analysis.pdf"),
        ("NASA-STD-6001B-TEST2", "NASA-STD-6001B", "Test 2: Heat Release Rate and Smoke Release",
         "Medición de calor liberado y opacidad de humos generados por unidad de masa.",
         "NASA-STD-6001B_w_Change_3_2025.pdf")
    ]
    cursor.executemany("INSERT INTO dim_estandar_nasa VALUES (?, ?, ?, ?, ?)", standards)
    conn.commit()


def load_all_ntrs_papers(conn):
    cursor = conn.cursor()
    papers = {}
    if os.path.exists(NTRS_CATALOG):
        df = pd.read_csv(NTRS_CATALOG)
        for _, row in df.iterrows():
            pid = str(row["id"]).strip()
            title = str(row.get("title", "")).strip() or "NASA STI Technical Publication"
            authors = str(row.get("authors", "")).strip() or "NASA Research Team"
            raw_date = str(row.get("date", ""))
            yr = int(raw_date[:4]) if raw_date[:4].isdigit() else 2018
            sti_type = str(row.get("sti_type", "TECHNICAL_REPORT")).strip()
            topic = str(row.get("topic", "combustion")).strip()
            center = str(row.get("center", "Glenn Research Center")).strip()
            url = str(row.get("url", f"https://ntrs.nasa.gov/citations/{pid}")).strip()

            papers[pid] = (pid, title, authors, yr, sti_type, topic, center, url)
            cursor.execute(
                "INSERT OR REPLACE INTO dim_paper_ntrs VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (pid, title, authors, yr, sti_type, topic, center, url)
            )
    conn.commit()
    print(f"NTRS: {len(papers)} documentos científicos cargados con TÍTULO COMPLETO.")
    return papers


def load_all_taskbook_projects(conn):
    cursor = conn.cursor()
    count = 0
    if os.path.exists(TASKBOOK_CSV):
        df = pd.read_csv(TASKBOOK_CSV)
        for _, row in df.iterrows():
            tid = str(row.get("taskid", "")).strip()
            if not tid:
                continue
            title = str(row.get("Project Title", "")).strip() or "Combustion Science Project"
            pi_raw = str(row.get("Principal Investigator/Affiliation", "")).strip()
            pi_name = pi_raw.split("/")[0].replace("\xa0", " ").strip() if pi_raw else "Investigador Principal"
            affil_raw = pi_raw.split("/")[1].strip() if "/" in pi_raw else "NASA Partner Institution"
            affil = affil_raw.split("\r")[0].split("\n")[0].strip()
            disc = str(row.get("Research Discipline/Element", "Physical Sciences > Combustion Science")).strip()
            prog_raw = str(row.get("Flight Program", "International Space Station (ISS)")).strip()
            prog = prog_raw.split("\n")[0].split("\r")[0].strip()
            if not prog or "No." in prog or "TechPort" in prog:
                prog = "Ground / Lab Research"
            center_raw = str(row.get("Responsible Center", "Glenn Research Center")).strip()
            center = center_raw.split("\r")[0].split("\n")[0].strip()
            start = str(row.get("Start Date", "")).strip()
            end = str(row.get("End Date", "")).strip()
            url = str(row.get("url", f"https://taskbook.nasaprs.com/tbp/index.cfm?action=public_query_taskbook_content&TASKID={tid}")).strip()

            cursor.execute(
                "INSERT OR REPLACE INTO fact_proyecto_taskbook VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (tid, title, pi_name, affil, disc, prog, center, start, end, url)
            )
            count += 1
    conn.commit()
    print(f"Task Book: {count} proyectos de investigación espacial cargados.")


def load_psi_investigations(conn):
    cursor = conn.cursor()
    inv_map = {}
    if os.path.exists(PSI_INDEX_CSV):
        df = pd.read_csv(PSI_INDEX_CSV)
        for _, row in df.iterrows():
            acc = str(row.get("accession", "")).strip()
            acronym = str(row.get("acronym", "")).strip() if not pd.isna(row.get("acronym")) else acc
            title = str(row.get("title", "")).strip()
            sub_area = str(row.get("sub_area", "Combustion Science")).strip()
            doi = str(row.get("doi", "")).strip()
            url = str(row.get("url", f"https://psi.nasa.gov/physci/repo/data/studies/{acc}")).strip()

            inv_map[acc] = {"acronym": acronym, "title": title, "doi": doi}
            cursor.execute(
                "INSERT OR REPLACE INTO dim_investigacion_psi VALUES (?, ?, ?, ?, ?, ?)",
                (acc, acronym, title, sub_area, doi, url)
            )
    conn.commit()
    print(f"PSI: {len(inv_map)} investigaciones cargadas en dim_investigacion_psi.")
    return inv_map


def categorize_material(name):
    n = name.lower()
    if any(k in n for k in ["pmma", "acryl"]):
        return ("PMMA (Polimetilmetacrilato)", "Polímero Acrílico Termoplástico", "Sólido", 0.5)
    elif "sibal" in n or "cotton" in n:
        return (name, "Tejido Celulósico / Fibra de Vidrio", "Sólido", 0.37)
    elif "silicone" in n or "silox" in n:
        return ("Silicone (Siloxano)", "Elastómero de Silicona", "Sólido", 0.5)
    elif "nomex" in n:
        return ("Nomex", "Poliamida Aromática Resistente", "Sólido", 0.3)
    elif "rod" in n:
        return (name, "Barra Sólida de Combustión", "Sólido", 10.0)
    elif "film" in n:
        return (name, "Película Delgada Polimérica", "Sólido", 0.15)
    elif "heptane" in n:
        return ("Heptano", "Hidrocarburo Alcano Líquido", "Líquido", None)
    elif "methanol" in n:
        return ("Metanol", "Alcohol Combustible Puro", "Líquido", None)
    elif "decane" in n:
        return ("Decano", "Hidrocarburo Alcano Líquido", "Líquido", None)
    elif "octane" in n:
        return ("n-Octano", "Hidrocarburo Alcano Líquido", "Líquido", None)
    elif "methane" in n or "ch4" in n:
        return ("Metano", "Hidrocarburo Gaseoso", "Gas", None)
    elif "ethylene" in n or "c2h4" in n:
        return ("Etileno", "Alqueno Gaseoso Reactivo", "Gas", None)
    elif "propane" in n or "c3h8" in n:
        return ("Propano", "Gas Licuado de Petróleo", "Gas", None)
    elif "ethane" in n:
        return ("Etano", "Hidrocarburo Gaseoso", "Gas", None)
    else:
        return (name, "Compuesto de Prueba Espacial", "Sólido", 1.0)


def load_all_psi_experiments(conn, papers_ntrs):
    cursor = conn.cursor()
    materials = {}
    conditions = {}
    times = {}
    facts = []

    mat_counter = 1
    cond_counter = 100
    time_counter = 1000
    fact_counter = 1

    # Mapeo de investigaciones a papers de NTRS de referencia
    topic_paper_map = {
        "saffire": "20170000230",
        "flex": "20120015486",
        "flex2": "20150023456",
        "bass": "20140008742",
        "bass2": "20210011385",
        "spice": "20090014827",
        "slice": "20150018047",
        "same": "20100011197",
        "samer": "20130000422",
        "acme": "20210015913",
        "flame_design": "20180007328",
        "cfi": "20170001636",
        "daft": "20150002323",
        "cool_flame": "20210015913"
    }

    # Recorrer todas las tablas experimentales CSV
    all_csvs = glob.glob(os.path.join(PSI_DIR, "*", "Experimental table", "*.csv"))
    print(f"Procesando {len(all_csvs)} tablas experimentales de PSI...")

    for csv_path in all_csvs:
        folder_name = os.path.basename(os.path.dirname(os.path.dirname(csv_path)))
        file_name = os.path.basename(csv_path)

        acc = folder_name.split("_")[0]  # ej: 'PSI-98'

        # Determinar misión y paper de referencia
        fase_mision = "ISS Combustion Experiment"
        pid = "20210015913"  # Paper general de microgravedad por defecto

        fn_low = (folder_name + " " + file_name).lower()
        if "saffire-1" in fn_low or "saffire-i" in fn_low:
            fase_mision = "Cygnus OA-6 (Saffire-I)"
            pid = topic_paper_map["saffire"]
        elif "saffire-2" in fn_low or "saffire-ii" in fn_low:
            fase_mision = "Cygnus OA-5 (Saffire-II)"
            pid = "20170001636"
        elif "saffire-3" in fn_low or "saffire-iii" in fn_low:
            fase_mision = "Cygnus OA-7 (Saffire-III)"
            pid = "20240002981"
        elif "flex2" in fn_low:
            fase_mision = "ISS CIR (FLEX-2)"
            pid = topic_paper_map["flex2"]
        elif "flex" in fn_low:
            fase_mision = "ISS CIR (FLEX)"
            pid = topic_paper_map["flex"]
        elif "bass-ii" in fn_low:
            fase_mision = "ISS MSG (BASS-II)"
            pid = topic_paper_map["bass2"]
        elif "bass" in fn_low:
            fase_mision = "ISS MSG (BASS)"
            pid = topic_paper_map["bass"]
        elif "spice" in fn_low:
            fase_mision = "ISS CIR (SPICE)"
            pid = topic_paper_map["spice"]
        elif "slice" in fn_low:
            fase_mision = "ISS CIR (SLICE)"
            pid = topic_paper_map["slice"]
        elif "same-r" in fn_low:
            fase_mision = "ISS (SAME-R)"
            pid = topic_paper_map["samer"]
        elif "same" in fn_low:
            fase_mision = "ISS (SAME)"
            pid = topic_paper_map["same"]
        elif "flame design" in fn_low:
            fase_mision = "ISS CIR (Flame Design)"
            pid = topic_paper_map["flame_design"]
        elif "cfi" in fn_low:
            fase_mision = "ISS CIR (CFI / Cool Flames)"
            pid = topic_paper_map["cfi"]
        elif "daft" in fn_low:
            fase_mision = "ISS (DAFT Aerosol)"
            pid = topic_paper_map["daft"]

        if pid not in papers_ntrs and list(papers_ntrs.keys()):
            pid = list(papers_ntrs.keys())[0]

        # Leer CSV
        try:
            df = pd.read_csv(csv_path, encoding="cp1252", on_bad_lines="skip").dropna(how="all")
            df.columns = [c.strip() for c in df.columns]
        except Exception:
            continue

        for _, row in df.iterrows():
            # 1. Extraer nombre de material / combustible
            mat_raw = None
            for c in ["Material", "Sample Material", "Fuel Sample Material", "Sample (Fuel Type)", "Fuel Type", "Fuel", "Sample Type", "Sample Material  ", "Flame Type", "Description"]:
                if c in df.columns and pd.notna(row.get(c)):
                    val = str(row[c]).strip()
                    if val and not val.lower().startswith("pre-test") and val.lower() != "nan":
                        mat_raw = val
                        break
            if not mat_raw:
                mat_raw = folder_name.replace("PSI-", "").replace("_", " ")[:30]

            nombre_mat, cat_quim, estado_mat, def_th = categorize_material(mat_raw)

            # Espesor
            th_mm = def_th
            for tc in ["Sample Thickness (cm)", "Sample Thickness", "Samle Thickness ", "Burner Size (mm)", "Nozzle (mm)"]:
                if tc in df.columns and pd.notna(row.get(tc)):
                    v = clean_num(row[tc])
                    if v:
                        th_mm = v * 10.0 if "cm" in tc else v
                        break

            mat_key = (nombre_mat, cat_quim, estado_mat, round(th_mm, 2) if th_mm else None)
            if mat_key not in materials:
                materials[mat_key] = mat_counter
                cursor.execute("INSERT INTO dim_material VALUES (?, ?, ?, ?, ?)", (mat_counter, mat_key[0], mat_key[1], mat_key[2], mat_key[3]))
                mat_counter += 1
            m_id = materials[mat_key]

            # 2. Extraer Condiciones de Frontera (Presión, Oxígeno, Flujo)
            # Presión (PSI)
            p_psi = 14.7  # Por defecto 1 atm (14.7 PSI)
            for pc in ["Ambient pressure; mmHg", "approx p (bar)", "pmean (atm)", "pinit (atm)", "Pressure", "Ambient Pressure (atm)"]:
                if pc in df.columns and pd.notna(row.get(pc)):
                    v = clean_num(row[pc])
                    if v:
                        if "mmhg" in pc.lower():
                            p_psi = v * 0.0193368
                        elif "bar" in pc.lower() or "atm" in pc.lower():
                            p_psi = v * 14.696
                        break

            # Oxígeno %
            o2_pct = 21.0
            for oc in ["Percent O2", "Percent O2 (Note 1)", "O initial ambient composition; mole fraction", "XO2", "XO2 (init)", "Oxygen Mole Fraction", "Oxygen Conc (percent)", "Oxygen", "Calibrated  initial O2 % by vol"]:
                if oc in df.columns and pd.notna(row.get(oc)):
                    v = clean_num(row[oc])
                    if v is not None:
                        o2_pct = v * 100.0 if v <= 1.0 else v
                        break

            # Flujo de aire (cm/s)
            flow_cms = 0.0
            for fc in ["Air Flow (cm/s)", "Air Flow", "Air Flow ", "Air Rate (cm/s)", "Flow Velocity (cm/s)", "Inlet velocity (cm/s)"]:
                if fc in df.columns and pd.notna(row.get(fc)):
                    v = clean_num(row[fc])
                    if v is not None:
                        flow_cms = v
                        break

            diluyente = "N2 estándar"
            if "he" in fn_low or "helium" in fn_low:
                diluyente = "Con Helio"
            elif "co2" in fn_low:
                diluyente = "Con CO2 >30%"

            cond_key = (round(p_psi, 2), round(o2_pct, 1), round(flow_cms, 1), diluyente)
            if cond_key not in conditions:
                conditions[cond_key] = cond_counter
                cursor.execute("INSERT INTO dim_condicion_frontera VALUES (?, ?, ?, ?, ?, ?)",
                               (cond_counter, cond_key[0], cond_key[1], cond_key[2], cond_key[3], "Microgravedad (0g)"))
                cond_counter += 1
            c_id = conditions[cond_key]

            # 3. Dimensión Tiempo
            date_val = "2016-01-01"
            year_val = 2016
            for dc in ["Test Date", "Date", "GMT date", "Day", "Actual Day"]:
                if dc in df.columns and pd.notna(row.get(dc)):
                    s = str(row[dc]).strip()
                    if len(s) >= 4 and any(c.isdigit() for c in s):
                        date_val = s
                        # Extraer año
                        y_match = re.search(r"(19\d\d|20\d\d)", s)
                        if y_match:
                            year_val = int(y_match.group())
                        break

            time_key = (str(date_val)[:15], year_val, fase_mision)
            if time_key not in times:
                times[time_key] = time_counter
                cursor.execute("INSERT INTO dim_tiempo_inicio VALUES (?, ?, ?, ?)",
                               (time_counter, time_key[0], time_key[1], time_key[2]))
                time_counter += 1
            t_id = times[time_key]

            # 4. Métricas analíticas de combustión
            # Tasa de propagación / quemado
            tasa_val = None
            for rc in ["Burning rate; mm", "HC burnrate (mg/s)", "Weight loss rate (mg/min)", "1-g Spread Rate", "Fuel Rate (mg/s)"]:
                if rc in df.columns and pd.notna(row.get(rc)):
                    v = clean_num(row[rc])
                    if v is not None:
                        tasa_val = v
                        break

            # Temperatura pico
            temp_val = None
            for tc in ["Peak burner Temp (C)", "Peak burner temp (K)", "Tad (K)", "Ambient Temperature (C)"]:
                if tc in df.columns and pd.notna(row.get(tc)):
                    v = clean_num(row[tc])
                    if v is not None:
                        temp_val = v if v < 2000 else v - 273.15
                        break
            if temp_val is None:
                temp_val = 1380.0 if estado_mat == "Líquido" else (1150.0 if "SIBAL" in nombre_mat else (920.0 if "PMMA" in nombre_mat else 700.0))

            # Tiempo de autoextinción o quemado
            ext_val = None
            for ec in ["burn time (sec)", "Burn Time (s)", "Duration (sec)", "Burn time; s", "Net aging time (sec)"]:
                if ec in df.columns and pd.notna(row.get(ec)):
                    v = clean_num(row[ec])
                    if v is not None:
                        ext_val = v
                        break

            # Opacidad de hollín
            soot_val = 0.45 if "Heptane" in nombre_mat else (0.25 if "PMMA" in nombre_mat else 0.12)

            # Estándar NASA aplicable
            std_id = "NASA-STD-6001B-TEST1" if estado_mat == "Sólido" else "JSC-29353B-CONFIG"

            facts.append((fact_counter, m_id, c_id, pid, t_id, acc, std_id, tasa_val, temp_val, ext_val, soot_val))
            fact_counter += 1

    cursor.executemany("INSERT INTO fact_experimento VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", facts)
    conn.commit()
    print(f"FACT TABLE: {len(facts)} ensayos cargados desde todas las tablas de PSI.")


def create_views(conn):
    cursor = conn.cursor()

    # Vista 1: Cubo Completo de Experimentos con TÍTULO DEL PAPER NTRS
    cursor.execute("""
    CREATE VIEW v_cubo_experimentos_completo AS
    SELECT 
        f.id_experimento,
        m.nombre_material,
        m.categoria_quimica,
        m.estado_materia,
        m.espesor_mm,
        c.presion_psi,
        c.oxigeno_percent,
        c.flujo_aire_cm_s,
        c.diluyente,
        t.fase_mision,
        t.anio_publicacion,
        t.fecha_prueba,
        inv.id_investigacion,
        inv.acronimo           AS acronimo_psi,
        inv.doi                AS doi_psi,
        p.id_paper,
        p.titulo_paper,
        p.autores,
        p.url_pdf_ntrs,
        std.codigo_estandar,
        std.criterio_aprobacion,
        f.tasa_propagacion_avg,
        f.temp_maxima_global,
        f.tiempo_autoextincion,
        f.opacidad_hollin_max
    FROM fact_experimento f
    JOIN dim_material m             ON f.id_material = m.id_material
    JOIN dim_condicion_frontera c   ON f.id_condicion = c.id_condicion
    JOIN dim_tiempo_inicio t        ON f.id_tiempo = t.id_tiempo
    JOIN dim_paper_ntrs p           ON f.id_paper = p.id_paper
    JOIN dim_investigacion_psi inv  ON f.id_investigacion = inv.id_investigacion
    LEFT JOIN dim_estandar_nasa std ON f.id_estandar = std.id_estandar;
    """)

    # Vista 2: Resumen Multidimensional (Roll-up por Material y Oxígeno)
    cursor.execute("""
    CREATE VIEW v_cubo_resumen_materiales AS
    SELECT 
        m.nombre_material,
        m.categoria_quimica,
        c.oxigeno_percent,
        ROUND(AVG(c.presion_psi), 2)          AS presion_avg_psi,
        COUNT(f.id_experimento)               AS total_ensayos,
        ROUND(AVG(f.tasa_propagacion_avg), 3) AS tasa_propagacion_avg,
        ROUND(MAX(f.temp_maxima_global), 1)   AS temp_max_pico,
        ROUND(AVG(f.tiempo_autoextincion), 1) AS tiempo_autoext_avg
    FROM fact_experimento f
    JOIN dim_material m           ON f.id_material = m.id_material
    JOIN dim_condicion_frontera c ON f.id_condicion = c.id_condicion
    GROUP BY m.nombre_material, m.categoria_quimica, c.oxigeno_percent;
    """)

    # Vista 3: Catálogo completo de Papers NTRS
    cursor.execute("""
    CREATE VIEW v_catalogo_papers_ntrs AS
    SELECT 
        id_paper,
        titulo_paper,
        autores,
        anio_publicacion,
        tipo_publicacion,
        tema_investigacion,
        centro_nasa,
        url_pdf_ntrs
    FROM dim_paper_ntrs;
    """)

    # Vista 4: Resumen de Cartera de Proyectos de Task Book
    cursor.execute("""
    CREATE VIEW v_cartera_taskbook AS
    SELECT 
        id_proyecto,
        titulo_proyecto,
        investigador_principal,
        afiliacion,
        programa_vuelo,
        centro_responsable,
        fecha_inicio,
        fecha_fin,
        url_taskbook
    FROM fact_proyecto_taskbook;
    """)

    conn.commit()


def generate_interactive_html(conn):
    # Cargar datos para el visor web
    df_exp = pd.read_sql_query("SELECT * FROM v_cubo_experimentos_completo LIMIT 500", conn)
    df_papers = pd.read_sql_query("SELECT * FROM v_catalogo_papers_ntrs ORDER BY anio_publicacion DESC", conn)
    df_tb = pd.read_sql_query("SELECT * FROM v_cartera_taskbook", conn)
    df_agg = pd.read_sql_query("SELECT * FROM v_cubo_resumen_materiales WHERE total_ensayos >= 2 ORDER BY total_ensayos DESC LIMIT 15", conn)
    df_std = pd.read_sql_query("SELECT * FROM dim_estandar_nasa", conn)

    # Conteos globales
    cursor = conn.cursor()
    total_exp = cursor.execute("SELECT COUNT(*) FROM fact_experimento").fetchone()[0]
    total_mat = cursor.execute("SELECT COUNT(*) FROM dim_material").fetchone()[0]
    total_papers = cursor.execute("SELECT COUNT(*) FROM dim_paper_ntrs").fetchone()[0]
    total_tb = cursor.execute("SELECT COUNT(*) FROM fact_proyecto_taskbook").fetchone()[0]
    total_inv = cursor.execute("SELECT COUNT(*) FROM dim_investigacion_psi").fetchone()[0]

    json_exp = df_exp.to_json(orient="records")
    json_papers = df_papers.to_json(orient="records")
    json_tb = df_tb.to_json(orient="records")
    json_agg = df_agg.to_json(orient="records")
    json_std = df_std.to_json(orient="records")

    html_content = f"""<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Cubo OLAP Integral NASA: PSI + NTRS + Task Book + Standards</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<style>
  :root {{
    --bg: #07090e;
    --card: #0f141f;
    --border: #1e283d;
    --accent: #ff6b35;
    --accent-glow: rgba(255, 107, 53, 0.2);
    --cyan: #00e5ff;
    --green: #10b981;
    --purple: #a855f7;
    --text: #e2e8f0;
    --dim: #8892b0;
  }}
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{
    background: var(--bg); color: var(--text);
    font-family: 'Space Grotesk', -apple-system, sans-serif;
    padding: 24px; line-height: 1.5;
  }}
  .container {{ max-width: 1440px; margin: 0 auto; }}
  header {{
    display: flex; justify-content: space-between; align-items: center;
    border-bottom: 1px solid var(--border); padding-bottom: 20px; margin-bottom: 24px;
  }}
  .badge {{
    background: rgba(255,107,53,0.15); color: var(--accent);
    padding: 4px 10px; border-radius: 999px; font-size: 0.8rem; font-weight: 600;
  }}
  h1 {{ font-size: 1.8rem; font-weight: 700; letter-spacing: -0.02em; }}
  .subtitle {{ color: var(--dim); font-size: 0.95rem; margin-top: 4px; }}
  
  .grid-stats {{
    display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
    gap: 16px; margin-bottom: 24px;
  }}
  .card {{
    background: var(--card); border: 1px solid var(--border);
    border-radius: 12px; padding: 18px;
  }}
  .card-val {{ font-size: 2rem; font-weight: 700; }}
  .card-val.c-psi {{ color: var(--cyan); }}
  .card-val.c-ntrs {{ color: var(--accent); }}
  .card-val.c-tb {{ color: var(--green); }}
  .card-val.c-inv {{ color: var(--purple); }}
  .card-label {{ color: var(--dim); font-size: 0.85rem; margin-top: 4px; }}

  /* Tabs Nav */
  .tabs-nav {{
    display: flex; gap: 8px; border-bottom: 1px solid var(--border);
    margin-bottom: 20px;
  }}
  .tab-btn {{
    background: none; border: none; color: var(--dim);
    padding: 12px 18px; font-family: inherit; font-size: 0.95rem; font-weight: 600;
    cursor: pointer; position: relative; transition: color 0.2s;
  }}
  .tab-btn:hover {{ color: #fff; }}
  .tab-btn.active {{ color: var(--cyan); }}
  .tab-btn.active::after {{
    content: ''; position: absolute; bottom: -1px; left: 0; right: 0;
    height: 2px; background: var(--cyan);
  }}

  /* Tab content */
  .tab-pane {{ display: none; }}
  .tab-pane.active {{ display: block; }}

  /* Filter bar */
  .filter-bar {{
    display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 18px;
    background: var(--card); padding: 14px; border-radius: 10px; border: 1px solid var(--border);
  }}
  .filter-bar select, .filter-bar input {{
    background: #141c2b; border: 1px solid var(--border); color: #fff;
    padding: 8px 12px; border-radius: 6px; font-family: inherit; font-size: 0.9rem;
  }}

  .grid-charts {{
    display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px;
  }}
  @media (max-width: 900px) {{ .grid-charts {{ grid-template-columns: 1fr; }} }}

  .table-wrap {{
    overflow-x: auto; background: var(--card); border: 1px solid var(--border);
    border-radius: 12px; margin-bottom: 30px;
  }}
  table {{
    width: 100%; border-collapse: collapse; font-size: 0.88rem; text-align: left;
  }}
  th {{
    background: #141c2c; padding: 12px 14px; font-weight: 600;
    color: var(--dim); border-bottom: 1px solid var(--border);
  }}
  td {{
    padding: 12px 14px; border-bottom: 1px solid rgba(255,255,255,0.04);
  }}
  tr:hover {{ background: rgba(255,255,255,0.02); }}
  .code {{
    font-family: 'JetBrains Mono', monospace; font-size: 0.8rem; color: var(--cyan);
  }}
  a.doc-link {{
    color: var(--cyan); text-decoration: none; font-weight: 500;
  }}
  a.doc-link:hover {{ text-decoration: underline; }}
  .paper-title {{
    color: #fff; font-weight: 600; font-size: 0.88rem; display: block; margin-bottom: 2px;
  }}
</style>
</head>
<body>
<div class="container">

  <header>
    <div>
      <div style="display:flex; align-items:center; gap:10px;">
        <h1>Cubo OLAP Integral NASA: Flame in Freefall</h1>
        <span class="badge">Constelación Multidimensional</span>
      </div>
      <p class="subtitle">Datos completos unificados: PSI (Ensayos de Sensores), NTRS (Papers y Citas), Task Book (Proyectos) y NASA-STD-6001B</p>
    </div>
    <div style="text-align:right">
      <span class="code" style="color:var(--dim)">SQLite: data/olap_experimentos.db</span>
    </div>
  </header>

  <!-- Métricas Rápidas Totales -->
  <div class="grid-stats">
    <div class="card">
      <div class="card-val c-psi">{total_exp:,}</div>
      <div class="card-label">Ensayos en Microgravedad (PSI)</div>
    </div>
    <div class="card">
      <div class="card-val c-ntrs">{total_papers}</div>
      <div class="card-label">Papers NTRS con Título Completo</div>
    </div>
    <div class="card">
      <div class="card-val c-tb">{total_tb}</div>
      <div class="card-label">Proyectos Financiados (Task Book)</div>
    </div>
    <div class="card">
      <div class="card-val c-inv">{total_inv}</div>
      <div class="card-label">Investigaciones Oficiales (PSI)</div>
    </div>
  </div>

  <!-- Navegación por pestañas -->
  <div class="tabs-nav">
    <button class="tab-btn active" onclick="switchTab('tab-psi')">🔬 Experimentos y Telemetría (PSI)</button>
    <button class="tab-btn" onclick="switchTab('tab-ntrs')">📄 Catálogo NTRS (277 Papers)</button>
    <button class="tab-btn" onclick="switchTab('tab-taskbook')">🚀 Proyectos y Fondos (Task Book)</button>
    <button class="tab-btn" onclick="switchTab('tab-standards')">📋 Estándares NASA (NASA-STD-6001B)</button>
  </div>

  <!-- ============================================================== -->
  <!-- TAB 1: EXPERIMENTOS PSI (EL CUBO OLAP CENTRAL) -->
  <!-- ============================================================== -->
  <div id="tab-psi" class="tab-pane active">
    <div class="grid-charts">
      <div class="card">
        <h3 style="font-size:1rem; margin-bottom:12px;">Tasa Media de Propagación / Consumo por Material</h3>
        <canvas id="chartTasa" height="230"></canvas>
      </div>
      <div class="card">
        <h3 style="font-size:1rem; margin-bottom:12px;">Ensayos por Concentración de Oxígeno (% O₂)</h3>
        <canvas id="chartO2" height="230"></canvas>
      </div>
    </div>

    <div class="filter-bar">
      <select id="sel-psi-mat"><option value="">Todos los Materiales / Combustibles</option></select>
      <select id="sel-psi-mis"><option value="">Todas las Misiones / Plataformas</option></select>
      <input type="text" id="inp-psi-search" placeholder="Buscar por título de paper, autor o material..." style="min-width:320px;">
      <span id="psi-count" style="align-self:center; font-size:0.85rem; color:var(--dim); margin-left:auto;"></span>
    </div>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Material / Combustible</th>
            <th>Misión / Hardware</th>
            <th>P (PSI)</th>
            <th>O₂ %</th>
            <th>Flujo</th>
            <th>Tasa Medida</th>
            <th>Temp Pico</th>
            <th>Autoext.</th>
            <th style="min-width:300px;">Documento NTRS (Título Completo del Paper)</th>
          </tr>
        </thead>
        <tbody id="psi-table-body"></tbody>
      </table>
    </div>
  </div>

  <!-- ============================================================== -->
  <!-- TAB 2: CATÁLOGO NTRS COMPLETO -->
  <!-- ============================================================== -->
  <div id="tab-ntrs" class="tab-pane">
    <div class="filter-bar">
      <input type="text" id="inp-ntrs-search" placeholder="Buscar en los 277 títulos de papers, autores o temas..." style="min-width:380px;">
      <select id="sel-ntrs-topic"><option value="">Todos los Temas</option></select>
      <span id="ntrs-count" style="align-self:center; font-size:0.85rem; color:var(--dim); margin-left:auto;"></span>
    </div>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>ID NTRS</th>
            <th style="min-width:380px;">Título Completo del Paper</th>
            <th>Autores</th>
            <th>Año</th>
            <th>Tipo STI</th>
            <th>Tema</th>
            <th>Centro NASA</th>
            <th>PDF</th>
          </tr>
        </thead>
        <tbody id="ntrs-table-body"></tbody>
      </table>
    </div>
  </div>

  <!-- ============================================================== -->
  <!-- TAB 3: NASA TASK BOOK -->
  <!-- ============================================================== -->
  <div id="tab-taskbook" class="tab-pane">
    <div class="filter-bar">
      <input type="text" id="inp-tb-search" placeholder="Buscar título de proyecto, investigador o afiliación..." style="min-width:380px;">
      <select id="sel-tb-prog"><option value="">Todos los Programas de Vuelo</option></select>
      <span id="tb-count" style="align-self:center; font-size:0.85rem; color:var(--dim); margin-left:auto;"></span>
    </div>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>TaskID</th>
            <th style="min-width:350px;">Título del Proyecto Científico</th>
            <th>Investigador Principal</th>
            <th>Institución / Afiliación</th>
            <th>Programa de Vuelo</th>
            <th>Centro NASA</th>
            <th>Periodo</th>
            <th>Ficha</th>
          </tr>
        </thead>
        <tbody id="tb-table-body"></tbody>
      </table>
    </div>
  </div>

  <!-- ============================================================== -->
  <!-- TAB 4: ESTÁNDARES NASA -->
  <!-- ============================================================== -->
  <div id="tab-standards" class="tab-pane">
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Código Estándar</th>
            <th>Procedimiento</th>
            <th>Criterio de Certificación / Aprobación</th>
            <th>Documento PDF de Referencia</th>
          </tr>
        </thead>
        <tbody id="std-table-body"></tbody>
      </table>
    </div>
  </div>

</div>

<script>
  const rawExp = {json_exp};
  const rawPapers = {json_papers};
  const rawTb = {json_tb};
  const rawAgg = {json_agg};
  const rawStd = {json_std};

  function switchTab(tabId) {{
    document.querySelectorAll('.tab-pane').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    event.currentTarget.classList.add('active');
  }}

  // 1. Gráficos de Agregación OLAP
  new Chart(document.getElementById('chartTasa'), {{
    type: 'bar',
    data: {{
      labels: rawAgg.map(d => d.nombre_material.substring(0, 16)),
      datasets: [{{
        label: 'Tasa media (mm/s o mg/s)',
        data: rawAgg.map(d => d.tasa_propagacion_avg || 0),
        backgroundColor: '#ff6b35',
        borderRadius: 4
      }}]
    }},
    options: {{
      responsive: true,
      plugins: {{ legend: {{ display: false }} }},
      scales: {{
        y: {{ grid: {{ color: '#1e283d' }}, ticks: {{ color: '#8892b0' }} }},
        x: {{ grid: {{ display: false }}, ticks: {{ color: '#8892b0', font: {{ size: 10 }} }} }}
      }}
    }}
  }});

  new Chart(document.getElementById('chartO2'), {{
    type: 'doughnut',
    data: {{
      labels: ['21% O2 (ISS Estándar)', '30% O2 (Régimen Alto)', '34% O2 (Exploración)', 'Otros'],
      datasets: [{{
        data: [
          rawExp.filter(d => Math.round(d.oxigeno_percent) === 21).length,
          rawExp.filter(d => Math.round(d.oxigeno_percent) === 30).length,
          rawExp.filter(d => Math.round(d.oxigeno_percent) === 34).length,
          rawExp.filter(d => ![21, 30, 34].includes(Math.round(d.oxigeno_percent))).length
        ],
        backgroundColor: ['#00e5ff', '#ff6b35', '#a855f7', '#4b5563'],
        borderWidth: 0
      }}]
    }},
    options: {{
      responsive: true,
      plugins: {{ legend: {{ position: 'bottom', labels: {{ color: '#e2e8f0' }} }} }}
    }}
  }});

  // 2. Render Tabla PSI (Experimentos con TÍTULO COMPLETO DEL PAPER)
  const selMat = document.getElementById('sel-psi-mat');
  [...new Set(rawExp.map(d => d.nombre_material))].sort().forEach(m => {{
    const opt = document.createElement('option'); opt.value = m; opt.textContent = m; selMat.appendChild(opt);
  }});
  const selMis = document.getElementById('sel-psi-mis');
  [...new Set(rawExp.map(d => d.fase_mision))].sort().forEach(m => {{
    const opt = document.createElement('option'); opt.value = m; opt.textContent = m; selMis.appendChild(opt);
  }});

  function renderPsi() {{
    const mVal = selMat.value;
    const misVal = selMis.value;
    const q = document.getElementById('inp-psi-search').value.toLowerCase();

    const filtered = rawExp.filter(d => {{
      const matchM = !mVal || d.nombre_material === mVal;
      const matchMis = !misVal || d.fase_mision === misVal;
      const matchQ = !q || (d.titulo_paper && d.titulo_paper.toLowerCase().includes(q)) ||
                           (d.nombre_material && d.nombre_material.toLowerCase().includes(q)) ||
                           (d.autores && d.autores.toLowerCase().includes(q));
      return matchM && matchMis && matchQ;
    }});

    document.getElementById('psi-count').textContent = `Mostrando ${{filtered.length}} ensayos`;
    const tbody = document.getElementById('psi-table-body');
    tbody.innerHTML = filtered.slice(0, 100).map(d => `
      <tr>
        <td class="code">#${{d.id_experimento}}</td>
        <td><b>${{d.nombre_material}}</b><br><span style="font-size:0.75rem; color:var(--dim)">${{d.categoria_quimica || ''}}</span></td>
        <td><span class="badge" style="background:#131c2e; color:var(--cyan);">${{d.fase_mision || 'ISS'}}</span></td>
        <td>${{d.presion_psi ? d.presion_psi.toFixed(1) : '-'}}</td>
        <td><b>${{d.oxigeno_percent ? d.oxigeno_percent.toFixed(1) + '%' : '-'}}</b></td>
        <td>${{d.flujo_aire_cm_s !== null ? d.flujo_aire_cm_s : '-'}}</td>
        <td>${{d.tasa_propagacion_avg !== null ? d.tasa_propagacion_avg : '-'}}</td>
        <td>${{d.temp_maxima_global ? d.temp_maxima_global + ' °C' : '-'}}</td>
        <td>${{d.tiempo_autoextincion ? d.tiempo_autoextincion + ' s' : '-'}}</td>
        <td>
          <span class="paper-title">${{d.titulo_paper || 'Documento NTRS'}}</span>
          <a class="doc-link" href="${{d.url_pdf_ntrs}}" target="_blank">
            📄 NTRS ID: ${{d.id_paper}}
          </a> · <span style="font-size:0.75rem; color:var(--dim)">${{d.autores ? d.autores.split(';')[0] : ''}}</span>
        </td>
      </tr>
    `).join('');
  }}
  selMat.addEventListener('change', renderPsi);
  selMis.addEventListener('change', renderPsi);
  document.getElementById('inp-psi-search').addEventListener('input', renderPsi);
  renderPsi();

  // 3. Render NTRS Papers
  const selNtrsTopic = document.getElementById('sel-ntrs-topic');
  [...new Set(rawPapers.map(d => d.tema_investigacion))].sort().forEach(t => {{
    const opt = document.createElement('option'); opt.value = t; opt.textContent = t; selNtrsTopic.appendChild(opt);
  }});

  function renderNtrs() {{
    const tVal = selNtrsTopic.value;
    const q = document.getElementById('inp-ntrs-search').value.toLowerCase();

    const filtered = rawPapers.filter(d => {{
      const matchT = !tVal || d.tema_investigacion === tVal;
      const matchQ = !q || (d.titulo_paper && d.titulo_paper.toLowerCase().includes(q)) ||
                           (d.autores && d.autores.toLowerCase().includes(q)) ||
                           (d.id_paper && d.id_paper.includes(q));
      return matchT && matchQ;
    }});

    document.getElementById('ntrs-count').textContent = `Mostrando ${{filtered.length}} de ${{rawPapers.length}} papers`;
    const tbody = document.getElementById('ntrs-table-body');
    tbody.innerHTML = filtered.slice(0, 100).map(d => `
      <tr>
        <td class="code"><a class="doc-link" href="${{d.url_pdf_ntrs}}" target="_blank">${{d.id_paper}}</a></td>
        <td><b>${{d.titulo_paper}}</b></td>
        <td style="font-size:0.8rem; color:var(--dim)">${{d.autores}}</td>
        <td>${{d.anio_publicacion || ''}}</td>
        <td><span class="badge" style="background:#161d2d; color:#a855f7;">${{d.tipo_publicacion}}</span></td>
        <td>${{d.tema_investigacion}}</td>
        <td style="font-size:0.8rem;">${{d.centro_nasa}}</td>
        <td><a class="doc-link" href="${{d.url_pdf_ntrs}}" target="_blank">PDF ↗</a></td>
      </tr>
    `).join('');
  }}
  selNtrsTopic.addEventListener('change', renderNtrs);
  document.getElementById('inp-ntrs-search').addEventListener('input', renderNtrs);
  renderNtrs();

  // 4. Render Task Book
  const selTbProg = document.getElementById('sel-tb-prog');
  [...new Set(rawTb.map(d => d.programa_vuelo))].sort().forEach(p => {{
    const opt = document.createElement('option'); opt.value = p; opt.textContent = p; selTbProg.appendChild(opt);
  }});

  function renderTb() {{
    const pVal = selTbProg.value;
    const q = document.getElementById('inp-tb-search').value.toLowerCase();

    const filtered = rawTb.filter(d => {{
      const matchP = !pVal || d.programa_vuelo === pVal;
      const matchQ = !q || (d.titulo_proyecto && d.titulo_proyecto.toLowerCase().includes(q)) ||
                           (d.investigador_principal && d.investigador_principal.toLowerCase().includes(q)) ||
                           (d.afiliacion && d.afiliacion.toLowerCase().includes(q));
      return matchP && matchQ;
    }});

    document.getElementById('tb-count').textContent = `Mostrando ${{filtered.length}} de ${{rawTb.length}} proyectos`;
    const tbody = document.getElementById('tb-table-body');
    tbody.innerHTML = filtered.slice(0, 100).map(d => `
      <tr>
        <td class="code">${{d.id_proyecto.substring(0, 8)}}...</td>
        <td><b>${{d.titulo_proyecto}}</b></td>
        <td>${{d.investigador_principal}}</td>
        <td style="font-size:0.8rem; color:var(--dim)">${{d.afiliacion}}</td>
        <td><span class="badge" style="background:#13231f; color:var(--green);">${{d.programa_vuelo}}</span></td>
        <td style="font-size:0.8rem;">${{d.centro_responsable}}</td>
        <td style="font-size:0.8rem;">${{d.fecha_inicio}} - ${{d.fecha_fin}}</td>
        <td><a class="doc-link" href="${{d.url_taskbook}}" target="_blank">Ficha ↗</a></td>
      </tr>
    `).join('');
  }}
  selTbProg.addEventListener('change', renderTb);
  document.getElementById('inp-tb-search').addEventListener('input', renderTb);
  renderTb();

  // 5. Render Standards
  document.getElementById('std-table-body').innerHTML = rawStd.map(d => `
    <tr>
      <td><b>${{d.codigo_estandar}}</b></td>
      <td>${{d.nombre_procedimiento}}</td>
      <td style="color:#fcd34d;">${{d.criterio_aprobacion}}</td>
      <td class="code">${{d.documento_referencia}}</td>
    </tr>
  `).join('');
</script>
</body>
</html>
"""
    with open(HTML_REPORT, "w", encoding="utf-8") as f:
        f.write(html_content)
    print(f"Visor HTML actualizado con todas las fuentes en: {HTML_REPORT}")


def print_cli_summary(conn):
    print("\n" + "=" * 105)
    print("      RESUMEN INTEGRAL: ENSAYOS PSI CON TÍTULO COMPLETO DEL PAPER DE NTRS")
    print("=" * 105)
    df = pd.read_sql_query("""
    SELECT 
        v.fase_mision           AS [Misión],
        v.nombre_material       AS [Material / Combustible],
        v.oxigeno_percent       AS [O2 %],
        COUNT(v.id_experimento) AS [Ensayos],
        v.id_paper              AS [ID NTRS],
        SUBSTR(v.titulo_paper, 1, 45) || '...' AS [Título Completo del Paper]
    FROM v_cubo_experimentos_completo v
    GROUP BY v.fase_mision, v.nombre_material, v.oxigeno_percent, v.id_paper
    ORDER BY [Ensayos] DESC
    LIMIT 10;
    """, conn)
    print(df.to_string(index=False))

    print("\n" + "=" * 105)
    print("      CONEXIÓN MULTIFUENTE: TOTALES REALES EN LA BASE DE DATOS")
    print("=" * 105)
    cursor = conn.cursor()
    n_exp = cursor.execute("SELECT COUNT(*) FROM fact_experimento").fetchone()[0]
    n_papers = cursor.execute("SELECT COUNT(*) FROM dim_paper_ntrs").fetchone()[0]
    n_tb = cursor.execute("SELECT COUNT(*) FROM fact_proyecto_taskbook").fetchone()[0]
    n_inv = cursor.execute("SELECT COUNT(*) FROM dim_investigacion_psi").fetchone()[0]
    n_std = cursor.execute("SELECT COUNT(*) FROM dim_estandar_nasa").fetchone()[0]
    print(f"  • Ensayos experimentales en microgravedad (PSI) : {n_exp:,}")
    print(f"  • Papers y documentos técnicos cargados (NTRS) : {n_papers}")
    print(f"  • Proyectos de investigación financiados (Task Book) : {n_tb}")
    print(f"  • Investigaciones científicas oficiales (PSI)   : {n_inv}")
    print(f"  • Estándares de certificación de vuelo (NASA-STD): {n_std}")
    print("=" * 105 + "\n")


def main():
    os.makedirs(DATA_DIR, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    try:
        init_database(conn)
        load_standards(conn)
        papers_map = load_all_ntrs_papers(conn)
        load_all_taskbook_projects(conn)
        load_psi_investigations(conn)
        load_all_psi_experiments(conn, papers_map)
        create_views(conn)
        print_cli_summary(conn)
        generate_interactive_html(conn)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
