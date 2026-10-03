import { fmt } from "../core/dom.js";

const rate = (a) => (a.length ? a.filter((r) => r.end === "Extinction").length / a.length : NaN);
const count = (a) => a.filter((r) => r.end === "Extinction").length;
const mean = (a, k) => {
  const v = a.filter((r) => r[k] != null);
  return v.reduce((s, r) => s + r[k], 0) / v.length;
};
const pct = (x) => `${Math.round(x * 100)} %`;

/** Hallazgos calculados en vivo desde la tabla de FLEX (no hay cifras escritas a mano). */
export function flexFindings(F) {
  const sel = (f) => F.filter(f);
  const mLow = sel((r) => r.fuel === "Methanol" && r.o2 <= 0.15);
  const hLow = sel((r) => r.fuel === "Heptane" && r.o2 <= 0.15);
  const minO2 = (fuel) => Math.min(...sel((r) => r.fuel === fuel && r.end !== "Extinction").map((r) => r.o2));
  const co2 = (fuel, hi) => sel((r) => r.fuel === fuel && (hi ? r.co2 > 0.3 : r.co2 === 0));
  const heHi = sel((r) => r.fuel === "Heptane" && r.he > 0.2);
  const heNo = sel((r) => r.fuel === "Heptane" && r.he === 0);
  const dx = sel((r) => r.fuel === "Heptane" && r.end === "Extinction" && r.dext != null).map((r) => r.dext).sort((a, b) => a - b);
  const med = dx[Math.floor(dx.length / 2)];

  return [
    {
      big: `${pct(rate(mLow))} vs ${pct(rate(hLow))}`,
      text: `Con 15 % de O₂ o menos, el metanol se apagó en ${count(mLow)} de ${mLow.length} ensayos; el heptano, en ${count(hLow)} de ${hLow.length}.`,
      src: `El heptano siguió ardiendo hasta ${Math.round(minO2("Heptane") * 100)} % de O₂; el metanol necesitó al menos ${Math.round(minO2("Methanol") * 100)} %.`,
    },
    {
      big: pct(rate(co2("Methanol", true))),
      text: `de las gotas de metanol se apagaron con más de 30 % de CO₂ en el ambiente, contra ${pct(rate(co2("Methanol", false)))} sin CO₂.`,
      src: `Heptano: ${pct(rate(co2("Heptane", true)))} contra ${pct(rate(co2("Heptane", false)))}. El CO₂ es el agente de los extintores de la ISS.`,
    },
    {
      big: `+${Math.round((mean(heHi, "K") / mean(heNo, "K") - 1) * 100)} %`,
      text: `más rápido se consume el heptano con más de 20 % de helio (${fmt(mean(heHi, "K"))} contra ${fmt(mean(heNo, "K"))} mm²/s).`,
      src: "El helio conduce mucho mejor el calor: no es un gas de relleno neutro para un hábitat.",
    },
    {
      big: `${fmt(med, 1)} mm`,
      text: "diámetro mediano al que se apagó la llama visible del heptano: las gotas grandes pierden demasiado calor por radiación.",
      src: "Tras esa extinción, FLEX observó llamas frías invisibles que siguieron consumiendo la gota (Nayagam et al., 2012).",
    },
  ];
}
