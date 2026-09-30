"""Deterministic Phase 1 extraction, compilation, verification, and demo state."""

from __future__ import annotations

import re
from collections import defaultdict
from datetime import date, datetime, timedelta
from uuid import uuid4

from construction_reconciliation.demo.importer import TAG_RE
from construction_reconciliation.demo.models import (
    CandidateLink,
    Event,
    Patch,
    ProposedUpdate,
    RuleResult,
    Schedule,
    Source,
    SourceClaim,
    SourceConflict,
    SourceKind,
    SourceSpan,
    TimeConflict,
    TimeInterval,
    Workspace,
)
from construction_reconciliation.demo.time_intervals import intersect_intervals, intervals_from_text

ACTION_PATTERNS = (
    (r"\b(?:fitted|positioned|pump installed)\b", "POSITION", "COMPLETE"),
    (r"\b(?:alignment done|aligned)\b", "ALIGN", "COMPLETE"),
    (r"\bdischarge\s+(?:couldn.t|could not|can.t|cannot)\s+(?:happen|be connected|proceed)\b", "CONNECT_DISCHARGE", "BLOCKED"),
    (r"\b(?:discharge connected|connected discharge)\b", "CONNECT_DISCHARGE", "COMPLETE"),
    (r"\b(?:suction connected|connected suction)\b", "CONNECT_SUCTION", "COMPLETE"),
    (r"\b(?:grouting completed|grouted)\b", "GROUT", "COMPLETE"),
    (r"\bhydrotest\b[^.\n]*\bcompleted\b", "HYDROTEST", "COMPLETE"),
    (r"\bndt\b[^.\n]*\bcompleted\b", "NDT", "COMPLETE"),
    (r"\b(?:erected|erection complete)\b", "ERECT", "COMPLETE"),
    (r"\berection started\b", "ERECT", "STARTED"),
    (r"\b(?:welded|welding complete)\b", "WELD", "COMPLETE"),
    (r"\bwelding started\b", "WELD", "STARTED"),
)


def extract_events(
    text: str,
    *,
    area: str | None = None,
    received_at: date | None = None,
    source_id: str = "",
) -> list[Event]:
    report_date = received_at or date.today()
    if not area:
        area_match = re.search(r"\bUnit[- ]?\d+\b", text, re.I)
        area = area_match.group(0).replace(" ", "-") if area_match else None
    tags = list(TAG_RE.finditer(text))
    events: list[Event] = []
    for pattern, action, state in ACTION_PATTERNS:
        for match in re.finditer(pattern, text, re.I):
            nearest = min(tags, key=lambda tag: abs(tag.start() - match.start()), default=None)
            spans = [SourceSpan(start=match.start(), end=match.end(), kind="state")]
            if nearest:
                spans.append(SourceSpan(start=nearest.start(), end=nearest.end(), kind="tag"))
            clause_start = max(text.rfind(".", 0, match.start()) + 1, text.rfind("\n", 0, match.start()) + 1)
            clause_end = text.find(".", match.end())
            clause = text[clause_start:clause_end if clause_end >= 0 else len(text)]
            time_intervals, time_spans = intervals_from_text(clause, report_date)
            merged_time = intersect_intervals(time_intervals)
            event_time_spans = [
                SourceSpan(
                    start=clause_start + start,
                    end=clause_start + end,
                    kind="time",
                )
                for start, end in time_spans
            ]
            quantity_match = re.search(r"\b(\d+(?:\.\d+)?)\s*(spools?|joints?|m3|m|%)\b", clause, re.I)
            if quantity_match:
                spans.append(SourceSpan(start=clause_start + quantity_match.start(), end=clause_start + quantity_match.end(), kind="qty"))
            event_date = (report_date - timedelta(days=1)).isoformat() if "yesterday" in clause.lower() else report_date.isoformat() if any(word in clause.lower() for word in ("today", "this morning")) else None
            explicit = re.search(r"\b20\d\d-\d\d-\d\d\b", clause)
            if explicit:
                event_date = explicit.group(0)
            cause = "valve unavailable" if action == "CONNECT_DISCHARGE" and "valve" in clause.lower() else None
            spans.extend(event_time_spans)
            events.append(Event(
                raw_text=text,
                object_tag=nearest.group(0).upper() if nearest else None,
                action=action,
                state=state,
                area=area,
                cause=cause,
                quantity=float(quantity_match.group(1)) if quantity_match else None,
                quantity_unit=quantity_match.group(2) if quantity_match else None,
                event_date=event_date,
                source_id=source_id,
                time_interval=merged_time,
                time_conflicts=time_intervals if merged_time is None else [],
                spans=spans,
            ))
    return sorted(events, key=lambda event: event.spans[0].start)


def link_and_compile(events: list[Event], schedule: Schedule) -> tuple[dict[str, list[CandidateLink]], list[ProposedUpdate], list[Event]]:
    links: dict[str, list[CandidateLink]] = {}
    updates: list[ProposedUpdate] = []
    unmatched: list[Event] = []
    explicit_actions = {(event.object_tag, event.action) for event in events}
    for event in events:
        candidates = [activity for activity in schedule.activities if event.object_tag and activity.object_tag == event.object_tag and activity.action == event.action]
        candidates.sort(key=lambda activity: bool(event.area and activity.area and event.area.casefold() not in activity.area.casefold()))
        links[event.id] = [CandidateLink(activity_id=a.id, activity_name=a.name, score=0.7 if event.area and a.area and event.area.casefold() not in a.area.casefold() else 1.0, reason="Exact tag and action; area differs" if event.area and a.area and event.area.casefold() not in a.area.casefold() else "Exact equipment tag and action match") for a in candidates]
        if not candidates:
            unmatched.append(event)
            continue
        for activity in candidates:
            updates.append(ProposedUpdate(activity_id=activity.id, activity_name=activity.name, field="status", before=activity.status, after=event.state, state=event.state, evidence_event_id=event.id))
        if event.action == "ALIGN" and event.state == "COMPLETE" and (event.object_tag, "POSITION") not in explicit_actions:
            for activity in schedule.activities:
                if activity.object_tag == event.object_tag and activity.action == "POSITION" and activity.status != "COMPLETE":
                    links[event.id].append(CandidateLink(activity_id=activity.id, activity_name=activity.name, score=0.85, reason="Inferred earlier pump state from alignment claim"))
                    updates.append(ProposedUpdate(activity_id=activity.id, activity_name=activity.name, field="status", before=activity.status, after="COMPLETE", state="COMPLETE", evidence_event_id=event.id, inferred=True))
    return links, updates, unmatched


def _reconcile_evidence(
    raw_updates: list[ProposedUpdate],
    events: list[Event],
    schedule: Schedule,
) -> tuple[list[ProposedUpdate], list[SourceConflict], list[TimeConflict]]:
    """Collapse duplicate activity claims while retaining every source of evidence."""
    event_by_id = {event.id: event for event in events}
    activity_by_id = {activity.id: activity for activity in schedule.activities}
    grouped: dict[tuple[str, str], list[ProposedUpdate]] = defaultdict(list)
    for update in raw_updates:
        grouped[(update.activity_id, update.field)].append(update)

    updates: list[ProposedUpdate] = []
    conflicts: list[SourceConflict] = []
    time_conflicts: list[TimeConflict] = []
    for (activity_id, field), claims in grouped.items():
        activity = activity_by_id[activity_id]
        claim_events = [event_by_id[claim.evidence_event_id] for claim in claims]
        event_ids = list(dict.fromkeys(event.id for event in claim_events))
        states = list(dict.fromkeys(claim.after for claim in claims))
        completion_blocked_conflict = {"COMPLETE", "BLOCKED"}.issubset(states)
        resolved_state = "PARTIAL" if completion_blocked_conflict else states[-1]
        if completion_blocked_conflict:
            conflicts.append(SourceConflict(
                activity_id=activity_id,
                activity_name=activity.name,
                field=field,
                claims=[SourceClaim(
                    source_id=event.source_id,
                    event_id=event.id,
                    state=event.state,
                    text=event.raw_text,
                ) for event in claim_events],
            ))

        intervals = [interval for event in claim_events for interval in (
            event.time_conflicts if event.time_conflicts else ([event.time_interval] if event.time_interval else [])
        )]
        merged_interval = intersect_intervals(intervals)
        if intervals and merged_interval is None:
            time_conflicts.append(TimeConflict(
                activity_id=activity_id,
                activity_name=activity.name,
                event_ids=event_ids,
                source_ids=list(dict.fromkeys(event.source_id for event in claim_events)),
                intervals=intervals,
            ))

        first = claims[0]
        updates.append(first.model_copy(update={
            "after": resolved_state,
            "state": resolved_state,
            "evidence_event_ids": event_ids,
            "time_interval": merged_interval,
        }))
    return updates, conflicts, time_conflicts


def verify(updates: list[ProposedUpdate], events: list[Event], schedule: Schedule, *, received_at: date | None = None) -> tuple[list[RuleResult], str]:
    by_id = {activity.id: activity for activity in schedule.activities}
    event_by_id = {event.id: event for event in events}
    completed_in_patch = {update.activity_id for update in updates if update.state == "COMPLETE"}
    rules: list[RuleResult] = []
    for update in updates:
        activity = by_id[update.activity_id]
        event = event_by_id[update.evidence_event_id]
        invalid_date = False
        if event.event_date:
            try:
                invalid_date = date.fromisoformat(event.event_date) > (received_at or date.today())
            except ValueError:
                invalid_date = True
        rules.append(RuleResult(name="Date order", verdict="BLOCKED" if invalid_date else "SAFE", reason="Event date is invalid or after the report date." if invalid_date else "Event date is valid for this report."))
        area_mismatch = bool(event.area and activity.area and event.area.lower() not in activity.area.lower())
        rules.append(RuleResult(name="Area consistency", verdict="SUSPICIOUS" if area_mismatch else "SAFE", reason="Reported area matches the planned activity." if not area_mismatch else "Reported area differs from planned activity area."))
        predecessor_missing = update.state in {"COMPLETE", "STARTED", "PROGRESS"} and bool(activity.predecessors) and any(by_id[p].status != "COMPLETE" and p not in completed_in_patch for p in activity.predecessors if p in by_id)
        rules.append(RuleResult(name="Predecessor evidence", verdict="SUSPICIOUS" if predecessor_missing else "SAFE", reason="Required predecessor evidence is present." if not predecessor_missing else "A predecessor has no completion evidence."))
        backwards = activity.status == "COMPLETE" and update.state in {"STARTED", "PROGRESS", "BLOCKED"} and "rework" not in event.raw_text.casefold()
        rules.append(RuleResult(name="Backward progress", verdict="SUSPICIOUS" if backwards else "SAFE", reason="Progress moves forward." if not backwards else "Progress moved backward without a rework tag."))
    tier = "BLOCKED" if any(rule.verdict == "BLOCKED" for rule in rules) else "PLANNER" if any(rule.verdict == "SUSPICIOUS" for rule in rules) else "CONFIRM"
    return rules, tier


class DemoStore:
    def __init__(self) -> None:
        self.schedules: dict[str, Schedule] = {}
        self.workspaces: dict[str, Workspace] = {}
        self.audit: dict[str, list[dict[str, str]]] = defaultdict(list)
        self.applied_fields: dict[str, dict[str, str]] = {}

    def add_schedule(self, schedule: Schedule) -> Schedule:
        self.schedules[schedule.id] = schedule
        return schedule

    def process(
        self,
        schedule_id: str,
        text: str,
        *,
        area: str | None = None,
        received_at: date | None = None,
        source_kind: SourceKind = "MESSAGE",
        filename: str | None = None,
        report_id: str | None = None,
    ) -> Workspace:
        if schedule_id not in self.schedules:
            raise KeyError(schedule_id)
        source = Source(
            kind=source_kind,
            filename=filename,
            text=text,
            received_at=received_at or date.today(),
        )
        if report_id is not None:
            return self.append_source(report_id, source, area=area)

        report_id = f"report-{uuid4().hex[:12]}"
        return self._compile(report_id, schedule_id, [source], area=area)

    def append_source(self, report_id: str, source: Source, *, area: str | None = None) -> Workspace:
        workspace = self.workspaces.get(report_id)
        if workspace is None:
            raise KeyError(report_id)
        if not workspace.patches or workspace.patches[0].status != "PENDING":
            raise ValueError("Sources can only be added while the current patch is pending.")

        previous_patch = workspace.patches[0]
        previous_patch.status = "SUPERSEDED"
        self.audit[previous_patch.id].append({"action": "SOURCE_ADDED", "status": "SUPERSEDED", "source_id": source.id})
        self.audit[previous_patch.id].append({"action": "PATCH_REVISED", "status": "SUPERSEDED"})
        return self._compile(
            report_id,
            previous_patch.schedule_id,
            [*workspace.sources, source],
            area=area,
            revision=previous_patch.revision + 1,
            patch_history=workspace.patches,
        )

    def _compile(
        self,
        report_id: str,
        schedule_id: str,
        sources: list[Source],
        *,
        area: str | None,
        revision: int = 1,
        patch_history: list[Patch] | None = None,
    ) -> Workspace:
        schedule = self.schedules[schedule_id]
        events: list[Event] = []
        for source in sources:
            events.extend(extract_events(
                source.text,
                area=area,
                received_at=source.received_at,
                source_id=source.id,
            ))
        links, raw_updates, unmatched = link_and_compile(events, schedule)
        updates, conflicts, time_conflicts = _reconcile_evidence(raw_updates, events, schedule)
        rules, tier = verify(updates, events, schedule, received_at=sources[-1].received_at if sources else None)
        if conflicts:
            tier = "PLANNER"
        if time_conflicts:
            tier = "PLANNER"
        if unmatched and not updates:
            tier = "PLANNER"
        patch = Patch(
            report_id=report_id,
            schedule_id=schedule_id,
            updates=updates,
            rules=rules,
            approval_tier=tier,
            evidence=[source.text for source in sources],
            revision=revision,
        )
        workspace = Workspace(
            report_id=report_id,
            source_text=sources[0].text if sources else "",
            sources=sources,
            events=events,
            links=links,
            patches=[patch, *(patch_history or [])],
            unmatched_work=unmatched,
            conflicts=conflicts,
            time_conflicts=time_conflicts,
        )
        self.workspaces[report_id] = workspace
        self.audit[patch.id].append({"action": "PATCH_CREATED", "status": "PENDING", "revision": str(revision)})
        return workspace

    def patch_action(self, patch_id: str, action: str) -> Patch:
        for workspace in self.workspaces.values():
            for patch in workspace.patches:
                if patch.id != patch_id:
                    continue
                schedule = self.schedules[patch.schedule_id]
                activities = {activity.id: activity for activity in schedule.activities}
                if action == "accept":
                    if patch.status != "PENDING":
                        raise ValueError("Only pending patches can be accepted.")
                    if not patch.updates:
                        raise ValueError("Unmatched work needs planner review before an update can be applied.")
                    if patch.approval_tier == "BLOCKED":
                        raise ValueError("Blocked patches cannot be accepted.")
                    if any(activities[update.activity_id].status != update.before for update in patch.updates):
                        raise ValueError("Schedule changed since this patch was proposed.")
                    self.applied_fields[patch.id] = {update.activity_id: activities[update.activity_id].status for update in patch.updates}
                    for update in patch.updates:
                        activities[update.activity_id].status = update.after
                    patch.status = "ACCEPTED"
                elif action == "reject":
                    if patch.status != "PENDING":
                        raise ValueError("Only pending patches can be rejected.")
                    patch.status = "REJECTED"
                elif action == "undo":
                    if patch.status != "ACCEPTED":
                        raise ValueError("Only accepted patches can be undone.")
                    if any(activities[update.activity_id].status != update.after for update in patch.updates):
                        raise ValueError("Schedule changed since this patch was applied.")
                    for activity_id, old_status in self.applied_fields[patch.id].items():
                        activities[activity_id].status = old_status
                    patch.status = "UNDONE"
                else:
                    raise ValueError("Unsupported patch action")
                self.audit[patch_id].append({"action": action.upper(), "status": patch.status})
                return patch
        raise KeyError(patch_id)

