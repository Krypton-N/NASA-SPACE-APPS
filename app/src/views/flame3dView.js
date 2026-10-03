import { fmt } from "../core/dom.js";
import { gravitySwitch } from "../ui/chips.js";
import { statusLine } from "./simulator.js";

export function mountFlame3D(root, data, { controls, scenario, gravity }) {
  root.innerHTML = `
    <div class="section-head">
      <div class="eyebrow">Visualizador parametrizado por el modelo</div>
      <h2>La llama en tres dimensiones</h2>
      <p class="lede">La misma predicción del simulador, en 3D: tamaño de la llama, color, hollín y tiempo de vida de la gota salen de los ensayos vecinos de FLEX. El motor 3D solo se descarga y dibuja mientras esta pestaña está abierta.</p>
    </div>
    <div class="grid-sim">
      <div data-slot="controls"></div>
      <div style="display:grid;gap:12px;min-width:0">
        <div class="statusline" id="v3-cov"></div>
        <div class="stage-bar">
          <div id="v3-g"></div>
          <div class="chips">
            <button type="button" class="btn small" id="v3-restart">Reiniciar</button>
            <button type="button" class="btn small" id="v3-spin">Pausar giro</button>
          </div>
        </div>
        <div class="stage stage-3d" id="v3-stage" aria-label="Vista 3D interactiva de la gota y su llama">
          <div class="msg" id="v3-msg">Cargando motor 3D…</div>
          <div class="hud" id="v3-hud"></div>
          <div class="note"><span id="v3-note"></span><span>Arrastra para rotar · rueda o pellizco para acercar</span></div>
        </div>
        <p class="dim small">Representación cualitativa: el radio de la llama sigue la relación típica de 5 a 12 veces el diámetro de la gota en microgravedad; la tasa de consumo, la extinción y la llama fría vienen de la predicción.</p>
      </div>
    </div>`;

  const q = (s) => root.querySelector(s);
  q("#v3-g").appendChild(gravitySwitch(gravity));
  let scene = null;
  let active = false;
  let unsub = null;

  const renderStatus = ({ sim }) => {
    if (!sim) return;
    q("#v3-cov").innerHTML = statusLine(sim) +
      `<span class="dim small">K ${fmt(sim.pr.K)} ± ${fmt(sim.pr.sd)} mm²/s · ${fmt(sim.tBurn, 1)} s de llama · ${Math.round(sim.pr.pExt * 100)} % de extinción</span>`;
  };

  q("#v3-restart").addEventListener("click", () => scene?.restart());
  q("#v3-spin").addEventListener("click", (e) => {
    if (!scene) return;
    const on = scene.toggleSpin();
    e.currentTarget.textContent = on ? "Pausar giro" : "Girar";
  });

  return {
    async enter() {
      active = true;
      q('[data-slot="controls"]').appendChild(controls);
      renderStatus(scenario.get());
      unsub = scenario.subscribe(renderStatus);
      const msg = q("#v3-msg");
      msg.hidden = false;
      msg.textContent = "Cargando motor 3D…";
      try {
        const { createFlame3D } = await import("../render/flame3d.js");
        if (!active || scene) return;
        scene = await createFlame3D(q("#v3-stage"), {
          getSim: () => scenario.get().sim,
          getG: () => gravity.get().g,
          onHud: ({ t, d, flame, label, note }) => {
            q("#v3-hud").innerHTML = `<span>t = <b>${t.toFixed(1)} s</b> · gota <b>${d.toFixed(2)} mm</b> · llama <b>${flame ? `${flame.toFixed(0)} mm` : "—"}</b></span><span>${label}</span>`;
            q("#v3-note").textContent = note;
          },
        });
        if (!active) { scene.dispose(); scene = null; return; }
        q("#v3-spin").textContent = scene.spinning ? "Pausar giro" : "Girar";
        msg.hidden = true;
      } catch (err) {
        console.error(err);
        msg.textContent = "No se pudo iniciar la vista 3D (WebGL no disponible o sin conexión).";
      }
    },
    leave() {
      active = false;
      unsub?.();
      scene?.dispose();
      scene = null;
    },
  };
}
