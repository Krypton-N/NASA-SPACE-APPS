import { ICON } from "../core/dom.js";

const FLOW = [
  { step: "01", h: "Fuentes", p: "PSI, NTRS y Task Book: tablas, PDFs y fichas de proyecto.", who: "Datos" },
  { step: "02", h: "Triage", p: "¿El fragmento habla de un experimento y reporta una medición?", who: "Jev", jev: true },
  { step: "03", h: "Extracción", p: "Un LLM llena un esquema fijo con valor, unidades y cita textual.", who: "LLM" },
  { step: "04", h: "Verificación", p: "¿La cita respalda el valor? La confianza decide si se acepta o se revisa.", who: "Jev", jev: true },
  { step: "05", h: "Modelo", p: "Vecinos más cercanos hoy; proceso gaussiano con datos de Cantera después.", who: "ML + física" },
  { step: "06", h: "Dashboard", p: "Un router tipado decide si la pregunta va a SQL, a RAG o al simulador.", who: "Jev", jev: true },
];

export function mountPipeline(root) {
  root.innerHTML = `
    <div class="section-head">
      <div class="eyebrow">Arquitectura propuesta</div>
      <h2>De 30 años de PDFs a recomendaciones con cita</h2>
      <p class="lede">Cada paso usa la herramienta que mejor encaja. Jev, de TypeSafe AI, devuelve decisiones tipadas (elegir una opción, sí o no, puntuar) con probabilidad calibrada: encaja en clasificar y verificar, no en predecir el fuego ni en extraer números.</p>
    </div>
    <div class="flow">
      ${FLOW.map((n) => `
        <div class="flow-node ${n.jev ? "jev" : ""}">
          <span class="step">${n.step}</span>
          <h3>${n.h}</h3>
          <p>${n.p}</p>
          <span class="who ${n.jev ? "jev" : ""}">${n.who}</span>
        </div>`).join("")}
    </div>
    <div class="grid-2">
      <div class="panel stack">
        <h3>Preguntas atómicas para el triage</h3>
        <p class="dim small">Cada fragmento de los 277 documentos pasa por estas decisiones. Solo los relevantes llegan al extractor, que es el paso caro.</p>
<pre class="code"><span class="k">estado</span>   fragmento de texto + título del documento
<span class="k">choice</span>   experimento = FLEX | FLEX-2 | BASS | Saffire | SoFIE |
                       ACME | SAME | otro | ninguno
<span class="k">noul</span>     reporta_medicion_cuantitativa
<span class="k">choice</span>   magnitud = velocidad_propagacion | limite_extincion |
                    tasa_quemado | tiempo_ignicion |
                    tamano_particula_humo | otra</pre>
      </div>
      <div class="panel stack">
        <h3>Verificación dirigida por confianza</h3>
        <p class="dim small">Pregunta sí o no: «¿la cita textual respalda el valor extraído con esas unidades?». En lugar de revisar una muestra al azar, las personas revisan solo lo dudoso.</p>
        <div class="policy">
          <div><span class="status st-good">${ICON.good}Aceptar</span><span><b>≥ 0.90</b> · entra a la tabla</span></div>
          <div><span class="status st-warn">${ICON.warn}Revisar</span><span><b>0.60–0.90</b> · cola humana</span></div>
          <div><span class="status st-crit">${ICON.crit}Descartar</span><span><b>&lt; 0.60</b> · se registra el motivo</span></div>
        </div>
        <p class="dim small">Umbrales iniciales; se ajustan con ~100 fragmentos etiquetados a mano.</p>
      </div>
    </div>
    <div class="grid-2">
      <div class="panel stack">
        <h3>Qué no le pediríamos a Jev</h3>
        <ul class="tight">
          <li>Predecir si un material arde: eso lo decide el modelo entrenado con ensayos, con física detrás.</li>
          <li>Extraer números o redactar respuestas: no genera texto.</li>
          <li>Recomendaciones sin cita: todo sale de la tabla verificada.</li>
        </ul>
      </div>
      <div class="panel stack">
        <h3>Antes de adoptarlo</h3>
        <ul class="tight">
          <li>Está en acceso anticipado: hay que pedir acceso en console.typesafe.ai con tiempo.</li>
          <li>Las cifras de velocidad y costo son del fabricante: medirlas con nuestro conjunto etiquetado y compararlas contra un LLM pequeño.</li>
          <li>Si no llega a tiempo, el mismo pipeline funciona con un LLM en modo clasificación.</li>
        </ul>
      </div>
    </div>`;
  return {};
}
