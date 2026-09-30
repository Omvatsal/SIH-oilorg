from pathlib import Path

from fastapi.testclient import TestClient

from construction_reconciliation.main import app, store


DATA = Path(__file__).parents[2] / "src" / "construction_reconciliation" / "demo_data"
client = TestClient(app)


def test_p201_api_import_compile_accept_undo_and_metrics():
    with (DATA / "project_schedule.csv").open("rb") as handle:
        imported = client.post("/schedule/import", files={"file": ("project_schedule.csv", handle, "text/csv")})
    assert imported.status_code == 200
    assert imported.json()["activity_count"] == 40
    schedule_id = imported.json()["schedule_id"]

    report = client.post("/ingest/message", json={
        "schedule_id": schedule_id,
        "text": (DATA / "p201_chat.txt").read_text(encoding="utf-8"),
        "area": "Unit-2",
        "received_at": "2026-09-30",
    })
    assert report.status_code == 200
    report_id = report.json()["report_id"]
    patch = report.json()["patches"][0]
    assert {item["activity_id"] for item in patch["updates"]} == {"L6-421", "L6-422", "L6-424"}
    assert client.get(f"/workspace/{report_id}").status_code == 200
    assert client.post(f"/patches/{patch['id']}/accept").json()["status"] == "ACCEPTED"
    assert next(a for a in store.schedules[schedule_id].activities if a.id == "L6-421").status == "COMPLETE"
    assert client.post(f"/patches/{patch['id']}/undo").json()["status"] == "UNDONE"
    assert client.get(f"/audit/{patch['id']}").json()["entries"][-1]["action"] == "UNDO"
    assert client.get("/metrics").json()["reports_processed"] >= 1


def test_excel_upload_and_bad_schedule_format():
    with (DATA / "project_schedule.csv").open("rb") as handle:
        imported = client.post("/schedule/import", files={"file": ("project_schedule.csv", handle, "text/csv")})
    schedule_id = imported.json()["schedule_id"]
    with (DATA / "contractor_dpr.xlsx").open("rb") as handle:
        result = client.post(f"/ingest/file?schedule_id={schedule_id}&area=Unit-2&received_at=2026-09-30", files={"file": ("contractor_dpr.xlsx", handle, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")})
    assert result.status_code == 200
    assert {update["activity_id"] for update in result.json()["patches"][0]["updates"]} == {"L6-421", "L6-422", "L6-424"}
    invalid = client.post("/schedule/import", files={"file": ("schedule.txt", b"anything", "text/plain")})
    assert invalid.status_code == 422
