from datetime import date
from pathlib import Path

from construction_reconciliation.demo.importer import import_csv
from construction_reconciliation.demo.pipeline import DemoStore, extract_events
from construction_reconciliation.demo.time_intervals import intersect_intervals, intervals_from_text


DATA = Path(__file__).parents[2] / "src" / "construction_reconciliation" / "demo_data"
REPORT_DAY = date(2026, 9, 30)


def test_time_phrases_narrow_to_intersection_and_keep_spans():
    text = "P-201 fitted after lunch, around 3."
    event = extract_events(text, received_at=REPORT_DAY)[0]
    assert event.time_interval.earliest.isoformat() == "2026-09-30T14:45:00+05:30"
    assert event.time_interval.latest.isoformat() == "2026-09-30T15:00:00+05:30"
    assert event.time_interval.confidence == "MEDIUM"
    assert {text[span.start:span.end] for span in event.spans if span.kind == "time"} == {"after lunch", "around 3"}


def test_yesterday_rollover_and_missing_time_fallback():
    evening = extract_events("P-201 fitted yesterday evening.", received_at=date(2026, 1, 1))[0].time_interval
    assert evening.earliest.isoformat() == "2025-12-31T17:00:00+05:30"
    assert evening.latest.isoformat() == "2025-12-31T21:00:00+05:30"
    fallback = extract_events("P-201 fitted sometime today.", received_at=REPORT_DAY)[0].time_interval
    assert fallback.earliest.isoformat() == "2026-09-30T00:00:00+05:30"
    assert fallback.latest.isoformat() == "2026-09-30T23:59:00+05:30"
    assert fallback.confidence == "LOW"


def test_disjoint_intervals_are_preserved_for_planner_review():
    morning, _ = intervals_from_text("morning", REPORT_DAY)
    evening, _ = intervals_from_text("evening", REPORT_DAY)
    assert intersect_intervals([*morning, *evening]) is None

    store = DemoStore()
    schedule = store.add_schedule(import_csv((DATA / "project_schedule.csv").read_text(encoding="utf-8")))
    first = store.process(schedule.id, "P-201 fitted yesterday morning.", received_at=REPORT_DAY)
    revised = store.process(schedule.id, "P-201 fitted yesterday evening.", received_at=REPORT_DAY, report_id=first.report_id)
    assert len(revised.time_conflicts) == 1
    assert revised.time_conflicts[0].activity_id == "L6-421"
    assert len(revised.time_conflicts[0].intervals) == 2
    assert revised.patches[0].approval_tier == "PLANNER"
