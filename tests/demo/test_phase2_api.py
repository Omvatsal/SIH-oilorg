from pathlib import Path

from fastapi.testclient import TestClient

from construction_reconciliation.main import app


DATA = Path(__file__).parents[2] / "src" / "construction_reconciliation" / "demo_data"
client = TestClient(app)


def import_schedule() -> str:
    with (DATA / "project_schedule.csv").open("rb") as handle:
        response = client.post("/schedule/import", files={"file": ("project_schedule.csv", handle, "text/csv")})
    assert response.status_code == 200
    assert "activities" in response.json()
    assert response.json()["activities"]
    return response.json()["schedule_id"]


def test_excel_and_chat_conflict_create_partial_revision_with_audit():
    schedule_id = import_schedule()
    with (DATA / "conflict_dpr.xlsx").open("rb") as handle:
        initial = client.post(
            f"/ingest/file?schedule_id={schedule_id}&area=Unit-2&received_at=2026-09-30",
            files={"file": ("conflict_dpr.xlsx", handle, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        )
    assert initial.status_code == 200
    first = initial.json()
    old_patch = first["patches"][0]
    assert len(first["sources"]) == 1
    assert first["sources"][0]["kind"] == "XLSX"
    assert next(update for update in old_patch["updates"] if update["activity_id"] == "L6-424")["after"] == "COMPLETE"

    revised_response = client.post("/ingest/message", json={
        "schedule_id": schedule_id,
        "report_id": first["report_id"],
        "text": (DATA / "p201_discharge_blocked_chat.txt").read_text(encoding="utf-8"),
        "area": "Unit-2",
        "received_at": "2026-09-30",
    })
    assert revised_response.status_code == 200
    workspace = revised_response.json()
    assert workspace["report_id"] == first["report_id"]
    assert [source["kind"] for source in workspace["sources"]] == ["XLSX", "MESSAGE"]
    assert len(workspace["patches"]) == 2
    assert workspace["patches"][1]["status"] == "SUPERSEDED"
    new_patch = workspace["patches"][0]
    assert new_patch["revision"] == 2
    assert new_patch["approval_tier"] == "PLANNER"
    update = next(update for update in new_patch["updates"] if update["activity_id"] == "L6-424")
    assert update["after"] == "PARTIAL"
    assert len(update["evidence_event_ids"]) == 2
    assert {claim["state"] for claim in workspace["conflicts"][0]["claims"]} == {"COMPLETE", "BLOCKED"}
    assert len({event["source_id"] for event in workspace["events"]}) == 2
    assert client.get(f"/workspace/{first['report_id']}").json()["patches"][0]["revision"] == 2
    old_audit = client.get(f"/audit/{old_patch['id']}").json()["entries"]
    assert [entry["action"] for entry in old_audit] == ["PATCH_CREATED", "SOURCE_ADDED", "PATCH_REVISED"]
    assert client.get(f"/audit/{new_patch['id']}").json()["entries"][0]["revision"] == "2"

    assert client.post(f"/patches/{old_patch['id']}/accept").status_code == 409
    assert client.post(f"/patches/{new_patch['id']}/reject").status_code == 200
    assert client.post("/ingest/message", json={
        "schedule_id": schedule_id,
        "report_id": first["report_id"],
        "text": "P-201 fitted today.",
    }).status_code == 409


def test_append_to_accepted_or_undone_workspace_is_rejected():
    schedule_id = import_schedule()
    response = client.post("/ingest/message", json={
        "schedule_id": schedule_id,
        "text": "P-201 fitted today.",
        "received_at": "2026-09-30",
    })
    assert response.status_code == 200
    workspace = response.json()
    patch_id = workspace["patches"][0]["id"]
    assert client.post(f"/patches/{patch_id}/accept").status_code == 200
    append = {"schedule_id": schedule_id, "report_id": workspace["report_id"], "text": "P-201 aligned today."}
    assert client.post("/ingest/message", json=append).status_code == 409
    assert client.post(f"/patches/{patch_id}/undo").status_code == 200
    assert client.post("/ingest/message", json=append).status_code == 409


def test_single_source_request_still_creates_new_workspace():
    schedule_id = import_schedule()
    response = client.post("/ingest/message", json={"schedule_id": schedule_id, "text": "P-201 fitted today.", "received_at": "2026-09-30"})
    assert response.status_code == 200
    workspace = response.json()
    assert len(workspace["sources"]) == 1
    assert workspace["patches"][0]["revision"] == 1
    assert workspace["patches"][0]["updates"][0]["after"] == "COMPLETE"


def test_silent_progress_finding_and_ask_back_answer_update_distribution():
    schedule_id = import_schedule()
    response = client.post("/ingest/message", json={
        "schedule_id": schedule_id,
        "text": 'Hydrotest 24"-P-112 completed today at 10:00.',
        "area": "Unit-2",
        "received_at": "2026-09-30",
    })
    assert response.status_code == 200
    workspace = response.json()
    finding = workspace["silent_progress"][0]
    assert finding["predecessor_activity_id"] == "L6-503"
    question = workspace["ask_back_questions"][0]
    assert question["candidate_distribution_before"] == [
        {"candidate": "PREDECESSOR_COMPLETE", "probability": 0.5},
        {"candidate": "PREDECESSOR_INCOMPLETE", "probability": 0.5},
    ]
    answer = client.post(
        f"/workspace/{workspace['report_id']}/questions/{question['id']}/answer",
        json={"answer": "yes"},
    )
    assert answer.status_code == 200
    after = answer.json()
    assert after["selected_answer"] == "YES"
    assert [item["probability"] for item in after["candidate_distribution_after"]] == [1.0, 0.0]


def test_quantity_progress_accumulates_distinct_reports_without_append_double_count():
    schedule_id = import_schedule()
    first = client.post("/ingest/message", json={
        "schedule_id": schedule_id,
        "text": '24"-P-112 erection started; 6 spools erected today.',
        "area": "Unit-2",
        "received_at": "2026-09-30",
    }).json()
    progress = first["quantity_progress"][0]
    assert progress["activity_id"] == "L6-501"
    assert progress["observed_quantity"] == 6
    assert progress["planned_quantity"] == 40
    appended = client.post("/ingest/message", json={
        "schedule_id": schedule_id,
        "report_id": first["report_id"],
        "text": '24"-P-112 erection started; 6 spools erected today.',
        "area": "Unit-2",
        "received_at": "2026-09-30",
    }).json()
    assert appended["quantity_progress"][0]["observed_quantity"] == 12


def test_quantity_progress_accumulates_across_workspaces():
    schedule_id = import_schedule()
    for quantity in (6, 6):
        response = client.post("/ingest/message", json={
            "schedule_id": schedule_id,
            "text": f'24"-P-112 erection started; {quantity} spools erected today.',
            "area": "Unit-2",
            "received_at": "2026-09-30",
        })
        assert response.status_code == 200
    assert response.json()["quantity_progress"][0]["observed_quantity"] == 12
