import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { reducedMotion } from "../core/dom.js";
import { timeline, span, flameParams, PHASE } from "../model/flame.js";
import { buildRig } from "./lab/chamber.js";
import { buildEnv, LOOK } from "./lab/environments.js";
import { disposeTree, smooth } from "./lab/kit.js";
import * as tx from "./lab/textures.js";

/*
 * Laboratorio 3D: la gota y su llama dentro de la cámara de combustión, con un entorno por escenario.
 * Este módulo (y three.js con él) se importa de forma dinámica: solo se descarga al abrir la pestaña 3D.
 * dispose() libera el contexto WebGL al salir.
 *
 * Unidades en milímetros, con la gota en el origen. Hay dos formas de mirar:
 *   - vista libre: cámara orbital a tres escalas (gota, cámara, laboratorio);
 *   - vista de cámara: el punto de vista fijo de un instrumento real (color, HiBMS, LLUV),
 *     con su proporción de sensor y su forma de ver (a contraluz, ultravioleta…).
 * Los monitores repiten las tres cámaras en miniatura sobre el mismo lienzo.
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

const PRE = 3.3; // segundos reales de despliegue e ignición antes de que arranque el reloj del modelo
const LEVEL = { drop: 118, chamber: 620 }; // distancias de cámara que separan las tres escalas
const FEEDS = ["color", "hibms", "lluv"];
const mix = (a, b, t) => a + (b - a) * t;

export async function createFlame3D(box, { getSim, getG, getEnv = () => "iss", onHud, onSpots }) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  box.prepend(renderer.domElement);
  const el = renderer.domElement;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const envMap = pmrem.fromScene(room, 0.04).texture;
  scene.environment = envMap;
  disposeTree(room);
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(38, 1, 0.5, 20000);
  const fcam = new THREE.PerspectiveCamera(20, 1, 2, 4000); // cámara de instrumento
  let W = 1;
  let H = 1;
  let monitors = []; // [{ id, el, rect }]
  const measure = () => {
    const b = box.getBoundingClientRect();
    monitors.forEach((m) => {
      const r = m.el.getBoundingClientRect();
      m.rect = r.width > 4 ? { x: r.left - b.left, y: r.top - b.top, w: r.width, h: r.height } : null;
    });
  };
  const resize = () => {
    W = Math.max(1, box.clientWidth);
    H = Math.max(1, box.clientHeight);
    renderer.setSize(W, H, false);
    measure();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(box);
  resize();

  const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
  const sun = new THREE.DirectionalLight(0xffffff, 1);
  const key = new THREE.PointLight(0x7fa6ff, 0, 0, 0.8);
  const warm = new THREE.PointLight(0xffa24a, 0, 0, 0.8);
  scene.add(hemi, sun, key, warm);

  // ---- cámara de combustión (fija) y entorno (cambia con el escenario) ----
  const rig = buildRig();
  scene.add(rig.group);
  let env = null;
  let look = LOOK.iss;

  // ---- gota y llama ----
  // líquido transparente: cuerpo oscuro que solo devuelve reflejos, para no quemarse junto a la llama
  const dropMat = new THREE.MeshStandardMaterial({ color: 0x2a3142, roughness: 0.1, metalness: 0.35 });
  const inkMat = new THREE.MeshBasicMaterial({ color: 0x050506 });
  const drop = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 48), dropMat);
  // a contraluz la gota actúa como lente: un punto de luz en el centro de la sombra
  const glint = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshBasicMaterial({ color: 0xb4b7bb, depthTest: false }));
  glint.renderOrder = 5;
  scene.add(drop, glint);

  const shellGeo = new THREE.SphereGeometry(1, 96, 64);
  const shell = (hex, pw, band) => {
    const base = new THREE.Color().setHex(hex, THREE.LinearSRGBColorSpace);
    const m = new THREE.Mesh(
      shellGeo,
      new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 }, uG: { value: 0 }, uAmp: { value: 0.05 },
          uColor: { value: base.clone() }, uAlpha: { value: 1 }, uPow: { value: pw }, uBand: { value: band },
        },
        vertexShader: VERT,
        fragmentShader: FRAG,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }),
    );
    m.userData.base = base;
    scene.add(m);
    return m;
  };
  const halo = shell(0x2a4bd0, 4.0, -1);
  const blue = shell(0x5b8cff, 2.4, -1);
  const sootShell = shell(0xff9433, 1.7, 1);
  const coolShell = shell(0x9cc6ff, 2.0, 0);
  const UV_GREY = new THREE.Color(0.8, 0.8, 0.8);

  const glowTex = tx.glow();
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  scene.add(glow);
  const cBlue = new THREE.Color(0x5b8cff);
  const cWarm = new THREE.Color(0xffa24a);

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
  const pmHot = new THREE.PointsMaterial({ color: 0xffb35a, size: 0.2, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false });
  const pmInk = new THREE.PointsMaterial({ color: 0x0a0a0c, size: 0.2, transparent: true, opacity: 0.9, depthWrite: false });
  const pts = new THREE.Points(pg, pmHot);
  pts.frustumCulled = false;
  scene.add(pts);

  const BG = { hibms: new THREE.Color(0x8d9095), lluv: new THREE.Color(0x030303), dark: new THREE.Color(0x000000), free: new THREE.Color(look.bg) };
  let fog = null;

  // ---- estado ----
  const cam = { th: 0.7, ph: 1.15, dist: 60, auto: true };
  let goal = null;
  const S = {
    spin: !reducedMotion, playing: !reducedMotion, rate: 1,
    clock: 0, pre: reducedMotion ? PRE : 0, burn: 9,
    envId: null, view: "free", fz: 1, simT0: null, g: null, fresh: true, introAt: null,
    raf: null, last: performance.now(), hudAt: 0, tick: 0,
  };
  const F = {}; // lo que se dibuja en este cuadro (lo calcula step, lo usa present)

  const dropDist = (sim, g) => {
    const { fsr } = flameParams(sim.q);
    return Math.max((sim.q.d0 / 2) * fsr, sim.q.d0 / 2 + 1.5) * (g ? 5.6 : 4.6);
  };
  const levelOf = (d) => (d < LEVEL.drop ? "drop" : d < LEVEL.chamber ? "chamber" : "lab");

  function swapEnv(id) {
    if (env) { scene.remove(env.group); disposeTree(env.group); }
    S.envId = id;
    look = LOOK[id] || LOOK.iss;
    env = buildEnv(id);
    scene.add(env.group);
    BG.free.setHex(look.bg);
    fog = look.fog ? new THREE.FogExp2(look.fog[0], look.fog[1]) : look.range ? new THREE.Fog(...look.range) : null;
    hemi.color.setHex(look.hemi[0]);
    hemi.groundColor.setHex(look.hemi[1]);
    sun.color.setHex(look.sun[0]);
    sun.position.set(...look.sun[2]);
    S.fresh = true;
    if (reducedMotion) return;
    // entrada: se ve el laboratorio y la cámara vuela hasta la gota mientras se despliega y enciende
    S.pre = 0;
    S.clock = 0;
    Object.assign(cam, { th: look.lab.th, ph: look.lab.ph, dist: look.lab.dist, auto: false });
    goal = null;
    S.introAt = performance.now() + 900;
  }

  function setLevel(id) {
    S.introAt = null;
    if (id === "lab") goal = { ...look.lab };
    else if (id === "chamber") goal = { dist: 138, ph: 1.22 };
    else goal = { auto: true, ph: 1.15 };
  }

  // ---- entrada: en vista libre se orbita; en vista de cámara la rueda es zoom digital ----
  const ptrs = new Map();
  let drag = null;
  let pinch = null;
  const hands = () => { goal = null; S.introAt = null; };
  const zoomTo = (d) => { cam.dist = Math.max(7, Math.min(look.maxDist, d)); cam.auto = false; };
  const feedZoom = (z) => { S.fz = Math.max(0.5, Math.min(6, z)); };
  const gap = () => { const [a, b] = [...ptrs.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
  const down = (e) => {
    hands();
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    el.setPointerCapture(e.pointerId);
    if (ptrs.size === 2) { pinch = { d: gap(), z: cam.dist, fz: S.fz }; drag = null; }
    else drag = { x: e.clientX, y: e.clientY, th: cam.th, ph: cam.ph };
  };
  const move = (e) => {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && ptrs.size === 2) {
      const k = gap() / Math.max(1, pinch.d);
      if (S.view === "free") zoomTo(pinch.z / k);
      else feedZoom(pinch.fz * k);
    } else if (drag && S.view === "free") {
      cam.th = drag.th - (e.clientX - drag.x) * 0.008;
      cam.ph = Math.max(0.25, Math.min(2.9, drag.ph - (e.clientY - drag.y) * 0.008));
    }
  };
  const up = (e) => { ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = null; drag = null; };
  const wheel = (e) => {
    e.preventDefault();
    if (S.view === "free") { hands(); zoomTo(cam.dist * Math.exp(e.deltaY * 0.0012)); }
    else feedZoom(S.fz * Math.exp(-e.deltaY * 0.0012));
  };
  el.addEventListener("pointerdown", down);
  el.addEventListener("pointermove", move);
  el.addEventListener("pointerup", up);
  el.addEventListener("pointercancel", up);
  el.addEventListener("wheel", wheel, { passive: false });

  const v3 = new THREE.Vector3();
  const camDir = new THREE.Vector3();

  /** Avanza la simulación y deja en F todo lo necesario para dibujar el cuadro. */
  function step(sim, dt, now) {
    const g = getG();
    const { q, cool } = sim;
    const sp = span(sim);
    if (sim.t0 !== S.simT0) {
      // condiciones nuevas: la llama arranca de nuevo, sin repetir el despliegue
      if (S.simT0 !== null && S.pre >= PRE) { S.clock = reducedMotion ? (0.3 * sim.tBurn * 1000) / sp.speed : 0; S.burn = 9; }
      if (S.simT0 === null && reducedMotion) S.clock = (0.3 * sim.tBurn * 1000) / sp.speed;
      S.simT0 = sim.t0;
      if (g !== S.g) { S.g = g; S.fresh = true; }
    }

    // ---- secuencia: despliegue → retracción de agujas → ignición → combustión ----
    let stage = null;
    let grow = 1;
    let needle = 1;
    let ign = 0;
    let heat = 0;
    if (S.pre < PRE) {
      if (S.playing) S.pre += dt;
      const a = S.pre;
      grow = Math.cbrt(0.03 + 0.97 * smooth(0.15, 1.5, a));
      needle = smooth(1.6, 1.85, a);
      ign = smooth(1.9, 2.5, a);
      heat = smooth(2.3, 3.2, a);
      stage = a < 1.6 ? "deploy" : a < 2.0 ? "retract" : "ignite";
      if (S.pre >= PRE) { S.clock = 0; S.burn = 0; stage = null; }
    } else if (S.playing) {
      const before = Math.floor(((S.clock / 1000) * sp.speed) / sp.total);
      S.clock += dt * 1000 * S.rate;
      S.burn += dt;
      // al terminar el ensayo se repite completo, con una gota nueva
      if (Math.floor(((S.clock / 1000) * sp.speed) / sp.total) > before) { S.pre = 0; S.clock = 0; S.fresh = true; }
    }
    if (S.pre >= PRE) {
      ign = 1 - smooth(0.05, 0.5, S.burn);
      heat = 1 - smooth(0, 0.9, S.burn);
    }
    const pre = S.pre < PRE;
    const tl = timeline(sim, S.clock, 0, false);
    const t = pre ? 0 : tl.t;
    const d = pre ? q.d0 * grow : tl.d;
    const phase = pre ? "pre" : tl.phase;

    const { fsr, o2i, soot } = flameParams(q);
    const time = reducedMotion ? 0 : now / 1000;
    const rD = Math.max(d / 2, 0.001);
    const rF0 = Math.max((q.d0 / 2) * fsr, q.d0 / 2 + 1.5);
    const kindle = smooth(0, 0.45, S.burn); // la llama crece desde los ignitores
    const flash = Math.max(0, 1 - S.burn / 0.3);
    const rF = Math.max(rD * fsr, rD + 0.6) * (g ? 0.8 : 1) * (0.25 + 0.75 * kindle);
    const hot = phase === "hot" && d > 0.02;
    const a = Math.min(0.95, 0.35 + o2i * 0.45) * kindle;
    const flick = reducedMotion ? 1 : 1 + 0.025 * Math.sin(time * 11) + 0.015 * Math.sin(time * 27);
    Object.assign(F, {
      g, hot, a, soot, kindle, flash, heat, rF, rF0, rD, d0: q.d0,
      dropOn: d > 0.02,
      sootOn: hot && soot > 0.02 && kindle > 0.6,
      coolA: phase === "cool" ? 0.35 : phase === "out" && cool ? 0.12 : 0,
    });

    drop.scale.setScalar(rD);
    glint.scale.setScalar(rD * 0.17);
    rig.set({ rD, needle, ign, heat });
    for (const [m, s] of [[halo, 1.22], [blue, 1.0], [sootShell, 0.86]]) {
      m.scale.setScalar(rF * s * flick);
      m.material.uniforms.uTime.value = time;
      m.material.uniforms.uG.value = g;
    }
    coolShell.scale.setScalar(rD * 3.2);
    coolShell.material.uniforms.uTime.value = time;
    coolShell.material.uniforms.uAlpha.value = F.coolA;
    key.position.set(rF * 0.3, rF * 0.4, rF * 0.5);
    warm.position.set(-rF * 0.3, rF * 0.2, rF * 0.4);

    // hollín: cascarón esférico dentro de la llama sin gravedad; columna ascendente con gravedad
    if (F.sootOn) {
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
      pmHot.opacity = Math.min(0.9, soot * 0.9);
      pmHot.size = pmInk.size = Math.max(0.06, rF * 0.025);
    }

    // ---- cámara orbital ----
    if (S.introAt && now > S.introAt) setLevel("drop");
    const dd = dropDist(sim, g);
    if (goal) {
      const k = 1 - Math.exp(-dt * 2.6);
      const target = goal.auto ? dd : goal.dist;
      cam.dist = Math.exp(mix(Math.log(cam.dist), Math.log(target), k));
      if (goal.ph != null) cam.ph = mix(cam.ph, goal.ph, k);
      if (goal.th != null) cam.th += Math.atan2(Math.sin(goal.th - cam.th), Math.cos(goal.th - cam.th)) * k;
      if (Math.abs(Math.log(cam.dist / target)) < 0.012) { cam.auto = !!goal.auto; goal = null; }
    } else if (cam.auto) cam.dist = mix(cam.dist, dd, 1 - Math.exp(-dt * 5));
    const level = levelOf(cam.dist);
    if (S.spin && ptrs.size === 0 && !goal && !S.introAt) cam.th += level === "drop" ? dt * 0.18 : dt * 0.05 * Math.cos(time * 0.3);

    const wide = smooth(Math.log(700), Math.log(1700), Math.log(cam.dist));
    const ty = mix(g ? rF0 * 0.7 : 0, look.lab.ty, wide);
    const R = cam.dist;
    camera.position.set(R * Math.sin(cam.ph) * Math.sin(cam.th), ty + R * Math.cos(cam.ph), R * Math.sin(cam.ph) * Math.cos(cam.th));
    camera.lookAt(0, ty, 0);
    camera.fov = mix(mix(38, 58, smooth(Math.log(100), Math.log(135), Math.log(R))), 62, smooth(Math.log(520), Math.log(1500), Math.log(R)));
    camera.near = Math.max(0.4, R * 0.02);
    camera.far = look.far || R * 3 + 12000;
    camera.aspect = W / H;
    camera.updateProjectionMatrix();

    // vista en corte: lo que quedaría entre la cámara y la gota se oculta
    F.inFront = camera.position.z > 255;
    F.inside = R < 190;
    F.dist = R;
    camDir.copy(camera.position).normalize();
    rig.instruments.forEach((it) => { it.cut = !F.inside && it.dir.dot(camDir) >= 0.25; });
    env?.update({ dt: reducedMotion ? 0 : dt, time, g, inFront: F.inFront, inside: F.inside, dist: R, fresh: S.fresh, still: reducedMotion });
    S.fresh = false;

    // ---- puntos de interés proyectados a pantalla (solo en vista libre) ----
    if (onSpots) {
      const list = [];
      const put = (id, p) => {
        v3.copy(p).project(camera);
        list.push({ id, x: (v3.x * 0.5 + 0.5) * W, y: (0.5 - v3.y * 0.5) * H, on: v3.z < 1 && Math.abs(v3.x) < 0.92 && Math.abs(v3.y) < 0.8 });
      };
      if (S.view === "free" && !goal) {
        if (level === "drop") {
          if (F.dropOn) put("drop", v3.set(rD * 0.75, rD * 0.75, 0));
          if (hot && kindle > 0.9) put(g ? "plume" : "flame", v3.set(0, g ? rF * 2.2 : rF, 0));
          if (F.sootOn && !g) put("soot", v3.set(-rF * 0.78, -rF * 0.12, 0));
        } else if (level === "chamber") {
          for (const id of ["needles", "igniters", "hibms", "lluv", "backlight", "radiometer", "colorcam"]) put(id, rig.anchors[id]);
        } else {
          put(env.chamberSpot || "chamber", rig.anchors.chamber);
          for (const id in env.anchors) put(id, env.anchors[id]);
        }
      }
      onSpots(list);
    }

    if (onHud && now - S.hudAt > 100) {
      S.hudAt = now;
      const prog = pre ? 0 : ((((S.clock / 1000) * sp.speed) % sp.total) / sp.total);
      onHud({ t, d, phase, stage, flame: hot ? 2 * rF : null, label: pre ? "Preparando el ensayo" : PHASE[phase], progress: prog, playing: S.playing, level, inst: S.view, g, feed: S.view === "free" ? null : F.feed });
    }
  }

  /** Prepara visibilidad, materiales y luces para dibujar como `kind`: "free" o una de las cámaras. */
  function present(kind, main) {
    const hibms = kind === "hibms";
    const uv = kind === "lluv";
    const color = !hibms && !uv;
    const feed = kind !== "free";
    scene.background = hibms ? BG.hibms : uv ? BG.lluv : BG.free;
    scene.fog = color && main ? fog : null;
    // dentro de la cámara real casi no hay luz: la imagen la da la llama
    const dim = feed ? 0.3 : 1;
    hemi.intensity = look.hemi[2] * dim;
    sun.intensity = look.sun[1] * dim;
    scene.environmentIntensity = look.env * (feed ? 0.6 : 1);
    if (env) env.group.visible = color && main;
    rig.shell.visible = color;
    rig.ext.visible = !feed && F.inFront && F.dist > 520;
    rig.instruments.forEach((it) => { it.group.visible = feed || !it.cut; });
    rig.mech.visible = !uv;
    rig.silhouette(hibms);

    drop.visible = F.dropOn && !uv;
    drop.material = hibms ? inkMat : dropMat;
    glint.visible = hibms && F.dropOn;
    for (const [m, al, on] of [[halo, F.a * 0.35, !hibms], [blue, F.a, !hibms], [sootShell, F.soot * 0.95 * F.kindle, color]]) {
      m.visible = F.hot && on && al > 0.01;
      m.material.uniforms.uAlpha.value = uv ? al * 0.7 : al;
      if (m !== sootShell) m.material.uniforms.uColor.value.copy(uv ? UV_GREY : m.userData.base);
    }
    coolShell.visible = color && F.coolA > 0;
    pts.visible = F.sootOn && !uv;
    pts.material = hibms ? pmInk : pmHot;

    glow.visible = color && (F.hot || F.heat > 0.05);
    if (glow.visible) {
      // de lejos la llama es un punto: se le da un tamaño aparente mínimo, como el destello en una lente
      const gs = F.hot ? Math.max(F.rF * (4.6 + F.flash * 5), feed ? 0 : cam.dist * 0.045) : 9;
      glow.scale.set(gs, gs * (F.g ? 1.6 : 1), 1);
      glow.position.set(0, F.g && F.hot ? F.rF * 0.6 : 0, 0);
      glow.material.color.copy(cBlue).lerp(cWarm, F.hot ? Math.min(0.7, F.soot * 0.6 + F.flash) : 1);
      glow.material.opacity = F.hot ? F.a * 0.2 + F.flash * 0.6 : F.heat * 0.35;
    }
    const lit = F.hot && color ? 1 : 0;
    key.intensity = lit * (40 + 110 * F.a) * (1 + F.flash * 2);
    warm.intensity = lit * F.soot * 120 * F.kindle + (color ? F.heat * 14 : 0);
  }

  /** Coloca la cámara de instrumento. Devuelve los píxeles por milímetro en el plano de la gota. */
  function aim(kind, h, zoom) {
    const c = rig.cams[kind];
    const dist = c.pos.length();
    // campo de vista fijo de cada instrumento (media altura, en mm, en el plano de la gota)
    const half = (kind === "color" ? 34 : kind === "hibms" ? Math.max(10, 3.6 * F.d0) : Math.max(16, F.rF0 * 1.5)) / zoom;
    fcam.position.copy(c.pos);
    fcam.up.copy(c.up);
    fcam.lookAt(0, 0, 0);
    fcam.fov = THREE.MathUtils.radToDeg(2 * Math.atan(half / dist));
    fcam.aspect = c.aspect;
    fcam.updateProjectionMatrix();
    return h / (2 * half);
  }

  function draw() {
    // cada render limpia solo su recorte; el fondo negro de las bandas se limpia aparte
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, W, H);
    if (S.view === "free") {
      present("free", true);
      renderer.render(scene, camera);
      F.feed = null;
    } else {
      // imagen del instrumento centrada, con la proporción de su sensor
      const asp = rig.cams[S.view].aspect;
      const h = Math.min(H, W / asp);
      const w = h * asp;
      const x = (W - w) / 2;
      const y = (H - h) / 2;
      renderer.setClearColor(0x000000, 1);
      renderer.clear();
      present(S.view, true);
      const pxmm = aim(S.view, h, S.fz);
      renderer.setViewport(x, y, w, h);
      renderer.setScissor(x, y, w, h);
      renderer.setScissorTest(true);
      renderer.render(scene, fcam);
      F.feed = { x, y, w, h, pxmm };
    }
    // monitores: las tres cámaras en miniatura
    for (const m of monitors) {
      if (!m.rect) continue;
      const { x, y, w, h } = m.rect;
      present(m.id, false);
      aim(m.id, h, 1);
      fcam.aspect = w / h;
      fcam.updateProjectionMatrix();
      renderer.setViewport(x, H - y - h, w, h);
      renderer.setScissor(x, H - y - h, w, h);
      renderer.setScissorTest(true);
      renderer.render(scene, fcam);
    }
  }

  function frame(now) {
    const dt = Math.min(0.1, (now - S.last) / 1000);
    S.last = now;
    const id = getEnv();
    if (id !== S.envId) swapEnv(id);
    if (++S.tick % 45 === 0) measure();
    const sim = getSim();
    if (sim) {
      step(sim, dt, now);
      draw();
    }
    S.raf = requestAnimationFrame(frame);
  }
  S.raf = requestAnimationFrame(frame);

  return {
    /** Repite el ensayo desde el despliegue de la gota. */
    restart() { S.pre = reducedMotion ? PRE : 0; S.clock = 0; S.fresh = true; if (!reducedMotion) S.playing = true; },
    toggleSpin() { S.spin = !S.spin; return S.spin; },
    get spinning() { return S.spin; },
    setPlaying(on) { S.playing = on; },
    get playing() { return S.playing; },
    /** Salta a una fracción (0–1) del ensayo. */
    setProgress(f) {
      const sim = getSim();
      if (!sim) return;
      const sp = span(sim);
      S.pre = PRE;
      S.burn = 9;
      S.clock = (Math.min(0.999, Math.max(0, f)) * sp.total * 1000) / sp.speed;
    },
    setRate(r) { S.rate = r; },
    setLevel,
    /** "free" para la vista orbital o el id de una cámara ("color", "hibms", "lluv"). */
    setView(id) {
      S.view = id === "free" || FEEDS.includes(id) ? id : "free";
      S.fz = 1;
      S.introAt = null;
    },
    /** Elementos sobre los que se dibujan las miniaturas: [{ id, el }]. */
    setMonitors(list) {
      monitors = list.filter((m) => FEEDS.includes(m.id)).map((m) => ({ ...m, rect: null }));
      measure();
    },
    dispose() {
      cancelAnimationFrame(S.raf);
      ro.disconnect();
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      el.removeEventListener("wheel", wheel);
      rig.silhouette(false);
      disposeTree(scene);
      for (const o of [inkMat, dropMat, pmHot, pmInk, glowTex, envMap]) o.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      el.remove();
    },
  };
}
