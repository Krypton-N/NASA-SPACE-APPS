import * as THREE from "three";
import { V, std, mesh, box, rod, pipe, hose, panel } from "./kit.js";
import * as tx from "./textures.js";

/*
 * Entorno alrededor de la cámara, uno por escenario:
 *   iss      módulo Destiny con el CIR abierto y la ventana nadir
 *   explore  hábitat de exploración en órbita lunar (misma arquitectura, otra luz y otra ventana)
 *   co2      el mismo módulo en alarma de incendio, con el extintor de CO₂ descargando en la cámara
 *   lowo2    vehículo de caída dentro del pozo de vacío de la torre de NASA Glenn
 * Las paredes son planos de una sola cara: al orbitar por fuera se cortan solas (vista de maqueta).
 */

/** Luz, niebla y encuadre de laboratorio de cada entorno. */
export const LOOK = {
  iss: { bg: 0x05070c, hemi: [0xe6edff, 0x596070, 1.5], sun: [0xffffff, 1.5, [0.3, 1, 0.9]], env: 0.6, maxDist: 2700, lab: { th: 0.44, ph: 1.3, dist: 1850, ty: 170 } },
  explore: { bg: 0x030303, hemi: [0xffe9cf, 0x4d4338, 1.15], sun: [0xffd09a, 2.4, [0.9, 0.3, 0.75]], env: 0.5, maxDist: 2700, lab: { th: 0.05, ph: 1.34, dist: 1950, ty: 200 } },
  co2: { bg: 0x0a0607, hemi: [0x97a3bd, 0x341a1a, 0.62], sun: [0xffe0d0, 0.4, [0.3, 1, 0.9]], env: 0.28, fog: [0xa9b2be, 0.00016], maxDist: 2700, lab: { th: 0.44, ph: 1.3, dist: 1850, ty: 170 } },
  lowo2: { bg: 0x030407, hemi: [0xb4c6e8, 0x20242d, 1.0], sun: [0xdde9ff, 1.5, [0.25, 1, 0.6]], env: 0.5, range: [0x04060a, 5000, 26000], far: 70000, maxDist: 2600, lab: { th: 0.62, ph: 1.22, dist: 2300, ty: 120 } },
};

export function buildEnv(id) {
  return id === "lowo2" ? tower() : station(id);
}

const glowMat = (color) => new THREE.MeshBasicMaterial({ color });
const capsule = (r, len, mat, parent, pos, horizontal = true) => {
  const g = new THREE.CapsuleGeometry(r, len, 8, 20);
  if (horizontal) g.rotateZ(Math.PI / 2);
  return mesh(g, mat, parent, pos);
};

function station(id) {
  const hab = id === "explore";
  const fire = id === "co2";
  const theme = hab ? "hab" : "iss";
  const G = new THREE.Group();
  const cut = new THREE.Group(); // equipo del rack: se oculta cuando taparía la vista en corte
  G.add(cut);
  const anchors = {};
  const ticks = [];

  const X1 = 2625, Y0 = -900, Y1 = 1200, Z0 = 250, Z1 = 2350;
  const H = Y1 - Y0, D = Z1 - Z0, yc = (Y0 + Y1) / 2, zc = (Z0 + Z1) / 2;

  const M = {
    alu: std(0x8f96a1, 0.85, 0.4),
    dark: std(0x1b1e24, 0.5, 0.7),
    tank: std(0xdfe2e6, 0.9, 0.28),
    white: std(0xeeeae0, 0, 0.6),
    rail: std(0x2456a6, 0.5, 0.45),
    grey: std(0x8a909b, 0.3, 0.6),
    strap: std(0x22252b, 0.2, 0.7),
  };

  // ---- módulo: racks en las cuatro paredes ----
  const titles = hab
    ? ["HAB-A1 · LIFE SUPPORT", "HAB-A2 · STOWAGE", "HAB-B1 · EVA PREP", "HAB-B2 · SCIENCE", "HAB-C1 · GALLEY", "HAB-C2 · MEDICAL"]
    : ["LAB1S1 · EXPRESS 1", "LAB1S2 · FIR", "LAB1P2 · MSRR", "LAB1O3 · STOWAGE", "LAB1D4 · WORF", "LAB1P4 · MSG"];
  const faces = titles.map((t, i) => new THREE.MeshLambertMaterial({ map: tx.rackFace(theme, 11 + i * 7, t) }));
  let n = 0;
  const face = () => faces[n++ % faces.length];
  for (let i = -2; i <= 2; i++) {
    const x = i * 1050;
    if (i !== 0) panel(1050, H, face(), G, [x, yc, Z0]);
    panel(1050, H, face(), G, [x, yc, Z1], [0, Math.PI, 0]);
    panel(1050, D, face(), G, [x, Y0, zc], [-Math.PI / 2, 0, 0]);
    panel(1050, D, face(), G, [x, Y1, zc], [Math.PI / 2, 0, 0]);
  }
  panel(D, H, new THREE.MeshLambertMaterial({ map: tx.hatchWall(theme, hab ? "AIRLOCK ▸" : "NODE 2 ▸") }), G, [X1, yc, zc], [0, -Math.PI / 2, 0]);
  panel(D, H, new THREE.MeshLambertMaterial({ map: tx.hatchWall(theme, hab ? "◂ LOGISTICS" : "◂ NODE 1") }), G, [-X1, yc, zc], [0, Math.PI / 2, 0]);

  // luminarias en las esquinas del techo
  const lamp = glowMat(fire ? 0x6b3a36 : hab ? 0xffe2bd : 0xf3f7ff);
  for (const x of [-1575, -525, 525, 1575]) for (const z of [Z0 + 70, Z1 - 70]) box(720, 26, 110, lamp, G, [x, Y1 - 16, z]);

  // pasamanos
  for (const [x, y, z, vertical] of [[-545, 250, Z0 + 46, 1], [545, 250, Z0 + 46, 1], [-1050, Y1 - 46, Z0 + 420, 0], [1050, Y0 + 46, Z0 + 520, 0], [-1600, 420, Z0 + 46, 1]]) {
    const g = new THREE.Group();
    box(26, 320, 26, M.rail, g);
    box(22, 22, 44, M.alu, g, [0, 130, -22]);
    box(22, 22, 44, M.alu, g, [0, -130, -22]);
    g.position.set(x, y, z);
    if (!vertical) g.rotation.z = Math.PI / 2;
    G.add(g);
  }

  // ---- bahía del CIR, con las puertas quitadas como en las fotos ----
  const bayTex = tx.darkMetal(5);
  bayTex.repeat.set(2, 4);
  panel(1050, H, std(0xffffff, 0.6, 0.6, { map: bayTex }), G, [0, yc, -720]);
  panel(970, H, M.dark, G, [-525, yc, -235], [0, Math.PI / 2, 0]);
  panel(970, H, M.dark, G, [525, yc, -235], [0, -Math.PI / 2, 0]);
  panel(1050, 970, M.dark, G, [0, Y1, -235], [Math.PI / 2, 0, 0]);
  panel(1050, 970, M.dark, G, [0, Y0, -235], [-Math.PI / 2, 0, 0]);
  for (const x of [-502, 502]) box(46, H, 46, M.alu, G, [x, yc, 230]);
  box(1050, 76, 40, M.dark, G, [0, Y1 - 38, 240]);
  panel(700, 50, glowMat(0xffffff), G, [0, Y1 - 38, 262]).material.map = tx.plate(hab ? "COMBUSTION RACK · 56.5 kPa · 34 % O2" : "CIR · COMBUSTION INTEGRATED RACK", { w: 1024, h: 72, size: 36, accent: hab ? "#d9722b" : "#2f6fd0" });
  box(960, 1320, 24, M.dark, cut, [0, 30, -452]);

  // botellas de gas sobre la cámara (como en la foto del CIR)
  const bottle = (x, y, len, r, label) => {
    capsule(r, len, M.tank, cut, [x, y, -90]);
    for (const dx of [-len * 0.3, len * 0.3]) mesh(new THREE.TorusGeometry(r + 2, 5, 8, 24).rotateY(Math.PI / 2), M.strap, cut, [x + dx, y, -90]);
    panel(Math.min(260, len * 0.6), 34, glowMat(0xffffff), cut, [x, y, -90 + r + 3]).material.map = tx.plate(label, { w: 512, h: 68, size: 34, bg: "#f1f2ee", fg: "#1b2a4a" });
  };
  bottle(-180, 1050, 460, 60, "DILUENT");
  bottle(330, 1050, 150, 60, "GAS FUEL");
  bottle(0, 900, 640, 64, "O2 MANIFOLD");
  bottle(0, 745, 760, 68, "N2 DILUENT");
  capsule(30, 600, M.white, cut, [0, 630, -90]);
  panel(220, 30, glowMat(0xffffff), cut, [0, 630, -57]).material.map = tx.plate("ADSORBER", { w: 512, h: 70, size: 34, bg: "#f1f2ee", fg: "#1b2a4a" });
  anchors.bottles = V(-250, 900, -20);

  // colector de válvulas y tuberías hacia la cámara
  box(520, 120, 150, M.alu, cut, [-110, 440, -130]);
  for (let i = 0; i < 5; i++) mesh(new THREE.CylinderGeometry(20, 20, 22, 16).rotateX(Math.PI / 2), M.white, cut, [-310 + i * 100, 440, -46]);
  pipe([V(420, 900, -90), V(470, 900, -90), V(470, 440, -90), V(160, 440, -90)], 7, M.tank, cut);
  pipe([V(-440, 745, -90), V(-480, 745, -90), V(-480, 300, -90), V(-250, 300, -160), V(-205, 120, -160)], 7, M.tank, cut);
  pipe([V(120, 380, -130), V(120, 260, -130), V(90, 205, -130)], 6, M.tank, cut);

  // aviónica bajo la cámara
  box(900, 250, 520, M.grey, cut, [0, -740, -210]);
  box(420, 200, 420, M.dark, cut, [-230, -470, -210]);
  box(380, 170, 400, M.alu, cut, [250, -455, -210]);
  for (let i = 0; i < 9; i++) box(14, 14, 6, glowMat(i % 4 === 3 ? 0xf1b63a : 0x58e07a), cut, [-380 + i * 40, -660, 52]);
  hose([V(-300, -380, 20), V(-380, -200, 120), V(-330, 60, 150), V(-240, 150, 60)], 11, std(0x1d4079, 0, 0.55), cut);
  hose([V(330, -380, 0), V(420, -150, 110), V(360, 120, 120)], 9, std(0xa8201d, 0, 0.6), cut);

  // laptop de operaciones en un brazo
  rod(V(600, -260, Z0), V(840, -230, Z0 + 170), 9, M.alu, G);
  const lap = new THREE.Group();
  box(300, 12, 210, M.dark, lap, [0, 0, 55]);
  const scr = panel(300, 188, glowMat(fire ? 0xaa7777 : 0xffffff), lap, [0, 98, -48], [-0.2, 0, 0]);
  scr.material.map = tx.screen();
  box(308, 196, 8, M.dark, lap, [0, 98, -54], [-0.2, 0, 0]);
  lap.position.set(880, -220, Z0 + 190);
  lap.rotation.set(0.15, -0.25, 0);
  G.add(lap);

  // ---- ventana ----
  if (hab) {
    const c = V(1050, 330, Z0 + 14);
    mesh(new THREE.CircleGeometry(330, 56), new THREE.MeshBasicMaterial({ map: tx.moonOrbit() }), G, c.toArray());
    mesh(new THREE.TorusGeometry(334, 26, 12, 64), M.alu, G, c.toArray());
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      mesh(new THREE.CylinderGeometry(9, 9, 12, 10).rotateX(Math.PI / 2), M.dark, G, [c.x + Math.cos(a) * 334, c.y + Math.sin(a) * 334, c.z + 22]);
    }
    anchors.moon = V(1050, 560, Z0 + 30);
  } else {
    const c = V(-560, Y0 + 4, 900);
    const et = tx.earth();
    et.repeat.set(0.5, 1);
    mesh(new THREE.CircleGeometry(250, 48), new THREE.MeshBasicMaterial({ map: et, color: fire ? 0x8899aa : 0xffffff }), G, c.toArray(), [-Math.PI / 2, 0, 0]);
    mesh(new THREE.TorusGeometry(254, 20, 10, 56).rotateX(Math.PI / 2), M.alu, G, [c.x, c.y + 8, c.z]);
    const glow = new THREE.PointLight(0x6aa6ff, fire ? 0 : 4200, 0, 1.3);
    glow.position.set(c.x, Y0 + 260, c.z);
    G.add(glow);
    ticks.push(({ dt }) => { et.offset.x += dt * 0.012; });
    anchors.earth = V(c.x, Y0 + 40, c.z - 120);
  }

  // ---- objetos flotando ----
  const floaters = [
    [rod(V(-65, 0, 0), V(65, 0, 0), 4, M.rail), V(-760, 520, 980)],
    [box(150, 2, 104, new THREE.MeshLambertMaterial({ map: tx.plate("FLEX\nPROC 2.104", { w: 300, h: 208, size: 40, bg: "#f4f2ea", fg: "#22262e" }) })), V(640, -330, 1180)],
    [mesh(new THREE.TorusGeometry(42, 4, 8, 28), M.white), V(-330, -470, 760)],
    [box(120, 82, 14, std(0xc9ccd2, 1, 0.3)), V(930, 640, 1500)],
    [box(140, 18, 6, M.alu), V(-980, -80, 1420)],
  ];
  floaters.forEach(([m, p], i) => {
    m.position.copy(p);
    m.rotation.set(i, i * 2.1, i * 0.7);
    G.add(m);
    ticks.push(({ time, dt }) => {
      m.position.set(p.x + 60 * Math.sin(time * 0.11 + i), p.y + 46 * Math.sin(time * 0.09 + i * 2), p.z + 50 * Math.cos(time * 0.07 + i));
      m.rotation.x += dt * (0.12 + i * 0.03);
      m.rotation.y += dt * (0.2 - i * 0.025);
    });
  });

  // ---- alarma de incendio y extintor de CO₂ ----
  if (fire) {
    const pfe = new THREE.Group();
    const red = std(0xb3231d, 0.3, 0.42);
    capsule(60, 230, red, pfe, [0, 0, 0], false);
    mesh(new THREE.CylinderGeometry(22, 30, 60, 16), M.strap, pfe, [0, 190, 0]);
    box(120, 16, 30, M.strap, pfe, [26, 228, 0]);
    panel(96, 110, glowMat(0xffffff), pfe, [0, 0, 61]).material.map = tx.plate("CO2\nPFE", { w: 192, h: 220, size: 60, bg: "#f4f2ea", fg: "#8c1410" });
    pfe.position.set(-330, -290, 600);
    pfe.rotation.set(0.25, 0.5, 0.75);
    G.add(pfe);
    const nozzle = V(-66, 22, 300);
    hose([V(-470, -140, 640), V(-420, 40, 600), V(-250, 110, 500), V(-130, 60, 400), nozzle.clone().multiplyScalar(1.1)], 13, M.strap, G);
    rod(nozzle.clone().multiplyScalar(1.12), nozzle.clone().multiplyScalar(0.74), 13, M.strap, G, 30, 18);
    anchors.pfe = V(-330, -200, 640);

    // niebla de CO₂ que entra por la boquilla y gira dentro de la cámara
    const N = 260;
    const pos = new Float32Array(N * 3);
    const seed = new Float32Array(N * 4).map(() => Math.random());
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ map: tx.puff(), size: 150, color: 0xeef2f7, transparent: true, opacity: 0.095, depthWrite: false });
    const fog = new THREE.Points(geo, mat);
    fog.frustumCulled = false;
    G.add(fog);
    ticks.push(({ time }) => {
      for (let i = 0; i < N; i++) {
        const [a, b, c, d] = [seed[i * 4], seed[i * 4 + 1], seed[i * 4 + 2], seed[i * 4 + 3]];
        const life = (a + time * (0.05 + c * 0.05)) % 1;
        if (i % 4 === 0) {
          // chorro que sale por la puerta hacia el módulo
          const spread = 120 + life * 620;
          pos.set([Math.cos(b * 6.28 + time * 0.1) * spread * d, 40 + Math.sin(b * 6.28) * spread * d + life * 120, 240 + life * 900], i * 3);
        } else {
          const r = 62 + d * 125;
          const ang = b * 6.28 + time * (0.25 - d * 0.15);
          pos.set([Math.cos(ang) * r, Math.sin(ang) * r, 250 - life * 640], i * 3);
        }
      }
      geo.attributes.position.needsUpdate = true;
    });

    // balizas y aviso de fuego
    const beacon = glowMat(0xff2a1a);
    for (const x of [-900, 900]) box(150, 46, 90, beacon, G, [x, Y1 - 30, Z0 + 150]);
    const sign = panel(300, 96, glowMat(0xffffff), G, [700, 640, Z0 + 10]);
    sign.material.map = tx.plate("FIRE", { w: 400, h: 128, size: 84, bg: "#b3120c", fg: "#fff3ea" });
    const strobe = new THREE.PointLight(0xff2a1a, 0, 0, 1.2);
    strobe.position.set(0, 850, 1150);
    G.add(strobe);
    ticks.push(({ time, still }) => {
      const k = still ? 0.7 : 0.5 + 0.5 * Math.sin(time * 5.2);
      strobe.intensity = 5200 * k;
      beacon.color.setRGB(0.25 + 0.75 * k, 0.04, 0.03);
      sign.material.color.setScalar(0.45 + 0.55 * k);
    });
    anchors.alarm = V(700, 700, Z0 + 20);
  }

  return {
    group: G,
    anchors,
    update(ctx) {
      cut.visible = ctx.inFront || ctx.inside;
      ticks.forEach((f) => f(ctx));
    },
  };
}

function tower() {
  const G = new THREE.Group();
  const cut = new THREE.Group();
  G.add(cut);
  const ZC = -110; // centro del vehículo
  const M = {
    frame: std(0xa9afb9, 0.9, 0.35),
    deck: std(0x4a505b, 0.8, 0.5),
    dark: std(0x1b1e24, 0.5, 0.7),
    batt: std(0x1f3a63, 0.3, 0.6),
    tank: std(0xdfe2e6, 0.9, 0.28),
    orange: std(0xd9722b, 0.2, 0.55),
  };

  const st = tx.shaft();
  st.repeat.set(10, 30);
  mesh(new THREE.CylinderGeometry(3050, 3050, 60000, 64, 1, true), new THREE.MeshBasicMaterial({ map: st, side: THREE.BackSide }), G, [0, 0, ZC]);

  // bastidor del vehículo de caída (sin su carenado, para ver el experimento)
  for (const x of [-570, 570]) for (const z of [340, -560]) box(60, 2300, 60, M.frame, G, [x, 150, z]);
  box(1200, 26, 960, M.deck, G, [0, -338, ZC]);
  box(1200, 26, 960, M.deck, G, [0, -1000, ZC]);
  box(1200, 26, 960, M.deck, cut, [0, 350, ZC]);
  box(1200, 26, 960, M.deck, cut, [0, 1300, ZC]);
  for (const y of [-1000, 1300]) for (const z of [340, -560]) box(1140, 50, 50, M.frame, G, [0, y, z]);
  for (const x of [-120, 120]) box(110, 112, 520, M.orange, G, [x, -270, ZC]);

  // baterías y electrónica abajo; gases y registrador arriba
  for (const x of [-290, 290]) box(380, 300, 440, M.batt, G, [x, -838, ZC]);
  box(150, 240, 380, M.dark, G, [0, -868, ZC]);
  for (let i = 0; i < 6; i++) box(14, 14, 6, new THREE.MeshBasicMaterial({ color: i % 3 ? 0x58e07a : 0xf1b63a }), G, [-40 + i * 16, -780, ZC + 193]);
  hose([V(-290, -690, 80), V(-360, -520, 180), V(-300, -360, 150)], 10, M.dark, G);
  for (const x of [-330, -200]) mesh(new THREE.CapsuleGeometry(52, 420, 8, 18), M.tank, cut, [x, 640, ZC - 150]);
  box(420, 260, 380, M.dark, cut, [220, 500, ZC - 80]);
  pipe([V(-200, 400, ZC - 150), V(-200, 290, ZC - 150), V(-120, 215, ZC - 150)], 7, M.tank, cut);

  // cono superior con el cable de suelta y punta de frenado
  mesh(new THREE.CylinderGeometry(40, 300, 320, 28), M.frame, G, [0, 1473, ZC]);
  const cable = rod(V(0, 1630, ZC), V(0, 30000, ZC), 12, M.frame, G);
  mesh(new THREE.CylinderGeometry(220, 34, 760, 28), M.orange, G, [0, -1393, ZC]);
  box(1140, 96, 12, M.dark, G, [0, 1240, 372]);
  panel(1000, 78, new THREE.MeshBasicMaterial({ map: tx.plate("NASA GLENN · ZERO GRAVITY FACILITY", { w: 1280, h: 100, size: 46, accent: "#d9722b" }) }), G, [0, 1240, 379]);

  let fall = 0;
  return {
    group: G,
    anchors: { shaft: V(-2300, -500, -2100), vehicle: V(570, 900, 340) },
    chamberSpot: "testchamber",
    update({ dt, g, fresh, inside, dist, still }) {
      cut.visible = inside || dist > 620;
      cable.visible = !!g;
      if (fresh || g) fall = 0;
      if (g || still) return;
      fall += dt;
      st.offset.y -= Math.min(0.2 + fall * 0.55, 2.4) * dt;
    },
  };
}
