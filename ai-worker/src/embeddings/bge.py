"""BGE-M3 임베딩 — DILAB B1.

청크 텍스트 → 1024 차 벡터 → Supabase pgvector. 한·영 다국어, 자체 호스팅.
"""
from functools import lru_cache

from sentence_transformers import SentenceTransformer

from ..config import settings


@lru_cache(maxsize=1)
def get_model() -> SentenceTransformer:
    """프로세스당 1회만 로드 (가중치 ~수 GB)."""
    return SentenceTransformer(settings.embedding_model_name)


def embed_texts(texts: list[str]) -> list[list[float]]:
    model = get_model()
    vectors = model.encode(texts, normalize_embeddings=True, show_progress_bar=False)
    return vectors.tolist()


def embed_one(text: str) -> list[float]:
    return embed_texts([text])[0]
