"""Persistence-agnostic text normalization, hashing, and embedding generation."""

from construction_reconciliation.embeddings.hashing import hash_embedding_text
from construction_reconciliation.embeddings.normalization import normalize_semantic_text
from construction_reconciliation.embeddings.service import (
    EmbeddingDimensionError,
    generate_embedding,
    generate_embeddings,
)

__all__ = [
    "EmbeddingDimensionError",
    "generate_embedding",
    "generate_embeddings",
    "hash_embedding_text",
    "normalize_semantic_text",
]
