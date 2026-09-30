"""CSV and deliberately small Primavera XER schedule importers."""

from __future__ import annotations

import csv
import io
import re
from datetime import date

from construction_reconciliation.demo.models import Activity, Schedule

TAG_RE = re.compile(r"\b(?:P|MCC|PT|NDT)-\d{3}[A-Z]?\b|\b\d{1,2}\"-P-\d{3}\b", re.I)


def parse_activity_name(name: str) -> tuple[str | None, str]:
    tag = TAG_RE.search(name)
    lowered = name.lower()
    for needle, action in (
        ("connect discharge", "CONNECT_DISCHARGE"),
        ("connect suction", "CONNECT_SUCTION"),
        ("position", "POSITION"),
        ("align", "ALIGN"),
        ("grout", "GROUT"),
        ("hydrotest", "HYDROTEST"),
        ("ndt", "NDT"),
        ("weld", "WELD"),
        ("erect", "ERECT"),
    ):
        if needle in lowered:
            return (tag.group(0).upper() if tag else None, action)
    if re.search(r"\b(?:install|set)\s+(?:pump\s+)?P-\d", name, re.I):
        return (tag.group(0).upper() if tag else None, "POSITION")
    return (tag.group(0).upper() if tag else None, "GENERAL")


def _activity(row: dict[str, str]) -> Activity:
    tag, action = parse_activity_name(row.get("name", ""))
    predecessors = [value.strip() for value in row.get("predecessors", "").split(",") if value.strip()]
    if not row.get("id", "").strip() or not row.get("name", "").strip():
        raise ValueError("Every schedule row needs an activity id and name.")
    for key in ("planned_start", "planned_finish"):
        if row.get(key):
            try:
                date.fromisoformat(row[key][:10])
            except ValueError as exc:
                raise ValueError(f"Invalid {key} for {row['id']}.") from exc
    if row.get("planned_start") and row.get("planned_finish") and row["planned_finish"][:10] < row["planned_start"][:10]:
        raise ValueError(f"Planned finish precedes start for {row['id']}.")
    return Activity(
        id=row["id"].strip(), name=row["name"].strip(), wbs=row.get("wbs", ""),
        discipline=row.get("discipline", "GENERAL"), area=row.get("area", ""),
        planned_start=row.get("planned_start") or None, planned_finish=row.get("planned_finish") or None,
        predecessors=predecessors, object_tag=tag, action=action,
    )


def import_csv(content: str) -> Schedule:
    reader = csv.DictReader(io.StringIO(content))
    if not reader.fieldnames or not {"id", "name"}.issubset({name.lower() for name in reader.fieldnames}):
        raise ValueError("CSV requires id and name columns.")
    activities = [_activity({key.lower(): value or "" for key, value in row.items() if key}) for row in reader]
    _validate_activities(activities)
    return Schedule(activities=activities, source_format="csv")


def _validate_activities(activities: list[Activity]) -> None:
    if not activities:
        raise ValueError("Schedule has no activities.")
    ids = {activity.id for activity in activities}
    if len(ids) != len(activities):
        raise ValueError("Schedule contains duplicate activity ids.")
    for activity in activities:
        if activity.id in activity.predecessors:
            raise ValueError(f"Activity {activity.id} cannot depend on itself.")


def import_xer(content: str) -> Schedule:
    """Read TASK, TASKPRED and PROJWBS blocks from a small P6 XER export."""
    tables: dict[str, list[dict[str, str]]] = {"TASK": [], "TASKPRED": [], "PROJWBS": []}
    fields: list[str] = []
    table: str | None = None
    for raw_line in content.splitlines():
        parts = raw_line.split("\t")
        marker = parts[0] if parts else ""
        if marker == "%T":
            table = parts[1] if len(parts) > 1 and parts[1] in tables else None
            fields = []
        elif table and marker == "%F":
            fields = [field.lower() for field in parts[1:]]
        elif table and marker == "%R" and fields:
            tables[table].append(dict(zip(fields, parts[1:], strict=False)))
    if not tables["TASK"]:
        raise ValueError("XER contains no supported TASK rows.")
    wbs_names = {row.get("wbs_id", ""): row.get("wbs_short_name", "") for row in tables["PROJWBS"]}
    task_code_by_id = {row.get("task_id", ""): row.get("task_code", row.get("id", "")) for row in tables["TASK"]}
    predecessors: dict[str, list[str]] = {}
    for relation in tables["TASKPRED"]:
        successor = task_code_by_id.get(relation.get("task_id", ""), "")
        predecessor = task_code_by_id.get(relation.get("pred_task_id", ""), "")
        if successor and predecessor:
            predecessors.setdefault(successor, []).append(predecessor)
    rows = []
    for row in tables["TASK"]:
        activity_id = row.get("activity_id") or row.get("task_code") or row.get("id", "")
        rows.append({
            "id": activity_id,
            "name": row.get("name") or row.get("task_name", ""),
            "wbs": row.get("wbs") or wbs_names.get(row.get("wbs_id", ""), ""),
            "discipline": row.get("discipline", "GENERAL"),
            "area": row.get("area", ""),
            "planned_start": (row.get("planned_start") or row.get("target_start_date") or "")[:10],
            "planned_finish": (row.get("planned_finish") or row.get("target_end_date") or "")[:10],
            "predecessors": row.get("predecessors") or ",".join(predecessors.get(activity_id, [])),
        })
    activities = [_activity(row) for row in rows]
    _validate_activities(activities)
    return Schedule(activities=activities, source_format="xer")


def schedule_summary(schedule: Schedule) -> dict[str, int | str]:
    tags = {activity.object_tag for activity in schedule.activities if activity.object_tag}
    relationships = sum(len(activity.predecessors) for activity in schedule.activities)
    return {"schedule_id": schedule.id, "source_format": schedule.source_format, "activity_count": len(schedule.activities), "relationship_count": relationships, "tag_count": len(tags)}
