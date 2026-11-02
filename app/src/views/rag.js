import { esc } from "../core/dom.js";

const API_BASE = "http://127.0.0.1:5005/api/rag";

// Catálogo base de Foundation Models en Amazon Bedrock
const DEFAULT_MODELS = [
  // --- Anthropic ---
  {
    id: "us.anthropic.claude-sonnet-4-6",
    name: "Claude Sonnet 4.6",
    provider: "Anthropic",
    family: "Claude",
    description: "Modelo insignia para análisis técnico complejo, extracción científica rigurosa y síntesis de literatura aeroespacial.",
    modalities: ["TEXT", "IMAGE"],
    context_window: "200K",
    category: "Científico & Multimodal",
    is_verified: true,
    badge: "Recomendado",
    speed: "Rápido (~1.4s)",
    default_temp: 0.2,
    default_tokens: 1500,
  },
  {
    id: "us.anthropic.claude-sonnet-4-5-20250929-v1:0",
    name: "Claude Sonnet 4.5",
    provider: "Anthropic",
    family: "Claude",
    description: "Excelente precisión en contrastes cuantitativos de telemetría y formulación de hipótesis en microgravedad.",
    modalities: ["TEXT", "IMAGE"],
    context_window: "200K",
    category: "Científico & Multimodal",
    is_verified: true,
    speed: "Rápido (~1.5s)",
    default_temp: 0.2,
    default_tokens: 1500,
  },
  {
    id: "us.anthropic.claude-haiku-4-5-20251001-v1:0",
    name: "Claude Haiku 4.5",
    provider: "Anthropic",
    family: "Claude",
    description: "Generación ultrarrápida de respuestas técnicas para exploración interactiva y verificación de parámetros de vuelo.",
    modalities: ["TEXT", "IMAGE"],
    context_window: "200K",
    category: "Ultra-Rápido",
    is_verified: true,
    badge: "Ultra Veloz",
    speed: "Inmediato (~0.7s)",
    default_temp: 0.2,
    default_tokens: 1000,
  },
  {
    id: "us.anthropic.claude-opus-4-6-v1",
    name: "Claude Opus 4.6",
    provider: "Anthropic",
    family: "Claude",
    description: "Máxima profundidad analítica para evaluación de riesgos de incendio, cinética química y certificación espacial.",
    modalities: ["TEXT", "IMAGE"],
    context_window: "200K",
    category: "Razonamiento Profundo",
    is_verified: true,
    badge: "Máxima Profundidad",
    speed: "Moderado (~2.8s)",
    default_temp: 0.1,
    default_tokens: 2048,
  },
  {
    id: "us.anthropic.claude-opus-4-5-20251101-v1:0",
    name: "Claude Opus 4.5",
    provider: "Anthropic",
    family: "Claude",
    description: "Capacidad avanzada de razonamiento formal y revisión cruzada de estándares NASA-STD-6001B.",
    modalities: ["TEXT", "IMAGE"],
    context_window: "200K",
    category: "Razonamiento Profundo",
    is_verified: true,
    speed: "Moderado (~3.0s)",
    default_temp: 0.1,
    default_tokens: 2048,
  },

  // --- DeepSeek ---
  {
    id: "us.deepseek.r1-v1:0",
    name: "DeepSeek-R1",
    provider: "DeepSeek",
    family: "DeepSeek",
    description: "Razonamiento por cadena de pensamiento (Chain-of-Thought) paso a paso en fenómenos de convección forzada y llama fría.",
    modalities: ["TEXT"],
    context_window: "128K",
    category: "Razonamiento Profundo",
    is_verified: true,
    badge: "CoT Reasoning",
    speed: "Analítico (~2.4s)",
    default_temp: 0.3,
    default_tokens: 2048,
  },

  // --- Amazon (Nova & Titan) ---
  {
    id: "us.amazon.nova-pro-v1:0",
    name: "Amazon Nova Pro",
    provider: "Amazon",
    family: "Nova",
    description: "Modelo insignia multimodal de Amazon optimizado para análisis de diagramas y reportes científicos aeroespaciales.",
    modalities: ["TEXT", "IMAGE", "VIDEO"],
    context_window: "300K",
    category: "Científico & Multimodal",
    is_verified: true,
    badge: "Amazon Flagship",
    speed: "Rápido (~1.2s)",
    default_temp: 0.2,
    default_tokens: 1500,
  },
  {
    id: "us.amazon.nova-2-lite-v1:0",
    name: "Amazon Nova 2 Lite",
    provider: "Amazon",
    family: "Nova",
    description: "Segunda generación de Nova optimizada para alta velocidad con amplia ventana de 256K tokens.",
    modalities: ["TEXT", "IMAGE", "VIDEO"],
    context_window: "256K",
    category: "Ultra-Rápido",
    is_verified: true,
    badge: "Nueva Generación",
    speed: "Ultra Veloz (~0.8s)",
    default_temp: 0.2,
    default_tokens: 1200,
  },
  {
    id: "us.amazon.nova-lite-v1:0",
    name: "Amazon Nova Lite",
    provider: "Amazon",
    family: "Nova",
    description: "Inferencia de baja latencia diseñada para respuestas estructuradas e integración fluida en tiempo real.",
    modalities: ["TEXT", "IMAGE", "VIDEO"],
    context_window: "300K",
    category: "Ultra-Rápido",
    is_verified: true,
    speed: "Inmediato (~0.7s)",
    default_temp: 0.2,
    default_tokens: 1000,
  },
  {
    id: "us.amazon.nova-micro-v1:0",
    name: "Amazon Nova Micro",
    provider: "Amazon",
    family: "Nova",
    description: "Modelo ultra-compacto de texto puro con latencia sub-segundo para consultas directas del catálogo.",
    modalities: ["TEXT"],
    context_window: "128K",
    category: "Ultra-Rápido",
    is_verified: true,
    speed: "Ultra Veloz (~0.5s)",
    default_temp: 0.1,
    default_tokens: 800,
  },

  // --- Meta (Llama) ---
  {
    id: "us.meta.llama4-maverick-17b-instruct-v1:0",
    name: "Llama 4 Maverick 17B",
    provider: "Meta",
    family: "Llama",
    description: "Arquitectura de última generación Llama 4 con razonamiento refinado y capacidades multimodales nativas.",
    modalities: ["TEXT", "IMAGE"],
    context_window: "128K",
    category: "Modelos Abiertos",
    is_verified: true,
    badge: "Llama 4",
    speed: "Rápido (~1.3s)",
    default_temp: 0.2,
    default_tokens: 1500,
  },
  {
    id: "us.meta.llama4-scout-17b-instruct-v1:0",
    name: "Llama 4 Scout 17B",
    provider: "Meta",
    family: "Llama",
    description: "Variante Llama 4 optimizada para exploración de hipótesis y síntesis conceptual en ciencia espacial.",
    modalities: ["TEXT", "IMAGE"],
    context_window: "128K",
    category: "Modelos Abiertos",
    is_verified: true,
    speed: "Rápido (~1.4s)",
    default_temp: 0.2,
    default_tokens: 1500,
  },
  {
    id: "us.meta.llama3-3-70b-instruct-v1:0",
    name: "Llama 3.3 70B Instruct",
    provider: "Meta",
    family: "Llama",
    description: "El modelo abierto insignia de 70B parámetros de Meta, entrenado para responder con rigor y fidelidad al contexto.",
    modalities: ["TEXT"],
    context_window: "128K",
    category: "Modelos Abiertos",
    is_verified: true,
    badge: "Top Open-Weight",
    speed: "Equilibrado (~1.9s)",
    default_temp: 0.2,
    default_tokens: 1500,
  },
  {
    id: "us.meta.llama3-1-8b-instruct-v1:0",
    name: "Llama 3.1 8B Instruct",
    provider: "Meta",
    family: "Llama",
    description: "Modelo de 8B parámetros con excelente agilidad y apego estricto a las directrices de los datos OLAP.",
    modalities: ["TEXT"],
    context_window: "128K",
    category: "Modelos Abiertos",
    is_verified: true,
    speed: "Rápido (~0.9s)",
    default_temp: 0.2,
    default_tokens: 1000,
  },
  {
    id: "meta.llama3-8b-instruct-v1:0",
    name: "Llama 3 8B Instruct",
    provider: "Meta",
    family: "Llama",
    description: "Versión compacta clásica de Llama 3 para inferencia veloz y confiable.",
    modalities: ["TEXT"],
    context_window: "8K",
    category: "Modelos Abiertos",
    is_verified: true,
    speed: "Rápido (~0.8s)",
    default_temp: 0.2,
    default_tokens: 800,
  },

  // --- Google ---
  {
    id: "google.gemma-3-12b-it",
    name: "Gemma 3 12B IT",
    provider: "Google",
    family: "Gemma",
    description: "Modelo insignia de Google en Bedrock, con comprensión matemática y científica de alto nivel para microgravedad.",
    modalities: ["TEXT", "IMAGE"],
    context_window: "128K",
    category: "Científico & Multimodal",
    is_verified: true,
    badge: "Default NASA",
    speed: "Rápido (~1.1s)",
    default_temp: 0.2,
    default_tokens: 1200,
  },
  {
    id: "google.gemma-3-27b-it",
    name: "Gemma 3 27B PT",
    provider: "Google",
    family: "Gemma",
    description: "Versión extendida de 27B parámetros con mayor capacidad de abstracción termodinámica y química.",
    modalities: ["TEXT", "IMAGE"],
    context_window: "128K",
    category: "Científico & Multimodal",
    is_verified: true,
    speed: "Equilibrado (~1.8s)",
    default_temp: 0.2,
    default_tokens: 1500,
  },
  {
    id: "google.gemma-3-4b-it",
    name: "Gemma 3 4B IT",
    provider: "Google",
    family: "Gemma",
    description: "Modelo liviano de 4B para respuestas concisas y de latencia mínima.",
    modalities: ["TEXT", "IMAGE"],
    context_window: "128K",
    category: "Ultra-Rápido",
    is_verified: true,
    speed: "Ultra Veloz (~0.6s)",
    default_temp: 0.2,
    default_tokens: 800,
  },

  // --- Mistral AI ---
  {
    id: "mistral.mistral-large-3-675b-instruct",
    name: "Mistral Large 3",
    provider: "Mistral AI",
    family: "Mistral",
    description: "Modelo MoE de escala masiva (675B) con razonamiento superior y soporte multimodal de vanguardia.",
    modalities: ["TEXT", "IMAGE"],
    context_window: "128K",
    category: "Razonamiento Profundo",
    is_verified: true,
    badge: "MoE 675B",
    speed: "Potente (~2.4s)",
    default_temp: 0.2,
    default_tokens: 2000,
  },
  {
    id: "us.mistral.pixtral-large-2502-v1:0",
    name: "Pixtral Large 25.02",
    provider: "Mistral AI",
    family: "Mistral",
    description: "Especialista en análisis de imágenes e ilustraciones experimentales junto a texto técnico.",
    modalities: ["TEXT", "IMAGE"],
    context_window: "128K",
    category: "Científico & Multimodal",
    is_verified: true,
    speed: "Rápido (~1.5s)",
    default_temp: 0.2,
    default_tokens: 1500,
  },
  {
    id: "mistral.ministral-3-14b-instruct",
    name: "Ministral 14B 3.0",
    provider: "Mistral AI",
    family: "Mistral",
    description: "Alta densidad de razonamiento en formato compacto de 14B para inferencia eficiente.",
    modalities: ["TEXT", "IMAGE"],
    context_window: "128K",
    category: "Científico & Multimodal",
    is_verified: true,
    speed: "Rápido (~1.0s)",
    default_temp: 0.2,
    default_tokens: 1200,
  },
  {
    id: "mistral.ministral-3-8b-instruct",
    name: "Ministral 3 8B",
    provider: "Mistral AI",
    family: "Mistral",
    description: "Modelo de 8B parámetros optimizado para baja latencia con comprensión de imágenes.",
    modalities: ["TEXT", "IMAGE"],
    context_window: "128K",
    category: "Ultra-Rápido",
    is_verified: true,
    speed: "Ultra Veloz (~0.8s)",
    default_temp: 0.2,
    default_tokens: 1000,
  },
  {
    id: "mistral.mixtral-8x7b-instruct-v0:1",
    name: "Mixtral 8x7B Instruct",
    provider: "Mistral AI",
    family: "Mistral",
    description: "Pionero en Mixture-of-Experts con enrutamiento dinámico de conocimiento técnico.",
    modalities: ["TEXT"],
    context_window: "32K",
    category: "Modelos Abiertos",
    is_verified: true,
    speed: "Rápido (~1.2s)",
    default_temp: 0.2,
    default_tokens: 1200,
  },
  {
    id: "mistral.mistral-7b-instruct-v0:2",
    name: "Mistral 7B Instruct v0.2",
    provider: "Mistral AI",
    family: "Mistral",
    description: "Modelo de referencia de 7B de alta eficiencia computacional.",
    modalities: ["TEXT"],
    context_window: "32K",
    category: "Modelos Abiertos",
    is_verified: true,
    speed: "Inmediato (~0.7s)",
    default_temp: 0.2,
    default_tokens: 800,
  },

  // --- Qwen ---
  {
    id: "qwen.qwen3-32b-v1:0",
    name: "Qwen3 32B (dense)",
    provider: "Qwen",
    family: "Qwen",
    description: "Modelo denso de 32B con capacidades matemáticas, químicas y de ingeniería aeroespacial excepcionales.",
    modalities: ["TEXT"],
    context_window: "128K",
    category: "Científico & Multimodal",
    is_verified: true,
    badge: "Alta Precisión",
    speed: "Equilibrado (~1.5s)",
    default_temp: 0.2,
    default_tokens: 1500,
  },
  {
    id: "qwen.qwen3-next-80b-a3b",
    name: "Qwen3 Next 80B A3B",
    provider: "Qwen",
    family: "Qwen",
    description: "Arquitectura avanzada de 80B con atención adaptativa para documentos científicos extensos.",
    modalities: ["TEXT"],
    context_window: "128K",
    category: "Razonamiento Profundo",
    is_verified: true,
    speed: "Potente (~2.1s)",
    default_temp: 0.2,
    default_tokens: 1800,
  },
  {
    id: "qwen.qwen3-coder-next",
    name: "Qwen3 Coder Next",
    provider: "Qwen",
    family: "Qwen",
    description: "Especialista en análisis algorítmico, formulación numérica y extracción cuantitativa de datos.",
    modalities: ["TEXT"],
    context_window: "128K",
    category: "Científico & Multimodal",
    is_verified: true,
    speed: "Rápido (~1.3s)",
    default_temp: 0.1,
    default_tokens: 1500,
  },
  {
    id: "qwen.qwen3-coder-30b-a3b-v1:0",
    name: "Qwen3 Coder 30B",
    provider: "Qwen",
    family: "Qwen",
    description: "Modelo de programación y lógica técnica enfocado en consistencia cuantitativa.",
    modalities: ["TEXT"],
    context_window: "128K",
    category: "Científico & Multimodal",
    is_verified: true,
    speed: "Rápido (~1.4s)",
    default_temp: 0.1,
    default_tokens: 1200,
  },

  // --- NVIDIA ---
  {
    id: "nvidia.nemotron-super-3-120b",
    name: "Nemotron 3 Super 120B",
    provider: "NVIDIA",
    family: "Nemotron",
    description: "Supermodelo de 120B optimizado por NVIDIA para inferencia acelerada de dominios científicos.",
    modalities: ["TEXT"],
    context_window: "128K",
    category: "Razonamiento Profundo",
    is_verified: true,
    badge: "NVIDIA Super 120B",
    speed: "Potente (~2.2s)",
    default_temp: 0.2,
    default_tokens: 1800,
  },
  {
    id: "nvidia.nemotron-nano-12b-v2",
    name: "Nemotron Nano 12B v2",
    provider: "NVIDIA",
    family: "Nemotron",
    description: "Modelo compacto de 12B con precisión BF16 optimizada para inferencia científica veloz.",
    modalities: ["TEXT", "IMAGE"],
    context_window: "128K",
    category: "Ultra-Rápido",
    is_verified: true,
    speed: "Rápido (~1.0s)",
    default_temp: 0.2,
    default_tokens: 1200,
  },
  {
    id: "nvidia.nemotron-nano-3-30b",
    name: "Nemotron Nano 3 30B",
    provider: "NVIDIA",
    family: "Nemotron",
    description: "Variante de 30B diseñada para compresión y síntesis de reportes extensos.",
    modalities: ["TEXT"],
    context_window: "128K",
    category: "Científico & Multimodal",
    is_verified: true,
    speed: "Equilibrado (~1.5s)",
    default_temp: 0.2,
    default_tokens: 1400,
  },
  {
    id: "nvidia.nemotron-nano-9b-v2",
    name: "Nemotron Nano 9B v2",
    provider: "NVIDIA",
    family: "Nemotron",
    description: "Modelo ligero de 9B con excelente balance entre velocidad y precisión conceptual.",
    modalities: ["TEXT"],
    context_window: "128K",
    category: "Ultra-Rápido",
    is_verified: true,
    speed: "Ultra Veloz (~0.8s)",
    default_temp: 0.2,
    default_tokens: 1000,
  },

  // --- MiniMax ---
  {
    id: "minimax.minimax-m2.5",
    name: "MiniMax M2.5",
    provider: "MiniMax",
    family: "MiniMax",
    description: "Modelo conversacional avanzado para diálogos técnicos interactivos y exploración guiada de hipótesis.",
    modalities: ["TEXT"],
    context_window: "128K",
    category: "Científico & Multimodal",
    is_verified: true,
    speed: "Rápido (~1.2s)",
    default_temp: 0.2,
    default_tokens: 1500,
  },
  {
    id: "minimax.minimax-m2.1",
    name: "MiniMax M2.1",
    provider: "MiniMax",
    family: "MiniMax",
    description: "Alta solidez analítica para contraste entre normas terrestres y microgravedad.",
    modalities: ["TEXT"],
    context_window: "128K",
    category: "Científico & Multimodal",
    is_verified: true,
    speed: "Rápido (~1.3s)",
    default_temp: 0.2,
    default_tokens: 1200,
  },
  {
    id: "minimax.minimax-m2",
    name: "MiniMax M2",
    provider: "MiniMax",
    family: "MiniMax",
    description: "Inferencia ágil para procesamiento de consultas del catálogo espacial.",
    modalities: ["TEXT"],
    context_window: "128K",
    category: "Ultra-Rápido",
    is_verified: true,
    speed: "Ultra Veloz (~0.9s)",
    default_temp: 0.2,
    default_tokens: 1000,
  },

  // --- OpenAI (Mantle / Bedrock) ---
  {
    id: "openai.gpt-oss-120b-1:0",
    name: "GPT OSS 120B",
    provider: "OpenAI",
    family: "GPT OSS",
    description: "Modelo de pesos abiertos de gran escala (120B) con salvaguardas avanzadas y razonamiento formal.",
    modalities: ["TEXT"],
    context_window: "128K",
    category: "Modelos Abiertos",
    is_verified: true,
    badge: "OpenAI Open-Weight",
    speed: "Equilibrado (~1.7s)",
    default_temp: 0.2,
    default_tokens: 1500,
  },
  {
    id: "openai.gpt-oss-20b-1:0",
    name: "GPT OSS 20B",
    provider: "OpenAI",
    family: "GPT OSS",
    description: "Versión compacta de 20B para razonamiento de alta velocidad con verificación de datos.",
    modalities: ["TEXT"],
    context_window: "128K",
    category: "Ultra-Rápido",
    is_verified: true,
    speed: "Ultra Veloz (~0.7s)",
    default_temp: 0.2,
    default_tokens: 1000,
  },

  // --- Modelos de Frontera ---
  {
    id: "us.anthropic.claude-sonnet-5-5",
    name: "Claude Sonnet 5.5",
    provider: "Anthropic",
    family: "Claude 5",
    description: "Nueva frontera Claude 5.x para síntesis autónoma de investigación científica.",
    modalities: ["TEXT", "IMAGE"],
    context_window: "500K",
    category: "Frontera",
    is_verified: false,
    badge: "Próxima Gen",
    speed: "Frontera",
    default_temp: 0.2,
    default_tokens: 2048,
  },
  {
    id: "us.openai.gpt-6.1-terra",
    name: "GPT-6.1 Terra",
    provider: "OpenAI",
    family: "GPT-6",
    description: "Modelo frontera OpenAI Mantle en Bedrock para razonamiento visual y científico extremo.",
    modalities: ["TEXT", "IMAGE"],
    context_window: "500K",
    category: "Frontera",
    is_verified: false,
    badge: "OpenAI Mantle",
    speed: "Frontera",
    default_temp: 0.2,
    default_tokens: 2048,
  },
  {
    id: "us.xai.grok-4.7",
    name: "Grok 4.7",
    provider: "xAI",
    family: "Grok",
    description: "Modelo de frontera xAI con gran ventana de contexto y capacidad de análisis cruzado.",
    modalities: ["TEXT", "IMAGE"],
    context_window: "256K",
    category: "Frontera",
    is_verified: false,
    badge: "xAI",
    speed: "Frontera",
    default_temp: 0.2,
    default_tokens: 2048,
  }
];

const SAMPLES = [
  {
    title: "Silicón: Tierra vs Órbita (Saffire-II)",
    prompt: "¿Por qué el silicón se autoextinguió en microgravedad durante Saffire-II mientras ardió completo en las pruebas en la Tierra?",
    model: "us.anthropic.claude-sonnet-4-6",
  },
  {
    title: "Gotas de Heptano y Llama Fría (FLEX)",
    prompt: "¿Qué observó el experimento FLEX en la ISS sobre la extinción de gotas de heptano y la presencia de llama fría?",
    model: "us.deepseek.r1-v1:0",
  },
  {
    title: "Atmósfera de Exploración (34% O₂)",
    prompt: "¿Qué riesgo existe en la atmósfera propuesta para misiones de exploración a 0.57 atm y 34% de oxígeno según los ensayos de NASA?",
    model: "us.amazon.nova-pro-v1:0",
  },
  {
    title: "Tela SIBAL vs PMMA Acrílico",
    prompt: "¿Cómo se compara la velocidad de propagación de la tela SIBAL frente al PMMA acrílico en flujo forzado de 20 cm/s en órbita?",
    model: "us.meta.llama4-maverick-17b-instruct-v1:0",
  },
  {
    title: "Norma NASA-STD-6001B Test 1",
    prompt: "¿Cuáles son las limitaciones del Test 1 de NASA-STD-6001B al predecir la inflamabilidad de materiales en microgravedad real?",
    model: "qwen.qwen3-32b-v1:0",
  },
];

export function mountRag(root, data, shared) {
  let catalog = DEFAULT_MODELS;
  let activeModelId = localStorage.getItem("flame_bedrock_model") || "us.anthropic.claude-sonnet-4-6";
  let inferenceParams = {
    temperature: 0.2,
    max_tokens: 1500,
    top_p: 0.9,
  };
  let lastPrompt = "";

  // Estado del catálogo modal
  let modalState = {
    isOpen: false,
    selectedProvider: "Todos",
    selectedCategory: "Todos",
    searchQuery: "",
  };

  root.innerHTML = `
    <div class="section-head">
      <div class="eyebrow">INTEGRACIÓN NATIVA · AMAZON BEDROCK FOUNDATION MODELS + CUBO OLAP</div>
      <h2>Asistente Científico RAG</h2>
      <p class="lede">
        Consulta los 277 documentos técnicos de NTRS indexados con <b>Amazon Titan Embeddings</b> e <b>Índice IVF (16 Celdas Voronoi)</b>.
        Elige entre <b>más de 35 Foundation Models líderes de Amazon Bedrock</b> para razonar, sintetizar literatura aeroespacial
        y contrastar en vivo contra las telemetrías del Cubo OLAP de la NASA mediante la llave foránea <code>titulo_paper</code>.
      </p>
    </div>

    <!-- Bedrock Hub Bar -->
    <div class="bedrock-hub-card">
      <div class="bedrock-hub-top">
        <div class="bedrock-active-box">
          <div class="bedrock-live-badge"><span class="dot-live"></span> AWS Bedrock Runtime</div>
          <div class="bedrock-active-meta">
            <span class="bedrock-label">Foundation Model Activo:</span>
            <span class="bedrock-model-name" id="bedrock-active-name">Cargando...</span>
            <span class="bedrock-pill" id="bedrock-active-provider">Anthropic</span>
            <span class="bedrock-spec-pill" id="bedrock-active-spec">Serverless · 200K</span>
          </div>
        </div>

        <div class="bedrock-hub-actions">
          <button type="button" class="btn primary small" id="btn-open-catalog">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
            <span>Catálogo Bedrock (40 FMs)</span>
          </button>
          <button type="button" class="btn ghost small" id="btn-toggle-params" title="Ajustar parámetros de inferencia">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>
            <span>Parámetros</span>
          </button>
        </div>
      </div>

      <!-- Quick Selector Pills -->
      <div class="bedrock-quick-pills" id="bedrock-quick-pills"></div>

      <!-- In-line Parameter Drawer (hidden by default) -->
      <div class="bedrock-params-drawer" id="bedrock-params-drawer" hidden>
        <div class="bedrock-params-grid">
          <div class="bedrock-param-item">
            <div class="param-head">
              <label for="param-temp">Temperatura: <b id="val-temp">0.2</b></label>
              <span class="dim small">Rigor científico vs Creatividad</span>
            </div>
            <input type="range" id="param-temp" min="0.0" max="1.0" step="0.05" value="0.2">
          </div>
          <div class="bedrock-param-item">
            <div class="param-head">
              <label for="param-tokens">Tokens Máximos: <b id="val-tokens">1500</b></label>
              <span class="dim small">Longitud de la respuesta analítica</span>
            </div>
            <select id="param-tokens" class="bedrock-select">
              <option value="800">800 tokens (~400 palabras concisas)</option>
              <option value="1200">1200 tokens (Estándar técnico)</option>
              <option value="1500" selected>1500 tokens (Análisis profundo con OLAP)</option>
              <option value="2048">2048 tokens (Informe exhaustivo)</option>
            </select>
          </div>
        </div>
      </div>
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
              <div class="rag-msg-fm-header">
                <span class="rag-fm-tag">⚡ Amazon Bedrock Hub</span>
                <span class="rag-fm-model">35+ Foundation Models integrados</span>
              </div>
              <p><b>¡Hola! Soy el asistente científico de Flame in Freefall conectado a Amazon Bedrock.</b></p>
              <p>Puedo procesar tus consultas utilizando cualquiera de los <b>Foundation Models de vanguardia</b> (Claude Sonnet 4.6, DeepSeek-R1, Nova Pro, Llama 4 Maverick, Qwen3, Gemma 3, etc.) y contrastar la teoría con las mediciones reales del Cubo OLAP de la NASA.</p>
              <p class="dim small">💡 Haz una pregunta de prueba o haz clic en <b>"Catálogo Bedrock"</b> para cambiar de modelo en cualquier momento.</p>
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
          <p class="dim small">Realiza una consulta para que el índice IVF recupere los documentos de NTRS correspondientes y despliegue aquí el <b>chunk textual de evidencia</b> extraído por el embedding Titan y la <b>tabla de experimentos del Cubo OLAP</b> con sus métricas.</p>
        </div>
      </div>
    </div>

    <!-- Modal: Bedrock Foundation Models Catalog GUI -->
    <div class="bedrock-modal-backdrop" id="bedrock-modal" hidden>
      <div class="bedrock-modal-dialog">
        <div class="bedrock-modal-header">
          <div class="bedrock-modal-title-box">
            <div class="bedrock-modal-eyebrow">AMAZON BEDROCK · MODEL CATALOG</div>
            <h3>Catálogo de Foundation Models Disponibles</h3>
            <p class="dim small">Selecciona el Foundation Model que procesará el contexto recuperado de NASA NTRS y el Cubo OLAP.</p>
          </div>
          <button type="button" class="bedrock-modal-close" id="btn-close-modal" aria-label="Cerrar catálogo">✕</button>
        </div>

        <div class="bedrock-modal-toolbar">
          <div class="bedrock-search-box">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" id="bedrock-search-inp" placeholder="Buscar por nombre, proveedor o capacidad (ej: claude, llama, nova, deepseek, reasoning, vision)..." />
          </div>

          <div class="bedrock-filter-row" id="bedrock-provider-filters">
            <!-- Tabs de proveedores dinámicos -->
          </div>
        </div>

        <div class="bedrock-modal-body">
          <div class="bedrock-cards-grid" id="bedrock-cards-grid">
            <!-- Render dinámico de modelos -->
          </div>
        </div>

        <div class="bedrock-modal-footer">
          <div class="dim small">
            <span>Mostrando <b id="bedrock-visible-count">0</b> Foundation Models en Amazon Bedrock</span>
          </div>
          <button type="button" class="btn ghost small" id="btn-footer-close">Cerrar</button>
        </div>
      </div>
    </div>
  `;

  // Referencias DOM
  const chipsContainer = root.querySelector("#rag-chips");
  const messagesContainer = root.querySelector("#rag-messages");
  const form = root.querySelector("#rag-form");
  const input = root.querySelector("#rag-input");
  const sendBtn = root.querySelector("#rag-send-btn");
  const dashContainer = root.querySelector("#rag-dashboard");
  const quickPillsContainer = root.querySelector("#bedrock-quick-pills");

  const btnOpenCatalog = root.querySelector("#btn-open-catalog");
  const btnToggleParams = root.querySelector("#btn-toggle-params");
  const paramsDrawer = root.querySelector("#bedrock-params-drawer");
  const paramTemp = root.querySelector("#param-temp");
  const valTemp = root.querySelector("#val-temp");
  const paramTokens = root.querySelector("#param-tokens");
  const valTokens = root.querySelector("#val-tokens");

  const modalBackdrop = root.querySelector("#bedrock-modal");
  const btnCloseModal = root.querySelector("#btn-close-modal");
  const btnFooterClose = root.querySelector("#btn-footer-close");
  const searchInput = root.querySelector("#bedrock-search-inp");
  const providerFiltersContainer = root.querySelector("#bedrock-provider-filters");
  const cardsGrid = root.querySelector("#bedrock-cards-grid");
  const visibleCountLabel = root.querySelector("#bedrock-visible-count");

  const activeNameLabel = root.querySelector("#bedrock-active-name");
  const activeProviderLabel = root.querySelector("#bedrock-active-provider");
  const activeSpecLabel = root.querySelector("#bedrock-active-spec");

  // Estado del Dashboard
  let dashState = {
    papers: [],
    activeIdx: 0,
    ivfStats: null,
    filterText: "",
  };

  // Cargar catálogo actualizado desde la API
  async function loadModelsFromApi() {
    try {
      const res = await fetch(`${API_BASE}/models`);
      if (res.ok) {
        const data = await res.json();
        if (data.models && data.models.length > 0) {
          catalog = data.models;
        }
      }
    } catch {
      // Usar catálogo estático de respaldo si la API aún no responde
    }
    updateActiveModelUI();
    renderQuickPills();
  }

  function getActiveModel() {
    return catalog.find((m) => m.id === activeModelId) || catalog[0];
  }

  function setActiveModel(modelId) {
    const found = catalog.find((m) => m.id === modelId);
    if (!found) return;
    activeModelId = modelId;
    localStorage.setItem("flame_bedrock_model", modelId);
    updateActiveModelUI();
    renderQuickPills();
    if (modalState.isOpen) {
      renderCatalogCards();
    }
  }

  function updateActiveModelUI() {
    const m = getActiveModel();
    if (!m) return;
    activeNameLabel.textContent = m.name;
    activeProviderLabel.textContent = m.provider;
    activeSpecLabel.textContent = `Serverless · ${m.context_window} · ${m.category}`;
  }

  // Quick select pills
  const QUICK_MODEL_IDS = [
    "us.anthropic.claude-sonnet-4-6",
    "us.deepseek.r1-v1:0",
    "us.amazon.nova-pro-v1:0",
    "us.amazon.nova-2-lite-v1:0",
    "us.meta.llama4-maverick-17b-instruct-v1:0",
    "google.gemma-3-12b-it",
    "mistral.mistral-large-3-675b-instruct",
    "qwen.qwen3-32b-v1:0",
    "nvidia.nemotron-super-3-120b",
    "openai.gpt-oss-120b-1:0",
  ];

  function renderQuickPills() {
    const active = getActiveModel();
    const quickModels = catalog.filter((m) => QUICK_MODEL_IDS.includes(m.id));

    quickPillsContainer.innerHTML = `
      <span class="quick-pill-label">Acceso Rápido FMs:</span>
      ${quickModels.map((m) => `
        <button type="button" class="bedrock-quick-pill ${m.id === active.id ? 'active' : ''}" data-model-id="${m.id}">
          <span class="dot-fm"></span>
          <span>${esc(m.name)}</span>
          <span class="pill-provider">${esc(m.provider)}</span>
        </button>
      `).join("")}
    `;

    quickPillsContainer.querySelectorAll(".bedrock-quick-pill").forEach((btn) => {
      btn.addEventListener("click", () => {
        setActiveModel(btn.dataset.modelId);
      });
    });
  }

  // Render Prompt Chips
  chipsContainer.innerHTML = SAMPLES.map((s, idx) => `
    <button type="button" class="rag-chip" data-idx="${idx}">
      <span>${esc(s.title)}</span>
    </button>
  `).join("");

  chipsContainer.querySelectorAll(".rag-chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      const s = SAMPLES[parseInt(btn.dataset.idx, 10)];
      if (s) {
        input.value = s.prompt;
        if (s.model && catalog.some((m) => m.id === s.model)) {
          setActiveModel(s.model);
        }
        submitQuery(s.prompt);
      }
    });
  });

  // Modal Catalog rendering
  function openCatalogModal() {
    modalState.isOpen = true;
    modalBackdrop.hidden = false;
    renderProviderFilterTabs();
    renderCatalogCards();
    searchInput.focus();
  }

  function closeCatalogModal() {
    modalState.isOpen = false;
    modalBackdrop.hidden = true;
  }

  btnOpenCatalog.addEventListener("click", openCatalogModal);
  btnCloseModal.addEventListener("click", closeCatalogModal);
  btnFooterClose.addEventListener("click", closeCatalogModal);
  modalBackdrop.addEventListener("click", (e) => {
    if (e.target === modalBackdrop) closeCatalogModal();
  });

  // Drawer de Parámetros
  btnToggleParams.addEventListener("click", () => {
    paramsDrawer.hidden = !paramsDrawer.hidden;
    btnToggleParams.classList.toggle("active", !paramsDrawer.hidden);
  });

  paramTemp.addEventListener("input", (e) => {
    inferenceParams.temperature = parseFloat(e.target.value);
    valTemp.textContent = inferenceParams.temperature.toFixed(2);
  });

  paramTokens.addEventListener("change", (e) => {
    inferenceParams.max_tokens = parseInt(e.target.value, 10);
    valTokens.textContent = inferenceParams.max_tokens;
  });

  function renderProviderFilterTabs() {
    const providers = ["Todos", ...new Set(catalog.map((m) => m.provider))];
    providerFiltersContainer.innerHTML = providers.map((p) => `
      <button type="button" class="bedrock-tab-pill ${p === modalState.selectedProvider ? 'active' : ''}" data-provider="${p}">
        ${p}
      </button>
    `).join("");

    providerFiltersContainer.querySelectorAll(".bedrock-tab-pill").forEach((btn) => {
      btn.addEventListener("click", () => {
        modalState.selectedProvider = btn.dataset.provider;
        renderProviderFilterTabs();
        renderCatalogCards();
      });
    });
  }

  function renderCatalogCards() {
    const q = (modalState.searchQuery || "").toLowerCase().trim();
    const pFilter = modalState.selectedProvider;

    const filtered = catalog.filter((m) => {
      if (pFilter !== "Todos" && m.provider.toLowerCase() !== pFilter.toLowerCase()) return false;
      if (!q) return true;
      return (
        m.name.toLowerCase().includes(q) ||
        m.provider.toLowerCase().includes(q) ||
        m.family.toLowerCase().includes(q) ||
        m.category.toLowerCase().includes(q) ||
        m.description.toLowerCase().includes(q) ||
        (m.badge && m.badge.toLowerCase().includes(q))
      );
    });

    visibleCountLabel.textContent = filtered.length;

    if (filtered.length === 0) {
      cardsGrid.innerHTML = `
        <div class="bedrock-catalog-empty">
          <div style="font-size:2rem; margin-bottom:8px;">🔍</div>
          <h4>No se encontraron Foundation Models</h4>
          <p class="dim small">Intenta buscar con otros términos como 'claude', 'llama', 'nova' o selecciona otro proveedor.</p>
        </div>
      `;
      return;
    }

    cardsGrid.innerHTML = filtered.map((m) => {
      const isSelected = m.id === activeModelId;
      return `
        <div class="bedrock-card ${isSelected ? 'selected' : ''}" data-card-id="${m.id}">
          <div class="bedrock-card-header">
            <div class="bedrock-card-provider-pill">${esc(m.provider)}</div>
            ${m.badge ? `<div class="bedrock-card-badge">${esc(m.badge)}</div>` : ''}
          </div>

          <h4 class="bedrock-card-title">${esc(m.name)}</h4>
          <div class="bedrock-card-sub">${esc(m.family)} · ${m.modalities.join(", ")}</div>

          <p class="bedrock-card-desc">${esc(m.description)}</p>

          <div class="bedrock-card-tags">
            <span class="bedrock-tag"><span class="dot-green"></span> Serverless</span>
            <span class="bedrock-tag">Contexto: ${esc(m.context_window)}</span>
            <span class="bedrock-tag">${esc(m.speed)}</span>
          </div>

          <div class="bedrock-card-action">
            <button type="button" class="btn small ${isSelected ? 'primary' : 'secondary'} bedrock-select-btn" data-model-id="${m.id}">
              ${isSelected ? '✓ Modelo Activo' : 'Seleccionar FM'}
            </button>
          </div>
        </div>
      `;
    }).join("");

    cardsGrid.querySelectorAll(".bedrock-select-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        setActiveModel(btn.dataset.modelId);
        closeCatalogModal();
      });
    });

    cardsGrid.querySelectorAll(".bedrock-card").forEach((card) => {
      card.addEventListener("click", () => {
        setActiveModel(card.dataset.cardId);
        closeCatalogModal();
      });
    });
  }

  searchInput.addEventListener("input", (e) => {
    modalState.searchQuery = e.target.value;
    renderCatalogCards();
  });

  // Mensajería y Chat
  function appendMessage(role, text, modelInfo = null) {
    const isUser = role === "user";
    const div = document.createElement("div");
    div.className = `rag-msg ${isUser ? "user" : "bot"}`;

    let headerHtml = "";
    let footerHtml = "";

    if (!isUser && modelInfo) {
      headerHtml = `
        <div class="rag-msg-fm-header">
          <span class="rag-fm-tag">⚡ ${esc(modelInfo.provider || 'Bedrock')}</span>
          <span class="rag-fm-model">${esc(modelInfo.name || 'Foundation Model')}</span>
          <span class="rag-fm-latency">${modelInfo.latency_ms ? (modelInfo.latency_ms / 1000).toFixed(2) + 's' : ''}</span>
          ${modelInfo.output_tokens ? `<span class="rag-fm-tokens">${modelInfo.output_tokens} tok</span>` : ''}
        </div>
      `;

      if (modelInfo.was_fallback && modelInfo.fallback_msg) {
        headerHtml += `
          <div class="rag-fallback-banner">
            ⚠️ ${esc(modelInfo.fallback_msg)}
          </div>
        `;
      }

      footerHtml = `
        <div class="rag-msg-footer">
          <button type="button" class="rag-rerun-btn" data-rerun-prompt="${esc(lastPrompt)}">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
            <span>Comparar con otro FM</span>
          </button>
        </div>
      `;
    }

    div.innerHTML = `
      <div class="rag-avatar">${isUser ? "👨‍🚀" : "🚀"}</div>
      <div class="rag-bubble">
        ${headerHtml}
        ${isUser ? `<p>${esc(text)}</p>` : formatBotText(text)}
        ${footerHtml}
      </div>
    `;

    messagesContainer.appendChild(div);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    div.querySelectorAll(".rag-rerun-btn").forEach((b) => {
      b.addEventListener("click", () => {
        openCatalogModal();
      });
    });
  }

  function formatBotText(raw) {
    let html = esc(raw);
    html = html.replace(/\*\*(.*?)\*\*/g, "<b>$1</b>");
    html = html.replace(/\n\s*•\s*(.*?)(?=\n|$)/g, "<li>$1</li>");
    html = html.replace(/\n\s*-\s*(.*?)(?=\n|$)/g, "<li>$1</li>");
    html = html.replace(/(<li>.*?<\/li>)/gs, "<ul>$1</ul>");
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
          <p class="dim small">Realiza una consulta para que el índice IVF recupere los documentos de NTRS correspondientes y despliegue aquí el <b>chunk textual de evidencia</b> extraído por el embedding Titan y la <b>tabla de experimentos del Cubo OLAP</b> con sus métricas.</p>
        </div>
      `;
      return;
    }

    const paper = dashState.papers[dashState.activeIdx] || dashState.papers[0];
    const summary = paper.summary || {};
    const experiments = paper.experiments || [];

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

        <!-- Evidencia Textual Recuperada -->
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

        <!-- Métricas Consolidadas del Cubo OLAP -->
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

        <!-- Tabla de Ensayos del Cubo OLAP -->
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

    const filterInput = dashContainer.querySelector("#rag-exp-filter-inp");
    if (filterInput) {
      filterInput.addEventListener("input", (e) => {
        dashState.filterText = e.target.value;
        renderDashboard();
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
    lastPrompt = queryText;

    const currentModel = getActiveModel();
    appendMessage("user", queryText);
    input.value = "";
    sendBtn.disabled = true;

    // Loading indicator con nombre del modelo
    const loadDiv = document.createElement("div");
    loadDiv.className = "rag-msg bot";
    loadDiv.id = "rag-loading-bubble";
    loadDiv.innerHTML = `
      <div class="rag-avatar">🚀</div>
      <div class="rag-bubble dim" style="display:flex; align-items:center; gap:8px;">
        <span class="spinner"></span>
        <span>Consultando <b>${esc(currentModel.name)}</b> en AWS Bedrock + Búsqueda IVF y Cubo OLAP...</span>
      </div>
    `;
    messagesContainer.appendChild(loadDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    try {
      const resp = await fetch(`${API_BASE}/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: queryText,
          model_id: activeModelId,
          n_probe: 3,
          top_k: 3,
          temperature: inferenceParams.temperature,
          max_tokens: inferenceParams.max_tokens,
        }),
      });

      const loadBubble = document.getElementById("rag-loading-bubble");
      if (loadBubble) loadBubble.remove();

      if (!resp.ok) {
        throw new Error(`Error en servidor RAG (${resp.status}): ${await resp.text()}`);
      }

      const result = await resp.json();
      appendMessage("bot", result.answer, result.model_used || currentModel);

      const retrievedDocs = result.all_retrieved_papers && result.all_retrieved_papers.length > 0
        ? result.all_retrieved_papers
        : (result.primary_paper ? [result.primary_paper] : []);

      setDashboardData(retrievedDocs, result.ivf_stats);
    } catch (err) {
      const loadBubble = document.getElementById("rag-loading-bubble");
      if (loadBubble) loadBubble.remove();

      appendMessage(
        "bot",
        `**[Conexión con AWS Bedrock RAG]**\n\nNo se pudo conectar con el endpoint local en \`http://127.0.0.1:5005\`. Asegúrate de que el servidor FastAPI esté activo ejecutando:\n\`python scripts/rag_api_server.py\`\n\n*Detalle técnico:* ${err.message}`
      );
    } finally {
      sendBtn.disabled = false;
    }
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    submitQuery(input.value);
  });

  // Inicializar
  loadModelsFromApi();

  return {};
}
