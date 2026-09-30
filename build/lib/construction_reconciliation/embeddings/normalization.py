"""Deterministic normalization for semantic activity text."""

import re


_WHITESPACE = re.compile(r"\s+")
_PIPE_SPACING = re.compile(r"\s*\|\s*")


def normalize_semantic_text(*fields: str | None) -> str:
    """Normalize and join semantic fields, omitting blank optional values.

    Pass only activity identity fields (for example discipline, activity type,
    description, location, and equipment tag). IDs, dates, and unrelated source
    metadata are intentionally not accepted as separate fields by this helper.
    Field order is preserved and meaningful wording/case is left unchanged.
    """
    parts: list[str] = []
    for index, field in enumerate(fields):
        if field is None:
            continue
        if not isinstance(field, str):
            raise TypeError(f"Semantic field at position {index} must be str or None.")

        normalized = _WHITESPACE.sub(" ", field).strip()
        normalized = _PIPE_SPACING.sub(" | ", normalized)
        normalized = normalized.strip(" |")
        if normalized:
            parts.append(normalized)

    return " | ".join(parts)
