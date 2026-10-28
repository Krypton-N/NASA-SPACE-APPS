import "../styles/lab3d.css";
import { esc, fmt, FUEL } from "../core/dom.js";
import { gravitySwitch } from "../ui/chips.js";
import { conditions } from "../state.js";
import { PRESETS } from "../model/flame.js";
import { ENVS, HOTSPOTS, VIEWS, LEVELS, STEPS, matchPreset, narrate, stepOf } from "../model/lab.js";
import { statusLine } from "./simulator.js";

const ICON = {
  play: '<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 1.5v11l9-5.5z" fill="currentColor"/></svg>',
  pause: '<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 2h3v10H3zM8 2h3v10H8z" fill="currentColor"/></svg>',
  restart: '<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M2.5 7a4.5 4.5 0 1 0 1.4-3.2M2.2 1.6v2.6h2.6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  full: '<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M1.5 5V1.5H5M9 1.5h3.5V5M12.5 9v3.5H9M5 12.5H1.5V9" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  sliders: '<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M1.5 4h6M11 4h1.5M1.5 10h1.5M6.5 10h6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="9" cy="4" r="1.8" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="4.7" cy="10" r="1.8" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
};

const GAS = [["o2", "O₂", "#6da7ec"], ["co2", "CO₂", "#d5d9e2"], ["he", "He", "#b58ae6"], ["n2", "N₂", "#2c3654"]];
const FEEDS = VIEWS.filter((v) => v.id !== "free");

function seg(box, options, value, onPick) {
  box.innerHTML = options.map((o) => `<button type="button" data-v="${o.id}" title="${esc(o.name || o.label)}">${o.label}</button>`).join("");
  const sync = (v) => box.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.v === v));
  box.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    sync(b.dataset.v);
    onPick(b.dataset.v);
  });
  sync(value);
  return sync;
}

export function mountFlame3D(root, data, { controls, scenario, gravity }) {
  root.innerHTML = `
    <div class="section-head">
      <div class="eyebrow">Laboratorio virtual · parametrizado por el modelo</div>
      <h2>Entra al laboratorio donde arde la gota</h2>
      <p class="lede">La misma predicción del simulador, dentro de una recreación de la cámara de combustión de FLEX: agujas que despliegan la gota, ignitores de hilo caliente y las cámaras científicas reales. Cada escenario cambia la atmósfera y también el lugar.</p>
    </div>
    <div class="lab-scenes" id="v3-scenes" role="group" aria-label="Escenarios"></div>
    <div class="grid-sim">
      <div data-slot="controls"></div>
      <div class="lab-col">
        <div class="statusline" id="v3-cov"></div>
        <div id="v3-toolslot">
          <div class="lab-toolbar" id="v3-toolbar">
            <div id="v3-g"></div>
            <div class="lab-pick"><span>Vista</span><div class="seg" id="v3-view" role="group" aria-label="Vista libre o cámara"></div></div>
            <div class="lab-pick"><span>Escala</span><div class="seg" id="v3-level" role="group" aria-label="Escala de la vista libre"></div></div>
            <div class="lab-pick"><span>Lectura</span><div class="seg" id="v3-aud" role="group" aria-label="Nivel de lectura"></div></div>
          </div>
        </div>
        <div class="stage stage-3d lab" id="v3-stage" data-env="iss" data-view="free" data-aud="plain" aria-label="Laboratorio 3D interactivo: gota, llama y cámara de combustión">
          <div class="msg" id="v3-msg">Cargando laboratorio 3D…</div>
          <div class="lab-fx" aria-hidden="true"></div>
          <div class="lab-frame" id="v3-frame" hidden aria-hidden="true"><i class="lab-cross"></i><span class="lab-scale" id="v3-scale"><i></i><b></b></span></div>
          <div class="lab-spots" id="v3-spots"></div>
          <div class="lab-top">
            <div class="lab-place"><b id="v3-env"></b><span id="v3-place"></span><span class="lab-feed" id="v3-feed" hidden></span></div>
            <ol class="lab-steps" id="v3-steps">${STEPS.map((s) => `<li data-step="${s.id}">${s.label}</li>`).join("")}</ol>
          </div>
          <aside class="lab-tele" id="v3-tele" aria-live="off"></aside>
          <div class="lab-drawer" id="v3-drawer" hidden>
            <div class="lab-drawer-head"><b>Condiciones del ensayo</b><button type="button" class="lab-card-x" id="v3-drawer-x" aria-label="Ocultar condiciones">×</button></div>
            <div class="lab-drawer-body" id="v3-drawer-body"></div>
          </div>
          <div class="lab-monitors" id="v3-mons" role="group" aria-label="Cámaras en vivo">
            ${FEEDS.map((f) => `<button type="button" class="lab-mon" data-v="${f.id}" title="Ver desde: ${esc(f.name)}"><span>${f.label}</span></button>`).join("")}
          </div>
          <div class="lab-card" id="v3-card" hidden></div>
          <div class="lab-bottom">
            <p class="lab-caption" id="v3-note"></p>
            <div class="lab-transport">
              <button type="button" class="lab-btn" id="v3-play" aria-label="Pausar"></button>
              <button type="button" class="lab-btn" id="v3-restart" title="Repetir el ensayo desde el despliegue">${ICON.restart}<span>Reiniciar</span></button>
              <input type="range" id="v3-scrub" min="0" max="1000" step="1" value="0" aria-label="Avance del ensayo">
              <output id="v3-time"></output>
              <button type="button" class="lab-btn" id="v3-rate" title="Velocidad de reproducción">1×</button>
              <button type="button" class="lab-btn" id="v3-cond" aria-pressed="true" title="Mostrar u ocultar las condiciones">${ICON.sliders}<span>Condiciones</span></button>
              <button type="button" class="lab-btn" id="v3-monbtn" aria-pressed="true" title="Miniaturas de las cámaras">Cámaras</button>
              <button type="button" class="lab-btn" id="v3-labels" aria-pressed="true">Etiquetas</button>
              <button type="button" class="lab-btn" id="v3-spin" aria-pressed="true">Giro</button>
              <button type="button" class="lab-btn" id="v3-full" aria-label="Pantalla completa" title="Pantalla completa">${ICON.full}</button>
            </div>
          </div>
        </div>
        <p class="lab-envtext" id="v3-envtext"></p>
        <p class="dim small">Vista libre: arrastra para orbitar · rueda o pellizco para pasar de la gota a la cámara y al laboratorio. Vistas de cámara: punto de vista fijo del instrumento, la rueda hace zoom digital. En pantalla completa, el botón «Condiciones» deja cambiar combustible, atmósfera y gravedad sin salir. Recreación ilustrativa del hardware descrito en los documentos de FLEX (CIR, MDCA, HiBMS, LLUV, torre de caída ZGF), no un modelo CAD. El radio de la llama es cualitativo; la tasa de consumo, la extinción y la llama fría vienen de la predicción.</p>
      </div>
    </div>`;

  const q = (s) => root.querySelector(s);
  const stage = q("#v3-stage");
  q("#v3-g").appendChild(gravitySwitch(gravity));

  let scene = null;
  let active = false;
  let unsub = null;
  let envId = matchPreset(conditions.get()) || "iss";
  let custom = false;
  let aud = "plain";
  let view = "free";
  let scrubbing = false;
  let last = null; // último estado recibido de la escena

  // ---- escenarios ----
  const scenes = q("#v3-scenes");
  scenes.innerHTML = PRESETS.map((p) => {
    const e = ENVS[p.id];
    return `<button type="button" class="lab-scene" data-env="${p.id}">
      <span class="lab-scene-name">${e.name}</span>
      <span class="lab-scene-place">${e.place}</span>
      <span class="lab-scene-spec">${FUEL[p.q.fuel].es} · ${Math.round(p.q.o2 * 100)} % O₂ · ${fmt(p.q.P)} atm${p.q.co2 ? ` · ${Math.round(p.q.co2 * 100)} % CO₂` : ""}</span>
    </button>`;
  }).join("");
  scenes.addEventListener("click", (e) => {
    const b = e.target.closest(".lab-scene");
    if (!b) return;
    const p = PRESETS.find((x) => x.id === b.dataset.env);
    // si ya está activo, repite el ensayo; si no, las condiciones nuevas cambian el entorno
    if (matchPreset(conditions.get()) === p.id) scene?.restart();
    else conditions.set({ ...p.q });
  });

  // ---- telemetría ----
  const tele = q("#v3-tele");
  tele.innerHTML = `
    <div class="tele-row big"><span data-l="t"></span><b data-v="t"></b></div>
    <div class="tele-row big"><span data-l="d"></span><b data-v="d"></b></div>
    <div class="tele-row big"><span data-l="f"></span><b data-v="f"></b></div>
    <div class="tele-sci">
      <div class="tele-row"><span>d²</span><b data-v="d2"></b></div>
      <div class="tele-row"><span>(d/d₀)²</span><b data-v="dn"></b></div>
      <div class="tele-row"><span>D<sub>f</sub>/D</span><b data-v="fsr"></b></div>
      <div class="tele-row"><span>K</span><b data-v="k"></b></div>
      <div class="tele-row"><span>P(extinción)</span><b data-v="pext"></b></div>
      <div class="tele-row"><span>Vecino más cercano</span><b data-v="nb"></b></div>
    </div>
    <div class="tele-gas">
      <div class="tele-head"><span data-l="atm"></span><b data-v="p"></b></div>
      <div class="gasbar" data-v="bar"></div>
      <div class="gaslegend" data-v="gas"></div>
    </div>`;
  const tv = Object.fromEntries([...tele.querySelectorAll("[data-v]")].map((n) => [n.dataset.v, n]));
  const tl = Object.fromEntries([...tele.querySelectorAll("[data-l]")].map((n) => [n.dataset.l, n]));

  function paintStatic({ sim }) {
    if (!sim) return;
    const m = matchPreset(sim.q);
    if (m) envId = m;
    custom = !m;
    const env = ENVS[envId];
    stage.dataset.env = envId;
    q("#v3-env").textContent = env.name;
    q("#v3-place").textContent = custom ? `${env.place} · condiciones personalizadas` : env.place;
    q("#v3-envtext").innerHTML = `<b>${env.name}.</b> ${aud === "plain" ? env.plain : env.tech}`;
    scenes.querySelectorAll(".lab-scene").forEach((b) => b.setAttribute("aria-pressed", !custom && b.dataset.env === envId));
    q('#v3-steps [data-step="cool"]').hidden = !sim.cool;

    q("#v3-cov").innerHTML = statusLine(sim) +
      `<span class="dim small">K ${fmt(sim.pr.K)} ± ${fmt(sim.pr.sd)} mm²/s · ${fmt(sim.tBurn, 1)} s de llama · ${Math.round(sim.pr.pExt * 100)} % de extinción</span>`;

    const sq = sim.q;
    const n2 = Math.max(0, 1 - sq.o2 - sq.co2 - sq.he);
    const mixv = { o2: sq.o2, co2: sq.co2, he: sq.he, n2 };
    tv.bar.innerHTML = GAS.map(([k, , c]) => `<i style="flex:${mixv[k]};background:${c}"></i>`).join("");
    tv.gas.innerHTML = GAS.filter(([k]) => mixv[k] > 0.004).map(([k, name, c]) => `<span><i style="background:${c}"></i>${name} ${Math.round(mixv[k] * 100)} %</span>`).join("");
    tv.p.textContent = aud === "plain" ? `${fmt(sq.P)} atm` : `${fmt(sq.P)} atm · ${(sq.P * 101.325).toFixed(0)} kPa · ${(sq.P * 14.696).toFixed(1)} psia`;
    tv.k.textContent = `${fmt(sim.pr.K)} ± ${fmt(sim.pr.sd)} mm²/s`;
    tv.pext.textContent = `${Math.round(sim.pr.pExt * 100)} %${sim.ext ? ` · d≈${fmt(sim.dEnd, 1)} mm` : ""}`;
    const nb = sim.pr.nb[0];
    tv.nb.textContent = nb ? `FLEX #${nb.r.n} · ${nb.d.toFixed(2)} u` : "—";
    tl.t.textContent = aud === "plain" ? "Tiempo" : "t";
    tl.d.textContent = aud === "plain" ? "Gota" : "d";
    tl.f.textContent = aud === "plain" ? "Llama" : "D_f";
    tl.atm.textContent = aud === "plain" ? "Aire de la cámara" : "Atmósfera";
    if (last) paintLive(last);
  }

  const frame = q("#v3-frame");
  function paintLive(h) {
    last = h;
    const { sim } = scenario.get();
    if (!sim) return;
    tv.t.textContent = `${h.t.toFixed(1)} s`;
    tv.d.textContent = `${h.d.toFixed(2)} mm`;
    tv.f.textContent = h.flame ? `${h.flame.toFixed(0)} mm` : "—";
    tv.d2.textContent = `${(h.d * h.d).toFixed(2)} mm²`;
    tv.dn.textContent = ((h.d / sim.q.d0) ** 2).toFixed(3);
    tv.fsr.textContent = h.flame && h.d > 0.05 ? (h.flame / h.d).toFixed(1) : "—";

    const step = stepOf(h.phase, h.stage);
    const order = STEPS.map((s) => s.id);
    q("#v3-steps").querySelectorAll("li").forEach((li) => {
      const i = order.indexOf(li.dataset.step);
      li.className = li.dataset.step === step ? "on" : i < order.indexOf(step) ? "done" : "";
    });
    q("#v3-note").textContent = narrate(sim, h);
    q("#v3-time").textContent = h.stage ? h.label : `${h.label} · t = ${h.t.toFixed(1)} s`;
    if (!scrubbing) {
      const s = q("#v3-scrub");
      s.value = Math.round(h.progress * 1000);
      s.style.setProperty("--fill", `${h.progress * 100}%`);
    }
    const play = q("#v3-play");
    if (play.dataset.on !== String(h.playing)) {
      play.dataset.on = String(h.playing);
      play.innerHTML = h.playing ? ICON.pause : ICON.play;
      play.setAttribute("aria-label", h.playing ? "Pausar" : "Reproducir");
    }
    if (stage.dataset.level !== h.level) {
      stage.dataset.level = h.level;
      if (view === "free") syncLevel(h.level);
    }
    // marco y barra de escala de la imagen del instrumento
    frame.hidden = !h.feed;
    if (h.feed) {
      const { x, y, w, h: fh, pxmm } = h.feed;
      frame.style.cssText = `left:${x}px;top:${y}px;width:${w}px;height:${fh}px`;
      const mm = VIEWS.find((v) => v.id === view)?.bar || 5;
      q("#v3-scale i").style.width = `${Math.max(4, pxmm * mm)}px`;
      q("#v3-scale b").textContent = `${mm} mm`;
    }
  }

  // ---- puntos de interés ----
  const spotBox = q("#v3-spots");
  const spots = {};
  for (const [id, s] of Object.entries(HOTSPOTS)) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "spot";
    b.hidden = true;
    b.innerHTML = `<i></i><span>${esc(s.title)}</span>`;
    b.addEventListener("click", () => openCard(id));
    spotBox.appendChild(b);
    spots[id] = b;
  }
  let shown = new Set();
  function paintSpots(list) {
    const now = new Set();
    for (const s of list) {
      const b = spots[s.id];
      if (!b || !s.on) continue;
      now.add(s.id);
      b.style.transform = `translate(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px)`;
      if (b.hidden) b.hidden = false;
    }
    shown.forEach((id) => { if (!now.has(id)) spots[id].hidden = true; });
    shown = now;
  }

  const card = q("#v3-card");
  let cardId = null;
  function openCard(id) {
    cardId = id;
    const s = HOTSPOTS[id];
    card.innerHTML = `
      <button type="button" class="lab-card-x" aria-label="Cerrar">×</button>
      <h4>${esc(s.title)}</h4>
      <p>${esc(aud === "plain" ? s.plain : s.tech)}</p>
      <p class="alt"><b>${aud === "plain" ? "Detalle técnico" : "En simple"}:</b> ${esc(aud === "plain" ? s.tech : s.plain)}</p>`;
    card.hidden = false;
    card.querySelector(".lab-card-x").addEventListener("click", closeCard);
  }
  function closeCard() { cardId = null; card.hidden = true; }

  // ---- vista: libre o desde una cámara real ----
  const mons = q("#v3-mons");
  function setView(v) {
    view = v;
    stage.dataset.view = v;
    syncView(v);
    mons.querySelectorAll(".lab-mon").forEach((b) => b.setAttribute("aria-pressed", b.dataset.v === v));
    const info = VIEWS.find((x) => x.id === v);
    const feed = q("#v3-feed");
    feed.hidden = v === "free";
    feed.textContent = v === "free" ? "" : `${info.name} · ${info.spec}`;
    if (v !== "free") closeCard();
    scene?.setView(v);
  }
  const syncView = seg(q("#v3-view"), VIEWS, view, setView);
  // una miniatura abre esa cámara; pulsarla de nuevo vuelve a la vista libre
  mons.addEventListener("click", (e) => {
    const b = e.target.closest(".lab-mon");
    if (b) setView(view === b.dataset.v ? "free" : b.dataset.v);
  });
  const monitorList = () => (mons.hidden ? [] : [...mons.querySelectorAll(".lab-mon")].map((el) => ({ id: el.dataset.v, el })));

  const syncLevel = seg(q("#v3-level"), LEVELS, "drop", (v) => {
    if (view !== "free") setView("free");
    scene?.setLevel(v);
  });
  seg(q("#v3-aud"), [{ id: "plain", label: "Explicado" }, { id: "tech", label: "Científico" }], aud, (v) => {
    aud = v;
    stage.dataset.aud = v;
    paintStatic(scenario.get());
    if (cardId) openCard(cardId);
  });

  // ---- transporte ----
  q("#v3-play").addEventListener("click", () => scene?.setPlaying(!scene.playing));
  q("#v3-restart").addEventListener("click", () => scene?.restart());
  const scrub = q("#v3-scrub");
  scrub.addEventListener("pointerdown", () => { scrubbing = true; });
  addEventListener("pointerup", () => { scrubbing = false; });
  scrub.addEventListener("input", () => {
    scrub.style.setProperty("--fill", `${scrub.value / 10}%`);
    scene?.setProgress(scrub.value / 1000);
  });
  const RATES = [1, 0.25, 2];
  q("#v3-rate").addEventListener("click", (e) => {
    const r = RATES[(RATES.indexOf(+e.currentTarget.dataset.r || 1) + 1) % RATES.length];
    e.currentTarget.dataset.r = r;
    e.currentTarget.textContent = `${r}×`;
    scene?.setRate(r);
  });
  const toggle = (id, fn) => q(id).addEventListener("click", (e) => {
    const on = e.currentTarget.getAttribute("aria-pressed") !== "true";
    e.currentTarget.setAttribute("aria-pressed", on);
    fn(on);
  });
  toggle("#v3-labels", (on) => { spotBox.hidden = !on; if (!on) closeCard(); });
  toggle("#v3-monbtn", (on) => { mons.hidden = !on; scene?.setMonitors(monitorList()); });
  q("#v3-spin").addEventListener("click", (e) => {
    if (scene) e.currentTarget.setAttribute("aria-pressed", scene.toggleSpin());
  });

  // ---- pantalla completa: las condiciones y la barra de herramientas entran al laboratorio ----
  const drawer = q("#v3-drawer");
  const drawerBody = q("#v3-drawer-body");
  // "lab-max" es el respaldo cuando el navegador no concede pantalla completa (iOS, vistas embebidas)
  const immersive = () => document.fullscreenElement === stage || stage.classList.contains("lab-max");
  function dock() {
    if (immersive()) {
      drawerBody.append(q("#v3-toolbar"), controls);
      drawer.hidden = q("#v3-cond").getAttribute("aria-pressed") !== "true";
    } else {
      drawer.hidden = true;
      q("#v3-toolslot").appendChild(q("#v3-toolbar"));
      if (active) q('[data-slot="controls"]').appendChild(controls);
    }
  }
  document.addEventListener("fullscreenchange", dock);
  toggle("#v3-cond", (on) => { drawer.hidden = !on || !immersive(); });
  q("#v3-drawer-x").addEventListener("click", () => q("#v3-cond").click());
  const maximize = (on) => {
    stage.classList.toggle("lab-max", on);
    if (on) root.classList.remove("enter"); // la animación de entrada dejaría el escenario anclado a la vista
    dock();
  };
  function leaveImmersive() {
    if (document.fullscreenElement === stage) document.exitFullscreen();
    if (stage.classList.contains("lab-max")) maximize(false);
  }
  q("#v3-full").addEventListener("click", () => {
    if (immersive()) return leaveImmersive();
    const req = stage.requestFullscreen?.();
    if (!req) maximize(true);
    else req.catch(() => maximize(true));
  });
  addEventListener("keydown", (e) => { if (e.key === "Escape" && stage.classList.contains("lab-max")) maximize(false); });

  return {
    async enter() {
      active = true;
      q('[data-slot="controls"]').appendChild(controls);
      paintStatic(scenario.get());
      unsub = scenario.subscribe(paintStatic);
      const msg = q("#v3-msg");
      msg.hidden = false;
      msg.textContent = "Cargando laboratorio 3D…";
      try {
        const { createFlame3D } = await import("../render/flame3d.js");
        if (!active || scene) return;
        scene = await createFlame3D(stage, {
          getSim: () => scenario.get().sim,
          getG: () => gravity.get().g,
          getEnv: () => envId,
          onHud: paintLive,
          onSpots: paintSpots,
        });
        if (!active) { scene.dispose(); scene = null; return; }
        scene.setView(view);
        scene.setMonitors(monitorList());
        scene.setRate(+q("#v3-rate").dataset.r || 1);
        q("#v3-spin").setAttribute("aria-pressed", scene.spinning);
        msg.hidden = true;
      } catch (err) {
        console.error(err);
        msg.textContent = "No se pudo iniciar la vista 3D (WebGL no disponible o sin conexión).";
      }
    },
    leave() {
      active = false;
      unsub?.();
      leaveImmersive();
      scene?.dispose();
      scene = null;
      paintSpots([]);
    },
  };
}
