"""Typed contracts for the offline Phase 1 demonstration."""

from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Literal
from uuid import uuid4

from pydantic import BaseModel, Field, model_validator


ActivityState = Literal["COMPLETE", "BLOCKED", "STARTED", "PROGRESS", "PARTIAL"]
RuleVerdict = Literal["SAFE", "SUSPICIOUS", "BLOCKED"]
SourceKind = Literal["MESSAGE", "TEXT", "CSV", "XLSX"]


class TimeInterval(BaseModel):
    earliest: datetime
    latest: datetime
    confidence: Literal["HIGH", "MEDIUM", "LOW"]
    phrase: str | None = None

    @model_validator(mode="after")
    def validate_bounds(self) -> "TimeInterval":
        if self.earliest.utcoffset() is None or self.latest.utcoffset() is None:
            raise ValueError("Time interval bounds must include a timezone offset.")
        if self.earliest > self.latest:
            raise ValueError("Time interval earliest bound must not follow latest bound.")
        return self


class Source(BaseModel):
    id: str = Field(default_factory=lambda: f"source-{uuid4().hex[:8]}")
    kind: SourceKind
    filename: str | None = None
    text: str
    received_at: date
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class SourceClaim(BaseModel):
    source_id: str
    event_id: str
    state: ActivityState
    text: str


class SourceConflict(BaseModel):
    activity_id: str
    activity_name: str
    field: str
    resolution: str = "PARTIAL"
    claims: list[SourceClaim]


class TimeConflict(BaseModel):
    activity_id: str | None = None
    activity_name: str | None = None
    event_ids: list[str]
    source_ids: list[str]
    intervals: list[TimeInterval]


class SilentProgressFinding(BaseModel):
    predecessor_activity_id: str
    predecessor_activity_name: str
    successor_activity_id: str
    successor_activity_name: str
    successor_event_id: str
    source_id: str
    successor_start_interval: TimeInterval | None = None
    predecessor_finish_upper_bound: datetime | None = None


class QuantityProgress(BaseModel):
    activity_id: str
    activity_name: str
    observed_quantity: float
    quantity_unit: str
    planned_quantity: float | None = None
    percent_complete: float | None = None
    evidence_event_ids: list[str] = Field(default_factory=list)


class StateProbability(BaseModel):
    candidate: Literal["PREDECESSOR_COMPLETE", "PREDECESSOR_INCOMPLETE"]
    probability: float


class AskBackOutcome(BaseModel):
    answer: Literal["YES", "NO"]
    distribution: list[StateProbability]


class AskBackQuestion(BaseModel):
    id: str
    predecessor_activity_id: str
    successor_activity_id: str
    successor_event_id: str
    question: str
    candidate_distribution_before: list[StateProbability]
    outcomes: list[AskBackOutcome]
    information_gain_bits: float
    selected_answer: Literal["YES", "NO"] | None = None
    candidate_distribution_after: list[StateProbability] = Field(default_factory=list)


class Activity(BaseModel):
    id: str
    name: str
    wbs: str = ""
    discipline: str = "GENERAL"
    area: str = ""
    planned_start: str | None = None
    planned_finish: str | None = None
    predecessors: list[str] = Field(default_factory=list)
    object_tag: str | None = None
    action: str = ""
    status: str = "NOT_STARTED"
    quantity_total: float | None = None
    quantity_unit: str | None = None
    is_critical: bool = False


class Schedule(BaseModel):
    id: str = Field(default_factory=lambda: f"schedule-{uuid4().hex[:8]}")
    activities: list[Activity]
    source_format: Literal["csv", "xer"]
    unresolved_dependency_edges: list[tuple[str, str]] = Field(default_factory=list)


class SourceSpan(BaseModel):
    start: int
    end: int
    kind: Literal["tag", "action", "state", "cause", "qty", "time"]


class Event(BaseModel):
    id: str = Field(default_factory=lambda: f"event-{uuid4().hex[:8]}")
    raw_text: str
    object_tag: str | None = None
    action: str
    state: ActivityState
    area: str | None = None
    cause: str | None = None
    quantity: float | None = None
    quantity_unit: str | None = None
    event_date: str | None = None
    source_id: str = ""
    time_interval: TimeInterval | None = None
    time_conflicts: list[TimeInterval] = Field(default_factory=list)
    spans: list[SourceSpan] = Field(default_factory=list)


class CandidateLink(BaseModel):
    activity_id: str
    activity_name: str
    score: float
    reason: str


class RuleResult(BaseModel):
    name: str
    verdict: RuleVerdict
    reason: str


class ProposedUpdate(BaseModel):
    activity_id: str
    activity_name: str
    field: str
    before: str
    after: str
    state: ActivityState
    evidence_event_id: str
    evidence_event_ids: list[str] = Field(default_factory=list)
    time_interval: TimeInterval | None = None
    inferred: bool = False


class Patch(BaseModel):
    id: str = Field(default_factory=lambda: f"patch-{uuid4().hex[:8]}")
    report_id: str
    updates: list[ProposedUpdate]
    rules: list[RuleResult]
    approval_tier: Literal["AUTO", "CONFIRM", "PLANNER", "BLOCKED"]
    status: Literal["PENDING", "ACCEPTED", "REJECTED", "UNDONE", "SUPERSEDED"] = "PENDING"
    evidence: list[str]
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    schedule_id: str = ""
    revision: int = 1


class Workspace(BaseModel):
    report_id: str
    source_text: str
    sources: list[Source] = Field(default_factory=list)
    events: list[Event]
    links: dict[str, list[CandidateLink]]
    patches: list[Patch]
    unmatched_work: list[Event]
    conflicts: list[SourceConflict] = Field(default_factory=list)
    time_conflicts: list[TimeConflict] = Field(default_factory=list)
    silent_progress: list[SilentProgressFinding] = Field(default_factory=list)
    ask_back_questions: list[AskBackQuestion] = Field(default_factory=list)
    quantity_progress: list[QuantityProgress] = Field(default_factory=list)

