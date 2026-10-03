# Flame in Freefall — NASA Space Apps 2026 (Reto #08)

Datos para el reto *"Flame in Freefall: AI-Powered Fire Safety Insights from Microgravity Combustion Data"*.
Hackathon: 14–15 nov 2026. Statement completo y datasets oficiales: 28 oct 2026.

## Estructura

```
data/
  ntrs/          Corpus de papers y reportes de NTRS (PDF + texto completo .txt) por tema
                 catalog.csv / catalog.jsonl → id, título, autores, fecha, URL (la cita de cada documento)
  psi/           NASA Physical Sciences Informatics, 24 investigaciones de Combustion Science
                 psi_index.csv → resumen por investigación (DOI, licencia, tamaño total vs. bajado)
                 <PSI-xx_ACRÓNIMO>/investigation.json   metadatos completos (objetivos, hipótesis, publicaciones)
                 <PSI-xx_ACRÓNIMO>/files_manifest.csv   TODOS los archivos de la investigación, bajados o no
                 <PSI-xx_ACRÓNIMO>/Experimental table/  matriz de ensayos (condiciones de cada prueba) ← empezar aquí
  taskbook/      NASA Task Book: 138 proyectos de Combustion Science (descripción, avances, bibliografía)
  standards/     NASA-STD-6001B (Change 3, 2025), JSC-29353B, paper sobre el Test 1
  mechanisms/    Mecanismos cinéticos para Cantera: gri30.yaml (GRI-Mech 3.0) y sandiego20161214.yaml
scripts/         Descargadores (se pueden re-ejecutar; no vuelven a bajar lo que ya existe)
app/             App web del dashboard (Vite). Ver app/README.md
                 Levantar: cd app && npm install && npm run dev → http://localhost:5173
                 Datos: scripts/build_dashboard_data.py → app/public/data/dashboard.json
GUIA_PRESENTACION.md   Guion para presentar el prototipo al equipo
.venv/           Entorno Python con cantera, pandas, requests
```

## Totales (27 sep 2026)

| Fuente | Contenido | Tamaño |
|---|---|---|
| PSI | 24 investigaciones, ~21 900 archivos, 20 tablas experimentales | 4.2 GB |
| NTRS | 277 documentos (PDF + texto completo) | 818 MB |
| Task Book | 138 proyectos | 4 MB |
| Estándares + mecanismos | 3 PDF + 2 mecanismos Cantera | 4 MB |

## Qué se bajó y qué no

- **PSI** pesa ~13.5 TB en total, casi todo video (.mp4/.ts) e imágenes crudas. Se bajaron metadatos,
  tablas experimentales, documentos (≤40 MB) y archivos tabulares de datos reducidos (≤2 MB en *Raw Data*).
  Todo lo demás está listado en cada `files_manifest.csv` con su `s3_key` por si hace falta algo puntual
  (p. ej. un video de FLEX para visión por computadora).
- Los archivos públicos de PSI tienen licencia **CC0** y se descargan sin cuenta.
- **Archivos rotos en PSI**: ~2 600 archivos "legacy" dan 404 en el propio servidor de NASA
  (`data/psi/_errors.log`), casi todos de FLEX-2. `scripts/recover_psi_from_zips.py` recuperó 978
  extrayendo el `.txt` de dentro del `.zip` de cada prueba con lecturas parciales (sin bajar las imágenes).
  Los ~1 600 restantes no tienen respaldo en el servidor: sobre todo `*_Settings.txt` y `*_Readings.txt`
  de FLEX-2 y los *proof sheets* PDF de BASS-II.
- **SLICE (PSI-106)**: se omitieron ~23 000 archivos `.dat` (matrices de imagen, ~7 GB).
- **data.nasa.gov / science.data.nasa.gov**: no tienen datasets de combustión propios; science.data.nasa.gov
  apunta a los mismos registros de PSI (DOIs `10.60555/...`).
- **SoFIE / MIST / Confined Combustion**: todavía no tienen investigación publicada en PSI; su información
  está en `data/ntrs/sofie/` y en Task Book.
- **MAPTIS** (base de flamabilidad de materiales) es de acceso restringido: fuera del plan.

## Uso

```bash
.venv/Scripts/python scripts/download_ntrs.py --per-query 40
.venv/Scripts/python scripts/download_psi.py --doc-mb 40 --raw-mb 2
.venv/Scripts/python scripts/download_taskbook.py
.venv/Scripts/python scripts/recover_psi_from_zips.py
```

Cantera (prueba rápida de que todo funciona):

```python
import cantera as ct
gas = ct.Solution("data/mechanisms/gri30.yaml")
gas.TPX = 300, 101325, "CH4:1, O2:2, N2:7.52"
flame = ct.FreeFlame(gas, width=0.03)
flame.solve(loglevel=0, auto=True)
print(flame.velocity[0])   # ≈ 0.385 m/s
```

Nota: los mecanismos incluidos son para gases ligeros (metano, etileno, propano). FLEX usó
heptano, decano y metanol; para esos combustibles hace falta un mecanismo específico
(p. ej. el submecanismo de heptano de San Diego).
