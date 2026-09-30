"""Offline, persistence-agnostic embedding generation."""

from collections.abc import Sequence
from numbers import Real

from construction_reconciliation.embeddings.model import (
    EMBEDDING_DIMENSION,
    get_embedding_model,
)
from construction_reconciliation.embeddings.normalization import normalize_semantic_text


class EmbeddingDimensionError(ValueError):
    """Raised when the model returns a vector with an unexpected shape."""


def _normalize_input(text: str, *, index: int | None = None) -> str:
    label = "Text" if index is None else f"Text at position {index}"
    if not isinstance(text, str):
        raise TypeError(f"{label} must be a string.")
    normalized = normalize_semantic_text(text)
    if not normalized:
        raise ValueError(f"{label} must not be empty or whitespace-only.")
    return normalized


def _as_vector(values: object, *, index: int | None = None) -> list[float]:
    label = "Embedding" if index is None else f"Embedding at position {index}"
    if hasattr(values, "tolist"):
        values = values.tolist()
    if not isinstance(values, (list, tuple)):
        raise EmbeddingDimensionError(f"{label} is not a one-dimensional vector.")
    if len(values) != EMBEDDING_DIMENSION:
        raise EmbeddingDimensionError(
            f"{label} has dimension {len(values)}; expected {EMBEDDING_DIMENSION}."
        )
    if any(not isinstance(value, Real) for value in values):
        raise TypeError(f"{label} contains a non-numeric value.")
    return [float(value) for value in values]


def generate_embedding(text: str) -> list[float]:
    """Generate one normalized 384-dimensional embedding from semantic text."""
    normalized_text = _normalize_input(text)
    model = get_embedding_model()
    result = model.encode(
        normalized_text,
        normalize_embeddings=True,
        show_progress_bar=False,
    )
    return _as_vector(result)


def generate_embeddings(texts: list[str]) -> list[list[float]]:
    """Generate a deterministically ordered batch of normalized embeddings."""
    if not isinstance(texts, list):
        raise TypeError("texts must be a list of strings.")
    if not texts:
        return []

    # Build a fresh list so neither normalization nor encoding mutates caller data.
    normalized_texts = [
        _normalize_input(text, index=index) for index, text in enumerate(texts)
    ]
    model = get_embedding_model()
    result = model.encode(
        normalized_texts,
        normalize_embeddings=True,
        show_progress_bar=False,
    )
    if hasattr(result, "tolist"):
        result = result.tolist()
    if not isinstance(result, Sequence) or isinstance(result, (str, bytes)):
        raise EmbeddingDimensionError("Batch encoder did not return a sequence of vectors.")
    if len(result) != len(normalized_texts):
        raise EmbeddingDimensionError(
            f"Batch encoder returned {len(result)} vectors for "
            f"{len(normalized_texts)} input texts."
        )
    return [_as_vector(vector, index=index) for index, vector in enumerate(result)]
