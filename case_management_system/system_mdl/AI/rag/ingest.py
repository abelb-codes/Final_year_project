import json
import logging
from pathlib import Path

import chromadb
from sentence_transformers import SentenceTransformer

logger = logging.getLogger(__name__)
BASE_DIR = Path(__file__).resolve().parent
DATA_PATH = BASE_DIR / "data"
CHROMA_DB_PATH = BASE_DIR / "db"
MODEL_NAME = 'all-MiniLM-L6-v2'

model = SentenceTransformer(MODEL_NAME)
client = chromadb.PersistentClient(path=str(CHROMA_DB_PATH))
collection = client.get_or_create_collection(name="hawassa_university")


def _normalize_text(value):
    return ' '.join(str(value or '').strip().split())


def _build_document_text(item):
    return f"Category: {item.get('category', '')}\nQuestion: {item.get('question', '')}\nAnswer: {item.get('answer', '')}".strip()


def _build_metadata(item, source_file):
    return {
        'category': _normalize_text(item.get('category', '')), 
        'question': _normalize_text(item.get('question', '')), 
        'source_file': source_file,
        'source_type': item.get('source_type', 'knowledge_base'),
    }


def ingest_documents():
    if not DATA_PATH.exists() or not DATA_PATH.is_dir():
        raise FileNotFoundError(f"Knowledge base directory not found: {DATA_PATH}")

    try:
        client.delete_collection(name="hawassa_university")
    except Exception:
        pass

    global collection
    collection = client.get_or_create_collection(name="hawassa_university")

    doc_id = 0
    added_count = 0

    for filepath in sorted(DATA_PATH.glob('*.json')):
        with filepath.open('r', encoding='utf-8') as f:
            data = json.load(f)

        if isinstance(data, dict):
            data = [data]

        if not isinstance(data, list):
            logger.warning('Skipping invalid JSON file: %s', filepath)
            continue

        for item in data:
            if not item.get('question') or not item.get('answer'):
                logger.warning('Skipping invalid knowledge item in %s: %s', filepath, item)
                continue

            text = _build_document_text(item)
            metadata = _build_metadata(item, source_file=filepath.name)
            embedding = model.encode(text, normalize_embeddings=True).tolist()

            collection.add(
                ids=[str(doc_id)],
                embeddings=[embedding],
                documents=[text],
                metadatas=[metadata],
            )

            doc_id += 1
            added_count += 1

    print(f"Ingested {added_count} knowledge entries into ChromaDB.")


if __name__ == "__main__":
    ingest_documents()