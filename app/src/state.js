import { createStore } from "./core/store.js";
import { simulate } from "./model/flame.js";

/** Condiciones que eligen los controles; compartidas por el simulador y la vista 3D. */
export const conditions = createStore({ fuel: "Heptane", o2: 0.21, P: 1.0, co2: 0, he: 0, d0: 3.0 });

/** Modo de gravedad compartido: 0 microgravedad, 1 gravedad terrestre. */
export const gravity = createStore({ g: 0 });

/** Escenario simulado a partir de las condiciones actuales. */
export const scenario = createStore({ sim: null });

export function initScenario(flex) {
  const run = (q) => scenario.set({ sim: simulate(flex, q) });
  conditions.subscribe(run);
  gravity.subscribe(() => {
    const { sim } = scenario.get();
    if (sim) scenario.set({ sim: { ...sim, t0: performance.now() } });
  });
  run(conditions.get());
}
