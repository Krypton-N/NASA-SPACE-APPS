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
import { mountSimulator } from "./views/simulator.js";
import { mountFlame3D } from "./views/flame3dView.js";
import { mountEvidence } from "./views/evidence.js";
import { mountPipeline } from "./views/pipeline.js";
import { mountRag } from "./views/rag.js";

const TABS = [
  { id: "panorama", label: "Panorama" },
  { id: "explorador", label: "Explorador" },
  { id: "simulador", label: "Simulador" },
  { id: "llama3d", label: "Llama 3D" },
  { id: "evidencia", label: "Evidencia" },
  { id: "pipeline", label: "Pipeline IA" },
  { id: "rag", label: "Asistente RAG" },
];

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
  const go = (id) => router.go(id);
  const views = {
    panorama: mountPanorama($("#view-panorama"), data, { go }),
    explorador: mountExplorer($("#view-explorador"), data),
    simulador: mountSimulator($("#view-simulador"), data, shared),
    llama3d: mountFlame3D($("#view-llama3d"), data, shared),
    evidencia: mountEvidence($("#view-evidencia"), data),
    pipeline: mountPipeline($("#view-pipeline")),
    rag: mountRag($("#view-rag"), data, shared),
  };
  router = createRouter({ tabs: TABS, views, initial: "panorama" });
  $(".brand").addEventListener("click", (e) => { e.preventDefault(); go("panorama"); });
}

boot().catch((err) => {
  console.error(err);
  const box = $("#loading");
  if (box) box.textContent = `Error al iniciar: ${err.message}. ¿Corriste "npm run dev" dentro de la carpeta app?`;
});
