from __future__ import annotations

import ast
import hashlib
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest

from construction_reconciliation.embeddings.hashing import hash_embedding_text
from construction_reconciliation.embeddings.normalization import normalize_semantic_text
from construction_reconciliation.embeddings.service import (
    EmbeddingDimensionError,
    generate_embedding,
    generate_embeddings,
)
import construction_reconciliation.embeddings.service as embedding_service
import construction_reconciliation.embeddings.model as model_module


class FakeSentenceTransformer:
    """Small deterministic stand-in that keeps unit tests offline and fast."""

    def __init__(self) -> None:
        self.calls: list[tuple[object, bool, bool]] = []

    @staticmethod
    def _vector(text: str) -> list[float]:
        digest = hashlib.sha256(text.encode("utf-8")).digest()
        vector = [0.0] * 384
        vector[int.from_bytes(digest[:2], "big") % 384] = 1.0
        return vector

    def encode(
        self,
        inputs: str | list[str],
        *,
        normalize_embeddings: bool,
        show_progress_bar: bool,
    ) -> list[float] | list[list[float]]:
        self.calls.append((inputs, normalize_embeddings, show_progress_bar))
        if isinstance(inputs, str):
            return self._vector(inputs)
        return [self._vector(text) for text in inputs]


@pytest.fixture
def fake_model(monkeypatch: pytest.MonkeyPatch) -> FakeSentenceTransformer:
    model = FakeSentenceTransformer()
    monkeypatch.setattr(embedding_service, "get_embedding_model", lambda: model)
    return model


def test_valid_single_embedding_is_a_list_of_384_floats(fake_model: FakeSentenceTransformer) -> None:
    vector = generate_embedding("Piping | Erection | Line 24 XX | Unit 3")

    assert isinstance(vector, list)
    assert len(vector) == 384
    assert all(type(value) is float for value in vector)
    assert fake_model.calls[0][1:] == (True, False)


def test_same_input_produces_equivalent_embeddings(fake_model: FakeSentenceTransformer) -> None:
    first = generate_embedding("Piping | Erection | Line 24 XX | Unit 3")
    second = generate_embedding("Piping | Erection | Line 24 XX | Unit 3")

    assert first == second


@pytest.mark.parametrize("text", ["", "   ", "\n\t  "])
def test_empty_or_whitespace_input_is_rejected(
    text: str, fake_model: FakeSentenceTransformer
) -> None:
    with pytest.raises(ValueError, match="empty or whitespace-only"):
        generate_embedding(text)
    assert fake_model.calls == []


def test_non_string_single_input_is_rejected(fake_model: FakeSentenceTransformer) -> None:
    with pytest.raises(TypeError, match="must be a string"):
        generate_embedding(123)  # type: ignore[arg-type]
    assert fake_model.calls == []


def test_batch_embedding_preserves_count_order_and_input_list(
    fake_model: FakeSentenceTransformer,
) -> None:
    texts = ["Civil | Concrete | Foundation", "Piping | Welding | Line 24"]
    original = texts.copy()

    vectors = generate_embeddings(texts)

    assert texts == original
    assert len(vectors) == len(texts)
    assert all(len(vector) == 384 for vector in vectors)
    assert vectors == [FakeSentenceTransformer._vector(text) for text in texts]
    assert isinstance(fake_model.calls[0][0], list)
    assert fake_model.calls[0][1:] == (True, False)


def test_batch_rejects_invalid_items_and_empty_batch_does_not_load_model(
    fake_model: FakeSentenceTransformer,
) -> None:
    assert generate_embeddings([]) == []
    with pytest.raises(ValueError, match="position 1"):
        generate_embeddings(["valid", "  "])
    assert fake_model.calls == []


def test_dimension_mismatch_raises_meaningful_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class WrongDimensionModel:
        def encode(self, *_: object, **__: object) -> list[float]:
            return [0.0] * 383

    monkeypatch.setattr(embedding_service, "get_embedding_model", WrongDimensionModel)
    with pytest.raises(EmbeddingDimensionError, match="dimension 383; expected 384"):
        generate_embedding("Piping | Erection")


def test_transformer_is_cached_and_loaded_local_only(monkeypatch: pytest.MonkeyPatch) -> None:
    constructions: list[tuple[str, bool]] = []

    class StubSentenceTransformer:
        def __init__(self, model_name: str, *, local_files_only: bool) -> None:
            constructions.append((model_name, local_files_only))

    monkeypatch.setitem(
        sys.modules,
        "sentence_transformers",
        SimpleNamespace(SentenceTransformer=StubSentenceTransformer),
    )
    model_module.get_embedding_model.cache_clear()
    try:
        first = model_module.get_embedding_model()
        second = model_module.get_embedding_model()
    finally:
        model_module.get_embedding_model.cache_clear()

    assert first is second
    assert constructions == [("sentence-transformers/all-MiniLM-L6-v2", True)]


def test_normalization_collapses_space_and_omits_empty_optional_fields() -> None:
    result = normalize_semantic_text(
        " Piping  ", "Erection", None, "  Line   24 XX  ", "", " Unit 3 "
    )
    assert result == "Piping | Erection | Line 24 XX | Unit 3"


def test_hashing_is_deterministic_and_semantic_changes_change_hash() -> None:
    first = normalize_semantic_text("Piping", "Erection", "Line 24 XX", "Unit 3")
    equivalent = normalize_semantic_text(" Piping ", "Erection", "Line 24 XX", "Unit 3")
    changed = normalize_semantic_text("Piping", "Erection", "Line 24 XX", "Unit 4")

    assert hash_embedding_text(first) == hash_embedding_text(equivalent)
    assert hash_embedding_text(first) != hash_embedding_text(changed)
    assert hash_embedding_text(first) == hashlib.sha256(first.encode("utf-8")).hexdigest()


def test_embedding_package_has_no_database_imports_or_persistence_code() -> None:
    package = Path(__file__).parents[2] / "src" / "construction_reconciliation" / "embeddings"
    forbidden_names = {"sqlalchemy", "construction_reconciliation.database"}

    for source_file in package.glob("*.py"):
        tree = ast.parse(source_file.read_text(encoding="utf-8"))
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                imported = {alias.name for alias in node.names}
                assert not any(
                    name == forbidden or name.startswith(f"{forbidden}.")
                    for name in imported
                    for forbidden in forbidden_names
                )
            elif isinstance(node, ast.ImportFrom) and node.module:
                assert node.module not in forbidden_names

