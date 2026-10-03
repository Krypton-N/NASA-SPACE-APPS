import { esc } from "../core/dom.js";
import { chipGroup } from "../ui/chips.js";

const KIND = {
  CONFERENCE_PAPER: "ponencia", PRESENTATION: "presentación", TECHNICAL_MEMORANDUM: "memo técnico", POSTER: "póster",
  OTHER: "otro", CONFERENCE_PROCEEDINGS: "memorias", ACCEPTED_MANUSCRIPT: "artículo", JOURNAL_ARTICLE: "artículo",
  CONTRACTOR_REPORT: "reporte", TECHNICAL_PUBLICATION: "publicación técnica", PROYECTO: "proyecto", DATOS: "dataset",
};
const LIMIT = 150;

export function mountEvidence(root, data) {
  const lib = [
    ...data.inventory.map((r) => ({
      src: "PSI", t: `${r.acr ? `${r.acr} — ` : ""}${r.title}`, y: (r.end || "").slice(-4), topic: r.area, kind: "DATOS",
      url: r.doi ? `https://doi.org/${r.doi}` : "https://psi.nasa.gov/physci/repo/",
    })),
    ...data.library,
  ];
  const on = new Set(["PSI", "NTRS", "Task Book"]);

  root.innerHTML = `
    <div class="section-head">
      <div class="eyebrow">Corpus para extracción y RAG</div>
      <h2>Biblioteca de evidencia</h2>
      <p class="lede">Todos los documentos descargados, buscables por título y tema. En la versión final, cada dato extraído por IA apuntará a su documento y a la cita textual de donde salió.</p>
    </div>
    <input class="search" id="q" type="search" placeholder="Buscar: cool flame, Saffire, smoke, flame spread, PMMA…" aria-label="Buscar en la biblioteca">
    <div class="stage-bar"><div class="chips" id="f-src"></div><span class="dim small" id="lib-count"></span></div>
    <div class="panel" style="padding:0"><div class="lib" id="lib"></div></div>`;

  const input = root.querySelector("#q");
  const draw = () => {
    const words = input.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const res = lib.filter((r) => on.has(r.src) && words.every((w) => `${r.t} ${r.topic}`.toLowerCase().includes(w)));
    root.querySelector("#lib-count").textContent = `${res.length} de ${lib.length} documentos`;
    root.querySelector("#lib").innerHTML =
      res.slice(0, LIMIT).map((r) => `
        <div class="lib-item">
          <span class="badge ${r.src === "PSI" ? "psi" : ""}">${esc(r.src)}</span>
          <div><a class="t" href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.t)}</a>
            <div class="meta">${esc(KIND[r.kind] || String(r.kind || "").toLowerCase())} · ${esc(String(r.topic).replace(/_/g, " "))}</div></div>
          <span class="meta">${esc(r.y)}</span>
        </div>`).join("") +
      (res.length > LIMIT ? `<div class="lib-item"><span></span><span class="dim">Mostrando ${LIMIT}. Afina la búsqueda para ver el resto.</span><span></span></div>` : "") +
      (res.length === 0 ? `<div class="lib-item"><span></span><span class="dim">Sin resultados. Prueba con otra palabra o activa más fuentes.</span><span></span></div>` : "");
  };
  chipGroup(root.querySelector("#f-src"), "Fuente", [["PSI", "PSI · datos"], ["NTRS", "NTRS · reportes"], ["Task Book", "Task Book · proyectos"]],
    (v) => on.has(v), (v) => { if (on.has(v) && on.size > 1) on.delete(v); else on.add(v); draw(); });
  input.addEventListener("input", draw);
  draw();
  return {};
}
