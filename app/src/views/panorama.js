import { esc, fmt } from "../core/dom.js";
import { flexFindings } from "../model/findings.js";
import { simulate } from "../model/flame.js";
import { createFlame2D } from "../render/flame2d.js";

const HERO_Q = { fuel: "Heptane", o2: 0.21, P: 1.0, co2: 0, he: 0, d0: 3.0 };

export function mountPanorama(root, data, { go }) {
  const inv = data.inventory;
  const flex = data.flex;
  const rows = inv.reduce((s, r) => s + r.rows, 0);
  const tb = inv.reduce((s, r) => s + r.gb, 0) / 1000;
  const got = inv.reduce((s, r) => s + r.mb, 0) / 1000;
  const tables = inv.filter((r) => r.rows > 0).length;
  const videoShare = 1 - got / (tb * 1000);
  const lowP = flex.filter((r) => r.P < 0.65).length;
  const minP = Math.min(...flex.map((r) => r.P));
  const hiO2lowP = flex.filter((r) => r.o2 >= 0.3 && r.P < 0.9).length;

  root.innerHTML = `
    <div class="hero">
      <div>
        <div class="eyebrow">NASA Space Apps 2026 · Reto #08</div>
        <h1>Cómo arde el fuego <span class="flame">sin gravedad</span></h1>
        <p class="lede">Tres décadas de experimentos de combustión en la Estación Espacial, reunidos, medidos y explicados. Cada cifra sale de una tabla o un documento de NASA y enlaza a su fuente, para decidir con evidencia cómo proteger a una tripulación de un incendio.</p>
        <div class="hero-cta">
          <button type="button" class="btn primary" data-go="explorador">Explorar los ensayos</button>
          <button type="button" class="btn" data-go="simulador">Probar el simulador</button>
        </div>
        <div class="hero-meta">
          <span><b>${inv.length}</b> investigaciones</span>
          <span><b>${rows.toLocaleString("es-MX")}</b> ensayos tabulados</span>
          <span><b>${data.totals.ntrs}</b> reportes técnicos</span>
        </div>
      </div>
      <figure class="porthole-wrap" style="margin:0">
        <div class="porthole" id="porthole"><canvas id="hero-flame" aria-label="Gota de heptano ardiendo en microgravedad"></canvas></div>
        <figcaption class="porthole-caption">Gota de <b>heptano</b> de 3 mm · 21 % O₂ · 1 atm<br><span class="dim">predicción a partir de los ensayos de FLEX</span></figcaption>
      </figure>
    </div>

    <div class="kpis">
      ${[
        [inv.length, "investigaciones de combustión en el repositorio PSI"],
        [rows.toLocaleString("es-MX"), "ensayos tabulados con sus condiciones"],
        [data.totals.ntrs, "reportes y papers de NTRS con texto completo"],
        [data.totals.taskbook, "proyectos financiados en NASA Task Book"],
        [`${tb.toFixed(1)} TB`, `publicados en PSI; ${got.toFixed(1)} GB son datos útiles`],
      ].map(([b, s]) => `<div class="panel kpi"><b>${b}</b><span>${s}</span></div>`).join("")}
    </div>

    <div class="section-head">
      <div class="eyebrow">El problema real</div>
      <h2>Dónde se atoran hoy los científicos</h2>
      <p class="lede">Lo que encontramos al descargar y cruzar los datos. Cada problema viene con la evidencia que lo sostiene y el punto donde la visualización puede atacarlo.</p>
    </div>
    <div class="problems">
      ${[
        {
          tag: "Datos fragmentados",
          h: "Cada experimento habla su propio idioma",
          p: `${tables} tablas experimentales, cada una con columnas, unidades y formatos distintos. Hay valores como «~ 21.5» o «20 cm/s» escritos como texto.`,
          ev: `Al descargar: ~2 600 archivos rotos en el propio servidor de PSI; recuperamos 978 desde los zips.`,
          at: "Base unificada donde cada dato conserva su fuente.",
        },
        {
          tag: "Conocimiento encerrado",
          h: "Los resultados viven en PDFs y video",
          p: `El ${(videoShare * 100).toFixed(2)} % del volumen de PSI es video e imagen cruda. Las conclusiones están en ${data.totals.ntrs} reportes, no en tablas.`,
          ev: `${tb.toFixed(1)} TB publicados contra ${got.toFixed(1)} GB de datos tabulares y documentos.`,
          at: "Extracción con IA y verificación con cita textual.",
        },
        {
          tag: "Huecos de cobertura",
          h: "No hay ensayos donde más importa",
          p: `Las misiones de exploración proponen 0.57 atm con 34 % de O₂. En FLEX hay ${lowP} ensayos por debajo de 0.65 atm; la presión mínima medida es ${fmt(minP)} atm.`,
          ev: `Ensayos con ≥30 % O₂ y menos de 0.9 atm: ${hiO2lowP}.`,
          at: "Mapa de cobertura y predicción que avisa cuando extrapola.",
        },
        {
          tag: "Tierra contra órbita",
          h: "Se certifica con gravedad, se vuela sin ella",
          p: "La prueba estándar de materiales (NASA-STD-6001, Test 1) quema una muestra hacia arriba en la Tierra. En microgravedad la llama se comporta distinto, y no siempre en la misma dirección.",
          ev: "Saffire-II: el silicón ardió completo en 1 g y casi nada en órbita; la tela SIBAL propagó 29 cm en órbita.",
          at: "Comparar 1 g contra microgravedad por material y condición.",
        },
      ].map((x) => `
        <article class="panel problem">
          <span class="tag">${x.tag}</span>
          <h3>${x.h}</h3>
          <p>${x.p}</p>
          <div class="evidence">${x.ev}</div>
          <div class="attack">${x.at}</div>
        </article>`).join("")}
    </div>

    <div class="section-head">
      <div class="eyebrow">Lo que ya dicen los datos</div>
      <h2>Hallazgos en 273 gotas encendidas en órbita</h2>
      <p class="lede">Calculados en vivo desde la tabla de FLEX. Son correlaciones entre ensayos, no reglas de diseño: el siguiente paso es validarlas con el modelo y con la literatura.</p>
    </div>
    <div class="findings">
      ${flexFindings(flex).map((f) => `<article class="panel finding"><div class="big">${f.big}</div><p>${f.text}</p><div class="src">${f.src}</div></article>`).join("")}
    </div>

    <div class="section-head">
      <div class="eyebrow">Inventario</div>
      <h2>Las 24 investigaciones</h2>
      <p class="lede">Ensayos = filas de la tabla experimental de cada investigación. Tamaño total en PSI = todo lo publicado, casi todo video; descargado = tablas, documentos y datos reducidos.</p>
    </div>
    <div class="panel" style="padding:0">
      <div class="tablewrap" style="border:0"><table class="inv" id="inv"></table></div>
    </div>`;

  root.querySelectorAll("[data-go]").forEach((b) => b.addEventListener("click", () => go(b.dataset.go)));

  // tornillos de la ventanilla
  const port = root.querySelector("#porthole");
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const bolt = document.createElement("span");
    bolt.className = "bolt";
    bolt.style.left = `calc(50% + ${Math.cos(a) * 46.2}% - 4.5px)`;
    bolt.style.top = `calc(50% + ${Math.sin(a) * 46.2}% - 4.5px)`;
    port.appendChild(bolt);
  }

  const maxGb = Math.max(...inv.map((r) => r.gb));
  root.querySelector("#inv").innerHTML =
    `<thead><tr><th>Investigación</th><th>Área</th><th>Periodo</th><th class="num">Ensayos</th><th class="num">Tamaño total en PSI</th><th class="num">Descargado</th><th>DOI</th></tr></thead><tbody>` +
    [...inv].sort((a, b) => b.rows - a.rows).map((r) => `
      <tr>
        <td><div class="acr">${esc(r.acr || r.acc)}</div><div class="dim small">${esc(r.title)}</div></td>
        <td class="small">${esc(r.area)}</td>
        <td class="dim small" style="white-space:nowrap">${esc((r.start || "").slice(-4))}–${esc((r.end || "").slice(-4))}</td>
        <td class="num">${r.rows || "—"}</td>
        <td class="num">${r.gb >= 1 ? `${r.gb.toFixed(0)} GB` : `${(r.gb * 1000).toFixed(0)} MB`}<div class="sizebar"><i style="width:${Math.max(2, Math.sqrt(r.gb / maxGb) * 100)}%"></i></div></td>
        <td class="num">${r.mb >= 1000 ? `${(r.mb / 1000).toFixed(1)} GB` : `${r.mb.toFixed(0)} MB`}</td>
        <td style="white-space:nowrap">${r.doi ? `<a href="https://doi.org/${esc(r.doi)}" target="_blank" rel="noopener">${esc(r.acc)}</a>` : esc(r.acc)}</td>
      </tr>`).join("") + "</tbody>";

  // la llama de la ventanilla solo se anima con la vista abierta y la ventanilla en pantalla
  const heroSim = simulate(flex, HERO_Q);
  const flame = createFlame2D(root.querySelector("#hero-flame"), { getSim: () => heroSim, scale: 1.5, bg: "#020309", frac: 0.45 });
  let active = false;
  let visible = true;
  const io = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (active && visible) flame.start();
    else flame.stop();
  });
  io.observe(port);

  return {
    enter() { active = true; if (visible) flame.start(); },
    leave() { active = false; flame.stop(); },
  };
}
