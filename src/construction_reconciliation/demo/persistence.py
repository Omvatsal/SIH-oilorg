"""Small Supabase/Postgres persistence adapter for the demo pipeline.

The reconciliation rules remain in :mod:`pipeline`; this module only translates
the demo models into the existing project tables. It is intentionally optional:
the demo still runs locally when ``DATABASE_URL`` is empty or unavailable.
"""

from __future__ import annotations

from collections import defaultdict
from uuid import NAMESPACE_URL, uuid5

from sqlalchemy import text

from construction_reconciliation.config import get_settings
from construction_reconciliation.database.session import get_session
from construction_reconciliation.demo.models import Schedule, Workspace
from construction_reconciliation.embeddings.hashing import hash_embedding_text
from construction_reconciliation.embeddings.model import MODEL_NAME as EMBEDDING_MODEL, EMBEDDING_VERSION
from construction_reconciliation.embeddings.normalization import normalize_semantic_text
from construction_reconciliation.embeddings.service import generate_embeddings

PROJECT_CODE = "SETU-DEMO"
PROJECT_UUID = uuid5(NAMESPACE_URL, "setu:project:demo")


def enabled() -> bool:
    return bool(get_settings().database_url.strip())


def _uuid(kind: str, value: str) -> str:
    return str(uuid5(PROJECT_UUID, f"{kind}:{value}"))


def persist_schedule(schedule: Schedule, filename: str | None = None) -> None:
    """Upsert one imported schedule and its activities."""
    if not enabled():
        return
    version_id = _uuid("schedule", schedule.id)
    document_id = _uuid("schedule-document", schedule.id)
    version_number = 1000 + int(schedule.id.replace("schedule-", "")[:6], 16) % 800000
    source_name = filename or f"{schedule.id}.{schedule.source_format}"
    session = get_session()
    try:
        session.execute(text("""
            INSERT INTO projects (id, project_code, name, status)
            VALUES (:id, :code, :name, 'ACTIVE')
            ON CONFLICT (project_code) DO UPDATE SET updated_at = now()
        """), {"id": str(PROJECT_UUID), "code": PROJECT_CODE, "name": "SETU workspace"})
        session.execute(text("""
            INSERT INTO schedule_versions (id, project_id, version_name, version_number, is_baseline, is_current, imported_at)
            VALUES (:id, :project_id, :name, :version_number, false, false, now())
            ON CONFLICT (id) DO UPDATE SET version_name = EXCLUDED.version_name, updated_at = now()
        """), {"id": version_id, "project_id": str(PROJECT_UUID), "name": source_name, "version_number": version_number})
        session.execute(text("""
            INSERT INTO source_documents
              (id, project_id, schedule_version_id, file_name, storage_path, file_type,
               mime_type, document_type, processing_status, extracted_text, extraction_metadata, processed_at)
            VALUES (:id, :project_id, :version_id, :name, :path, :file_type,
                    :mime, 'SCHEDULE', 'COMPLETED', :text, CAST(:metadata AS jsonb), now())
            ON CONFLICT (storage_bucket, storage_path) DO UPDATE SET
              file_name = EXCLUDED.file_name, extracted_text = EXCLUDED.extracted_text,
              extraction_metadata = EXCLUDED.extraction_metadata, updated_at = now()
        """), {"id": document_id, "project_id": str(PROJECT_UUID), "version_id": version_id,
                 "name": source_name, "path": f"{PROJECT_CODE}/schedules/{schedule.id}.{schedule.source_format}",
                 "file_type": schedule.source_format, "mime": "text/csv" if schedule.source_format == "csv" else "application/octet-stream",
                 "text": "Imported schedule", "metadata": _json({"demo_schedule_id": schedule.id, "source_format": schedule.source_format})})
        for row_number, activity in enumerate(schedule.activities, start=1):
            session.execute(text("""
                INSERT INTO planned_activities
                  (schedule_version_id, activity_id, discipline, activity_type, description, location,
                   equipment_tag, planned_start, planned_finish, source_row_number, source_data)
                VALUES (:version_id, :activity_id, :discipline, :activity_type, :description, :location,
                        :equipment_tag, :planned_start, :planned_finish, :row_number, CAST(:source_data AS jsonb))
                ON CONFLICT (schedule_version_id, activity_id) DO UPDATE SET
                  discipline = EXCLUDED.discipline, activity_type = EXCLUDED.activity_type,
                  description = EXCLUDED.description, location = EXCLUDED.location,
                  equipment_tag = EXCLUDED.equipment_tag, planned_start = EXCLUDED.planned_start,
                  planned_finish = EXCLUDED.planned_finish, source_data = EXCLUDED.source_data, updated_at = now()
            """), {"version_id": version_id, "activity_id": activity.id, "discipline": activity.discipline,
                     "activity_type": activity.action, "description": activity.name, "location": activity.area,
                     "equipment_tag": activity.object_tag, "planned_start": activity.planned_start,
                     "planned_finish": activity.planned_finish, "row_number": row_number,
                     "source_data": _json({"demo_schedule_id": schedule.id, "wbs": activity.wbs,
                                           "predecessors": activity.predecessors, "status": activity.status,
                                           "quantity_total": activity.quantity_total, "quantity_unit": activity.quantity_unit})})
        texts = [normalize_semantic_text(a.discipline, a.action, a.name, a.area, a.object_tag) for a in schedule.activities]
        for activity, semantic_text, vector in zip(schedule.activities, texts, generate_embeddings(texts)):
            session.execute(text("""UPDATE planned_activities SET embedding=CAST(:vector AS vector), embedding_text=:text,
                embedding_source_hash=:hash, embedding_model=:model, embedding_version=:version,
                embedding_status='COMPLETED', embedding_generated_at=now() WHERE schedule_version_id=:version_id AND activity_id=:activity_id"""),
                {"vector": str(vector), "text": semantic_text, "hash": hash_embedding_text(semantic_text),
                 "model": EMBEDDING_MODEL, "version": EMBEDDING_VERSION, "version_id": version_id, "activity_id": activity.id})
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def persist_workspace(workspace: Workspace, *, area: str | None = None) -> None:
    """Persist report sources and extracted events; derived review state stays in the pipeline."""
    if not enabled():
        return
    session = get_session()
    try:
        for source in workspace.sources:
            document_id = _uuid("source", source.id)
            filename = source.filename or f"{source.kind.lower()}-{source.id}.txt"
            session.execute(text("""
                INSERT INTO source_documents
                  (id, project_id, file_name, storage_path, file_type, document_type,
                   document_date, processing_status, extracted_text, extraction_metadata, processed_at)
                VALUES (:id, :project_id, :name, :path, :file_type, 'DAILY_REPORT',
                        :document_date, 'COMPLETED', :body, CAST(:metadata AS jsonb), now())
                ON CONFLICT (storage_bucket, storage_path) DO UPDATE SET
                  extracted_text = EXCLUDED.extracted_text, extraction_metadata = EXCLUDED.extraction_metadata,
                  processing_status = 'COMPLETED', processed_at = now(), updated_at = now()
            """), {"id": document_id, "project_id": str(PROJECT_UUID), "name": filename,
                     "path": f"{PROJECT_CODE}/reports/{workspace.report_id}/{source.id}/{filename}",
                     "file_type": source.kind.lower(), "document_date": source.received_at, "body": source.text,
                     "metadata": _json({"report_id": workspace.report_id, "schedule_id": workspace.patches[0].schedule_id if workspace.patches else None,
                                         "area": area, "source_id": source.id})})
        for event in workspace.events:
            session.execute(text("""
                INSERT INTO actual_events
                  (id, project_id, source_document_id, raw_text, normalized_activity_text, event_type,
                   event_date, location, equipment_tag, percentage_complete, processing_status, extraction_metadata)
                VALUES (:id, :project_id, :source_id, :raw_text, :normalized, :event_type,
                        :event_date, :location, :equipment_tag, :percentage, 'COMPLETED', CAST(:metadata AS jsonb))
                ON CONFLICT (id) DO UPDATE SET processing_status = EXCLUDED.processing_status,
                  extraction_metadata = EXCLUDED.extraction_metadata, updated_at = now()
            """), {"id": _uuid("event", event.id), "project_id": str(PROJECT_UUID),
                     "source_id": _uuid("source", event.source_id), "raw_text": event.raw_text,
                     "normalized": f"{event.action} {event.object_tag or ''}".strip(), "event_type": event.state,
                     "event_date": event.event_date, "location": event.area, "equipment_tag": event.object_tag,
                     "percentage": None, "metadata": _json({"demo_event_id": event.id, "report_id": workspace.report_id})})
        texts = [normalize_semantic_text(e.action, e.object_tag, e.area) for e in workspace.events]
        for event, semantic_text, vector in zip(workspace.events, texts, generate_embeddings(texts)):
            session.execute(text("""UPDATE actual_events SET embedding=CAST(:vector AS vector), embedding_text=:text,
                embedding_source_hash=:hash, embedding_model=:model, embedding_version=:version,
                embedding_status='COMPLETED', embedding_generated_at=now() WHERE id=:id"""),
                {"vector": str(vector), "text": semantic_text, "hash": hash_embedding_text(semantic_text),
                 "model": EMBEDDING_MODEL, "version": EMBEDDING_VERSION, "id": _uuid("event", event.id)})
        if workspace.patches:
            version_id = _uuid("schedule", workspace.patches[0].schedule_id)
            for patch in workspace.patches:
                for update in patch.updates:
                    if patch.status == "ACCEPTED":
                        session.execute(text("""
                            UPDATE planned_activities
                            SET source_data = jsonb_set(source_data, '{status}', to_jsonb(CAST(:status AS text)), true), updated_at = now()
                            WHERE schedule_version_id = :version_id AND activity_id = :activity_id
                        """), {"status": update.after, "version_id": version_id, "activity_id": update.activity_id})
                session.execute(text("""
                    INSERT INTO audit_logs (id, project_id, entity_type, entity_id, action, actor_type, new_value, metadata)
                    VALUES (:id, :project_id, 'demo_patch', :entity_id, :action, 'SYSTEM', CAST(:new_value AS jsonb), CAST(:metadata AS jsonb))
                    ON CONFLICT (id) DO NOTHING
                """), {"id": _uuid("audit", patch.id), "project_id": str(PROJECT_UUID),
                         "entity_id": _uuid("patch", patch.id), "action": f"PATCH_{patch.status}",
                         "new_value": _json(patch.model_dump(mode="json")), "metadata": _json({"report_id": workspace.report_id})})
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def _json(value: object) -> str:
    import json
    return json.dumps(value, default=str)


def load_schedules() -> list[Schedule]:
    """Load imported demo schedules stored by this adapter."""
    if not enabled():
        return []
    from construction_reconciliation.demo.models import Activity
    session = get_session()
    try:
        rows = session.execute(text("""
            SELECT a.schedule_version_id, a.source_data, d.extraction_metadata, a.activity_id, a.description, a.discipline,
                   a.activity_type, a.location, a.equipment_tag, a.planned_start, a.planned_finish
            FROM planned_activities a
            JOIN schedule_versions v ON v.id = a.schedule_version_id
            JOIN source_documents d ON d.schedule_version_id = v.id
            WHERE d.document_type = 'SCHEDULE'
            ORDER BY v.imported_at, a.source_row_number
        """)).mappings().all()
    finally:
        session.close()
    grouped: dict[str, list] = defaultdict(list)
    formats: dict[str, str] = {}
    for row in rows:
        meta = row["extraction_metadata"]
        # Imported demo files carry their original id. Seeded rows do not, so
        # expose them with a stable id derived from the schedule version.
        sid = str(meta.get("demo_schedule_id") or f"schedule-db-{row['schedule_version_id']}")
        formats[sid] = meta.get("source_format") or "csv"
        raw = row
        source_data = raw["source_data"] or {}
        grouped[sid].append(Activity(id=raw["activity_id"], name=raw["description"], discipline=raw["discipline"] or "GENERAL",
                                     action=raw["activity_type"] or "", area=raw["location"] or "", object_tag=raw["equipment_tag"],
                                     planned_start=str(raw["planned_start"]) if raw["planned_start"] else None,
                                     planned_finish=str(raw["planned_finish"]) if raw["planned_finish"] else None,
                                     predecessors=source_data.get("predecessors", []), status=source_data.get("status", "NOT_STARTED"),
                                     quantity_total=source_data.get("quantity_total"), quantity_unit=source_data.get("quantity_unit")))
    return [Schedule(id=sid, activities=activities, source_format=formats[sid]) for sid, activities in grouped.items()]


def load_sources() -> dict[str, list[dict[str, object]]]:
    """Return saved report sources grouped by their report id."""
    if not enabled():
        return {}
    session = get_session()
    try:
        rows = session.execute(text("""
            SELECT extracted_text, file_name, file_type, document_date, extraction_metadata
            FROM source_documents
            WHERE document_type = 'DAILY_REPORT' AND extraction_metadata ? 'report_id'
            ORDER BY uploaded_at, created_at
        """)).mappings().all()
    finally:
        session.close()
    result: dict[str, list[dict[str, object]]] = defaultdict(list)
    for row in rows:
        meta = row["extraction_metadata"] or {}
        result[str(meta["report_id"])].append({"text": row["extracted_text"] or "", "filename": row["file_name"],
                                                "kind": (row["file_type"] or "TEXT").upper(), "received_at": row["document_date"],
                                                "area": meta.get("area"), "schedule_id": meta.get("schedule_id")})
    return dict(result)
