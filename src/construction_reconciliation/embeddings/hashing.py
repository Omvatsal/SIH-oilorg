"""Stable SHA-256 hashes for normalized embedding text."""

import hashlib


def hash_embedding_text(text: str) -> str:
    """Return the SHA-256 hex digest of the supplied UTF-8 text.

    Pass the output of ``normalize_semantic_text`` so equivalent semantic text
    has an identical source hash.
    """
    if not isinstance(text, str):
        raise TypeError("Embedding text must be a string.")
    return hashlib.sha256(text.encode("utf-8")).hexdigest()
