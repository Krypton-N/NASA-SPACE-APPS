const NS = "http://www.w3.org/2000/svg";

export function el(tag, attrs = {}, parent) {
  const n = document.createElementNS(NS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(n);
  return n;
}

export function text(parent, x, y, str, attrs = {}) {
  const t = el("text", { x, y, ...attrs }, parent);
  t.textContent = str;
  return t;
}

/** Escala lineal de dominio [d0, d1] a rango [r0, r1]. */
export const linear = (d0, d1, r0, r1) => (v) => r0 + ((v - d0) / (d1 - d0)) * (r1 - r0);

/** Paso "bonito" para ~5 marcas en un rango. */
export function niceStep(span) {
  const e = Math.pow(10, Math.floor(Math.log10(span / 4)));
  return [1, 2, 5, 10].map((k) => k * e).find((s) => span / s <= 6);
}

export function ticks(max, min = 0) {
  const s = niceStep(max - min);
  const out = [];
  for (let v = min; v <= max + 1e-9; v += s) out.push(+v.toFixed(4));
  return out;
}

/** Rejilla, ejes y títulos de eje con una sola escala por eje. */
export function axes(svg, { m, W, H, x, y, xt, yt, xLabel, yLabel, xf = (v) => v, yf = (v) => v }) {
  const g = el("g", { class: "grid" }, svg);
  const a = el("g", { class: "axis" }, svg);
  yt.forEach((v) => {
    el("line", { x1: m.l, x2: W - m.r, y1: y(v), y2: y(v) }, g);
    text(a, m.l - 8, y(v) + 4, yf(v), { "text-anchor": "end" });
  });
  xt.forEach((v) => text(a, x(v), H - m.b + 18, xf(v), { "text-anchor": "middle" }));
  el("line", { x1: m.l, x2: W - m.r, y1: H - m.b, y2: H - m.b }, a);
  text(a, (m.l + W - m.r) / 2, H - 6, xLabel, { "text-anchor": "middle" });
  text(a, m.l - 36 > 0 ? m.l - 36 : 4, m.t - 12, yLabel, { "text-anchor": "start" });
}

/** Barra con esquinas superiores redondeadas anclada a la base. */
export function barPath(x, y0, w, y1, r = 4) {
  const h = y0 - y1;
  if (h <= 0) return "";
  const rr = Math.min(r, h, w / 2);
  return `M${x},${y0} V${y1 + rr} Q${x},${y1} ${x + rr},${y1} H${x + w - rr} Q${x + w},${y1} ${x + w},${y1 + rr} V${y0} Z`;
}
