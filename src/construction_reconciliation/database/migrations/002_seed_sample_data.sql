-- Synthetic, repeatable sample data for local/prototype development.
-- Apply after 001_initial_schema.sql using the Supabase SQL Editor.
-- Planned activity inserts intentionally use NOT EXISTS: the migration trigger
-- queues embedding jobs only for activities that are actually new.

INSERT INTO projects (
    id, project_code, name, description, client_name, location, status
) VALUES (
    '10000000-0000-4000-8000-000000000001',
    'DEMO-REFINERY-001',
    'Demo Refinery Expansion',
    'Synthetic project for validating schedule reconciliation workflows.',
    'Example Energy Ltd.',
    'Vadodara, Gujarat',
    'ACTIVE'
)
ON CONFLICT (project_code) DO NOTHING;

INSERT INTO schedule_versions (
    id, project_id, version_name, version_number, is_baseline, is_current, imported_at
)
SELECT
    '20000000-0000-4000-8000-000000000001', p.id,
    'Baseline Schedule', 1, true, true, now()
FROM projects p
WHERE p.project_code = 'DEMO-REFINERY-001'
ON CONFLICT (project_id, version_number) DO NOTHING;

INSERT INTO source_documents (
    id, project_id, schedule_version_id, file_name, storage_bucket,
    storage_path, file_type, mime_type, document_type, processing_status,
    extracted_text, extraction_metadata, processed_at
)
SELECT
    '30000000-0000-4000-8000-000000000001', p.id, s.id,
    'demo_baseline_schedule.csv', 'project-documents',
    p.id::text || '/schedules/demo_baseline_schedule.csv', 'csv', 'text/csv',
    'SCHEDULE', 'COMPLETED',
    'Synthetic schedule rows for demo activities DEMO-PIP-001 through DEMO-INS-003.',
    '{"seed": true, "source": "synthetic"}'::jsonb, now()
FROM projects p
JOIN schedule_versions s ON s.project_id = p.id AND s.version_number = 1
WHERE p.project_code = 'DEMO-REFINERY-001'
ON CONFLICT (storage_bucket, storage_path) DO NOTHING;

INSERT INTO source_documents (
    id, project_id, file_name, storage_bucket, storage_path, file_type,
    mime_type, document_type, discipline, document_date, processing_status,
    extracted_text, extraction_metadata, processed_at
)
SELECT
    '30000000-0000-4000-8000-000000000002', p.id,
    'demo_daily_report.txt', 'project-documents',
    p.id::text || '/daily-reports/demo_daily_report.txt', 'txt', 'text/plain',
    'DAILY_REPORT', 'MULTI-DISCIPLINE', DATE '2026-01-26', 'COMPLETED',
    'Synthetic daily execution notes for piping, mechanical, civil, and electrical work.',
    '{"seed": true, "source": "synthetic"}'::jsonb, now()
FROM projects p
WHERE p.project_code = 'DEMO-REFINERY-001'
ON CONFLICT (storage_bucket, storage_path) DO NOTHING;

WITH seed_activities (
    activity_id, wbs_code, wbs_level, activity_code, discipline, activity_type,
    description, location, equipment_tag, planned_start, planned_finish, duration,
    embedding_text, source_row_number
) AS (
    VALUES
    ('DEMO-CIV-001', '1.1.1', 5, 'CIV-EXC-001', 'CIVIL', 'EARTHWORK', 'Excavate pump foundation area', 'Pump Station PS-01', NULL, DATE '2026-01-05', DATE '2026-01-08', 4::numeric, 'Civil | Earthwork | Pump foundation area | Pump Station PS-01', 2),
    ('DEMO-CIV-002', '1.1.2', 5, 'CIV-CON-001', 'CIVIL', 'CONCRETE', 'Pour concrete for pump foundation', 'Pump Station PS-01', NULL, DATE '2026-01-09', DATE '2026-01-12', 4::numeric, 'Civil | Concrete | Pump foundation | Pump Station PS-01', 3),
    ('DEMO-CIV-003', '1.1.3', 5, 'CIV-REB-001', 'CIVIL', 'REINFORCEMENT', 'Install foundation reinforcement', 'Pump Station PS-01', NULL, DATE '2026-01-08', DATE '2026-01-10', 3::numeric, 'Civil | Reinforcement | Pump foundation | Pump Station PS-01', 4),
    ('DEMO-STR-001', '1.2.1', 5, 'STR-ERE-001', 'STRUCTURAL', 'STEEL ERECTION', 'Erect pipe rack steel columns', 'Pipe Rack PR-04', NULL, DATE '2026-01-13', DATE '2026-01-18', 6::numeric, 'Structural | Steel erection | Pipe rack columns | Pipe Rack PR-04', 5),
    ('DEMO-STR-002', '1.2.2', 5, 'STR-BRC-001', 'STRUCTURAL', 'STEEL ERECTION', 'Install pipe rack cross bracing', 'Pipe Rack PR-04', NULL, DATE '2026-01-19', DATE '2026-01-22', 4::numeric, 'Structural | Steel erection | Cross bracing | Pipe Rack PR-04', 6),
    ('DEMO-PIP-001', '2.1.1', 6, 'PIP-ERE-101', 'PIPING', 'ERECTION', 'Erect process line 24 inch carbon steel', 'Unit 3, Pipe Rack PR-04', 'L-24-CS-101', DATE '2026-01-20', DATE '2026-01-26', 7::numeric, 'Piping | Erection | Process line 24 inch carbon steel | Unit 3 | Pipe Rack PR-04', 7),
    ('DEMO-PIP-002', '2.1.2', 6, 'PIP-WEL-102', 'PIPING', 'WELDING', 'Weld process line 24 inch joints', 'Unit 3, Pipe Rack PR-04', 'L-24-CS-101', DATE '2026-01-22', DATE '2026-01-29', 8::numeric, 'Piping | Welding | Process line 24 inch joints | Unit 3 | Pipe Rack PR-04', 8),
    ('DEMO-PIP-003', '2.1.3', 6, 'PIP-NDE-103', 'PIPING', 'INSPECTION', 'Perform radiographic testing on line 24 welds', 'Unit 3, Pipe Rack PR-04', 'L-24-CS-101', DATE '2026-01-28', DATE '2026-01-31', 4::numeric, 'Piping | NDE inspection | Radiography of line 24 welds | Unit 3', 9),
    ('DEMO-PIP-004', '2.2.1', 6, 'PIP-ERE-201', 'PIPING', 'ERECTION', 'Install cooling water line 10 inch', 'Unit 3, Rack PR-05', 'L-10-CW-204', DATE '2026-01-21', DATE '2026-01-27', 7::numeric, 'Piping | Erection | Cooling water line 10 inch | Unit 3 | Rack PR-05', 10),
    ('DEMO-PIP-005', '2.2.2', 6, 'PIP-HYD-202', 'PIPING', 'TESTING', 'Hydrotest cooling water line 10 inch', 'Unit 3, Rack PR-05', 'L-10-CW-204', DATE '2026-01-28', DATE '2026-01-30', 3::numeric, 'Piping | Hydrotest | Cooling water line 10 inch | Unit 3 | Rack PR-05', 11),
    ('DEMO-MEC-001', '3.1.1', 5, 'MEC-SET-001', 'MECHANICAL', 'EQUIPMENT INSTALLATION', 'Set centrifugal pump P-301 on foundation', 'Pump Station PS-01', 'P-301', DATE '2026-01-20', DATE '2026-01-22', 3::numeric, 'Mechanical | Equipment installation | Centrifugal pump P-301 | Pump Station PS-01', 12),
    ('DEMO-MEC-002', '3.1.2', 5, 'MEC-ALI-002', 'MECHANICAL', 'ALIGNMENT', 'Align pump P-301 and motor coupling', 'Pump Station PS-01', 'P-301', DATE '2026-01-23', DATE '2026-01-24', 2::numeric, 'Mechanical | Alignment | Pump P-301 motor coupling | Pump Station PS-01', 13),
    ('DEMO-ELE-001', '4.1.1', 5, 'ELE-TRAY-001', 'ELECTRICAL', 'CABLE TRAY', 'Install cable tray to pump station', 'Pump Station PS-01', NULL, DATE '2026-01-15', DATE '2026-01-19', 5::numeric, 'Electrical | Cable tray installation | Pump Station PS-01', 14),
    ('DEMO-ELE-002', '4.1.2', 5, 'ELE-CAB-002', 'ELECTRICAL', 'CABLING', 'Pull motor power cable for pump P-301', 'Pump Station PS-01', 'P-301', DATE '2026-01-25', DATE '2026-01-27', 3::numeric, 'Electrical | Cable pulling | Motor power cable for pump P-301 | Pump Station PS-01', 15),
    ('DEMO-INS-001', '5.1.1', 5, 'INS-INST-001', 'INSTRUMENTATION', 'INSTRUMENT INSTALLATION', 'Install pressure transmitter PT-301', 'Pump Station PS-01', 'PT-301', DATE '2026-01-24', DATE '2026-01-26', 3::numeric, 'Instrumentation | Instrument installation | Pressure transmitter PT-301 | Pump Station PS-01', 16),
    ('DEMO-INS-002', '5.1.2', 5, 'INS-CAL-002', 'INSTRUMENTATION', 'CALIBRATION', 'Calibrate pressure transmitter PT-301', 'Pump Station PS-01', 'PT-301', DATE '2026-01-27', DATE '2026-01-28', 2::numeric, 'Instrumentation | Calibration | Pressure transmitter PT-301 | Pump Station PS-01', 17),
    ('DEMO-INS-003', '5.2.1', 5, 'INS-LOOP-003', 'INSTRUMENTATION', 'LOOP CHECK', 'Complete pump P-301 control loop check', 'Pump Station PS-01', 'P-301', DATE '2026-01-29', DATE '2026-01-30', 2::numeric, 'Instrumentation | Loop check | Pump P-301 control loop | Pump Station PS-01', 18)
)
INSERT INTO planned_activities (
    id, schedule_version_id, activity_id, wbs_code, wbs_level, activity_code,
    discipline, activity_type, description, location, equipment_tag,
    planned_start, planned_finish, planned_duration, calendar_name,
    embedding_text, embedding_source_hash, embedding_status, source_row_number, source_data
)
SELECT
    (('40000000-0000-4000-8000-' || lpad(row_number() OVER (ORDER BY a.activity_id)::text, 12, '0'))::uuid),
    s.id, a.activity_id, a.wbs_code, a.wbs_level, a.activity_code,
    a.discipline, a.activity_type, a.description, a.location, a.equipment_tag,
    a.planned_start, a.planned_finish, a.duration, '6 Day Construction Calendar',
    a.embedding_text,
    encode(extensions.digest(convert_to(a.embedding_text, 'UTF8'), 'sha256'), 'hex'),
    'PENDING', a.source_row_number,
    jsonb_build_object('seed', true, 'source_file', 'demo_baseline_schedule.csv')
FROM seed_activities a
CROSS JOIN schedule_versions s
JOIN projects p ON p.id = s.project_id
WHERE p.project_code = 'DEMO-REFINERY-001'
  AND s.version_number = 1
  AND NOT EXISTS (
      SELECT 1 FROM planned_activities existing
      WHERE existing.schedule_version_id = s.id
        AND existing.activity_id = a.activity_id
  );

WITH demo_events (
    id, event_type, discipline, raw_text, normalized_activity_text,
    event_timestamp, event_date, location, equipment_tag, percentage_complete,
    extraction_confidence, event_embedding_text, processing_status
) AS (
    VALUES
    ('50000000-0000-4000-8000-000000000001'::uuid, 'START', 'PIPING', 'Crew started erecting the 24 inch process line on rack PR-04.', 'Erect process line 24 inch carbon steel Unit 3 Pipe Rack PR-04', TIMESTAMPTZ '2026-01-21 07:30:00+05:30', DATE '2026-01-21', 'Unit 3, Pipe Rack PR-04', 'L-24-CS-101', NULL::numeric, 0.96::numeric, 'Piping | Erection | Process line 24 inch carbon steel | Unit 3 | Pipe Rack PR-04', 'COMPLETED'),
    ('50000000-0000-4000-8000-000000000002'::uuid, 'PROGRESS', 'PIPING', 'Line 24 welding is about 60 percent complete; 18 joints welded today.', 'Weld process line 24 inch joints Unit 3', TIMESTAMPTZ '2026-01-25 17:00:00+05:30', DATE '2026-01-25', 'Unit 3, Pipe Rack PR-04', 'L-24-CS-101', 60, 0.93, 'Piping | Welding | Process line 24 inch joints | Unit 3 | Pipe Rack PR-04', 'COMPLETED'),
    ('50000000-0000-4000-8000-000000000003'::uuid, 'FINISH', 'MECHANICAL', 'Pump P-301 installed and grouted; ready for alignment.', 'Set centrifugal pump P-301 on foundation', TIMESTAMPTZ '2026-01-23 15:45:00+05:30', DATE '2026-01-23', 'Pump Station PS-01', 'P-301', 100, 0.97, 'Mechanical | Equipment installation | Centrifugal pump P-301 | Pump Station PS-01', 'COMPLETED'),
    ('50000000-0000-4000-8000-000000000004'::uuid, 'PROGRESS', 'CIVIL', 'Concrete curing is complete at the north utility slab; small edge repairs remain.', 'Complete concrete work north utility slab', TIMESTAMPTZ '2026-01-18 12:00:00+05:30', DATE '2026-01-18', 'North Utility Area', NULL, 90, 0.68, 'Civil | Concrete | North utility slab edge repair', 'NEEDS_REVIEW'),
    ('50000000-0000-4000-8000-000000000005'::uuid, 'PROGRESS', 'ELECTRICAL', 'Cable pulling for motor M-900 is waiting on access clearance.', 'Pull motor cable M-900', TIMESTAMPTZ '2026-01-26 10:00:00+05:30', DATE '2026-01-26', 'Unknown area', 'M-900', 0, 0.54, 'Electrical | Cable pulling | Motor M-900', 'NEEDS_REVIEW')
)
INSERT INTO actual_events (
    id, project_id, source_document_id, discipline, raw_text,
    normalized_activity_text, event_type, event_timestamp, event_date, location,
    equipment_tag, percentage_complete, extraction_confidence, extraction_model,
    extraction_metadata, embedding_text, embedding_source_hash, embedding_status,
    processing_status
)
SELECT
    e.id, p.id, d.id, e.discipline, e.raw_text, e.normalized_activity_text,
    e.event_type, e.event_timestamp, e.event_date, e.location, e.equipment_tag,
    e.percentage_complete, e.extraction_confidence, 'synthetic-seed',
    jsonb_build_object('seed', true, 'source', 'demo_daily_report.txt'),
    e.event_embedding_text,
    encode(extensions.digest(convert_to(e.event_embedding_text, 'UTF8'), 'sha256'), 'hex'),
    'PENDING', e.processing_status
FROM demo_events e
JOIN projects p ON p.project_code = 'DEMO-REFINERY-001'
JOIN source_documents d ON d.project_id = p.id AND d.file_name = 'demo_daily_report.txt'
WHERE NOT EXISTS (SELECT 1 FROM actual_events existing WHERE existing.id = e.id);

-- Four events have reviewed/selected matches. The fourth event keeps two
-- competing candidates and needs planner review. Event 5 intentionally has no
-- candidates, demonstrating that unmatched events remain stored.
WITH candidate_matches (
    id, event_id, activity_id, similarity, confidence, method, candidate_rank,
    selected, review_status, reviewer_comment
) AS (
    VALUES
    ('60000000-0000-4000-8000-000000000001'::uuid, '50000000-0000-4000-8000-000000000001'::uuid, 'DEMO-PIP-001', 0.94::numeric, 0.95::numeric, 'VECTOR_PLUS_RULES', 1, true, 'AUTO_ACCEPTED', 'Strong discipline, line size, and location match.'),
    ('60000000-0000-4000-8000-000000000002'::uuid, '50000000-0000-4000-8000-000000000001'::uuid, 'DEMO-PIP-002', 0.72::numeric, 0.74::numeric, 'VECTOR_PLUS_RULES', 2, false, 'PENDING', NULL),
    ('60000000-0000-4000-8000-000000000003'::uuid, '50000000-0000-4000-8000-000000000002'::uuid, 'DEMO-PIP-002', 0.96::numeric, 0.96::numeric, 'VECTOR_PLUS_RULES', 1, true, 'ACCEPTED', 'Confirmed by planner.'),
    ('60000000-0000-4000-8000-000000000004'::uuid, '50000000-0000-4000-8000-000000000003'::uuid, 'DEMO-MEC-001', 0.97::numeric, 0.98::numeric, 'VECTOR_PLUS_RULES', 1, true, 'AUTO_ACCEPTED', 'Equipment tag and installation description match.'),
    ('60000000-0000-4000-8000-000000000005'::uuid, '50000000-0000-4000-8000-000000000004'::uuid, 'DEMO-CIV-002', 0.71::numeric, 0.69::numeric, 'VECTOR_PLUS_RULES', 1, false, 'NEEDS_REVIEW', 'Could refer to another concrete activity.'),
    ('60000000-0000-4000-8000-000000000006'::uuid, '50000000-0000-4000-8000-000000000004'::uuid, 'DEMO-CIV-001', 0.66::numeric, 0.63::numeric, 'VECTOR_PLUS_RULES', 2, false, 'NEEDS_REVIEW', 'Alternative candidate; confirm exact work scope.')
)
INSERT INTO activity_matches (
    id, actual_event_id, planned_activity_id, similarity_score,
    final_confidence, matching_method, rank, is_selected, review_status,
    reviewer_comment, matching_metadata
)
SELECT
    c.id, e.id, a.id, c.similarity, c.confidence, c.method, c.candidate_rank,
    c.selected, c.review_status, c.reviewer_comment,
    jsonb_build_object('seed', true, 'candidate_reason', 'synthetic example')
FROM candidate_matches c
JOIN actual_events e ON e.id = c.event_id
JOIN planned_activities a ON a.activity_id = c.activity_id
JOIN schedule_versions s ON s.id = a.schedule_version_id
JOIN projects p ON p.id = s.project_id AND p.project_code = 'DEMO-REFINERY-001'
WHERE NOT EXISTS (SELECT 1 FROM activity_matches existing WHERE existing.id = c.id);

-- The planned activity trigger already enqueues planned-activity embedding
-- jobs. Add retryable jobs for the synthetic actual events as well.
INSERT INTO embedding_jobs (entity_type, entity_id, job_type)
SELECT 'actual_event', e.id, 'GENERATE_EMBEDDING'
FROM actual_events e
WHERE e.id IN (
    '50000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000002',
    '50000000-0000-4000-8000-000000000003',
    '50000000-0000-4000-8000-000000000004',
    '50000000-0000-4000-8000-000000000005'
)
AND NOT EXISTS (
    SELECT 1 FROM embedding_jobs j
    WHERE j.entity_type = 'actual_event'
      AND j.entity_id = e.id
      AND j.job_type = 'GENERATE_EMBEDDING'
);

INSERT INTO audit_logs (
    id, project_id, entity_type, entity_id, action, actor_type,
    model_name, confidence, metadata
)
SELECT
    '70000000-0000-4000-8000-000000000001', p.id, 'actual_event',
    '50000000-0000-4000-8000-000000000001', 'EVENT_EXTRACTED', 'SYSTEM',
    'synthetic-seed', 0.96,
    '{"seed": true, "source": "demo_daily_report.txt"}'::jsonb
FROM projects p
WHERE p.project_code = 'DEMO-REFINERY-001'
AND NOT EXISTS (
    SELECT 1 FROM audit_logs WHERE id = '70000000-0000-4000-8000-000000000001'
);

INSERT INTO audit_logs (
    id, project_id, entity_type, entity_id, action, actor_type,
    model_name, confidence, metadata
)
SELECT
    '70000000-0000-4000-8000-000000000002', p.id, 'activity_match',
    '60000000-0000-4000-8000-000000000001', 'MATCH_CREATED', 'SYSTEM',
    'synthetic-seed', 0.95,
    '{"seed": true, "method": "VECTOR_PLUS_RULES"}'::jsonb
FROM projects p
WHERE p.project_code = 'DEMO-REFINERY-001'
AND NOT EXISTS (
    SELECT 1 FROM audit_logs WHERE id = '70000000-0000-4000-8000-000000000002'
);
