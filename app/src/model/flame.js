import { predict, coverage } from "./knn.js";

/** Convierte condiciones en un escenario completo: predicción, ley d² y fases de la llama. */
export function simulate(flex, q) {
  const pr = predict(flex, q);
  const cov = coverage(pr, q, flex);
  const ext = pr.pExt >= 0.5;
  const dEnd = ext && pr.dext ? Math.min(pr.dext, q.d0 * 0.95) : 0;
  const tBurn = (q.d0 ** 2 - dEnd ** 2) / pr.K;
  // FLEX observó llamas frías en heptano tras la extinción radiativa de gotas grandes.
  const cool = q.fuel === "Heptane" && ext && dEnd > 1.2;
  return { q, pr, cov, ext, dEnd, tBurn, cool, t0: performance.now() };
}

/**
 * Diámetro y fase de la gota en el instante `now` (reproducción acelerada en bucle).
 * `frac` < 1 repite solo la primera parte de la combustión (útil como decoración).
 */
export function timeline(sim, now, t0, reduce = false, frac = 1) {
  const { q, pr, ext, dEnd, tBurn, cool } = sim;
  const speed = Math.max(1, tBurn / 6);
  const coolDur = cool ? tBurn * 0.6 : 0;
  const total = frac < 1 ? tBurn * frac : tBurn + coolDur + 1.5;
  const t = reduce ? tBurn * 0.3 : (((now - t0) / 1000) * speed * (frac < 1 ? 0.5 : 1)) % total;
  let d;
  let phase;
  if (t <= tBurn) {
    d = Math.sqrt(Math.max(0, q.d0 ** 2 - pr.K * t));
    phase = "hot";
  } else if (t <= tBurn + coolDur) {
    d = Math.sqrt(Math.max(0.05, dEnd ** 2 - pr.K * 0.35 * (t - tBurn)));
    phase = "cool";
  } else {
    d = ext ? (cool ? Math.sqrt(Math.max(0.05, dEnd ** 2 - pr.K * 0.35 * coolDur)) : dEnd) : 0;
    phase = ext ? "out" : "gone";
  }
  return { t: Math.min(t, tBurn + coolDur), d, phase };
}

/**
 * Parámetros visuales (cualitativos): radio relativo de la llama, intensidad y hollín.
 * En microgravedad la llama suele medir de 5 a 12 veces el diámetro de la gota.
 */
export function flameParams(q) {
  return {
    fsr: Math.max(3.5, Math.min(12, 7 + (0.21 - q.o2) * 35 - q.he * 4 + q.co2 * 3)),
    o2i: Math.max(0.15, Math.min(1.3, (q.o2 - 0.1) / 0.2)) * (1 - q.co2 * 0.6),
    soot: q.fuel === "Heptane" ? Math.max(0, Math.min(1, (q.o2 - 0.14) / 0.2 + (q.P - 1) * 0.3)) : 0,
  };
}

export const PHASE = {
  hot: "Llama visible",
  cool: "Llama fría · invisible a simple vista",
  out: "Llama apagada",
  gone: "Gota consumida",
};

export function phaseNote(sim, phase, g) {
  if (g) return "Con gravedad, el aire caliente sube: la llama se alarga hacia arriba y recibe más oxígeno.";
  if (sim.cool && phase !== "hot") return "FLEX observó que el heptano sigue quemándose con llama fría tras apagarse la llama visible.";
  return "Sin gravedad no hay corriente ascendente: la llama es una esfera y el oxígeno llega solo por difusión.";
}

export const PRESETS = [
  { label: "Cabina ISS", q: { fuel: "Heptane", o2: 0.21, P: 1.0, co2: 0, he: 0, d0: 3.0 } },
  { label: "Atmósfera de exploración", q: { fuel: "Heptane", o2: 0.34, P: 0.57, co2: 0, he: 0, d0: 3.0 } },
  { label: "Descarga de extintor CO₂", q: { fuel: "Methanol", o2: 0.17, P: 1.0, co2: 0.4, he: 0, d0: 3.0 } },
  { label: "Oxígeno bajo", q: { fuel: "Methanol", o2: 0.14, P: 1.0, co2: 0, he: 0, d0: 3.0 } },
];
