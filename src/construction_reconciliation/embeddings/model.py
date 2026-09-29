"""Central model configuration and cached local SentenceTransformer loader."""

from functools import lru_cache

from construction_reconciliation.config import get_settings

_settings = get_settings()

MODEL_NAME = _settings.embedding_model
EMBEDDING_DIMENSION = _settings.embedding_dimension
EMBEDDING_VERSION = _settings.embedding_version

if EMBEDDING_DIMENSION != 384:
    raise ValueError(
        "sentence-transformers/all-MiniLM-L6-v2 produces 384-dimensional vectors; "
        f"EMBEDDING_DIMENSION is configured as {EMBEDDING_DIMENSION}."
    )


@lru_cache(maxsize=1)
def get_embedding_model():
    """Load the configured transformer once, using only its local model cache."""
    try:
        from sentence_transformers import SentenceTransformer
    except ImportError as exc:
        raise RuntimeError(
            "SentenceTransformer is unavailable. Install project dependencies with "
            "`pip install -e .`."
        ) from exc

    # local_files_only prevents implicit downloads when the model is not cached.
    # Callers can provision the model separately; embedding requests stay offline.
    return SentenceTransformer(MODEL_NAME, local_files_only=True)
