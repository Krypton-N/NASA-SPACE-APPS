/**
 * Modelo base: k vecinos más cercanos sobre los ensayos reales de FLEX.
 * Validación dejando uno fuera (257 ensayos): R² = 0.68, MAE = 0.051 mm²/s en K,
 * 83 % de acierto en extinción (69 % prediciendo siempre la clase mayoritaria).
 */

// Escala de cada variable: una "unidad" de distancia equivale a este cambio.
export const SCALES = { P: 1.0, o2: 0.05, co2: 0.15, he: 0.15, d0: 1.0 };
export const K_NEIGHBORS = 7;
export const METRICS = { r2: 0.68, mae: 0.051, acc: 0.83, base: 0.69, n: 257 };

export function predict(flex, q) {
  const pool = flex.filter((r) => r.fuel === q.fuel && r.K != null && r.d0 != null && r.P != null);
  const nb = pool
    .map((r) => ({
      r,
      d: Math.sqrt(Object.keys(SCALES).reduce((s, k) => s + ((r[k] - q[k]) / SCALES[k]) ** 2, 0)),
    }))
    .sort((a, b) => a.d - b.d)
    .slice(0, K_NEIGHBORS);

  const w = nb.map((n) => 1 / (n.d + 0.15));
  const W = w.reduce((a, b) => a + b, 0);
  const avg = (f) => nb.reduce((s, n, i) => s + w[i] * f(n.r), 0) / W;

  const K = avg((r) => r.K);
  const sd = Math.sqrt(avg((r) => (r.K - K) ** 2));
  const pExt = avg((r) => (r.end === "Extinction" ? 1 : 0));
  const pDis = avg((r) => (r.end === "Disruption" ? 1 : 0));
  const ext = nb.map((n, i) => [n, w[i]]).filter(([n]) => n.r.end === "Extinction" && n.r.dext != null);
  const dext = ext.length ? ext.reduce((s, [n, wi]) => s + wi * n.r.dext, 0) / ext.reduce((s, [, wi]) => s + wi, 0) : null;

  return { nb, K, sd, pExt, pDis, dext, dmin: nb[0]?.d ?? Infinity };
}

const NAMES = { P: ["presión", "atm", 2], o2: ["O₂", "", 2], co2: ["CO₂", "", 2], he: ["helio", "", 2], d0: ["diámetro", "mm", 1] };
const rangeCache = new Map();

/** Mínimo y máximo medidos de cada variable, por combustible. */
function ranges(flex, fuel) {
  if (!rangeCache.has(fuel)) {
    const rows = flex.filter((r) => r.fuel === fuel);
    rangeCache.set(fuel, Object.fromEntries(Object.keys(SCALES).map((k) => {
      const v = rows.map((r) => r[k]).filter((x) => x != null);
      return [k, [Math.min(...v), Math.max(...v)]];
    })));
  }
  return rangeCache.get(fuel);
}

/** Variables fuera del rango medido: la predicción ahí es extrapolación. */
function outOfRange(flex, q) {
  const R = ranges(flex, q.fuel);
  return Object.keys(SCALES)
    .map((k) => {
      const [lo, hi] = R[k];
      if (q[k] >= lo - 1e-9 && q[k] <= hi + 1e-9) return null;
      const [name, unit, dec] = NAMES[k];
      const gap = q[k] < lo ? lo - q[k] : q[k] - hi;
      const far = gap / Math.max(hi - lo, 1e-6) > 0.15;
      const bound = q[k] < lo ? `el mínimo medido es ${lo.toFixed(dec)}` : `el máximo medido es ${hi.toFixed(dec)}`;
      return { far, text: `${name} ${q[k].toFixed(dec)}${unit ? ` ${unit}` : ""}: ${bound}` };
    })
    .filter(Boolean);
}

/** Qué tan cubiertas están las condiciones por ensayos reales. */
export function coverage(pr, q, flex) {
  if (q.o2 + q.co2 + q.he > 1) {
    return { level: "crit", title: "Mezcla imposible", text: "O₂ + CO₂ + He suman más de 1. Baja alguno de los tres." };
  }
  const out = flex ? outOfRange(flex, q) : [];
  if (out.length) {
    return {
      level: out.some((o) => o.far) || pr.dmin >= 1.5 ? "crit" : "warn",
      title: "Extrapolando",
      text: `Fuera de lo que midió FLEX (${out.map((o) => o.text).join("; ")}). La predicción copia los ensayos más cercanos y no sabe qué cambia más allá.`,
    };
  }
  if (pr.dmin < 0.6) {
    return { level: "good", title: "Dentro de los datos", text: `El ensayo más parecido está a ${pr.dmin.toFixed(2)} unidades. Error típico en este rango: ±0.05 mm²/s.` };
  }
  if (pr.dmin < 1.5) {
    return { level: "warn", title: "Cobertura parcial", text: `El ensayo más parecido está a ${pr.dmin.toFixed(2)} unidades. Úsese como orientación, no como dato.` };
  }
  return { level: "crit", title: "Fuera de lo medido", text: `Nadie ha probado algo parecido en FLEX (distancia ${pr.dmin.toFixed(2)}). La predicción no es confiable.` };
}
