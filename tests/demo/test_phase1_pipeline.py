from pathlib import Path
from datetime import date

from construction_reconciliation.demo.importer import import_csv, import_xer
from construction_reconciliation.demo.pipeline import DemoStore, extract_events, verify, link_and_compile
from construction_reconciliation.demo.models import Event, ProposedUpdate, Source


DATA = Path(__file__).parents[2] / "src" / "construction_reconciliation" / "demo_data"


def csv_schedule():
    return import_csv((DATA / "project_schedule.csv").read_text(encoding="utf-8"))


def test_csv_fixture_has_40_industrial_activities():
    schedule = csv_schedule()
    assert len(schedule.activities) == 40
    assert next(a for a in schedule.activities if a.id == "L6-424").predecessors == ["L6-423"]


def test_xer_import_preserves_p201_dependencies():
    schedule = import_xer((DATA / "project_schedule.xer").read_text(encoding="utf-8"))
    assert next(a for a in schedule.activities if a.id == "L6-422").predecessors == ["L6-421"]
    assert next(a for a in schedule.activities if a.id == "L6-424").action == "CONNECT_DISCHARGE"


def test_standard_xer_taskpred_rows_link_task_codes():
    content = "%T\tPROJWBS\n%F\twbs_id\twbs_short_name\n%R\t10\tPump\n%T\tTASK\n%F\ttask_id\ttask_code\ttask_name\twbs_id\n%R\t1\tL6-421\tPosition P-201\t10\n%R\t2\tL6-422\tAlign P-201\t10\n%T\tTASKPRED\n%F\ttask_id\tpred_task_id\tpred_type\n%R\t2\t1\tPR_FS\n"
    schedule = import_xer(content)
    assert next(a for a in schedule.activities if a.id == "L6-422").predecessors == ["L6-421"]
    assert all(a.wbs == "Pump" for a in schedule.activities)


def test_p201_compiles_into_two_completions_and_one_blocked_update():
    store = DemoStore()
    schedule = store.add_schedule(csv_schedule())
    workspace = store.process(schedule.id, (DATA / "p201_chat.txt").read_text(encoding="utf-8"), area="Unit-2")

    updates = {update.activity_id: update.after for update in workspace.patches[0].updates}
    assert updates == {"L6-421": "COMPLETE", "L6-422": "COMPLETE", "L6-424": "BLOCKED"}
    # The blocked discharge connection lacks its suction predecessor evidence,
    # so the safety gate escalates the otherwise valid fan-out to a planner.
    assert workspace.patches[0].approval_tier == "PLANNER"


def test_single_alignment_claim_fans_out_to_position_and_align():
    schedule = csv_schedule()
    events = extract_events("P-201 aligned today.", received_at=date(2026, 9, 30))
    _, updates, unmatched = link_and_compile(events, schedule)
    assert not unmatched
    assert {update.activity_id for update in updates} == {"L6-421", "L6-422"}
    assert next(update for update in updates if update.activity_id == "L6-421").inferred


def test_dpr_quantity_and_area_are_extracted():
    events = extract_events('24"-P-112 erection started in Unit-2; 6 spools erected today.', received_at=date(2026, 9, 30))
    assert events[0].object_tag == '24"-P-112'
    assert events[0].area == "Unit-2"
    assert any(event.quantity == 6 and event.quantity_unit == "spools" for event in events)


def test_unmapped_grouting_is_retained_for_review():
    store = DemoStore()
    schedule = store.add_schedule(csv_schedule())
    workspace = store.process(schedule.id, (DATA / "grouting_chat.txt").read_text(encoding="utf-8"), area="Unit-2")

    assert len(workspace.unmatched_work) == 1
    assert workspace.unmatched_work[0].action == "GROUT"
    assert workspace.patches[0].approval_tier == "PLANNER"


def test_hydrotest_without_ndt_evidence_requires_planner_review():
    store = DemoStore()
    schedule = store.add_schedule(csv_schedule())
    workspace = store.process(schedule.id, (DATA / "hydrotest_chat.txt").read_text(encoding="utf-8"), area="Unit-2")

    rule = next(rule for rule in workspace.patches[0].rules if rule.name == "Predecessor evidence")
    assert rule.verdict == "SUSPICIOUS"
    assert workspace.patches[0].approval_tier == "PLANNER"


def test_patch_accept_and_undo_append_audit_history():
    store = DemoStore()
    schedule = store.add_schedule(csv_schedule())
    workspace = store.process(schedule.id, (DATA / "p201_chat.txt").read_text(encoding="utf-8"), area="Unit-2")
    patch = workspace.patches[0]

    assert store.patch_action(patch.id, "accept").status == "ACCEPTED"
    assert next(a for a in schedule.activities if a.id == "L6-421").status == "COMPLETE"
    assert store.patch_action(patch.id, "undo").status == "UNDONE"
    assert next(a for a in schedule.activities if a.id == "L6-421").status == "NOT_STARTED"
    assert [entry["action"] for entry in store.audit[patch.id]] == ["PATCH_CREATED", "ACCEPT", "UNDO"]


def test_future_event_date_is_blocked():
    schedule = csv_schedule()
    events = extract_events("P-201 fitted 2026-10-01.", received_at=date(2026, 9, 30))
    _, updates, _ = link_and_compile(events, schedule)
    rules, tier = verify(updates, events, schedule, received_at=date(2026, 9, 30))
    assert tier == "BLOCKED"
    assert next(rule for rule in rules if rule.name == "Date order").verdict == "BLOCKED"


def test_area_mismatch_and_backward_progress_are_reviewed():
    schedule = csv_schedule()
    position = next(a for a in schedule.activities if a.id == "L6-421")
    position.status = "COMPLETE"
    events = extract_events("P-201 fitted today.", area="Unit-3", received_at=date(2026, 9, 30))
    _, updates, _ = link_and_compile(events, schedule)
    rules, tier = verify(updates, events, schedule, received_at=date(2026, 9, 30))
    assert tier == "PLANNER"
    assert next(rule for rule in rules if rule.name == "Area consistency").verdict == "SUSPICIOUS"

    backward_event = Event(raw_text="P-201 started again.", object_tag="P-201", action="POSITION", state="STARTED")
    backward_update = ProposedUpdate(activity_id=position.id, activity_name=position.name, field="status", before="COMPLETE", after="STARTED", state="STARTED", evidence_event_id=backward_event.id)
    backward_rules, _ = verify([backward_update], [backward_event], schedule)
    assert next(rule for rule in backward_rules if rule.name == "Backward progress").verdict == "SUSPICIOUS"


def test_patch_reject_preserves_schedule_and_invalid_transition_fails():
    store = DemoStore()
    schedule = store.add_schedule(csv_schedule())
    workspace = store.process(schedule.id, (DATA / "p201_chat.txt").read_text(encoding="utf-8"))
    patch = workspace.patches[0]
    assert store.patch_action(patch.id, "reject").status == "REJECTED"
    assert next(a for a in schedule.activities if a.id == "L6-421").status == "NOT_STARTED"
    import pytest
    with pytest.raises(ValueError, match="Only accepted"):
        store.patch_action(patch.id, "undo")


def test_auto_tier_requires_two_independent_agreeing_sources_and_logs_acceptance():
    store = DemoStore()
    schedule = store.add_schedule(csv_schedule())
    first = store.process(schedule.id, '24"-P-112 erection started; 6 spools erected today.', area="Unit-2")
    revised = store.append_source(first.report_id, Source(
        kind="MESSAGE", text='24"-P-112 erection started; 6 spools erected today.', received_at=date(2026, 9, 30),
    ), area="Unit-2")
    patch = revised.patches[0]
    assert patch.approval_tier == "AUTO"
    assert store.patch_action(patch.id, "accept").status == "ACCEPTED"
