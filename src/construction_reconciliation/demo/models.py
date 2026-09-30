"""Typed contracts for the offline Phase 1 demonstration."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal
from uuid import uuid4

from pydantic import BaseModel, Field


ActivityState = Literal["COMPLETE", "BLOCKED", "STARTED", "PROGRESS"]
RuleVerdict = Literal["SAFE", "SUSPICIOUS", "BLOCKED"]


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


class Schedule(BaseModel):
    id: str = Field(default_factory=lambda: f"schedule-{uuid4().hex[:8]}")
    activities: list[Activity]
    source_format: Literal["csv", "xer"]


class SourceSpan(BaseModel):
    start: int
    end: int
    kind: Literal["tag", "action", "state", "cause", "qty"]


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
    inferred: bool = False


class Patch(BaseModel):
    id: str = Field(default_factory=lambda: f"patch-{uuid4().hex[:8]}")
    report_id: str
    updates: list[ProposedUpdate]
    rules: list[RuleResult]
    approval_tier: Literal["AUTO", "CONFIRM", "PLANNER", "BLOCKED"]
    status: Literal["PENDING", "ACCEPTED", "REJECTED", "UNDONE"] = "PENDING"
    evidence: list[str]
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    schedule_id: str = ""


class Workspace(BaseModel):
    report_id: str
    source_text: str
    events: list[Event]
    links: dict[str, list[CandidateLink]]
    patches: list[Patch]
    unmatched_work: list[Event]

