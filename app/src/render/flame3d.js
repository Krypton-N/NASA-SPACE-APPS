import { reducedMotion } from "../core/dom.js";
import { timeline, flameParams, PHASE, phaseNote } from "../model/flame.js";

/*
 * Escena 3D de la gota y su llama. three.js se importa de forma dinámica:
 * Vite lo separa en su propio archivo y solo se descarga al abrir la pestaña 3D.
 * dispose() libera el contexto WebGL al salir.
 */

const VERT = /* glsl */ `
uniform float uTime; uniform float uG; uniform float uAmp;
varying vec3 vN; varying vec3 vV; varying float vY;
float hsh(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
float nz(vec3 p){ vec3 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(mix(hsh(i), hsh(i+vec3(1.,0.,0.)), f.x), mix(hsh(i+vec3(0.,1.,0.)), hsh(i+vec3(1.,1.,0.)), f.x), f.y),
             mix(mix(hsh(i+vec3(0.,0.,1.)), hsh(i+vec3(1.,0.,1.)), f.x), mix(hsh(i+vec3(0.,1.,1.)), hsh(i+vec3(1.,1.,1.)), f.x), f.y), f.z); }
void main(){
  vec3 p = position;
  float n = nz(p * 2.2 + vec3(0.0, -uTime * (0.5 + 2.5 * uG), uTime * 0.2));
  p *= 1.0 + (n - 0.5) * (uAmp + 0.3 * uG);
  if (uG > 0.5) {
    float up = max(p.y, 0.0);
    p.y += up * up * 1.6;
    p.xz *= 1.0 - 0.5 * smoothstep(0.0, 2.6, p.y);
    p.y -= 0.35;
  }
  vY = p.y;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;

const FRAG = /* glsl */ `
uniform vec3 uColor; uniform float uAlpha; uniform float uPow; uniform float uG; uniform float uBand;
varying vec3 vN; varying vec3 vV; varying float vY;
void main(){
  float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), uPow);
  float band = uBand > 0.5 ? smoothstep(-0.3, 0.7, vY) : (uBand < -0.5 ? 1.0 - 0.7 * smoothstep(0.2, 1.8, vY) : 1.0);
  gl_FragColor = vec4(uColor * f * uAlpha * 1.6 * mix(1.0, band, uG), 1.0);
}`;

export async function createFlame3D(box, { getSim, getG, onHud }) {
  const THREE = await import("three");

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
  renderer.setClearColor(0x03050b, 1);
  box.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 1000);
  const resize = () => {
    const w = box.clientWidth;
    const h = box.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(box);
  resize();

  scene.add(new THREE.HemisphereLight(0x8aa4d6, 0x0a0c12, 0.6));
  const key = new THREE.PointLight(0x7fa6ff, 1.5, 0, 0);
  const warm = new THREE.PointLight(0xffa24a, 0, 0, 0);
  scene.add(key, warm);

  const drop = new THREE.Mesh(
    new THREE.SphereGeometry(1, 64, 48),
    new THREE.MeshStandardMaterial({ color: 0xb8c2d6, roughness: 0.18, metalness: 0.25 }),
  );
  scene.add(drop);

  const shellGeo = new THREE.SphereGeometry(1, 96, 64);
  const shell = (hex, pw, band) => {
    const c = new THREE.Color().setHex(hex, THREE.LinearSRGBColorSpace);
    const m = new THREE.Mesh(
      shellGeo,
      new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 }, uG: { value: 0 }, uAmp: { value: 0.05 },
          uColor: { value: c }, uAlpha: { value: 1 }, uPow: { value: pw }, uBand: { value: band },
        },
        vertexShader: VERT,
        fragmentShader: FRAG,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }),
    );
    scene.add(m);
    return m;
  };
  const halo = shell(0x2a4bd0, 4.0, -1);
  const blue = shell(0x5b8cff, 2.4, -1);
  const sootShell = shell(0xff9433, 1.7, 1);
  const coolShell = shell(0x9cc6ff, 2.0, 0);

  // partículas de hollín
  const N = 900;
  const pos = new Float32Array(N * 3);
  const seed = new Float32Array(N * 4);
  for (let i = 0; i < N; i++) {
    const u = Math.random() * 2 - 1;
    const th = Math.random() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    seed.set([s * Math.cos(th), u, s * Math.sin(th), Math.random()], i * 4);
  }
  const pg = new THREE.BufferGeometry();
  pg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const pm = new THREE.PointsMaterial({ color: 0xffb35a, size: 0.2, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false });
  const pts = new THREE.Points(pg, pm);
  scene.add(pts);

  const grid = new THREE.GridHelper(200, 40, 0x243049, 0x151c2b);
  grid.material.transparent = true;
  grid.material.opacity = 0.5;
  scene.add(grid);

  // cámara orbital: arrastre, rueda y pellizco
  const cam = { th: 0.7, ph: 1.15, zoom: 1 };
  const state = { spin: !reducedMotion, t0: performance.now(), raf: null, last: performance.now(), hudAt: 0 };
  const ptrs = new Map();
  let drag = null;
  let pinch = null;
  const dist = () => { const [a, b] = [...ptrs.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
  const down = (e) => {
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    box.setPointerCapture(e.pointerId);
    if (ptrs.size === 2) { pinch = { d: dist(), z: cam.zoom }; drag = null; }
    else drag = { x: e.clientX, y: e.clientY, th: cam.th, ph: cam.ph };
  };
  const move = (e) => {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && ptrs.size === 2) cam.zoom = Math.max(0.35, Math.min(3, (pinch.z * pinch.d) / Math.max(1, dist())));
    else if (drag) {
      cam.th = drag.th - (e.clientX - drag.x) * 0.008;
      cam.ph = Math.max(0.25, Math.min(2.9, drag.ph - (e.clientY - drag.y) * 0.008));
    }
  };
  const up = (e) => { ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = null; drag = null; };
  const wheel = (e) => { e.preventDefault(); cam.zoom = Math.max(0.35, Math.min(3, cam.zoom * Math.exp(e.deltaY * 0.001))); };
  box.addEventListener("pointerdown", down);
  box.addEventListener("pointermove", move);
  box.addEventListener("pointerup", up);
  box.addEventListener("pointercancel", up);
  box.addEventListener("wheel", wheel, { passive: false });

  function frame(now) {
    const dt = Math.min(0.1, (now - state.last) / 1000);
    state.last = now;
    const sim = getSim();
    if (sim) {
      const g = getG();
      const { q, cool } = sim;
      const { t, d, phase } = timeline(sim, now, Math.max(sim.t0, state.t0), reducedMotion);
      const { fsr, o2i, soot } = flameParams(q);
      const time = reducedMotion ? 0 : now / 1000;
      const rD = Math.max(d / 2, 0.001);
      const rF0 = Math.max((q.d0 / 2) * fsr, q.d0 / 2 + 1.5);
      const rF = Math.max(rD * fsr, rD + 0.6) * (g ? 0.8 : 1);
      const hot = phase === "hot" && d > 0.02;
      const a = Math.min(0.95, 0.35 + o2i * 0.45);
      const flick = reducedMotion ? 1 : 1 + 0.025 * Math.sin(time * 11) + 0.015 * Math.sin(time * 27);

      drop.visible = d > 0.02;
      drop.scale.setScalar(rD);
      for (const [m, s, al] of [[halo, 1.22, a * 0.35], [blue, 1.0, a], [sootShell, 0.86, soot * 0.95]]) {
        m.visible = hot && al > 0.01;
        m.scale.setScalar(rF * s * flick);
        const u = m.material.uniforms;
        u.uTime.value = time;
        u.uG.value = g;
        u.uAlpha.value = al;
      }
      const coolOn = phase === "cool" || (phase === "out" && cool);
      coolShell.visible = coolOn;
      coolShell.scale.setScalar(rD * 3.2);
      coolShell.material.uniforms.uTime.value = time;
      coolShell.material.uniforms.uAlpha.value = phase === "cool" ? 0.35 : 0.12;

      key.position.set(rF * 0.6, rF * 0.8, rF * 0.9);
      key.intensity = hot ? 1.2 + a : coolOn ? 0.5 : 0.25;
      warm.position.set(-rF * 0.5, rF * 0.3, rF * 0.7);
      warm.intensity = hot ? soot * 1.6 : 0;

      // hollín: capa esférica dentro de la llama sin gravedad; columna ascendente con gravedad
      pts.visible = hot && soot > 0.02;
      if (pts.visible) {
        for (let i = 0; i < N; i++) {
          const x = seed[i * 4];
          const y = seed[i * 4 + 1];
          const z = seed[i * 4 + 2];
          const r = seed[i * 4 + 3];
          if (!g) {
            const rad = rF * (0.7 + 0.16 * ((r + time * 0.05) % 1));
            const ang = (time * 0.15 + r * 6) * 0.1;
            const ca = Math.cos(ang);
            const sa = Math.sin(ang);
            pos[i * 3] = (x * ca - z * sa) * rad;
            pos[i * 3 + 1] = y * rad;
            pos[i * 3 + 2] = (x * sa + z * ca) * rad;
          } else {
            const life = (r + time * 0.35) % 1;
            const k = rF * 0.5 * (1 - life * 0.7);
            pos[i * 3] = x * k;
            pos[i * 3 + 1] = rF * (-0.1 + life * 2.4);
            pos[i * 3 + 2] = z * k;
          }
        }
        pg.attributes.position.needsUpdate = true;
        pm.opacity = Math.min(0.9, soot * 0.9);
        pm.size = Math.max(0.06, rF * 0.025);
      }

      grid.scale.setScalar(rF0 / 40);
      grid.position.y = -rF0 * 1.6;
      if (state.spin && ptrs.size === 0) cam.th += dt * 0.18;
      const R = rF0 * (g ? 4.4 : 3.4) * cam.zoom;
      const ty = g ? rF0 * 0.7 : 0;
      camera.position.set(R * Math.sin(cam.ph) * Math.sin(cam.th), ty + R * Math.cos(cam.ph), R * Math.sin(cam.ph) * Math.cos(cam.th));
      camera.lookAt(0, ty, 0);

      if (onHud && now - state.hudAt > 100) {
        state.hudAt = now;
        onHud({ t, d, phase, flame: hot ? 2 * rF : null, label: PHASE[phase], note: phaseNote(sim, phase, g) });
      }
    }
    renderer.render(scene, camera);
    state.raf = requestAnimationFrame(frame);
  }
  state.raf = requestAnimationFrame(frame);

  return {
    restart() { state.t0 = performance.now(); },
    toggleSpin() { state.spin = !state.spin; return state.spin; },
    get spinning() { return state.spin; },
    renderOnce() { cancelAnimationFrame(state.raf); frame(performance.now()); },
    dispose() {
      cancelAnimationFrame(state.raf);
      ro.disconnect();
      box.removeEventListener("pointerdown", down);
      box.removeEventListener("pointermove", move);
      box.removeEventListener("pointerup", up);
      box.removeEventListener("pointercancel", up);
      box.removeEventListener("wheel", wheel);
      scene.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); });
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}
