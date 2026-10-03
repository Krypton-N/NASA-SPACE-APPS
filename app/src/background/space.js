/*
 * Fondo espacial: tres capas de estrellas con paralaje al cursor, un gigante gaseoso,
 * un planeta con anillos, nebulosa tenue y cometas ocasionales.
 * Diseñado para quedarse atrás: contraste bajo, se pausa con la pestaña oculta
 * y queda estático con "reducir movimiento".
 */
import { reducedMotion } from "../core/dom.js";

const rand = (a, b) => a + Math.random() * (b - a);

function offscreen(w, h) {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return [c, c.getContext("2d")];
}

function paintNebula(W, H) {
  const [c, g] = offscreen(W, H);
  const blobs = [
    [0.18, 0.28, 0.55, "rgba(52, 72, 170, 0.20)"],
    [0.78, 0.18, 0.45, "rgba(120, 60, 150, 0.11)"],
    [0.62, 0.82, 0.6, "rgba(20, 110, 140, 0.12)"],
  ];
  for (const [x, y, r, col] of blobs) {
    const gr = g.createRadialGradient(x * W, y * H, 0, x * W, y * H, r * Math.max(W, H));
    gr.addColorStop(0, col);
    gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr;
    g.fillRect(0, 0, W, H);
  }
  return c;
}

function paintGiant(r) {
  const pad = r * 0.25;
  const [c, g] = offscreen(r * 2 + pad * 2, r * 2 + pad * 2);
  const cx = r + pad;
  const cy = r + pad;
  // atmósfera
  const atm = g.createRadialGradient(cx - r * 0.25, cy - r * 0.25, r * 0.9, cx, cy, r * 1.18);
  atm.addColorStop(0, "rgba(110, 150, 255, 0.28)");
  atm.addColorStop(1, "rgba(110, 150, 255, 0)");
  g.fillStyle = atm;
  g.beginPath();
  g.arc(cx, cy, r * 1.18, 0, Math.PI * 2);
  g.fill();
  // cuerpo
  g.save();
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.clip();
  const body = g.createRadialGradient(cx - r * 0.45, cy - r * 0.5, r * 0.1, cx, cy, r * 1.05);
  body.addColorStop(0, "#4c64a8");
  body.addColorStop(0.55, "#243463");
  body.addColorStop(1, "#070b18");
  g.fillStyle = body;
  g.fillRect(cx - r, cy - r, r * 2, r * 2);
  g.translate(cx, cy);
  g.rotate(-0.38);
  for (let i = 0; i < 18; i++) {
    const y = -r + (i + Math.random() * 0.6) * ((2 * r) / 18);
    g.fillStyle = `rgba(${170 + Math.random() * 60}, ${180 + Math.random() * 50}, 255, ${rand(0.025, 0.07)})`;
    g.beginPath();
    g.ellipse(0, y, r * 1.3, rand(r * 0.02, r * 0.06), 0, 0, Math.PI * 2);
    g.fill();
  }
  g.rotate(0.38);
  // terminador: la cara lejana en sombra
  const shade = g.createRadialGradient(-r * 0.5, -r * 0.55, r * 0.3, r * 0.2, r * 0.25, r * 1.35);
  shade.addColorStop(0, "rgba(3,5,11,0)");
  shade.addColorStop(0.6, "rgba(3,5,11,0.45)");
  shade.addColorStop(1, "rgba(3,5,11,0.95)");
  g.fillStyle = shade;
  g.fillRect(-r, -r, r * 2, r * 2);
  g.restore();
  return c;
}

function paintRinged(r) {
  const w = r * 5;
  const h = r * 3;
  const [c, g] = offscreen(w, h);
  const cx = w / 2;
  const cy = h / 2;
  const ring = (front) => {
    g.save();
    g.translate(cx, cy);
    g.rotate(-0.42);
    g.beginPath();
    if (front) g.ellipse(0, 0, r * 2.2, r * 0.55, 0, 0, Math.PI);
    else g.ellipse(0, 0, r * 2.2, r * 0.55, 0, Math.PI, Math.PI * 2);
    g.strokeStyle = "rgba(226, 196, 160, 0.45)";
    g.lineWidth = r * 0.16;
    g.stroke();
    g.strokeStyle = "rgba(226, 196, 160, 0.18)";
    g.lineWidth = r * 0.34;
    g.stroke();
    g.restore();
  };
  ring(false);
  const body = g.createRadialGradient(cx - r * 0.4, cy - r * 0.45, r * 0.1, cx, cy, r);
  body.addColorStop(0, "#e2c29a");
  body.addColorStop(0.6, "#8b6446");
  body.addColorStop(1, "#23170f");
  g.fillStyle = body;
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.fill();
  ring(true);
  return c;
}

export function createSpace(canvas) {
  const ctx = canvas.getContext("2d");
  const mouse = { x: 0, y: 0, tx: 0, ty: 0, px: -999, py: -999 };
  let W = 0;
  let H = 0;
  let stars = [];
  let nebula;
  let giant;
  let ringed;
  let comets = [];
  let nextComet = performance.now() + rand(3000, 7000);
  let raf = null;
  let last = performance.now();

  const LAYERS = [
    { n: 0.00018, z: 6, size: [0.35, 0.9], a: [0.25, 0.6] },
    { n: 0.00008, z: 14, size: [0.6, 1.3], a: [0.35, 0.8] },
    { n: 0.000025, z: 28, size: [1.0, 1.9], a: [0.5, 0.95] },
  ];

  function build() {
    const dpr = Math.min(1.5, devicePixelRatio || 1);
    W = innerWidth;
    H = innerHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    stars = [];
    LAYERS.forEach((L, li) => {
      const n = Math.round(W * H * L.n);
      for (let i = 0; i < n; i++) {
        const warm = Math.random() < 0.12;
        stars.push({
          x: rand(-40, W + 40),
          y: rand(-40, H + 40),
          r: rand(...L.size),
          a: rand(...L.a),
          tw: rand(0.4, 1.6),
          ph: rand(0, Math.PI * 2),
          z: L.z,
          li,
          c: warm ? "255, 214, 170" : "210, 225, 255",
        });
      }
    });
    nebula = paintNebula(W, H);
    giant = paintGiant(Math.min(W, H) * 0.46);
    ringed = paintRinged(Math.max(14, Math.min(W, H) * 0.028));
  }

  function spawnComet() {
    const fromLeft = Math.random() < 0.5;
    const ang = fromLeft ? rand(0.25, 0.55) : Math.PI - rand(0.25, 0.55);
    const speed = rand(520, 820);
    comets.push({
      x: fromLeft ? rand(-80, W * 0.4) : rand(W * 0.6, W + 80),
      y: rand(-60, H * 0.35),
      vx: Math.cos(ang) * speed,
      vy: Math.sin(ang) * speed,
      len: rand(140, 260),
      life: 0,
    });
  }

  function draw(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    mouse.x += (mouse.tx - mouse.x) * 0.045;
    mouse.y += (mouse.ty - mouse.y) * 0.045;

    ctx.fillStyle = "#03050b";
    ctx.fillRect(0, 0, W, H);
    ctx.drawImage(nebula, -mouse.x * 8, -mouse.y * 8);

    // planetas (más cercanos: más paralaje)
    const gx = W * 0.9 - giant.width / 2 - mouse.x * 36;
    const gy = H * 1.02 - giant.height / 2 - mouse.y * 30;
    ctx.globalAlpha = 0.92;
    ctx.drawImage(giant, gx, gy);
    ctx.globalAlpha = 0.85;
    ctx.drawImage(ringed, W * 0.1 - ringed.width / 2 - mouse.x * 18, H * 0.2 - ringed.height / 2 - mouse.y * 14);
    ctx.globalAlpha = 1;

    // estrellas
    const t = now / 1000;
    for (const s of stars) {
      const x = s.x - mouse.x * s.z;
      const y = s.y - mouse.y * s.z;
      let a = s.a * (0.78 + 0.22 * Math.sin(t * s.tw + s.ph));
      // el cursor aviva ligeramente las estrellas cercanas
      const dx = x - mouse.px;
      const dy = y - mouse.py;
      const d2 = dx * dx + dy * dy;
      if (d2 < 22000) a = Math.min(1, a + 0.45 * (1 - d2 / 22000));
      ctx.fillStyle = `rgba(${s.c}, ${a})`;
      if (s.r < 1) ctx.fillRect(x, y, s.r * 1.6, s.r * 1.6);
      else {
        ctx.beginPath();
        ctx.arc(x, y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // cometas
    if (!reducedMotion && now > nextComet) {
      spawnComet();
      nextComet = now + rand(7000, 15000);
    }
    comets = comets.filter((c) => c.x > -400 && c.x < W + 400 && c.y < H + 400);
    for (const c of comets) {
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.life += dt;
      const sp = Math.hypot(c.vx, c.vy);
      const tx = c.x - (c.vx / sp) * c.len;
      const ty = c.y - (c.vy / sp) * c.len;
      const fade = Math.min(1, c.life * 3);
      const gr = ctx.createLinearGradient(c.x, c.y, tx, ty);
      gr.addColorStop(0, `rgba(230, 240, 255, ${0.85 * fade})`);
      gr.addColorStop(0.15, `rgba(150, 185, 255, ${0.35 * fade})`);
      gr.addColorStop(1, "rgba(150, 185, 255, 0)");
      ctx.strokeStyle = gr;
      ctx.lineWidth = 1.6;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(c.x, c.y);
      ctx.lineTo(tx, ty);
      ctx.stroke();
      ctx.fillStyle = `rgba(255,255,255,${fade})`;
      ctx.beginPath();
      ctx.arc(c.x, c.y, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }

    // halo muy tenue siguiendo al cursor
    if (mouse.px > -900) {
      const gr = ctx.createRadialGradient(mouse.px, mouse.py, 0, mouse.px, mouse.py, 260);
      gr.addColorStop(0, "rgba(120, 150, 255, 0.05)");
      gr.addColorStop(1, "rgba(120, 150, 255, 0)");
      ctx.fillStyle = gr;
      ctx.fillRect(mouse.px - 260, mouse.py - 260, 520, 520);
    }
  }

  // 30 cuadros por segundo bastan para un fondo; si el equipo va lento, se activa el modo ligero
  let lastDraw = 0;
  const gaps = [];
  function loop(now) {
    raf = requestAnimationFrame(loop);
    if (now - lastDraw < 31) return;
    if (lastDraw && document.hasFocus() && gaps.length < 120) {
      gaps.push(now - lastDraw);
      if (gaps.length === 120) {
        const sorted = [...gaps].sort((a, b) => a - b);
        if (sorted[60] > 48) document.documentElement.classList.add("lite");
      }
    }
    lastDraw = now;
    draw(now);
  }

  addEventListener("pointermove", (e) => {
    mouse.tx = (e.clientX / W - 0.5) * 2;
    mouse.ty = (e.clientY / H - 0.5) * 2;
    mouse.px = e.clientX;
    mouse.py = e.clientY;
  }, { passive: true });
  addEventListener("resize", () => { build(); if (reducedMotion) draw(performance.now()); });
  document.addEventListener("visibilitychange", () => {
    if (reducedMotion) return;
    if (document.hidden) { cancelAnimationFrame(raf); raf = null; }
    else if (!raf) { last = performance.now(); raf = requestAnimationFrame(loop); }
  });

  build();
  if (reducedMotion) draw(performance.now());
  else raf = requestAnimationFrame(loop);
}
