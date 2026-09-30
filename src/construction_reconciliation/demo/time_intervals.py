"""Small, deterministic time-phrase parser for the Phase 2 demo."""

from __future__ import annotations

import re
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from construction_reconciliation.demo.models import TimeInterval

PROJECT_TIMEZONE = ZoneInfo("Asia/Kolkata")
_TIME_PHRASE = re.compile(
    r"\baround\s+3(?:\s*(?:pm|p\.m\.))?\b"
    r"|\bafter\s+lunch\b"
    r"|\b(?:(?:today|yesterday)\s+)?(?:morning|evening)\b"
    r"|\b(?:today|yesterday)\b"
    r"|\b20\d{2}-\d{2}-\d{2}\b",
    re.IGNORECASE,
)
_EXPLICIT_DATE = re.compile(r"\b20\d{2}-\d{2}-\d{2}\b")


def _event_day(text: str, received_at: date) -> date:
    explicit = _EXPLICIT_DATE.search(text)
    if explicit:
        try:
            return date.fromisoformat(explicit.group(0))
        except ValueError:
            pass
    if re.search(r"\byesterday\b", text, re.IGNORECASE):
        return received_at - timedelta(days=1)
    return received_at


def _make_interval(
    day: date,
    start_hour: int,
    start_minute: int,
    end_hour: int,
    end_minute: int,
    phrase: str | None,
    confidence: str = "MEDIUM",
) -> TimeInterval:
    return TimeInterval(
        earliest=datetime.combine(day, time(start_hour, start_minute), tzinfo=PROJECT_TIMEZONE),
        latest=datetime.combine(day, time(end_hour, end_minute), tzinfo=PROJECT_TIMEZONE),
        confidence=confidence,
        phrase=phrase,
    )


def intervals_from_text(text: str, received_at: date) -> tuple[list[TimeInterval], list[tuple[int, int]]]:
    """Return recognized time ranges and their offsets in the supplied text.

    If the text has no supported phrase, return a low-confidence interval for
    the whole report day. Unrecognized phrases are left untouched in source
    text and use that same conservative fallback.
    """
    day = _event_day(text, received_at)
    intervals: list[TimeInterval] = []
    spans: list[tuple[int, int]] = []
    for match in _TIME_PHRASE.finditer(text):
        phrase = match.group(0)
        normalized = phrase.casefold()
        if normalized.startswith("around"):
            bounds = (14, 45, 15, 15)
        elif normalized == "after lunch":
            bounds = (13, 0, 15, 0)
        elif normalized.endswith("evening"):
            bounds = (17, 0, 21, 0)
        elif normalized.endswith("morning"):
            bounds = (6, 0, 12, 0)
        else:
            bounds = (0, 0, 23, 59)
        confidence = "LOW" if bounds == (0, 0, 23, 59) else "MEDIUM"
        intervals.append(_make_interval(day, *bounds, phrase=phrase, confidence=confidence))
        spans.append((match.start(), match.end()))

    if not intervals:
        intervals.append(
            _make_interval(
                day,
                0,
                0,
                23,
                59,
                phrase=None,
                confidence="LOW",
            )
        )
    return intervals, spans


def intersect_intervals(intervals: list[TimeInterval]) -> TimeInterval | None:
    """Intersect time evidence, returning None when the claims do not overlap."""
    if not intervals:
        return None
    earliest = max(interval.earliest for interval in intervals)
    latest = min(interval.latest for interval in intervals)
    if earliest > latest:
        return None
    confidence_rank = {"LOW": 0, "MEDIUM": 1, "HIGH": 2}
    informative = [
        item for item in intervals
        if not (
            item.confidence == "LOW"
            and item.latest - item.earliest >= timedelta(hours=23)
        )
    ]
    confidence = min(informative or intervals, key=lambda item: confidence_rank[item.confidence]).confidence
    phrases = [interval.phrase for interval in intervals if interval.phrase]
    return TimeInterval(
        earliest=earliest,
        latest=latest,
        confidence=confidence,
        phrase="; ".join(phrases) or None,
    )
