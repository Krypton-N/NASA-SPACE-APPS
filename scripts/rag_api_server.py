"""Servidor API REST para el Asistente RAG Multi-FM con IVF y Cubo OLAP.

Ejecuta un servidor FastAPI con soporte CORS para comunicarse con el frontend
de la aplicación web ('Flame in Freefall') de NASA Space Apps 2026.

Integración Nativa con Amazon Bedrock:
- Expone catálogo de más de 30+ Foundation Models (Claude, Nova, Llama 4, DeepSeek, Gemma, Mistral, Qwen, Nemotron, etc.)
- Permite selección en tiempo real del FM que sintetiza la respuesta
- Soporte para parámetros de inferencia (temperatura, maxTokens, topP)
- Cruce automático entre literatura NTRS, embeddings Titan y telemetría del Cubo OLAP

Endpoints:
- POST /api/rag/query           -> Búsqueda IVF + Cruce OLAP + Invocación del FM seleccionado
- GET  /api/rag/models          -> Catálogo completo de Foundation Models de Bedrock
- GET  /api/rag/status          -> Estado del sistema, modelos disponibles y base OLAP
- GET  /api/rag/sample_prompts  -> Preguntas recomendadas para la demo

Uso:
    python scripts/rag_api_server.py
"""
import os
import sys
import uvicorn
from typing import Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from scripts.rag_service import FreefallRAGService, EMBED_MODEL_ID
from scripts.bedrock_models import (
    BEDROCK_MODELS,
    DEFAULT_MODEL_ID,
    get_catalog_summary,
    get_model,
)

app = FastAPI(
    title="Flame in Freefall — Amazon Bedrock RAG API",
    description="API de síntesis científica en microgravedad con Foundation Models de Bedrock, IVF y Cubo OLAP",
    version="2.0.0",
)

# Permitir CORS para Vite (localhost:5173) y cualquier origen local
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

rag_service: Optional[FreefallRAGService] = None


def get_service() -> FreefallRAGService:
    global rag_service
    if rag_service is None:
        rag_service = FreefallRAGService()
    return rag_service


class QueryRequest(BaseModel):
    question: str = Field(..., description="Pregunta del usuario sobre combustión o microgravedad")
    model_id: Optional[str] = Field(None, description="ID o perfil del Foundation Model de Bedrock a utilizar")
    n_probe: int = Field(3, description="Número de clusters Voronoi a explorar en el índice IVF")
    top_k: int = Field(3, description="Número de documentos principales a recuperar")
    temperature: Optional[float] = Field(None, ge=0.0, le=1.0, description="Temperatura de muestreo (creatividad/rigor)")
    max_tokens: Optional[int] = Field(None, ge=100, le=4096, description="Límite máximo de tokens generados")
    top_p: Optional[float] = Field(None, ge=0.0, le=1.0, description="Top-P nucleus sampling")


@app.get("/api/rag/status")
def get_status():
    """Estado general del servicio RAG, embeddings y catálogo Bedrock."""
    service = get_service()
    has_ivf = service.ivf_index is not None
    summary = get_catalog_summary()
    return {
        "status": "online",
        "embedding_model": EMBED_MODEL_ID,
        "active_llm_model": service.default_model_id,
        "total_available_fms": summary["total_models"],
        "verified_fms": summary["verified_models"],
        "providers_count": len(summary["providers"]),
        "providers": summary["providers"],
        "ivf_index_loaded": has_ivf,
        "total_documents": len(service.ivf_index.documents) if has_ivf else 0,
        "n_clusters": service.ivf_index.metadata.get("n_clusters", 0) if has_ivf else 0,
        "foreign_key": "titulo_paper",
        "olap_database": "data/olap_experimentos.db",
    }


@app.get("/api/rag/models")
def get_bedrock_models():
    """Retorna el catálogo completo de Foundation Models de Bedrock disponibles."""
    return get_catalog_summary()


@app.get("/api/rag/sample_prompts")
def get_sample_prompts():
    """Preguntas científicas sugeridas de prueba para la evaluación del reto."""
    return [
        {
            "id": 1,
            "title": "Silicón en Saffire-II vs Tierra",
            "prompt": "¿Por qué el silicón se autoextinguió en microgravedad durante Saffire-II mientras ardió completo en las pruebas en la Tierra?",
            "recommended_model": "us.anthropic.claude-sonnet-4-6",
            "focus": "Mecanismos de pérdida radiativa y extinción sin boyamiento",
        },
        {
            "id": 2,
            "title": "Gotas de Heptano y Llama Fría (FLEX)",
            "prompt": "¿Qué observó el experimento FLEX en la ISS sobre la extinción de gotas de heptano y la presencia de llama fría?",
            "recommended_model": "us.deepseek.r1-v1:0",
            "focus": "Cinética química de baja temperatura y ley d²",
        },
        {
            "id": 3,
            "title": "Atmósfera de Exploración (34% O₂)",
            "prompt": "¿Qué riesgo existe en la atmósfera propuesta para misiones de exploración a 0.57 atm y 34% de oxígeno según los ensayos de NASA?",
            "recommended_model": "us.amazon.nova-pro-v1:0",
            "focus": "Huecos de cobertura y seguridad de hábitats",
        },
        {
            "id": 4,
            "title": "Tela SIBAL vs PMMA Acrílico",
            "prompt": "¿Cómo se compara la velocidad de propagación de la tela SIBAL frente al PMMA acrílico en flujo forzado de 20 cm/s en órbita?",
            "recommended_model": "us.meta.llama4-maverick-17b-instruct-v1:0",
            "focus": "Convección forzada en sólidos",
        },
        {
            "id": 5,
            "title": "Certificación NASA-STD-6001B Test 1",
            "prompt": "¿Cuáles son las limitaciones del Test 1 de NASA-STD-6001B al predecir la inflamabilidad de materiales en microgravedad real?",
            "recommended_model": "qwen.qwen3-32b-v1:0",
            "focus": "Estándares y pruebas de calificación de vuelo",
        },
    ]


@app.post("/api/rag/query")
def run_rag_query(req: QueryRequest):
    """Ejecuta consulta RAG integral: IVF (Titan) + Cubo OLAP + FM de Amazon Bedrock."""
    if not req.question or not req.question.strip():
        raise HTTPException(status_code=400, detail="La pregunta no puede estar vacía.")

    service = get_service()
    try:
        response = service.ask(
            user_question=req.question.strip(),
            model_id=req.model_id,
            n_probe=req.n_probe,
            top_k=req.top_k,
            temperature=req.temperature,
            max_tokens=req.max_tokens,
            top_p=req.top_p,
        )
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error procesando RAG en Bedrock: {str(e)}")


def main():
    print("Iniciando Servidor RAG FastAPI con Bedrock Foundation Models en http://127.0.0.1:5005 ...")
    uvicorn.run("scripts.rag_api_server:app", host="127.0.0.1", port=5005, reload=False)


if __name__ == "__main__":
    main()
