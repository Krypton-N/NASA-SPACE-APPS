"""Generador de Base de Datos Vectorial Local con IVF (Inverted File Index)
para 'Flame in Freefall' (NASA Space Apps 2026).

- Modelo de Embeddings: 'amazon.titan-embed-text-v1' (AWS Bedrock, 1536 dim)
  Con rate limiting y caché local en disco ('data/embeddings_cache.json')
- Llave Foránea: 'titulo_paper' (cruza exactamente con el Cubo OLAP 'fact_experimento' y 'dim_paper_ntrs')
- Algoritmo de Indexación: IVF (Inverted File Index) con k-Means para partición de espacio vectorial
  (evita escaneo lineal exhaustivo y no requiere pgvector ni extensiones de SQL).

Archivos generados:
- data/vector_db_ivf.json      (Metadatos de chunks, listas invertidas IVF y centroides)
- data/vector_db_vectors.npy   (Matriz de embeddings normalizados)
"""
import glob
import json
import os
import re
import time
import boto3
import numpy as np
import pandas as pd
from sklearn.cluster import KMeans

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
NTRS_DIR = os.path.join(DATA_DIR, "ntrs")
NTRS_CATALOG = os.path.join(NTRS_DIR, "catalog.csv")
CACHE_FILE = os.path.join(DATA_DIR, "embeddings_cache.json")
VDB_JSON = os.path.join(DATA_DIR, "vector_db_ivf.json")
VDB_NPY = os.path.join(DATA_DIR, "vector_db_vectors.npy")

BEDROCK_REGION = "us-east-1"
EMBED_MODEL_ID = "amazon.titan-embed-text-v1"


def get_bedrock_client():
    session = boto3.Session()
    reg = session.region_name or BEDROCK_REGION
    return boto3.client("bedrock-runtime", region_name=reg)


def get_titan_embedding(client, text, cache=None):
    """Genera embedding de 1536 dimensiones usando Amazon Titan con reintentos y caché."""
    clean_text = text.strip()[:6000]
    cache_key = clean_text[:200]

    if cache is not None and cache_key in cache:
        return cache[cache_key]

    for attempt in range(4):
        try:
            resp = client.invoke_model(
                modelId=EMBED_MODEL_ID,
                contentType="application/json",
                accept="application/json",
                body=json.dumps({"inputText": clean_text})
            )
            res_json = json.loads(resp["body"].read())
            vec = res_json.get("embedding")
            if vec:
                if cache is not None:
                    cache[cache_key] = vec
                return vec
        except Exception as e:
            err_str = str(e)
            if "ThrottlingException" in err_str or "Too many requests" in err_str:
                wait_time = (attempt + 1) * 2.0
                time.sleep(wait_time)
            else:
                print(f"Error en Titan (intento {attempt+1}): {err_str[:80]}", flush=True)
                time.sleep(1.0)

    return None


def collect_paper_chunks():
    chunks = []
    if not os.path.exists(NTRS_CATALOG):
        raise FileNotFoundError(f"No se encontró el catálogo en {NTRS_CATALOG}")

    df_ntrs = pd.read_csv(NTRS_CATALOG)
    print(f"Leyendo catálogo de {len(df_ntrs)} documentos de NTRS...", flush=True)

    for idx, row in df_ntrs.iterrows():
        pid = str(row["id"]).strip()
        title = str(row.get("title", "")).strip() or "NASA Technical Report"
        authors = str(row.get("authors", "")).strip() or "NASA Research Team"
        date_str = str(row.get("date", ""))
        yr = int(date_str[:4]) if date_str[:4].isdigit() else 2018
        topic = str(row.get("topic", "combustion")).strip()
        center = str(row.get("center", "Glenn Research Center")).strip()
        url = str(row.get("url", f"https://ntrs.nasa.gov/citations/{pid}")).strip()
        txt_path = str(row.get("txt", "")).strip()

        full_text_snippet = ""
        candidate_paths = [
            os.path.join(NTRS_DIR, txt_path),
            os.path.join(NTRS_DIR, topic, f"{pid}.txt"),
            os.path.join(NTRS_DIR, f"{pid}.txt")
        ]
        for cp in candidate_paths:
            if os.path.exists(cp):
                try:
                    with open(cp, "r", encoding="utf-8", errors="ignore") as f:
                        content = f.read(2500)
                        full_text_snippet = re.sub(r"\s+", " ", content).strip()
                        break
                except Exception:
                    pass

        text_for_embedding = f"Título: {title}. Tema: {topic}. Centro: {center}. Autores: {authors}. {full_text_snippet[:1500]}"

        chunks.append({
            "chunk_id": idx,
            "id_paper": pid,
            "titulo_paper": title,  # LLAVE FORÁNEA CLAVE
            "authors": authors,
            "year": yr,
            "topic": topic,
            "center": center,
            "url": url,
            "text": text_for_embedding,
            "snippet": full_text_snippet[:500] if full_text_snippet else title
        })

    return chunks


def build_and_index_ivf(n_clusters=16, sample_limit=None):
    """Genera embeddings y construye el índice IVF (Inverted File Index)."""
    chunks = collect_paper_chunks()
    if sample_limit:
        chunks = chunks[:sample_limit]
    total = len(chunks)
    print(f"Total de chunks preparados: {total}", flush=True)

    client = get_bedrock_client()

    # Cargar caché existente si existe
    cache = {}
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, "r", encoding="utf-8") as f:
                cache = json.load(f)
            print(f"Caché cargado: {len(cache)} embeddings previos.", flush=True)
        except Exception:
            cache = {}

    embeddings = []
    valid_chunks = []
    print(f"Generando embeddings con AWS Bedrock ('{EMBED_MODEL_ID}')...", flush=True)
    start_t = time.time()

    for i, ch in enumerate(chunks):
        vec = get_titan_embedding(client, ch["text"], cache)
        if vec is not None:
            embeddings.append(vec)
            valid_chunks.append(ch)

        # Guardar caché periódicamente
        if (i + 1) % 15 == 0 or (i + 1) == total:
            with open(CACHE_FILE, "w", encoding="utf-8") as f:
                json.dump(cache, f)
            elapsed = time.time() - start_t
            rate = (i + 1) / max(elapsed, 0.001)
            print(f"  [{i+1}/{total}] embeddings listos ({rate:.1f} doc/s)...", flush=True)

        time.sleep(0.12)  # Pausa breve para respetar rate limit de Bedrock

    if not embeddings:
        raise RuntimeError("No se pudieron generar embeddings de Titan.")

    X = np.array(embeddings, dtype=np.float32)
    norms = np.linalg.norm(X, axis=1, keepdims=True)
    norms[norms == 0] = 1.0
    X = X / norms

    print(f"Matriz de embeddings: {X.shape} (N={X.shape[0]}, D={X.shape[1]})", flush=True)

    # IVF
    print(f"\nEntrenando índice IVF con k-Means ({n_clusters} centroides / celdas de Voronoi)...", flush=True)
    k = min(n_clusters, len(valid_chunks))
    kmeans = KMeans(n_clusters=k, random_state=42, n_init=10)
    cluster_labels = kmeans.fit_predict(X)

    centroids = kmeans.cluster_centers_.astype(np.float32)
    c_norms = np.linalg.norm(centroids, axis=1, keepdims=True)
    c_norms[c_norms == 0] = 1.0
    centroids = centroids / c_norms

    inverted_lists = {int(cid): [] for cid in range(k)}
    for doc_idx, cid in enumerate(cluster_labels):
        inverted_lists[int(cid)].append(doc_idx)
        valid_chunks[doc_idx]["cluster_id"] = int(cid)

    print("Distribución de vectores en listas invertidas IVF:", flush=True)
    for cid, doc_list in inverted_lists.items():
        print(f"  • Centroide {cid:02d}: {len(doc_list)} documentos", flush=True)

    np.save(VDB_NPY, X)

    ivf_payload = {
        "embedding_model": EMBED_MODEL_ID,
        "dimension": int(X.shape[1]),
        "total_documents": len(valid_chunks),
        "n_clusters": k,
        "foreign_key": "titulo_paper",
        "centroids": centroids.tolist(),
        "inverted_lists": inverted_lists,
        "documents": valid_chunks
    }

    with open(VDB_JSON, "w", encoding="utf-8") as f:
        json.dump(ivf_payload, f, ensure_ascii=False)

    print(f"\nBase de datos vectorial con IVF guardada con éxito:", flush=True)
    print(f"  -> {VDB_JSON}", flush=True)
    print(f"  -> {VDB_NPY}", flush=True)


class IVFVectorIndex:
    """Clase de consulta rápida sobre el índice vectorial IVF local."""

    def __init__(self, json_path=VDB_JSON, npy_path=VDB_NPY):
        if not os.path.exists(json_path) or not os.path.exists(npy_path):
            raise FileNotFoundError("El índice vectorial IVF no existe. Ejecuta build_vector_db_ivf.py")
        with open(json_path, "r", encoding="utf-8") as f:
            self.metadata = json.load(f)
        self.vectors = np.load(npy_path)
        self.centroids = np.array(self.metadata["centroids"], dtype=np.float32)
        self.inverted_lists = {int(k): v for k, v in self.metadata["inverted_lists"].items()}
        self.documents = self.metadata["documents"]

    def query(self, query_vector, n_probe=3, top_k=5):
        """Búsqueda vectorial con IVF probe."""
        q = np.array(query_vector, dtype=np.float32)
        q_norm = np.linalg.norm(q)
        if q_norm > 0:
            q = q / q_norm

        centroid_sims = np.dot(self.centroids, q)
        top_centroid_indices = np.argsort(-centroid_sims)[:n_probe]

        candidate_indices = []
        for cid in top_centroid_indices:
            candidate_indices.extend(self.inverted_lists.get(cid, []))

        candidate_indices = list(set(candidate_indices))
        if not candidate_indices:
            return {"results": []}

        candidate_vecs = self.vectors[candidate_indices]
        similarities = np.dot(candidate_vecs, q)

        best_local_indices = np.argsort(-similarities)[:top_k]

        results = []
        for local_idx in best_local_indices:
            global_idx = candidate_indices[local_idx]
            doc = self.documents[global_idx]
            results.append({
                "score": float(similarities[local_idx]),
                "titulo_paper": doc["titulo_paper"],
                "id_paper": doc["id_paper"],
                "authors": doc["authors"],
                "year": doc["year"],
                "topic": doc["topic"],
                "url": doc["url"],
                "snippet": doc["snippet"],
                "cluster_id": doc["cluster_id"]
            })

        return {
            "n_probe": n_probe,
            "probed_centroids": [int(c) for c in top_centroid_indices],
            "candidates_scanned": len(candidate_indices),
            "total_documents": len(self.documents),
            "results": results
        }


if __name__ == "__main__":
    build_and_index_ivf(n_clusters=16)
