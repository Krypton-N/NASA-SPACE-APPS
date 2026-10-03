import { reducedMotion } from "../core/dom.js";
import { timeline, flameParams, PHASE, phaseNote } from "../model/flame.js";

/**
 * Llama 2D en canvas. Se usa en el simulador y en la ventanilla de la portada.
 * getSim(): escenario actual · getG(): 0 microgravedad / 1 gravedad terrestre
 * onHud({t, d, phase, label, note}): opcional, para textos superpuestos.
 */
export function createFlame2D(canvas, { getSim, getG = () => 0, onHud, scale = 1, bg = "#03050b", frac = 1 }) {
  const ctx = canvas.getContext("2d");
  let raf = null;
  let W = 0;
  let H = 0;

  function fit() {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(2, devicePixelRatio || 1);
    W = Math.max(200, r.width);
    H = Math.max(200, r.height);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function shell(rad, stops, stretch, flick) {
    ctx.save();
    if (stretch) {
      ctx.translate(0, -rad * 0.9);
      ctx.scale(0.62, 1.9 * flick);
    }
    const g = ctx.createRadialGradient(0, 0, rad * 0.2, 0, 0, rad);
    stops.forEach(([o, c]) => g.addColorStop(o, c));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, rad, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function draw(now) {
    const sim = getSim();
    if (!sim) return;
    const g = getG();
    const { q, cool } = sim;
    const { t, d, phase } = timeline(sim, now, sim.t0, reducedMotion, frac);
    const { fsr, o2i, soot } = flameParams(q);

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    const pxmm = Math.min(30, Math.min(W, H) / 32) * scale;
    const ox = W / 2;
    const oy = H / 2 + (g ? H * 0.14 : 0);
    const rD = (d / 2) * pxmm;
    const flick = reducedMotion ? 1 : 1 + 0.03 * Math.sin(now / 90) + 0.02 * Math.sin(now / 37);

    if (phase === "hot" && d > 0.02) {
      const rF = Math.max(rD * fsr, rD + 8) * (g ? 0.8 : 1);
      const a = Math.min(0.9, 0.35 + o2i * 0.45);
      ctx.save();
      ctx.translate(ox, oy);
      shell(rF * 1.18 * flick, [[0, "rgba(40,70,160,0)"], [0.72, `rgba(60,110,255,${a * 0.35})`], [0.86, `rgba(125,172,255,${a})`], [0.93, `rgba(90,130,255,${a * 0.5})`], [1, "rgba(30,50,140,0)"]], g, flick);
      if (soot > 0.02) {
        shell(rF * 0.88 * flick, [[0, "rgba(255,140,40,0)"], [0.6, `rgba(255,120,30,${soot * 0.25})`], [0.82, `rgba(255,172,62,${soot * 0.85})`], [0.95, `rgba(255,120,40,${soot * 0.3})`], [1, "rgba(255,100,20,0)"]], g, flick);
      }
      ctx.restore();
    }
    if (phase === "cool" || (phase === "out" && cool)) {
      const rF = rD * 3.2;
      const al = phase === "cool" ? 0.28 : 0.12;
      const gr = ctx.createRadialGradient(ox, oy, rD, ox, oy, rF);
      gr.addColorStop(0, `rgba(160,200,255,${al})`);
      gr.addColorStop(1, "rgba(160,200,255,0)");
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.arc(ox, oy, rF, 0, Math.PI * 2);
      ctx.fill();
    }
    if (d > 0.02) {
      const gr = ctx.createRadialGradient(ox - rD * 0.35, oy - rD * 0.35, rD * 0.1, ox, oy, rD);
      gr.addColorStop(0, "#dde2ec");
      gr.addColorStop(0.5, "#8a93a6");
      gr.addColorStop(1, "#343b4b");
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.arc(ox, oy, Math.max(1.5, rD), 0, Math.PI * 2);
      ctx.fill();
    }
    if (onHud) {
      ctx.strokeStyle = "#5d6b86";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(18, H - 42);
      ctx.lineTo(18 + pxmm * 5, H - 42);
      ctx.stroke();
      ctx.fillStyle = "#8fa0bd";
      ctx.font = "11px 'IBM Plex Mono', monospace";
      ctx.fillText("5 mm", 18, H - 48);
      onHud({ t, d, phase, label: PHASE[phase], note: phaseNote(sim, phase, g) });
    }
  }

  function loop(now) {
    draw(now);
    raf = reducedMotion ? null : requestAnimationFrame(loop);
  }

  const ro = new ResizeObserver(() => { fit(); if (!raf) draw(performance.now()); });

  return {
    start() {
      if (raf) return;
      fit();
      ro.observe(canvas);
      raf = requestAnimationFrame(loop);
    },
    stop() {
      if (raf) cancelAnimationFrame(raf);
      raf = null;
      ro.disconnect();
    },
    redraw: () => draw(performance.now()),
  };
}
