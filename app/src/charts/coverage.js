import { el, text } from "../core/svg.js";
import { bindTip } from "../core/tooltip.js";
import { cssVar } from "../core/dom.js";

const O2 = [];
for (let v = 0.1; v < 0.36; v += 0.02) O2.push([+v.toFixed(2), +(v + 0.02).toFixed(2)]);
const P = [
  [0.4, 0.65, "0.40–0.65"],
  [0.65, 0.9, "0.65–0.90"],
  [0.9, 1.1, "0.90–1.10"],
  [1.1, 1.6, "1.10–1.60"],
  [1.6, 2.4, "1.60–2.40"],
  [2.4, 3.2, "2.40–3.20"],
];

// condiciones de referencia para ubicar el problema en el mapa
const MARKS = [
  { o2: 0.21, P: 1.0, label: "Cabina ISS" },
  { o2: 0.34, P: 0.57, label: "Exploración (8.2 psia)" },
];

/**
 * Mapa de cobertura: cuántos ensayos hay en cada combinación de O₂ y presión.
 * Las celdas vacías son preguntas que nadie ha respondido con experimentos.
 */
export function drawCoverage(svg, rows) {
  svg.innerHTML = "";
  const W = 560;
  const H = 330;
  const m = { l: 86, r: 12, t: 26, b: 46 };
  const cw = (W - m.l - m.r) / O2.length;
  const ch = (H - m.t - m.b) / P.length;
  const seq = ["--seq-1", "--seq-2", "--seq-3", "--seq-4", "--seq-5", "--seq-6"].map(cssVar);
  const shade = (n) => seq[Math.min(seq.length - 1, n <= 1 ? 0 : n <= 3 ? 1 : n <= 6 ? 2 : n <= 12 ? 3 : n <= 24 ? 4 : 5)];
  const a = el("g", { class: "axis" }, svg);

  P.forEach(([lo, hi, lab], pi) => {
    const yy = H - m.b - (pi + 1) * ch;
    text(a, m.l - 8, yy + ch / 2 + 4, lab, { "text-anchor": "end" });
    O2.forEach(([o0, o1], oi) => {
      const xx = m.l + oi * cw;
      const s = rows.filter((r) => r.P >= lo && r.P < hi && r.o2 >= o0 - 1e-9 && r.o2 < o1 - 1e-9);
      const cell = s.length
        ? el("rect", { x: xx + 1, y: yy + 1, width: cw - 2, height: ch - 2, rx: 3, fill: shade(s.length) }, svg)
        : el("rect", { x: xx + 1.5, y: yy + 1.5, width: cw - 3, height: ch - 3, rx: 3, fill: "none", stroke: cssVar("--line-2"), "stroke-dasharray": "2 3" }, svg);
      const hit = el("rect", { x: xx, y: yy, width: cw, height: ch, fill: "transparent" }, svg);
      bindTip(
        hit,
        () =>
          `<b>O₂ ${Math.round(o0 * 100)}–${Math.round(o1 * 100)} %</b> · ${lab} atm<br>` +
          (s.length ? `${s.length} ensayos FLEX` : "Sin ensayos: hueco en los datos"),
        { on: () => cell.setAttribute("stroke", cssVar("--ink")), off: () => (s.length ? cell.removeAttribute("stroke") : cell.setAttribute("stroke", cssVar("--line-2"))) },
      );
    });
  });
  O2.forEach(([o0], oi) => {
    if (oi % 2 === 0) text(a, m.l + oi * cw + cw / 2, H - m.b + 18, `${Math.round(o0 * 100)}%`, { "text-anchor": "middle" });
  });
  text(a, (m.l + W - m.r) / 2, H - 6, "Oxígeno (fracción molar)", { "text-anchor": "middle" });
  text(a, 4, m.t - 12, "Presión (atm)");

  const px = (o2) => m.l + ((o2 - 0.1) / 0.02) * cw;
  const py = (p) => {
    const i = P.findIndex(([lo, hi]) => p >= lo && p < hi);
    const [lo, hi] = P[i];
    return H - m.b - i * ch - ((p - lo) / (hi - lo)) * ch;
  };
  MARKS.forEach((mk) => {
    const cx = px(mk.o2);
    const cy = py(mk.P);
    el("circle", { cx, cy, r: 7, fill: "none", stroke: "#fff", "stroke-width": 2 }, svg);
    el("circle", { cx, cy, r: 2.5, fill: "#fff" }, svg);
    const right = cx < W - 150;
    text(svg, right ? cx + 12 : cx - 12, cy - 10, mk.label, { "text-anchor": right ? "start" : "end", style: "fill:#fff" });
  });

  return seq;
}
