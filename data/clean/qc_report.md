# Reporte de calidad — limpieza de tablas PSI

Generado por `scripts/clean_psi.py`.

## Decisiones abiertas

Interpretaciones que no se resolvieron: los datos quedan marcados y la limpieza continúa. Solo importan si esas columnas se usan para entrenar o se muestran como dato firme.

| Tema | Marca | Situación |
|---|---|---|
| Espesor del SIBAL en SAFFIRE | `thickness_mm:inconsistente_entre_campanas` | SAFFIRE-I y III dicen 0.37 y 0.33 **cm**; SAFFIRE-II dice `037 mm` (0.37 **mm**). Una de las dos unidades está mal (10x). Se conservan ambos valores. Verificar en los papers de Saffire antes de usar el espesor. |
| Material inferido en BASS / BASS-II | `material:inferido` | Descripciones como `2 cm sphere` o `1/4" black rod` no dicen el material; se asumió PMMA porque es el único material de esas geometrías en ambas campañas. Confirmar con la documentación de BASS. |
| Diluyente de los combustibles de SPICE | `x_fuel:diluyente_no_especificado` | `75% Propylene` y `50% Propylene` no dicen con qué se diluyó (¿N2? ¿propano?). Se guarda la fracción pero `fuel` queda como propylene. Revisar el paper de SPICE si se usa SPICE para entrenar. |

## Filas por campaña

| Campaña | Familia | Tipo de tabla | Filas | Con marcas | Excluidas |
|---|---|---|---:|---:|---:|
| DAFT (PSI-47) | aerosol | condiciones | 2 | 0 | 0 |
| SAME (PSI-102) | aerosol | ensayos | 8 | 4 | 0 |
| SAME-R (PSI-101) | aerosol | ensayos | 109 | 2 | 0 |
| CFI (PSI-39) | droplet | condiciones | 87 | 20 | 8 |
| FLEX (PSI-69) | droplet | ensayos | 274 | 35 | 0 |
| ACME CFI-G (PSI-159) | gas_flame | ensayos | 333 | 13 | 0 |
| ACME Flame Design (PSI-10) | gas_flame | condiciones | 327 | 71 | 0 |
| SPICE (PSI-107) | gas_flame | ensayos | 469 | 300 | 0 |
| ACME BRE (PSI-20) | session | bitacora | 18 | 2 | 0 |
| ACME CLD Flame (PSI-21) | session | bitacora | 32 | 26 | 0 |
| ACME E-FIELD (PSI-22) | session | bitacora | 20 | 1 | 0 |
| ACME s-Flame (PSI-23) | session | bitacora | 18 | 7 | 0 |
| SLICE (PSI-106) | session | bitacora | 12 | 0 | 0 |
| BASS (PSI-26) | solid | condiciones | 121 | 43 | 0 |
| BASS-II (PSI-25) | solid | ensayos | 129 | 90 | 0 |
| SAFFIRE-I (PSI-98) | solid | ensayos | 2 | 2 | 0 |
| SAFFIRE-II (PSI-99) | solid | ensayos | 9 | 9 | 0 |
| SAFFIRE-III (PSI-100) | solid | ensayos | 2 | 2 | 0 |
| FLEX-2 (PSI-68) | — | matriz_de_diseno | 0 | 0 | 0 |
| PSI-115 (PSI-115) | — | sin_tabla | 0 | 0 | 0 |
| PSI-117 (PSI-117) | — | sin_tabla | 0 | 0 | 0 |
| PSI-142 (PSI-142) | — | indice_de_figuras | 0 | 0 | 0 |
| PSI-60 (PSI-60) | — | sin_tabla | 0 | 0 | 0 |
| PSI-62 (PSI-62) | — | sin_tabla | 0 | 0 | 0 |

## droplets.csv (361 filas)

Marcas más frecuentes:

- `d_ext_mm:falta_con_extincion` × 27
- `test_id:id_duplicado` × 18
- `x_o2:fracciones_no_suman_1` × 10
- `pressure_atm:cero` × 1
- `d_ext_mm:mayor_que_d0` × 1

Columnas con más datos faltantes:

- `fiber_supported`: 78%
- `time_local`: 76%
- `fuel_blend`: 76%
- `d_ext_mm`: 45%
- `burning_rate_mm2_s`: 29%
- `d0_mm`: 27%
- `ignited`: 26%
- `burn_time_s`: 26%
- `time_gmt`: 24%
- `extinguished`: 24%
- `end_mode`: 24%
- `pressure_atm`: 0%

## gas_flames.csv (1129 filas)

Marcas más frecuentes:

- `x_fuel:diluyente_no_especificado` × 246
- `n2_rate_mg_s:rampa` × 69
- `total_rate_mg_s:rampa` × 69
- `z_st:rampa` × 69
- `t_ad_K:rampa` × 69
- `duration_s:separador_corregido` × 63
- `time_gmt:separador_corregido` × 61
- `x_fuel:rampa` × 60
- `fuel_rate_mg_s:rampa` × 60
- `fuel_rate_mg_s:tomado_de_hc_rate` × 12
- `time_gmt:perdida_de_senal` × 12
- `burn_time_s:atipico` × 10
- `duration_s:perdida_de_senal` × 10
- `x_o2:rampa` × 9
- `air_velocity_cm_s:fuera_de_rango` × 8

Columnas con más datos faltantes:

- `cool_flame`: 99%
- `comments`: 93%
- `flame_color`: 89%
- `hc_fuel_rate_mg_s`: 78%
- `n2_rate_mg_s`: 77%
- `total_rate_mg_s`: 77%
- `o2_rate_mg_s`: 76%
- `extinguished`: 76%
- `end_mode`: 76%
- `x_fuel_final`: 76%
- `peak_burner_T_K`: 75%
- `ramped`: 71%

## solids.csv (263 filas)

Marcas más frecuentes:

- `material:inferido` × 87
- `geometry:inferida_del_espesor` × 17
- `co_initial_ppm:negativo` × 13
- `test_id:id_duplicado` × 10
- `x_o2:aprox` × 8
- `date:no_coincide_con_dia_gmt` × 8
- `flow_max_cm_s:posible_lectura_del_ventilador` × 7
- `thickness_mm:inconsistente_entre_campanas` × 6
- `ug_burn_length_cm:aprox` × 6
- `g1_burn_length_cm:completa` × 6
- `burn_time_s:insignificante` × 4
- `x_o2_final:caida_de_o2_inverosimil` × 4
- `x_o2:rango_promediado` × 3
- `thickness_mm:decimal_faltante` × 3
- `co_final_ppm:fuera_de_escala_del_sensor` × 3

Columnas con más datos faltantes:

- `g1_spread_rate_mm_s`: 99%
- `ug_spread_rate_mm_s`: 99%
- `sides_burning`: 98%
- `blowoff`: 97%
- `g1_spread_mode`: 97%
- `ug_burn_length_cm`: 97%
- `g1_burn_length_cm`: 97%
- `ignition_time_s`: 96%
- `ignition_power_W`: 96%
- `burn_time_s`: 96%
- `ignited`: 95%
- `video_ids`: 95%

## aerosols.csv (119 filas)

Marcas más frecuentes:

- `flow_cm_s:condiciones_en_otra_fila` × 4
- `test_id:id_duplicado` × 2

Columnas con más datos faltantes:

- `weight_loss_mg_min`: 97%
- `primary_mixing_s`: 44%
- `primary_aging_s`: 44%
- `duration_s`: 43%
- `aging_s`: 9%
- `date_raw`: 8%
- `rt_r0`: 8%
- `flow_cm_s`: 5%
- `description`: 3%

## sessions.csv (100 filas)

Marcas más frecuentes:

- `fuel_bottle:autorrelleno_excel` × 28
- `atmosphere:autorrelleno_excel` × 6
- `x_o2_values:formato_porcentaje_excel` × 2
- `test_id:bloque_duplicado_en_tabla` × 1

Columnas con más datos faltantes:

- `notes`: 95%
- `atmosphere`: 82%
- `burner_mm`: 82%
- `ambient_diluent`: 82%
- `mesh_polarity`: 80%
- `fuel_diluent`: 79%
- `n2_mfc`: 68%
- `fuel_mfc`: 68%
- `x_o2_values`: 64%
- `x_fuel_values`: 48%
- `test_type`: 30%
- `flames_ignited`: 12%

## Filas descartadas de las tablas originales

| Archivo | Línea | Motivo |
|---|---:|---|
| data/psi/PSI-98_SAFFIRE-I/Experimental table/PSI-98_Experimental table_SAFFIRE-1.csv | 4 | visualizacion_de_flujo_pre_ensayo |
| data/psi/PSI-98_SAFFIRE-I/Experimental table/PSI-98_Experimental table_SAFFIRE-1.csv | 5 | visualizacion_de_flujo_pre_ensayo |
| data/psi/PSI-99_SAFFIRE-II/Experimental table/PSI-99_Experimental table_SAFFIRE-2.csv | 11 | visualizacion_de_flujo_pre_ensayo |
| data/psi/PSI-99_SAFFIRE-II/Experimental table/PSI-99_Experimental table_SAFFIRE-2.csv | 12 | visualizacion_de_flujo_pre_ensayo |
| data/psi/PSI-26_BASS/Experimental table/PSI-26_Experimental table_BASS.csv | 67 | no_es_ensayo |
