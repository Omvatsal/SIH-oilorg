"""FastAPI entry point for the offline SETU demonstration."""

import argparse
import os
import sys
from datetime import date

from fastapi import FastAPI, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from construction_reconciliation.demo.importer import import_csv, import_xer, schedule_summary
from construction_reconciliation.demo.dependency_graph import analyze_dependency_graph
from construction_reconciliation.demo.pipeline import DemoStore
from construction_reconciliation.demo import persistence

PRODUCT_NAME = os.getenv("PRODUCT_NAME", "SETU")
app = FastAPI(title=f"{PRODUCT_NAME} Phase 2 API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)
store = DemoStore()


@app.on_event("startup")
def load_persisted_demo_data() -> None:
    """Restore schedules saved by the demo adapter without blocking health checks."""
    if not persistence.enabled():
        return
    try:
        for schedule in persistence.load_schedules():
            store.add_schedule(schedule)
        for saved_sources in persistence.load_sources().values():
            if not saved_sources:
                continue
            first = saved_sources[0]
            schedule_id = str(first.get("schedule_id") or "")
            if schedule_id not in store.schedules:
                continue
            workspace = store.process(schedule_id, str(first["text"]), area=first.get("area"),
                                      received_at=first.get("received_at"), source_kind=str(first["kind"]).upper(),
                                      filename=str(first.get("filename") or ""))
            for saved in saved_sources[1:]:
                if saved.get("schedule_id") == schedule_id:
                    workspace = store.process(schedule_id, str(saved["text"]), area=saved.get("area"),
                                              received_at=saved.get("received_at"), source_kind=str(saved["kind"]).upper(),
                                              filename=str(saved.get("filename") or ""), report_id=workspace.report_id)
    except Exception:
        # A missing migration must not prevent the API process from starting.
        # The first write will return a clear persistence error instead.
        return


def persist_or_raise(action) -> None:
    if not persistence.enabled():
        return
    try:
        action()
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Supabase persistence is unavailable. Apply the database migrations and check DATABASE_URL.") from exc


class MessageRequest(BaseModel):
    schedule_id: str
    text: str
    area: str | None = None
    received_at: date | None = None
    report_id: str | None = None


class AskBackAnswerRequest(BaseModel):
    answer: str


@app.get("/api/config")
def app_config() -> dict[str, str]:
    return {"product_name": PRODUCT_NAME}


@app.get("/health")
def health() -> dict[str, str]:
    """Return process health without depending on external services."""
    return {"status": "ok"}


@app.post("/schedule/import")
async def import_schedule(file: UploadFile):
    suffix = (file.filename or "").lower().rsplit(".", 1)[-1]
    if suffix not in {"csv", "xer"}:
        raise HTTPException(status_code=422, detail="Only CSV and XER schedules are supported")
    try:
        content = (await file.read()).decode("utf-8")
        schedule = import_xer(content) if suffix == "xer" else import_csv(content)
    except (KeyError, UnicodeDecodeError, ValueError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    store.add_schedule(schedule)
    persist_or_raise(lambda: persistence.persist_schedule(schedule, filename=file.filename))
    return {
        **schedule_summary(schedule),
        "dependency_graph": analyze_dependency_graph(schedule),
        "activities": [activity.model_dump() for activity in schedule.activities],
    }


@app.get("/schedule/{schedule_id}/dependencies")
def get_schedule_dependencies(schedule_id: str):
    """Return the complete graph and consistency findings for one schedule."""
    schedule = store.schedules.get(schedule_id)
    if schedule is None:
        raise HTTPException(status_code=404, detail="Schedule not found")
    return analyze_dependency_graph(schedule)


@app.post("/ingest/message")
def ingest_message(payload: MessageRequest):
    if payload.schedule_id not in store.schedules:
        raise HTTPException(status_code=404, detail="Schedule not found")
    if payload.report_id:
        workspace = store.workspaces.get(payload.report_id)
        if workspace is None:
            raise HTTPException(status_code=404, detail="Report not found")
        if not workspace.patches or workspace.patches[0].schedule_id != payload.schedule_id:
            raise HTTPException(status_code=409, detail="Report belongs to a different schedule")
    try:
        workspace = store.process(payload.schedule_id, payload.text, area=payload.area, received_at=payload.received_at, report_id=payload.report_id, source_kind="MESSAGE")
        persist_or_raise(lambda: persistence.persist_workspace(workspace, area=payload.area))
        return workspace
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@app.post("/ingest/file")
async def ingest_file(schedule_id: str, file: UploadFile, area: str | None = None, received_at: date | None = None, report_id: str | None = None):
    if schedule_id not in store.schedules:
        raise HTTPException(status_code=404, detail="Schedule not found")
    suffix = (file.filename or "").lower().rsplit(".", 1)[-1]
    raw = await file.read()
    if suffix in {"txt", "csv"}:
        text = raw.decode("utf-8")
    elif suffix == "xlsx":
        try:
            from openpyxl import load_workbook
            from io import BytesIO

            workbook = load_workbook(BytesIO(raw), read_only=True, data_only=True)
            try:
                text = "\n".join(" | ".join(str(cell) for cell in row if cell is not None) for row in workbook.active.iter_rows(values_only=True))
            finally:
                workbook.close()
        except Exception as exc:
            raise HTTPException(status_code=422, detail="Could not read Excel report") from exc
    else:
        raise HTTPException(status_code=422, detail="Only txt, csv, and xlsx reports are supported")
    if report_id:
        workspace = store.workspaces.get(report_id)
        if workspace is None:
            raise HTTPException(status_code=404, detail="Report not found")
        if not workspace.patches or workspace.patches[0].schedule_id != schedule_id:
            raise HTTPException(status_code=409, detail="Report belongs to a different schedule")
    source_kind = "XLSX" if suffix == "xlsx" else "CSV" if suffix == "csv" else "TEXT"
    try:
        workspace = store.process(schedule_id, text, area=area, received_at=received_at, source_kind=source_kind, filename=file.filename, report_id=report_id)
        persist_or_raise(lambda: persistence.persist_workspace(workspace, area=area))
        return workspace
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@app.get("/workspace/{report_id}")
def get_workspace(report_id: str):
    try:
        return store.workspaces[report_id]
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Report not found") from exc


@app.post("/workspace/{report_id}/questions/{question_id}/answer")
def answer_ask_back(report_id: str, question_id: str, payload: AskBackAnswerRequest):
    try:
        return store.answer_question(report_id, question_id, payload.answer.upper())
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Workspace or question not found") from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


def _patch_action(patch_id: str, action: str):
    try:
        return store.patch_action(patch_id, action)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Patch not found") from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@app.post("/patches/{patch_id}/accept")
def accept_patch(patch_id: str):
    return _patch_action(patch_id, "accept")


@app.post("/patches/{patch_id}/reject")
def reject_patch(patch_id: str):
    return _patch_action(patch_id, "reject")


@app.post("/patches/{patch_id}/undo")
def undo_patch(patch_id: str):
    return _patch_action(patch_id, "undo")


@app.get("/audit/{patch_id}")
def get_audit(patch_id: str):
    if patch_id not in store.audit:
        raise HTTPException(status_code=404, detail="Patch not found")
    return {"patch_id": patch_id, "entries": store.audit[patch_id]}


@app.get("/metrics")
def get_metrics() -> dict[str, int]:
    workspaces = list(store.workspaces.values())
    patches = [patch for workspace in workspaces for patch in workspace.patches]
    return {
        "schedules_imported": len(store.schedules),
        "reports_processed": len(workspaces),
        "events_extracted": sum(len(workspace.events) for workspace in workspaces),
        "updates_proposed": sum(len(patch.updates) for patch in patches),
        "patches_accepted": sum(patch.status == "ACCEPTED" for patch in patches),
    }


def run_dev_server(*, seed: bool = False) -> int:
    """Start the local server, optionally applying sample data first."""
    if seed:
        # Import only for explicit seed runs; app import and normal startup stay DB-free.
        from construction_reconciliation.database.seed import seed_database

        try:
            seed_database()
        except Exception as exc:
            # Driver error text can contain connection details; keep output generic.
            print(f"Database seeding failed ({type(exc).__name__}).", file=sys.stderr)
            return 1

    import uvicorn

    uvicorn.run(
        "construction_reconciliation.main:app",
        host="127.0.0.1",
        port=8000,
        reload=True,
    )
    return 0


def _main() -> int:
    parser = argparse.ArgumentParser(description="Run the local reconciliation API.")
    parser.add_argument(
        "--seed",
        action="store_true",
        help="apply the repeatable sample data before starting the API",
    )
    args = parser.parse_args()
    return run_dev_server(seed=args.seed)


if __name__ == "__main__":
    raise SystemExit(_main())
