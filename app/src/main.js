import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/layout.css";
import "./styles/components.css";
import "./styles/views.css";

import { $ } from "./core/dom.js";
import { createRouter } from "./core/router.js";
import { createSpace } from "./background/space.js";
import { conditions, gravity, scenario, initScenario } from "./state.js";
import { createControls } from "./ui/controls.js";
import { mountPanorama } from "./views/panorama.js";
import { mountExplorer } from "./views/explorer.js";
import { mountExperiments } from "./views/experiments.js";
import { mountSimulator } from "./views/simulator.js";
import { mountFlame3D } from "./views/flame3dView.js";
import { mountEvidence } from "./views/evidence.js";
import { mountPipeline } from "./views/pipeline.js";
import { mountRag } from "./views/rag.js";
import { mountParts, mountStack } from "./views/parts.js";

const TABS = [
  { id: "panorama", label: "Panorama" },
  { id: "datos", label: "Datos" },
  { id: "simulador", label: "Simulador" },
  { id: "asistente", label: "Asistente" },
  { id: "pipeline", label: "Cómo funciona" },
];

// las pestañas de antes siguen abriendo su contenido desde enlaces o lo guardado en el navegador
const ALIASES = {
  explorador: "datos/graficas",
  experimentos: "datos/ensayos",
  llama3d: "simulador/3d",
  evidencia: "asistente",
  rag: "asistente",
};

const HACKATHON = new Date("2026-11-14T09:00:00-06:00");

function countdown() {
  const days = Math.ceil((HACKATHON - Date.now()) / 86400000);
  $("#countdown").innerHTML = days > 0 ? `Hackathon en <b>${days} días</b>` : "Hackathon <b>en curso</b>";
}

async function boot() {
  createSpace($("#space"));
  countdown();

  const res = await fetch(`${import.meta.env.BASE_URL}data/dashboard.json`);
  if (!res.ok) throw new Error(`No se pudieron cargar los datos (${res.status})`);
  const data = await res.json();
  $("#loading").remove();

  initScenario(data.flex);
  const controls = createControls(conditions);
  const shared = { controls, scenario, gravity };

  let router;
  const go = (id, sub) => router.go(id, sub);
  const views = {
    panorama: mountPanorama($("#view-panorama"), data, { go }),
    datos: mountParts($("#view-datos"), "datos", [
      { id: "graficas", label: "Gráficas de FLEX", mount: (el) => mountExplorer(el, data, { open: (uid) => go("datos", `ensayos/${uid}`) }) },
      { id: "ensayos", label: "Ensayo por ensayo", mount: (el) => mountExperiments(el, data, { go, gravity }) },
    ], { label: "Vista de los datos" }),
    simulador: mountParts($("#view-simulador"), "simulador", [
      { id: "2d", label: "Gráficas 2D", mount: (el) => mountSimulator(el, data, shared) },
      { id: "3d", label: "Laboratorio 3D", mount: (el) => mountFlame3D(el, data, shared) },
    ], { label: "Vista del simulador" }),
    asistente: mountStack($("#view-asistente"), [
      (el) => mountRag(el, data, shared),
      (el) => mountEvidence(el, data),
    ]),
    pipeline: mountPipeline($("#view-pipeline")),
  };
  router = createRouter({ tabs: TABS, views, initial: "panorama", aliases: ALIASES });
  $(".brand").addEventListener("click", (e) => { e.preventDefault(); go("panorama"); });
}

boot().catch((err) => {
  console.error(err);
  const box = $("#loading");
  if (box) box.textContent = `Error al iniciar: ${err.message}. ¿Corriste "npm run dev" dentro de la carpeta app?`;
});
