import { el, text, linear, axes } from "../core/svg.js";
import { bindTip } from "../core/tooltip.js";
import { cssVar, fmt, FUEL, END } from "../core/dom.js";

export function marker(g, cx, cy, r, color, end, surface) {
  if (end === "Extinction") return el("circle", { cx, cy, r: r - 0.5, fill: surface, stroke: color, "stroke-width": 2 }, g);
  if (end === "Disruption") {
    return el("path", { d: `M${cx - r},${cy} L${cx},${cy - r - 1} L${cx + r},${cy} L${cx},${cy + r + 1}Z`, fill: color, stroke: surface, "stroke-width": 1.5 }, g);
  }
  return el("circle", { cx, cy, r, fill: color, stroke: surface, "stroke-width": 1.5 }, g);
}

export function legendHTML(withShapes = true) {
  const fuels = ["Methanol", "Heptane"]
    .map((f) => `<span><svg width="12" height="12"><circle cx="6" cy="6" r="5" fill="${cssVar(FUEL[f].color)}"/></svg>${FUEL[f].es}</span>`)
    .join("");
  if (!withShapes) return fuels;
  const c = cssVar("--ink-2");
  return (
    fuels +
    `<span style="margin-left:12px"><svg width="12" height="12"><circle cx="6" cy="6" r="5" fill="${c}"/></svg>Completa</span>` +
    `<span><svg width="12" height="12"><circle cx="6" cy="6" r="4.5" fill="none" stroke="${c}" stroke-width="2"/></svg>Extinción</span>` +
    `<span><svg width="12" height="14"><path d="M1,7 L6,1 L11,7 L6,13Z" fill="${c}"/></svg>Disrupción</span>`
  );
}

/** Tasa de quemado K contra fracción de O₂: color = combustible, relleno = cómo terminó. */
export function drawScatter(svg, rows) {
  svg.innerHTML = "";
  const W = 820;
  const H = 420;
  const m = { l: 56, r: 18, t: 30, b: 44 };
  const x = linear(0.1, 0.36, m.l, W - m.r);
  const y = linear(0, 1.1, H - m.b, m.t);
  axes(svg, {
    m, W, H, x, y,
    xt: [0.12, 0.15, 0.18, 0.21, 0.24, 0.27, 0.3, 0.33],
    yt: [0, 0.2, 0.4, 0.6, 0.8, 1.0],
    xLabel: "Fracción molar de O₂ en el ambiente",
    yLabel: "Tasa de quemado K (mm²/s)",
    xf: (v) => v.toFixed(2),
    yf: (v) => v.toFixed(1),
  });
  el("line", { x1: x(0.209), x2: x(0.209), y1: m.t, y2: H - m.b, stroke: cssVar("--line-2"), "stroke-dasharray": "4 4" }, svg);
  text(svg, x(0.209) + 6, m.t + 10, "aire · 20.9 %");

  const surface = cssVar("--panel-solid");
  const g = el("g", {}, svg);
  rows.forEach((r) => {
    const jit = (((r.n * 7919) % 100) / 100) * 0.004 - 0.002;
    const cx = x(r.o2 + jit);
    const cy = y(r.K);
    const mk = marker(g, cx, cy, 4.5, cssVar(FUEL[r.fuel].color), r.end, surface);
    const hit = el("circle", { cx, cy, r: 9, fill: "transparent" }, g);
    bindTip(
      hit,
      () => `<b>FLEX #${r.n}</b> · ${FUEL[r.fuel].es}<br>O₂ ${fmt(r.o2)} · ${fmt(r.P)} atm<br>CO₂ ${fmt(r.co2)} · He ${fmt(r.he)}<br>d₀ ${fmt(r.d0)} mm · K ${fmt(r.K)} mm²/s<br>${END[r.end] || r.end}${r.dext ? ` a ${fmt(r.dext)} mm` : ""}`,
      { on: () => mk.setAttribute("transform", `translate(${cx} ${cy}) scale(1.45) translate(${-cx} ${-cy})`), off: () => mk.removeAttribute("transform") },
    );
  });
}
