/**
 * Ensayos limpios de PSI (data/experiments.json, generado por scripts/build_dashboard_data.py
 * a partir de data/clean). Aquí vive lo que la vista necesita saber de cada familia:
 * qué columnas son condiciones, cuáles resultados, cómo se nombran y cómo se muestran.
 */

export const FAMILIES = {
  droplet: {
    label: "Gotas",
    about: "Una gota de combustible líquido encendida en microgravedad; la llama la rodea como una esfera.",
    conditions: ["fuel", "fuel_blend", "pressure_atm", "x_o2", "d0_mm", "fiber_supported"],
    results: ["end_mode", "burning_rate_mm2_s", "burn_time_s", "d_ext_mm"],
  },
  gas_flame: {
    label: "Llamas de gas",
    about: "Un chorro de gas combustible (u oxidante, en llamas inversas) que arde en la cámara.",
    conditions: ["flame_type", "fuel", "x_fuel", "x_o2", "pressure_atm", "fuel_rate_mg_s", "o2_rate_mg_s",
      "air_velocity_cm_s", "nozzle_mm", "t_ad_K", "z_st"],
    results: ["ignition", "end_mode", "burn_time_s", "duration_s", "peak_burner_T_K", "flame_color", "cool_flame"],
  },
  solid: {
    label: "Sólidos",
    about: "Una muestra de material sólido que se enciende y sobre la que avanza la llama, con flujo de aire.",
    conditions: ["material", "geometry", "thickness_mm", "width_cm", "length_cm", "diameter_mm", "flow_cm_s",
      "flow_direction", "x_o2"],
    results: ["ignited", "extinguished", "blowoff", "burn_time_s", "ug_burn_length_cm", "ug_spread_rate_mm_s",
      "g1_spread_rate_mm_s", "flow_min_cm_s", "x_o2_final", "co_final_ppm"],
  },
  aerosol: {
    label: "Aerosoles",
    about: "Materiales calentados (no quemados) para medir el humo que generan y cómo envejece.",
    conditions: ["material", "flow_cm_s", "aging_s", "description"],
    results: ["weight_loss_mg_min", "rt_r0", "duration_s"],
  },
  session: {
    label: "Bitácoras",
    about: "Resumen de un día de pruebas: qué se probó y cuántas llamas se encendieron, sin el detalle de cada ensayo.",
    conditions: ["test_type", "fuel", "fuel_bottle", "x_fuel_values", "x_o2_values", "atmosphere", "burner_mm",
      "mesh_polarity"],
    results: ["flames_ignited", "notes"],
  },
};

/** Nombre corto en español de cada columna. Lo que no esté aquí usa la descripción del diccionario. */
export const LABELS = {
  fuel: "Combustible", fuel_blend: "Mezcla", fuel_bottle: "Botella", material: "Material", geometry: "Geometría",
  pressure_atm: "Presión", x_o2: "Oxígeno", x_o2_final: "O₂ al final", x_fuel: "Fracción de combustible",
  d0_mm: "Diámetro inicial", d_ext_mm: "Diámetro al extinguirse", burning_rate_mm2_s: "Tasa de quemado K",
  burn_time_s: "Tiempo de combustión", end_mode: "Cómo terminó", fiber_supported: "Sostenida en fibra",
  flame_type: "Tipo de llama", fuel_rate_mg_s: "Flujo de combustible", o2_rate_mg_s: "Flujo de O₂",
  air_velocity_cm_s: "Velocidad del aire", nozzle_mm: "Boquilla", t_ad_K: "Temperatura adiabática",
  z_st: "Mezcla estequiométrica", ignition: "Ignición", ignited: "Encendió", duration_s: "Duración",
  peak_burner_T_K: "Temperatura máx. del quemador", flame_color: "Color de la llama", cool_flame: "Llama fría",
  thickness_mm: "Espesor", width_cm: "Ancho", length_cm: "Largo", diameter_mm: "Diámetro",
  flow_cm_s: "Flujo de aire", flow_min_cm_s: "Flujo mínimo", flow_direction: "Dirección del flujo",
  extinguished: "Se autoextinguió", blowoff: "Arrastrada por el flujo", ug_burn_length_cm: "Longitud quemada (µg)",
  ug_spread_rate_mm_s: "Propagación (µg)", g1_spread_rate_mm_s: "Propagación (1 g)", co_final_ppm: "CO al final",
  aging_s: "Envejecimiento", description: "Descripción", weight_loss_mg_min: "Pérdida de masa", rt_r0: "Rt/R0",
  test_type: "Serie", x_fuel_values: "Combustible probado", x_o2_values: "O₂ probado", atmosphere: "Atmósfera",
  burner_mm: "Quemador", mesh_polarity: "Polaridad de la malla", flames_ignited: "Llamas encendidas", notes: "Notas",
  test_id: "Ensayo", date: "Fecha", test_number: "Número de ensayo", time_gmt: "Hora GMT", time_local: "Hora local",
  day_of_year: "Día del año", test_day: "Día de operación", x_n2: "Nitrógeno", x_co2: "CO₂", x_he: "Helio",
  diluent: "Inertes", fuel_raw: "Combustible (original)", material_raw: "Material (original)", sample_id: "Muestra",
  ramped: "Flujo en rampa", n2_rate_mg_s: "Flujo de N₂", total_rate_mg_s: "Flujo total", x_fuel_final: "Combustible al final",
  fuel_rate_sccm: "Flujo de combustible", hc_fuel_rate_mg_s: "Flujo de hidrocarburo", tfp: "Sonda TFP",
  comments: "Comentarios", pi: "Investigador", planned_test: "Ensayo planeado", rod_color: "Color de la barra",
  sides_burning: "Caras que arden", ignition_note: "Nota de ignición", ignition_power_W: "Potencia del ignitor",
  ignition_time_s: "Tiempo del ignitor", g1_burn_length_cm: "Longitud quemada (1 g)", g1_spread_mode: "Modo de propagación (1 g)",
  flow_max_cm_s: "Flujo máximo", flow_history_raw: "Bitácora de flujo", fan_history_raw: "Bitácora del ventilador",
  flow_restrictor: "Restrictor", co2_initial_pct: "CO₂ al inicio", co2_final_pct: "CO₂ al final", co_initial_ppm: "CO al inicio",
  frames_shot: "Cuadros de video", video_ids: "Videos", thickness_raw: "Espesor (original)", date_raw: "Fecha (original)",
  primary_aging_s: "Envejecimiento primario", primary_mixing_s: "Mezcla primaria", x_fuel_bottle: "Combustible en la botella",
  fuel_diluent: "Diluyente de la botella", ambient_diluent: "Inerte del ambiente", fuel_mfc: "MFC de combustible", n2_mfc: "MFC de N₂",
};

const ENUMS = {
  end_mode: { extinction: "Extinción", disruption: "Disrupción", completion: "Completa", self_extinction: "Autoextinción", flow_termination: "Corte de flujo" },
  ignition: { yes: "Sí", no: "No", flash: "Destello" },
  flame_type: { normal: "Normal", inverse: "Inversa", coflow: "Coflujo" },
  flow_direction: { concurrent: "A favor (concurrente)", opposed: "En contra (opuesto)" },
  geometry: { film: "Película", slab: "Placa", rod: "Barra", sphere: "Esfera", spherical_section: "Sección esférica", candle: "Vela", fabric: "Tela" },
  flame_color: { yellow: "Amarilla", blue: "Azul", "yellow-blue": "Amarilla-azul", limit: "Límite" },
};

const FUEL_ES = {
  methanol: "Metanol", "n-heptane": "Heptano", "n-dodecane": "Dodecano", "n-dodecane+iso-dodecane": "Dodecano + isododecano",
  ethylene: "Etileno", ethane: "Etano", propane: "Propano", "n-butane": "Butano", propylene: "Propileno", methane: "Metano",
  hydrogen: "Hidrógeno", "hydrogen+methane": "Hidrógeno + metano",
};

/** Columnas con fracción molar: se muestran como porcentaje. */
const isFraction = (k) => /^x_(o2|n2|co2|he|fuel)(_final)?$/.test(k);

export const label = (k, cols) => LABELS[k] || cols?.[k]?.[1]?.replace(/\.$/, "") || k;

/** Valor legible y unidad por separado (la unidad va en otro estilo). */
export function display(k, v, cols) {
  if (v == null || v === "") return { v: "—", u: "" };
  if (typeof v === "boolean") return { v: v ? "Sí" : "No", u: "" };
  if (ENUMS[k]) return { v: ENUMS[k][v] || v, u: "" };
  if (k === "fuel") return { v: FUEL_ES[v] || v, u: "" };
  if (k === "x_fuel_values" || k === "x_o2_values") {
    return { v: String(v).split(";").map((x) => `${+(x * 100).toFixed(1)}`).join(" · "), u: "%" };
  }
  if (isFraction(k)) return { v: (v * 100).toFixed(v < 0.1 ? 1 : 0), u: "%" };
  if (typeof v === "number") {
    const unit = cols?.[k]?.[0];
    const u = unit && unit !== "—" && unit !== "bool" ? unit : "";
    const a = Math.abs(v);
    const s = Number.isInteger(v) || a >= 1000 ? Math.round(v).toLocaleString("es-MX")
      : a >= 100 ? v.toFixed(0) : a >= 10 ? v.toFixed(1) : v.toFixed(2);
    return { v: s, u };
  }
  return { v: String(v), u: "" };
}

export const isNumeric = (rows, k) => rows.some((r) => typeof r[k] === "number") && !ENUMS[k];

/** Lo que se muestra en la lista para resumir cómo salió el ensayo. */
export function outcome(r) {
  if (r.family === "session") return r.flames_ignited != null ? `${r.flames_ignited} llamas` : "Bitácora";
  if (r.end_mode) return ENUMS.end_mode[r.end_mode];
  if (r.ignition) return r.ignition === "yes" ? "Encendió" : r.ignition === "flash" ? "Destello" : "No encendió";
  if (r.extinguished) return "Se extinguió";
  if (r.ignited === true) return "Encendió";
  if (r.ignited === false) return "No encendió";
  return "Sin resultado";
}

export const subject = (r) => FUEL_ES[r.fuel] || r.fuel || r.material || r.fuel_bottle || "—";

/** Rango de los controles del simulador 3D (ui/controls.js). */
const SIM_FUEL = { methanol: "Methanol", "n-heptane": "Heptane" };

/**
 * Condiciones para el simulador 3D, o el motivo por el que no se puede.
 * El simulador modela gotas de metanol y heptano (FLEX); los valores fuera de sus rangos se recortan y se avisa.
 */
export function simQuery(r, sliders) {
  if (r.family !== "droplet") return { why: "El simulador 3D modela gotas de combustible; las llamas de gas y los sólidos aún no tienen simulación." };
  if (!SIM_FUEL[r.fuel]) return { why: `El simulador 3D solo tiene metanol y heptano (este ensayo es de ${subject(r).toLowerCase()}).` };
  const raw = { o2: r.x_o2, P: r.pressure_atm, co2: r.x_co2 ?? 0, he: r.x_he ?? 0, d0: r.d0_mm };
  if (raw.o2 == null || raw.P == null || raw.d0 == null) return { why: "Al ensayo le falta O₂, presión o diámetro inicial." };
  const q = { fuel: SIM_FUEL[r.fuel] };
  const clipped = [];
  for (const s of sliders) {
    const v = Math.min(s.max, Math.max(s.min, raw[s.key]));
    if (Math.abs(v - raw[s.key]) > 1e-9) {
      const [name, unit] = s.label.replace(")", "").split(" (");
      const u = unit && unit !== "fracción molar" ? ` ${unit}` : "";
      clipped.push(`${name.toLowerCase()} ${raw[s.key].toFixed(s.dec)}${u} → ${v.toFixed(s.dec)}${u}`);
    }
    q[s.key] = v;
  }
  return { q, clipped };
}

/** Percentil (0–100) de v dentro de values. */
export function percentile(values, v) {
  const below = values.filter((x) => x < v).length;
  const equal = values.filter((x) => x === v).length;
  return Math.round(((below + equal / 2) / values.length) * 100);
}
