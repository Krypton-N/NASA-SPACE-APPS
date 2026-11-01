import { esc } from "../core/dom.js";

const API_BASE = "http://127.0.0.1:5005/api/rag";

const SAMPLES = [
  {
    title: "Silicón: Tierra vs Órbita (Saffire-II)",
    prompt: "¿Por qué el silicón se autoextinguió en microgravedad durante Saffire-II mientras ardió completo en las pruebas en la Tierra?",
  },
  {
    title: "Gotas de Heptano y Llama Fría (FLEX)",
    prompt: "¿Qué observó el experimento FLEX en la ISS sobre la extinción de gotas de heptano y la presencia de llama fría?",
  },
  {
    title: "Atmósfera de Exploración (34% O₂)",
    prompt: "¿Qué riesgo existe en la atmósfera propuesta para misiones de exploración a 0.57 atm y 34% de oxígeno según los ensayos de NASA?",
  },
  {
    title: "Tela SIBAL vs PMMA Acrílico",
    prompt: "¿Cómo se compara la velocidad de propagación de la tela SIBAL frente al PMMA acrílico en flujo forzado de 20 cm/s en órbita?",
  },
];

export function mountRag(root, data, shared) {
  root.innerHTML = `
    <div class="section-head">
      <div class="eyebrow">Inteligencia Artificial Generativa + Cubo OLAP</div>
      <h2>Asistente Científico RAG</h2>
      <p class="lede">Consulta los 277 documentos técnicos de NTRS indexados localmente con <b>IVF (Inverted File Index)</b> y <b>Amazon Titan Embeddings</b>. Cada respuesta generada por <b>Google Gemma 3 (12B IT)</b> en AWS Bedrock se cruza en vivo mediante <code>titulo_paper</code> con la telemetría del Cubo OLAP de PSI.</p>
    </div>

    <!-- Status Bar -->
    <div class="rag-status-bar">
      <div class="rag-badge"><span class="dot-live"></span> Titan Embeddings (1536 dim)</div>
      <div class="rag-badge"><span class="dot-live"></span> Índice IVF (16 Celdas Voronoi)</div>
      <div class="rag-badge"><span class="dot-live"></span> Gemma 3 12B IT (AWS Bedrock)</div>
      <div class="rag-badge"><span class="dot-link"></span> Llave Foránea: <code>titulo_paper</code> → OLAP</div>
    </div>

    <!-- Main 2-Column Grid -->
    <div class="rag-layout">
      <!-- Columna Izquierda: Chatbot -->
      <div class="panel rag-chat-col">
        <div class="rag-chips-label">Preguntas sugeridas de investigación:</div>
        <div class="rag-prompt-chips" id="rag-chips"></div>

        <div class="rag-messages" id="rag-messages">
          <div class="rag-msg bot">
            <div class="rag-avatar">🚀</div>
            <div class="rag-bubble">
              <p><b>¡Hola! Soy el asistente científico de Flame in Freefall.</b></p>
              <p>Tengo acceso a los 277 reportes técnicos de NTRS y a los datos de telemetría del Cubo OLAP de la NASA. Puedes preguntarme sobre cualquier material, experimento (Saffire, FLEX, BASS), fenómeno de llama esférica o estándar de certificación de vuelo.</p>
            </div>
          </div>
        </div>

        <form class="rag-input-bar" id="rag-form">
          <input type="text" id="rag-input" placeholder="Pregunta sobre combustión, materiales o atmósferas espaciales..." autocomplete="off" />
          <button type="submit" class="btn primary" id="rag-send-btn">
            <span>Consultar RAG</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </button>
        </form>
      </div>

      <!-- Columna Derecha: Dashboard de Métricas del Paper Recuperado -->
      <div class="panel rag-dashboard-col" id="rag-dashboard">
        <div class="rag-dash-empty">
          <div style="font-size: 2.2rem; margin-bottom: 8px;">📊</div>
          <h3>Dashboard de Experimentos y Evidencia</h3>
          <p class="dim small">Realiza una consulta para que el índice IVF recupere los documentos de NTRS correspondientes y despliegue aquí el <b>chunk textual de evidencia</b> extraído por el embedding y la <b>tabla de experimentos del Cubo OLAP</b> con sus métricas.</p>
        </div>
      </div>
    </div>
  `;

  const chipsContainer = root.querySelector("#rag-chips");
  const messagesContainer = root.querySelector("#rag-messages");
  const form = root.querySelector("#rag-form");
  const input = root.querySelector("#rag-input");
  const sendBtn = root.querySelector("#rag-send-btn");
  const dashContainer = root.querySelector("#rag-dashboard");

  // Estado local del Dashboard para navegación por documentos y filtrado
  let dashState = {
    papers: [],
    activeIdx: 0,
    ivfStats: null,
    filterText: "",
  };

  // Render prompt chips
  chipsContainer.innerHTML = SAMPLES.map((s, idx) => `
    <button type="button" class="rag-chip" data-idx="${idx}">${esc(s.title)}</button>
  `).join("");

  chipsContainer.querySelectorAll(".rag-chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      const s = SAMPLES[parseInt(btn.dataset.idx, 10)];
      if (s) {
        input.value = s.prompt;
        submitQuery(s.prompt);
      }
    });
  });

  function appendMessage(role, text) {
    const isUser = role === "user";
    const div = document.createElement("div");
    div.className = `rag-msg ${isUser ? "user" : "bot"}`;
    div.innerHTML = `
      <div class="rag-avatar">${isUser ? "👨‍🚀" : "🚀"}</div>
      <div class="rag-bubble">
        ${isUser ? `<p>${esc(text)}</p>` : formatBotText(text)}
      </div>
    `;
    messagesContainer.appendChild(div);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  function formatBotText(raw) {
    let html = esc(raw);
    // Negritas
    html = html.replace(/\*\*(.*?)\*\*/g, "<b>$1</b>");
    // Listas con viñetas
    html = html.replace(/\n\s*•\s*(.*?)(?=\n|$)/g, "<li>$1</li>");
    html = html.replace(/\n\s*-\s*(.*?)(?=\n|$)/g, "<li>$1</li>");
    html = html.replace(/(<li>.*?<\/li>)/gs, "<ul>$1</ul>");
    // Párrafos
    html = html.split("\n\n").map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`).join("");
    return html;
  }

  function setDashboardData(papers, ivfStats) {
    dashState.papers = papers || [];
    dashState.activeIdx = 0;
    dashState.ivfStats = ivfStats || null;
    dashState.filterText = "";
    renderDashboard();
  }

  function renderDashboard() {
    if (!dashState.papers || dashState.papers.length === 0) {
      dashContainer.innerHTML = `
        <div class="rag-dash-empty">
          <div style="font-size: 2.2rem; margin-bottom: 8px;">📊</div>
          <h3>Dashboard de Experimentos y Evidencia</h3>
          <p class="dim small">Realiza una consulta para que el índice IVF recupere los documentos de NTRS correspondientes y despliegue aquí el <b>chunk textual de evidencia</b> extraído por el embedding y la <b>tabla de experimentos del Cubo OLAP</b> con sus métricas.</p>
        </div>
      `;
      return;
    }

    const paper = dashState.papers[dashState.activeIdx] || dashState.papers[0];
    const summary = paper.summary || {};
    const experiments = paper.experiments || [];

    // Filtrar experimentos según el texto de búsqueda local
    const q = (dashState.filterText || "").toLowerCase().trim();
    const filteredExps = experiments.filter((e) => {
      if (!q) return true;
      return (
        (e.nombre_material && e.nombre_material.toLowerCase().includes(q)) ||
        (e.categoria_quimica && e.categoria_quimica.toLowerCase().includes(q)) ||
        (e.fase_mision && e.fase_mision.toLowerCase().includes(q)) ||
        (e.titulo_paper && e.titulo_paper.toLowerCase().includes(q)) ||
        String(e.id_experimento).includes(q)
      );
    });

    dashContainer.innerHTML = `
      <div class="rag-dash-content">
        <!-- Navegación por documentos recuperados -->
        ${dashState.papers.length > 1 ? `
          <div class="rag-doc-nav">
            ${dashState.papers.map((p, idx) => `
              <button type="button" class="rag-doc-tab ${idx === dashState.activeIdx ? 'active' : ''}" data-doc-idx="${idx}">
                <span>📄 Doc #${idx + 1}: ${esc(p.titulo_paper ? p.titulo_paper.substring(0, 26) + '...' : 'Paper')}</span>
                <span class="tab-score">${(p.score * 100).toFixed(1)}%</span>
              </button>
            `).join("")}
          </div>
        ` : ""}

        <!-- Encabezado del Paper Activo -->
        <div class="rag-dash-header">
          <span class="rag-topic-tag">${esc(paper.topic || 'Spacecraft Fire Safety')}</span>
          <span class="dim small">NTRS ID: <b>${esc(paper.id_paper)}</b> · ${paper.year || 2024}</span>
        </div>

        <h3 class="rag-dash-title">${esc(paper.titulo_paper)}</h3>
        <div class="rag-dash-authors">${esc(paper.authors || 'NASA Research Team')}</div>

        <div style="margin: 10px 0 14px 0;">
          <a href="${esc(paper.url || `https://ntrs.nasa.gov/citations/${paper.id_paper}`)}" target="_blank" rel="noopener" class="btn small" style="display:inline-flex; align-items:center; gap:6px;">
            <span>Ver Documento Original en NTRS</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/></svg>
          </a>
        </div>

        <!-- 1. EL PEDAZO DE CHUNK DE INFORMACIÓN QUE SACÓ (EMBEDDING RECONSTRUIDO) -->
        <div class="rag-chunk-card">
          <div class="rag-chunk-header">
            <div style="font-weight:600; color:#fff; font-size:0.83rem; display:flex; align-items:center; gap:6px;">
              <span>📜 Evidencia Textual Recuperada (Chunk del Embedding Titan):</span>
            </div>
            <div style="display:flex; gap:6px;">
              <span class="rag-chunk-badge">⚡ Similitud: ${(paper.score * 100).toFixed(1)}%</span>
              <span class="rag-chunk-badge" style="color:var(--flame-b); background:rgba(255,107,53,0.15);">Voronoi #${paper.cluster_id ?? 0}</span>
            </div>
          </div>
          <div class="rag-chunk-body">
            "${esc(paper.chunk_text || 'Resumen y fragmento técnico indexado en la base vectorial IVF.')}"
          </div>
          <div style="font-size:10px; color:var(--muted); margin-top:6px;">
            ℹ️ De este fragmento exacto se extrajo el embedding vectorial para recuperar este paper y cruzarlo con el Cubo OLAP mediante <code>titulo_paper</code>.
          </div>
        </div>

        <!-- 2. MÉTRICAS CONSOLIDADAS DE ESE PAPER (CUBO OLAP) -->
        <div style="margin-bottom: 14px;">
          <div style="font-size:0.82rem; font-weight:600; color:var(--ink); margin-bottom:8px; text-transform:uppercase; letter-spacing:0.05em;">
            📊 Métricas Consolidadas del Paper (Cubo OLAP):
          </div>
          <div class="rag-kpi-grid">
            <div class="rag-kpi-box">
              <b>${summary.total_ensayos || experiments.length}</b>
              <span>Total Ensayos</span>
            </div>
            <div class="rag-kpi-box">
              <b>${summary.presion_avg !== undefined ? summary.presion_avg + ' PSI' : '14.7 PSI'}</b>
              <span>Presión Cabina</span>
            </div>
            <div class="rag-kpi-box">
              <b>${summary.oxigeno_avg !== undefined ? summary.oxigeno_avg + '%' : '21.0%'}</b>
              <span>Oxígeno O₂</span>
            </div>
            <div class="rag-kpi-box">
              <b>${summary.temp_max !== undefined && summary.temp_max !== null ? summary.temp_max + ' °C' : '1150 °C'}</b>
              <span>Temp Pico Máx</span>
            </div>
            <div class="rag-kpi-box">
              <b>${summary.tasa_avg !== null && summary.tasa_avg !== undefined ? summary.tasa_avg + ' mm/s' : '-'}</b>
              <span>Tasa Medida</span>
            </div>
            <div class="rag-kpi-box">
              <b>${summary.autoext_avg !== null && summary.autoext_avg !== undefined ? summary.autoext_avg + ' s' : 'Autoext.'}</b>
              <span>Autoextinción</span>
            </div>
          </div>
        </div>

        <!-- 3. TABLA DE EXPERIMENTOS DE ESTE PAPER (IDÉNTICA A LA IMAGEN / VISOR OLAP) -->
        <div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; flex-wrap:wrap; gap:8px;">
            <div style="font-size:0.82rem; font-weight:600; color:var(--ink); text-transform:uppercase; letter-spacing:0.05em;">
              🔬 Ensayos en Microgravedad de este Paper (Cubo OLAP)
            </div>
            <span style="font-size:11px; color:var(--muted);">
              Mostrando ${filteredExps.length} de ${experiments.length} ensayos
            </span>
          </div>

          <div class="rag-exp-filter">
            <input type="text" id="rag-exp-filter-inp" placeholder="Filtrar por material, misión o ID en estos ensayos..." value="${esc(dashState.filterText)}" />
          </div>

          <div class="rag-table-wrap">
            <table class="rag-table">
              <thead>
                <tr>
                  <th style="width: 45px;">ID</th>
                  <th>Material / Combustible</th>
                  <th>Misión / Hardware</th>
                  <th>P (PSI)</th>
                  <th>O₂ %</th>
                  <th>Flujo</th>
                  <th>Tasa Medida</th>
                  <th>Temp Pico</th>
                  <th>Autoext.</th>
                  <th style="min-width: 220px;">Documento NTRS (Título Completo del Paper)</th>
                </tr>
              </thead>
              <tbody>
                ${filteredExps.length > 0 ? filteredExps.map((exp) => `
                  <tr>
                    <td class="exp-id">#${exp.id_experimento}</td>
                    <td>
                      <span class="exp-mat-name">${esc(exp.nombre_material)}</span>
                      <span class="exp-mat-cat">${esc(exp.categoria_quimica || '')}</span>
                    </td>
                    <td>
                      <span class="exp-mission-badge">${esc(exp.fase_mision || 'ISS')}</span>
                    </td>
                    <td>${exp.presion_psi !== null && exp.presion_psi !== undefined ? Number(exp.presion_psi).toFixed(1) : '-'}</td>
                    <td><b>${exp.oxigeno_percent !== null && exp.oxigeno_percent !== undefined ? Number(exp.oxigeno_percent).toFixed(1) + '%' : '-'}</b></td>
                    <td>${exp.flujo_aire_cm_s !== null && exp.flujo_aire_cm_s !== undefined ? exp.flujo_aire_cm_s : '-'}</td>
                    <td>${exp.tasa_propagacion_avg !== null && exp.tasa_propagacion_avg !== undefined ? exp.tasa_propagacion_avg : '-'}</td>
                    <td>${exp.temp_maxima_global ? exp.temp_maxima_global + ' °C' : '-'}</td>
                    <td>${exp.tiempo_autoextincion ? exp.tiempo_autoextincion + ' s' : '-'}</td>
                    <td>
                      <span class="exp-paper-title">${esc(exp.titulo_paper || paper.titulo_paper)}</span>
                      <span class="exp-paper-meta">
                        <a href="${esc(exp.url_pdf_ntrs || paper.url || `https://ntrs.nasa.gov/citations/${exp.id_paper || paper.id_paper}`)}" target="_blank" class="exp-paper-link">
                          📄 NTRS ID: ${esc(exp.id_paper || paper.id_paper)}
                        </a> · ${esc(exp.autores ? exp.autores.split(';')[0] : (paper.authors ? paper.authors.split(';')[0] : ''))}
                      </span>
                    </td>
                  </tr>
                `).join("") : `
                  <tr>
                    <td colspan="10" style="text-align:center; padding:18px; color:var(--muted);">
                      No se encontraron ensayos que coincidan con el filtro ingresado.
                    </td>
                  </tr>
                `}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    // Event listeners para tabs de documentos
    dashContainer.querySelectorAll(".rag-doc-tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.dataset.docIdx, 10);
        if (idx !== dashState.activeIdx) {
          dashState.activeIdx = idx;
          dashState.filterText = "";
          renderDashboard();
        }
      });
    });

    // Event listener para filtro instantáneo de la tabla
    const filterInput = dashContainer.querySelector("#rag-exp-filter-inp");
    if (filterInput) {
      filterInput.addEventListener("input", (e) => {
        dashState.filterText = e.target.value;
        renderDashboard();
        // Restaurar cursor en el input
        const reInput = dashContainer.querySelector("#rag-exp-filter-inp");
        if (reInput) {
          reInput.focus();
          reInput.selectionStart = reInput.selectionEnd = reInput.value.length;
        }
      });
    }
  }

  async function submitQuery(q) {
    if (!q || !q.trim()) return;
    const queryText = q.trim();

    appendMessage("user", queryText);
    input.value = "";
    sendBtn.disabled = true;

    // Loading indicator
    const loadDiv = document.createElement("div");
    loadDiv.className = "rag-msg bot";
    loadDiv.id = "rag-loading-bubble";
    loadDiv.innerHTML = `
      <div class="rag-avatar">🚀</div>
      <div class="rag-bubble dim" style="display:flex; align-items:center; gap:8px;">
        <span class="spinner"></span>
        <span>Sondeando índice IVF, cruzando Cubo OLAP y consultando Gemma 3 (12B)...</span>
      </div>
    `;
    messagesContainer.appendChild(loadDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    try {
      const resp = await fetch(`${API_BASE}/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: queryText, n_probe: 3, top_k: 3 }),
      });

      const loadBubble = document.getElementById("rag-loading-bubble");
      if (loadBubble) loadBubble.remove();

      if (!resp.ok) {
        throw new Error(`Error en servidor RAG (${resp.status}): ${await resp.text()}`);
      }

      const result = await resp.json();
      appendMessage("bot", result.answer);

      // Cargar los documentos recuperados con su chunk y experimentos al dashboard
      const retrievedDocs = result.all_retrieved_papers && result.all_retrieved_papers.length > 0
        ? result.all_retrieved_papers
        : (result.primary_paper ? [result.primary_paper] : []);

      setDashboardData(retrievedDocs, result.ivf_stats);
    } catch (err) {
      const loadBubble = document.getElementById("rag-loading-bubble");
      if (loadBubble) loadBubble.remove();

      appendMessage(
        "bot",
        `**[Conexión con el Servidor RAG]**\n\nNo se pudo conectar con el endpoint local en \`http://127.0.0.1:5005\`. Asegúrate de que el servidor esté activo ejecutando:\n\`python scripts/rag_api_server.py\`\n\n*Detalle técnico:* ${err.message}`
      );
    } finally {
      sendBtn.disabled = false;
    }
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    submitQuery(input.value);
  });

  return {};
}
