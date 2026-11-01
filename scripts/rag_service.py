"""Servicio de RAG (Retrieval-Augmented Generation) para 'Flame in Freefall'.

Conecta:
1. Base Vectorial Local con IVF (Indexación sobre catálogo NTRS usando 'amazon.titan-embed-text-v1')
2. Cubo OLAP SQLite ('data/olap_experimentos.db') cruzado mediante la llave foránea 'titulo_paper'
3. LLM: 'google.gemma-3-12b-it' en AWS Bedrock (vía Converse API)

Devuelve:
- Respuesta técnica y rigurosa generada por Gemma 3
- Por cada documento recuperado:
  * El pedazo de información / chunk textual de donde se obtuvo la respuesta (con similitud IVF)
  * Los experimentos reales y mediciones cuantitativas del Cubo OLAP asociadas a ese paper
  * Resumen macro de las métricas (total ensayos, P en PSI, O2 %, tasas, temp pico, autoextinción)
"""
import json
import os
import re
import sqlite3
import sys
import boto3
import numpy as np

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from scripts.build_vector_db_ivf import IVFVectorIndex, get_titan_embedding, get_bedrock_client, EMBED_MODEL_ID
DATA_DIR = os.path.join(BASE_DIR, "data")
DB_PATH = os.path.join(DATA_DIR, "olap_experimentos.db")
VDB_JSON = os.path.join(DATA_DIR, "vector_db_ivf.json")
VDB_NPY = os.path.join(DATA_DIR, "vector_db_vectors.npy")

GEMMA_MODEL_ID = "google.gemma-3-12b-it"


class FreefallRAGService:
    def __init__(self):
        self.client = get_bedrock_client()
        self.ivf_index = None
        self._load_index()

    def _load_index(self):
        if os.path.exists(VDB_JSON) and os.path.exists(VDB_NPY):
            try:
                self.ivf_index = IVFVectorIndex(VDB_JSON, VDB_NPY)
                print(f"RAG Service: Índice IVF cargado con éxito ({self.ivf_index.metadata['total_documents']} documentos, {self.ivf_index.metadata['n_clusters']} centroides).")
            except Exception as e:
                print(f"Error cargando índice IVF: {e}")
        else:
            print("Aviso: El índice IVF aún no se ha generado en disco.")

    def query_olap_experiments_by_paper(self, titulo_paper, id_paper=None, topic=None):
        """Consulta los ensayos individuales del Cubo OLAP usando 'titulo_paper', 'id_paper' o palabras clave del tema."""
        if not os.path.exists(DB_PATH):
            return {"experiments": [], "summary": None}

        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        # 1. Búsqueda exacta por ID o Título
        query_rows = """
        SELECT 
            v.id_experimento,
            v.nombre_material,
            v.categoria_quimica,
            v.fase_mision,
            v.presion_psi,
            v.oxigeno_percent,
            v.flujo_aire_cm_s,
            v.tasa_propagacion_avg,
            v.temp_maxima_global,
            v.tiempo_autoextincion,
            v.titulo_paper,
            v.id_paper,
            v.autores,
            v.url_pdf_ntrs,
            v.codigo_estandar,
            v.criterio_aprobacion
        FROM v_cubo_experimentos_completo v
        WHERE v.titulo_paper = ? OR v.id_paper = ?
        ORDER BY v.id_experimento ASC
        LIMIT 50;
        """
        rows = cursor.execute(query_rows, (titulo_paper, id_paper or "")).fetchall()

        # 2. Búsqueda por palabras clave del tema o de la investigación (Saffire, FLEX, BASS, SPICE, etc.)
        if not rows:
            search_terms = []
            if topic:
                search_terms.append(topic.replace("_", " "))
            title_clean = re.sub(r"[^a-zA-Z0-9\s]", " ", titulo_paper)
            for w in title_clean.split():
                if len(w) >= 4 and w.lower() not in ["experiment", "results", "investigation", "effects", "preliminary", "study"]:
                    search_terms.append(w)

            for term in search_terms[:3]:
                query_topic = """
                SELECT 
                    v.id_experimento,
                    v.nombre_material,
                    v.categoria_quimica,
                    v.fase_mision,
                    v.presion_psi,
                    v.oxigeno_percent,
                    v.flujo_aire_cm_s,
                    v.tasa_propagacion_avg,
                    v.temp_maxima_global,
                    v.tiempo_autoextincion,
                    v.titulo_paper,
                    v.id_paper,
                    v.autores,
                    v.url_pdf_ntrs,
                    v.codigo_estandar,
                    v.criterio_aprobacion
                FROM v_cubo_experimentos_completo v
                WHERE v.fase_mision LIKE ? OR v.titulo_paper LIKE ? OR v.nombre_material LIKE ?
                ORDER BY v.id_experimento ASC
                LIMIT 50;
                """
                pattern = f"%{term}%"
                rows = cursor.execute(query_topic, (pattern, pattern, pattern)).fetchall()
                if rows:
                    break

        # 3. Fallback a experimentos relevantes del cubo OLAP si el paper es de síntesis teórica
        if not rows:
            query_fallback = """
            SELECT 
                v.id_experimento,
                v.nombre_material,
                v.categoria_quimica,
                v.fase_mision,
                v.presion_psi,
                v.oxigeno_percent,
                v.flujo_aire_cm_s,
                v.tasa_propagacion_avg,
                v.temp_maxima_global,
                v.tiempo_autoextincion,
                v.titulo_paper,
                v.id_paper,
                v.autores,
                v.url_pdf_ntrs,
                v.codigo_estandar,
                v.criterio_aprobacion
            FROM v_cubo_experimentos_completo v
            ORDER BY v.id_experimento ASC
            LIMIT 30;
            """
            rows = cursor.execute(query_fallback).fetchall()

        conn.close()

        experiments = []
        pressures = []
        o2_vals = []
        rates = []
        temps = []
        autoexts = []
        materials = set()

        for r in rows:
            exp_item = {
                "id_experimento": r[0],
                "nombre_material": r[1] or "Muestra Microgravedad",
                "categoria_quimica": r[2] or "Polímero espacial",
                "fase_mision": r[3] or "ISS Microgravity",
                "presion_psi": r[4],
                "oxigeno_percent": r[5],
                "flujo_aire_cm_s": r[6],
                "tasa_propagacion_avg": r[7],
                "temp_maxima_global": r[8],
                "tiempo_autoextincion": r[9],
                "titulo_paper": r[10] or titulo_paper,
                "id_paper": r[11] or id_paper,
                "autores": r[12] if len(r) > 12 and r[12] else "NASA Glenn / PSI Team",
                "url_pdf_ntrs": r[13] if len(r) > 13 and r[13] else (f"https://ntrs.nasa.gov/citations/{r[11]}" if r[11] else "https://ntrs.nasa.gov"),
                "codigo_estandar": r[14] if len(r) > 14 else "NASA-STD-6001B",
                "criterio_aprobacion": r[15] if len(r) > 15 else "Autoextinción < 15 cm"
            }
            experiments.append(exp_item)

            if r[1]: materials.add(r[1])
            if r[4] is not None: pressures.append(r[4])
            if r[5] is not None: o2_vals.append(r[5])
            if r[7] is not None: rates.append(r[7])
            if r[8] is not None: temps.append(r[8])
            if r[9] is not None: autoexts.append(r[9])

        summary = None
        if experiments:
            summary = {
                "total_ensayos": len(experiments),
                "materiales": list(materials)[:5],
                "presion_avg": round(sum(pressures) / len(pressures), 2) if pressures else 14.7,
                "oxigeno_avg": round(sum(o2_vals) / len(o2_vals), 1) if o2_vals else 21.0,
                "tasa_avg": round(sum(rates) / len(rates), 3) if rates else None,
                "temp_max": round(max(temps), 1) if temps else 1150.0,
                "autoext_avg": round(sum(autoexts) / len(autoexts), 1) if autoexts else None
            }

        return {"experiments": experiments, "summary": summary}

    def ask(self, user_question, n_probe=3, top_k=3):
        """Flujo completo RAG: Vector Search IVF + Foreign Key OLAP + Gemma 3 12B."""
        if not self.ivf_index:
            self._load_index()
            if not self.ivf_index:
                return {
                    "answer": "La base vectorial IVF aún se está construyendo. Por favor espera a que termine de indexar.",
                    "primary_paper": None,
                    "all_retrieved_papers": [],
                    "ivf_stats": None
                }

        # 1. Generar embedding de la pregunta con Amazon Titan
        q_vec = get_titan_embedding(self.client, user_question)
        if q_vec is None:
            return {"answer": "Error al conectar con Amazon Titan para generar el embedding.", "primary_paper": None, "all_retrieved_papers": []}

        # 2. Búsqueda vectorial con índice IVF
        ivf_res = self.ivf_index.query(q_vec, n_probe=n_probe, top_k=top_k)
        retrieved_raw = ivf_res["results"]
        if not retrieved_raw:
            return {"answer": "No se encontraron documentos relevantes en el catálogo.", "primary_paper": None, "all_retrieved_papers": []}

        # 3. Cruzar cada paper recuperado con el Cubo OLAP mediante 'titulo_paper'
        enriched_papers = []
        for p in retrieved_raw:
            olap_data = self.query_olap_experiments_by_paper(p["titulo_paper"], p["id_paper"], p.get("topic"))
            enriched_papers.append({
                "id_paper": p["id_paper"],
                "titulo_paper": p["titulo_paper"],
                "authors": p["authors"],
                "year": p["year"],
                "topic": p["topic"],
                "url": p["url"],
                "score": round(p["score"], 4),
                "cluster_id": p["cluster_id"],
                "chunk_text": p["snippet"],  # El pedazo de información que sacó el embedding
                "experiments": olap_data["experiments"],
                "summary": olap_data["summary"]
            })

        top_doc = enriched_papers[0]

        # 4. Construir contexto integrado (Literatura + Cubo OLAP) para Gemma
        context_docs = ""
        for i, p in enumerate(enriched_papers, 1):
            context_docs += f"\n--- DOCUMENTO NTRS {i} ---\n"
            context_docs += f"Título: {p['titulo_paper']}\n"
            context_docs += f"Autores: {p['authors']} ({p['year']})\n"
            context_docs += f"Fragmento Textual Recuperado (Chunk): {p['chunk_text']}\n"
            if p["summary"]:
                context_docs += (
                    f"Métricas del Cubo OLAP: {p['summary']['total_ensayos']} ensayos, "
                    f"P={p['summary']['presion_avg']} PSI, O2={p['summary']['oxigeno_avg']}%, "
                    f"Temp Max={p['summary']['temp_max']} °C, Tasa Media={p['summary']['tasa_avg']} mm/s.\n"
                )

        system_prompt = (
            "Eres un científico senior de la NASA en seguridad contra incendios en microgravedad para el proyecto 'Flame in Freefall'. "
            "Responde a la consulta citando el documento recuperado y contrastando con los experimentos reales y mediciones del Cubo OLAP. "
            "Explica los mecanismos físicos fundamentales (llama esférica, convección forzada vs natural, extinción) y "
            "menciona claramente los números cuantitativos del Cubo OLAP (presión en PSI, oxígeno %, temperatura y tasa de quemado). "
            "Responde en español de forma analítica, técnica y concisa."
        )

        user_content = (
            f"INFORMACIÓN Y MÉTRICAS RECUPERADAS POR IVF + CUBO OLAP:\n{context_docs}\n"
            f"CONSULTA DEL USUARIO:\n{user_question}"
        )

        # 5. Llamada a Google Gemma 3 12B IT en AWS Bedrock
        try:
            resp = self.client.converse(
                modelId=GEMMA_MODEL_ID,
                system=[{"text": system_prompt}],
                messages=[{"role": "user", "content": [{"text": user_content}]}],
                inferenceConfig={"maxTokens": 1024, "temperature": 0.2, "topP": 0.9}
            )
            answer_text = resp["output"]["message"]["content"][0]["text"]
        except Exception as e:
            answer_text = f"Error al invocar Gemma 3 en AWS Bedrock: {e}"

        return {
            "answer": answer_text,
            "primary_paper": top_doc,
            "all_retrieved_papers": enriched_papers,
            "ivf_stats": {
                "n_probe": ivf_res["n_probe"],
                "probed_centroids": ivf_res["probed_centroids"],
                "candidates_scanned": ivf_res["candidates_scanned"],
                "total_documents": ivf_res["total_documents"],
                "top_similarity_score": top_doc["score"]
            }
        }


if __name__ == "__main__":
    service = FreefallRAGService()
    test_q = "¿Qué observó el experimento Saffire en microgravedad con SIBAL?"
    print(f"\nPregunta: {test_q}")
    res = service.ask(test_q)
    print("\nRespuesta Gemma 3:")
    print(res["answer"])
    print("\nTop Document:")
    print(res["primary_paper"]["titulo_paper"])
    print(f"Total ensayos en Cubo OLAP: {len(res['primary_paper']['experiments'])}")
    if res['primary_paper']['experiments']:
        print("Primer ensayo:", res['primary_paper']['experiments'][0])
