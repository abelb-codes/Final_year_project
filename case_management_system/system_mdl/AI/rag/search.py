import logging
from pathlib import Path

import chromadb
from sentence_transformers import SentenceTransformer

logger = logging.getLogger(__name__)
BASE_DIR = Path(__file__).resolve().parent
CHROMA_DB_PATH = BASE_DIR / "db"

model = SentenceTransformer('all-MiniLM-L6-v2')
client = chromadb.PersistentClient(path=str(CHROMA_DB_PATH))
collection = client.get_or_create_collection(name="hawassa_university")


def _normalize_text(value):
    return ' '.join(str(value or '').strip().split())


def _similarity_score(distance):
    try:
        distance = float(distance)
    except (TypeError, ValueError):
        return 0.0
    if distance <= 0:
        return 1.0
    return 1.0 / (1.0 + distance)


def search(query, top_k=3):
    query_text = _normalize_text(query)
    if not query_text:
        return []

    try:
        query_embedding = model.encode(query_text, normalize_embeddings=True).tolist()
        results = collection.query(
            query_embeddings=[query_embedding],
            n_results=top_k,
            include=["documents", "metadatas", "distances", "ids"],
        )
    except Exception:
        logger.exception('Failed to query ChromaDB')
        return []

    documents = results.get("documents", [[]])[0]
    distances = results.get("distances", [[]])[0]
    metadatas = results.get("metadatas", [[]])[0]
    ids = results.get("ids", [[]])[0]

    formatted_results = []
    for idx, (doc, distance, metadata, ident) in enumerate(zip(documents, distances, metadatas, ids)):
        formatted_results.append({
            "id": ident,
            "document": doc,
            "metadata": metadata or {},
            "distance": distance,
            "score": _similarity_score(distance),
            "rank": idx + 1,
        })

    return formatted_results


if __name__ == "__main__":
    while True:
        query = input("Ask question: ")
        if query.lower() == "exit":
            break

        results = search(query)
        print("\nRelevant Results:\n")
        for result in results:
            print(f"Score: {result['score']:.4f}")
            print(result['document'])
            print(f"Metadata: {result['metadata']}")
            print("-" * 50)