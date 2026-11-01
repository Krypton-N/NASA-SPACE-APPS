"""Servidor API REST para el Asistente RAG con IVF y Cubo OLAP.

Ejecuta un servidor FastAPI con soporte CORS para comunicarse con el frontend
de la aplicación web ('Flame in Freefall').

Endpoints:
- POST /api/rag/query           -> Ejecuta búsqueda IVF + Cruce OLAP + Gemma 3 12B
- GET  /api/rag/status          -> Estado de Bedrock, IVF y base OLAP
- GET  /api/rag/sample_prompts  -> Preguntas recomendadas para la demo

Uso:
    python scripts/rag_api_server.py
"""
import os
import sys
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BASE_DIR)

from scripts.rag_service import FreefallRAGService, GEMMA_MODEL_ID, EMBED_MODEL_ID

app = FastAPI(title="Flame in Freefall RAG API", version="1.0.0")

# Permitir CORS para Vite (localhost:5173) y cualquier origen local
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

rag_service = None


def get_service():
    global rag_service
    if rag_service is None:
        rag_service = FreefallRAGService()
    return rag_service


class QueryRequest(BaseModel):
    question: str
    n_probe: int = 3
    top_k: int = 3


@app.get("/api/rag/status")
def get_status():
    service = get_service()
    has_ivf = service.ivf_index is not None
    return {
        "status": "online",
        "embedding_model": EMBED_MODEL_ID,
        "llm_model": GEMMA_MODEL_ID,
        "ivf_index_loaded": has_ivf,
        "total_documents": len(service.ivf_index.documents) if has_ivf else 0,
        "n_clusters": service.ivf_index.metadata.get("n_clusters", 0) if has_ivf else 0,
        "foreign_key": "titulo_paper",
        "olap_database": "data/olap_experimentos.db"
    }


@app.get("/api/rag/sample_prompts")
def get_sample_prompts():
    return [
        {
            "id": 1,
            "title": "Silicón en Saffire-II vs Tierra",
            "prompt": "¿Por qué el silicón se autoextinguió en microgravedad durante Saffire-II mientras ardió completo en las pruebas en la Tierra?"
        },
        {
            "id": 2,
            "title": "Gotas de Heptano y Llama Fría",
            "prompt": "¿Qué observó el experimento FLEX en la ISS sobre la extinción de gotas de heptano y la presencia de llama fría?"
        },
        {
            "id": 3,
            "title": "Atmósfera de Exploración (34% O2)",
            "prompt": "¿Qué riesgo existe en la atmósfera propuesta para misiones de exploración a 0.57 atm y 34% de oxígeno según los ensayos de NASA?"
        },
        {
            "id": 4,
            "title": "Tela SIBAL vs PMMA",
            "prompt": "¿Cómo se compara la velocidad de propagación de la tela SIBAL frente al PMMA acrílico en flujo forzado de 20 cm/s?"
        }
    ]


@app.post("/api/rag/query")
def run_rag_query(req: QueryRequest):
    if not req.question or not req.question.strip():
        raise HTTPException(status_code=400, detail="La pregunta no puede estar vacía.")

    service = get_service()
    try:
        response = service.ask(req.question.strip(), n_probe=req.n_probe, top_k=req.top_k)
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error procesando RAG: {str(e)}")


def main():
    print("Iniciando Servidor RAG FastAPI en http://127.0.0.1:5005 ...")
    uvicorn.run("scripts.rag_api_server:app", host="127.0.0.1", port=5005, reload=False)


if __name__ == "__main__":
    main()
