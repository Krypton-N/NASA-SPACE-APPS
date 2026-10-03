import { el, text, linear, axes, ticks } from "../core/svg.js";
import { bindTip } from "../core/tooltip.js";
import { cssVar, fmt, FUEL, END } from "../core/dom.js";

/** Ley d²: curvas medidas de los ensayos vecinos contra la recta predicha. */
export function drawD2(svg, sim, curves) {
  svg.innerHTML = "";
  const { q, pr, tBurn, dEnd, ext } = sim;
  const W = 520;
  const H = 300;
  const m = { l: 48, r: 14, t: 30, b: 42 };
  const series = pr.nb.map(({ r }) => [r, curves[r.n]]).filter(([, c]) => c && c.length > 3);
  const tMax = Math.max(tBurn * 1.1, ...series.map(([, c]) => c[c.length - 1][0])) || 10;
  const dMax = Math.max(q.d0 ** 2, ...series.map(([, c]) => Math.max(...c.map((p) => p[1] ** 2)))) * 1.08;
  const x = linear(0, tMax, m.l, W - m.r);
  const y = linear(0, dMax, H - m.b, m.t);
  axes(svg, {
    m, W, H, x, y,
    xt: ticks(tMax),
    yt: ticks(dMax),
    xLabel: "Tiempo desde la ignición (s)",
    yLabel: "d² (mm²)",
    xf: (v) => +v.toFixed(1),
    yf: (v) => +v.toFixed(1),
  });
  const muted = cssVar("--muted");
  series.forEach(([r, c]) => {
    const points = c.map(([t, d]) => `${x(t)},${y(d * d)}`).join(" ");
    const line = el("polyline", { points, fill: "none", stroke: muted, "stroke-width": 1.3, opacity: 0.75 }, svg);
    const hit = el("polyline", { points, fill: "none", stroke: "transparent", "stroke-width": 10 }, svg);
    bindTip(hit, () => `<b>FLEX #${r.n}</b> · medido<br>O₂ ${fmt(r.o2)} · d₀ ${fmt(r.d0, 1)} mm<br>K ${fmt(r.K)} mm²/s · ${END[r.end] || r.end}`, {
      on: () => { line.setAttribute("stroke", cssVar("--ink")); line.setAttribute("stroke-width", 2); },
      off: () => { line.setAttribute("stroke", muted); line.setAttribute("stroke-width", 1.3); },
    });
  });
  const col = cssVar(FUEL[q.fuel].color);
  el("line", { x1: x(0), y1: y(q.d0 ** 2), x2: x(tBurn), y2: y(dEnd ** 2), stroke: col, "stroke-width": 2.5, "stroke-linecap": "round" }, svg);
  el("circle", { cx: x(tBurn), cy: y(dEnd ** 2), r: 5, fill: col, stroke: cssVar("--panel-solid"), "stroke-width": 2 }, svg);
  text(svg, Math.min(x(tBurn) + 9, W - m.r - 70), y(dEnd ** 2) - 9, ext ? "extinción" : "consumida");
  return { color: col, muted, count: series.length };
}
