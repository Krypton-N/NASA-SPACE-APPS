import { el, text, linear, barPath } from "../core/svg.js";
import { bindTip } from "../core/tooltip.js";
import { cssVar, FUEL } from "../core/dom.js";

const BINS = [
  [0, 0.15, "≤15 %"],
  [0.15, 0.18, "16–18 %"],
  [0.18, 0.21, "19–21 %"],
  [0.21, 0.25, "22–25 %"],
  [0.25, 0.5, ">25 %"],
];

/** Porcentaje de ensayos que terminaron en extinción, por rango de O₂ y combustible. */
export function drawExtinction(svg, rows, fuels) {
  svg.innerHTML = "";
  const W = 500;
  const H = 320;
  const m = { l: 46, r: 10, t: 30, b: 46 };
  const bw = (W - m.l - m.r) / BINS.length;
  const y = linear(0, 1, H - m.b, m.t);
  const g = el("g", { class: "grid" }, svg);
  const a = el("g", { class: "axis" }, svg);
  [0, 0.25, 0.5, 0.75, 1].forEach((v) => {
    el("line", { x1: m.l, x2: W - m.r, y1: y(v), y2: y(v) }, g);
    text(a, m.l - 8, y(v) + 4, `${Math.round(v * 100)}%`, { "text-anchor": "end" });
  });
  el("line", { x1: m.l, x2: W - m.r, y1: H - m.b, y2: H - m.b }, a);
  text(a, (m.l + W - m.r) / 2, H - 6, "Oxígeno en el ambiente", { "text-anchor": "middle" });

  const inner = Math.min(24, (bw - 18) / fuels.length);
  BINS.forEach(([lo, hi, lab], i) => {
    const cx = m.l + bw * i + bw / 2;
    text(a, cx, H - m.b + 18, lab, { "text-anchor": "middle" });
    fuels.forEach((f, j) => {
      const s = rows.filter((r) => r.fuel === f && r.o2 > lo && r.o2 <= hi);
      if (!s.length) return;
      const n = s.filter((r) => r.end === "Extinction").length;
      const p = n / s.length;
      const bx = cx - (fuels.length * inner + (fuels.length - 1) * 2) / 2 + j * (inner + 2);
      const bar = el("path", { d: barPath(bx, y(0), inner, y(p)), fill: cssVar(FUEL[f].color) }, svg);
      text(svg, bx + inner / 2, y(p) - 6, s.length, { "text-anchor": "middle", "font-size": 10 });
      const hit = el("rect", { x: bx - 2, y: m.t, width: inner + 4, height: y(0) - m.t, fill: "transparent" }, svg);
      bindTip(hit, () => `<b>${FUEL[f].es}</b> · O₂ ${lab}<br>${Math.round(p * 100)} % extinción<br>${n} de ${s.length} ensayos`, {
        on: () => bar.setAttribute("opacity", 0.75),
        off: () => bar.removeAttribute("opacity"),
      });
    });
  });
}
