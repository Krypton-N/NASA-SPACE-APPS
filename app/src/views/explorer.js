import { FLEX_DOI } from "../core/dom.js";
import { chipGroup } from "../ui/chips.js";
import { drawScatter, legendHTML } from "../charts/scatter.js";
import { drawExtinction } from "../charts/extinction.js";
import { drawCoverage } from "../charts/coverage.js";

export function mountExplorer(root, data) {
  const flex = data.flex;
  const f = { fuel: new Set(["Methanol", "Heptane"]), co2: "all", he: "all" };
  const pass = (r) =>
    f.fuel.has(r.fuel) &&
    (f.co2 === "all" || (f.co2 === "none") === (r.co2 === 0)) &&
    (f.he === "all" || (f.he === "none") === (r.he === 0));

  root.innerHTML = `
    <div class="section-head">
      <div class="eyebrow">FLEX · Flame Extinguishment Experiment · ISS 2009–2011</div>
      <h2>Tasa de quemado contra oxígeno</h2>
      <p class="lede">Cada punto es una gota de combustible encendida en la Estación Espacial. La tasa de quemado K mide qué tan rápido se consume la gota (ley d²: d² = d₀² − K·t). El relleno indica cómo terminó el ensayo.</p>
    </div>
    <div class="panel stack">
      <div class="filters">
        <div class="chips" id="f-fuel"></div>
        <div class="chips" id="f-co2"></div>
        <div class="chips" id="f-he"></div>
      </div>
      <div class="legend" id="lg-scatter"></div>
      <svg class="chart" id="scatter" viewBox="0 0 820 420" role="img" aria-label="Dispersión de tasa de quemado contra fracción molar de oxígeno"></svg>
      <div class="dim small" id="scatter-count"></div>
    </div>
    <div class="grid-2">
      <div class="panel stack">
        <div class="panel-title"><h3>¿Dónde hay datos y dónde no?</h3><span class="dim small">ensayos por celda</span></div>
        <div class="cov-legend" id="cov-legend"></div>
        <svg class="chart" id="coverage" viewBox="0 0 560 330" role="img" aria-label="Mapa de cobertura de ensayos por oxígeno y presión"></svg>
        <p class="dim small">Celdas punteadas = combinación sin ningún ensayo. La atmósfera propuesta para exploración cae fuera de lo medido: ahí la predicción tiene que apoyarse en física y avisar.</p>
      </div>
      <div class="panel stack">
        <h3>Probabilidad de extinción por nivel de O₂</h3>
        <div class="legend" id="lg-bars"></div>
        <svg class="chart" id="bars" viewBox="0 0 500 320" role="img" aria-label="Porcentaje de ensayos que terminaron en extinción por rango de oxígeno"></svg>
        <p class="dim small">Encima de cada barra: número de ensayos en ese rango. Respeta los filtros de arriba.</p>
      </div>
    </div>
    <div class="panel stack">
      <h3>Cómo leer esto</h3>
      <ul class="tight">
        <li><b>Metanol</b> casi no produce hollín y arde con llama azul tenue. <b>Heptano</b> se parece a los combustibles líquidos comunes y sí produce hollín.</li>
        <li>En microgravedad la llama es una esfera alrededor de la gota: sin flotabilidad, el oxígeno llega solo por difusión.</li>
        <li><b>Extinción</b>: la llama se apagó antes de consumir la gota. <b>Completa</b>: ardió hasta el final. <b>Disrupción</b>: la gota se fragmentó o se desplazó.</li>
        <li>FLEX añadió CO₂ y helio a la atmósfera para medir su efecto como supresores. Los extintores de la ISS son de CO₂.</li>
      </ul>
      <p class="dim small">Fuente: PSI-69 FLEX, tabla experimental (licencia CC0). <a href="${FLEX_DOI}" target="_blank" rel="noopener">doi:10.60555/mbq8-0451</a></p>
    </div>`;

  const q = (s) => root.querySelector(s);
  const draw = () => {
    const rows = flex.filter(pass);
    const pts = rows.filter((r) => r.K != null && r.o2 != null);
    drawScatter(q("#scatter"), pts);
    q("#scatter-count").textContent = `${pts.length} ensayos mostrados de ${flex.length}. Pasa el cursor sobre un punto para ver sus condiciones.`;
    drawExtinction(q("#bars"), rows, ["Methanol", "Heptane"].filter((x) => f.fuel.has(x)));
    const seq = drawCoverage(q("#coverage"), rows);
    q("#cov-legend").innerHTML =
      `<span>0</span><i style="border:1px dashed var(--line-2)"></i>` +
      ["1", "2–3", "4–6", "7–12", "13–24", "25+"].map((l, i) => `<i style="background:${seq[i]}"></i><span>${l}</span>`).join("");
  };

  chipGroup(q("#f-fuel"), "Combustible", [["Methanol", "Metanol"], ["Heptane", "Heptano"]], (v) => f.fuel.has(v), (v) => {
    if (f.fuel.has(v) && f.fuel.size > 1) f.fuel.delete(v);
    else f.fuel.add(v);
    draw();
  });
  chipGroup(q("#f-co2"), "CO₂", [["all", "Todos"], ["none", "Sin CO₂"], ["some", "Con CO₂"]], (v) => f.co2 === v, (v) => { f.co2 = v; draw(); });
  chipGroup(q("#f-he"), "Helio", [["all", "Todos"], ["none", "Sin He"], ["some", "Con He"]], (v) => f.he === v, (v) => { f.he = v; draw(); });
  q("#lg-scatter").innerHTML = legendHTML(true);
  q("#lg-bars").innerHTML = legendHTML(false);
  draw();
  return {};
}
