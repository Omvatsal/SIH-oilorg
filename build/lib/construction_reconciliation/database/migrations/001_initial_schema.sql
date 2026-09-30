-- Apply through the Supabase SQL editor or your migration runner.
-- pgvector is stored directly in PostgreSQL; no vector bucket is used.
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS projects (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_code text NOT NULL UNIQUE,
    name text NOT NULL,
    description text,
    client_name text,
    location text,
    status text NOT NULL DEFAULT 'ACTIVE',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS source_documents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    schedule_version_id uuid,
    uploaded_by uuid,
    file_name text NOT NULL,
    storage_bucket text NOT NULL DEFAULT 'project-documents',
    storage_path text NOT NULL,
    file_type text,
    mime_type text,
    file_size bigint CHECK (file_size IS NULL OR file_size >= 0),
    document_type text,
    discipline text,
    document_date date,
    processing_status text NOT NULL DEFAULT 'PENDING',
    processing_error text,
    extracted_text text,
    extraction_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    uploaded_at timestamptz NOT NULL DEFAULT now(),
    processed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(storage_bucket, storage_path)
);

CREATE TABLE IF NOT EXISTS schedule_versions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    version_name text NOT NULL,
    version_number integer,
    source_file_id uuid REFERENCES source_documents(id) ON DELETE SET NULL,
    is_baseline boolean NOT NULL DEFAULT false,
    is_current boolean NOT NULL DEFAULT false,
    imported_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(project_id, version_number)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_schedule_one_current_per_project
    ON schedule_versions(project_id) WHERE is_current;
CREATE UNIQUE INDEX IF NOT EXISTS uq_schedule_one_baseline_per_project
    ON schedule_versions(project_id) WHERE is_baseline;
ALTER TABLE source_documents ADD CONSTRAINT fk_source_documents_schedule_version
    FOREIGN KEY (schedule_version_id) REFERENCES schedule_versions(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS planned_activities (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_version_id uuid NOT NULL REFERENCES schedule_versions(id) ON DELETE CASCADE,
    activity_id text NOT NULL,
    parent_activity_id uuid REFERENCES planned_activities(id) ON DELETE SET NULL,
    wbs_code text,
    wbs_level integer,
    activity_code text,
    discipline text,
    activity_type text,
    description text NOT NULL,
    location text,
    equipment_tag text,
    planned_start date,
    planned_finish date,
    planned_duration numeric,
    calendar_name text,
    embedding_text text,
    embedding extensions.vector(384),
    embedding_source_hash text,
    embedding_model text,
    embedding_version text,
    embedding_status text NOT NULL DEFAULT 'PENDING',
    embedding_generated_at timestamptz,
    source_row_number integer,
    source_data jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(schedule_version_id, activity_id),
    CHECK (planned_finish IS NULL OR planned_start IS NULL OR planned_finish >= planned_start)
);

CREATE TABLE IF NOT EXISTS actual_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    source_document_id uuid REFERENCES source_documents(id) ON DELETE SET NULL,
    discipline text,
    raw_text text NOT NULL,
    normalized_activity_text text,
    event_type text NOT NULL,
    event_timestamp timestamptz,
    event_date date,
    reported_by uuid,
    location text,
    equipment_tag text,
    percentage_complete numeric CHECK (percentage_complete IS NULL OR percentage_complete BETWEEN 0 AND 100),
    extraction_confidence numeric CHECK (extraction_confidence IS NULL OR extraction_confidence BETWEEN 0 AND 1),
    extraction_model text,
    extraction_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    embedding_text text,
    embedding extensions.vector(384),
    embedding_model text,
    embedding_version text,
    embedding_source_hash text,
    embedding_status text NOT NULL DEFAULT 'PENDING',
    embedding_generated_at timestamptz,
    processing_status text NOT NULL DEFAULT 'PENDING',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS activity_matches (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    actual_event_id uuid NOT NULL REFERENCES actual_events(id) ON DELETE CASCADE,
    planned_activity_id uuid NOT NULL REFERENCES planned_activities(id) ON DELETE CASCADE,
    similarity_score numeric CHECK (similarity_score IS NULL OR similarity_score BETWEEN 0 AND 1),
    llm_confidence numeric CHECK (llm_confidence IS NULL OR llm_confidence BETWEEN 0 AND 1),
    final_confidence numeric CHECK (final_confidence IS NULL OR final_confidence BETWEEN 0 AND 1),
    matching_method text NOT NULL,
    rank integer NOT NULL CHECK (rank > 0),
    is_selected boolean NOT NULL DEFAULT false,
    review_status text NOT NULL DEFAULT 'PENDING',
    reviewed_by uuid,
    reviewed_at timestamptz,
    reviewer_comment text,
    matching_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(actual_event_id, planned_activity_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_selected_match_per_event
    ON activity_matches(actual_event_id) WHERE is_selected;

CREATE TABLE IF NOT EXISTS embedding_jobs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type text NOT NULL,
    entity_id uuid NOT NULL,
    job_type text NOT NULL DEFAULT 'GENERATE_EMBEDDING',
    status text NOT NULL DEFAULT 'PENDING',
    attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    error_message text,
    created_at timestamptz NOT NULL DEFAULT now(),
    started_at timestamptz,
    completed_at timestamptz
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
    entity_type text NOT NULL,
    entity_id uuid NOT NULL,
    action text NOT NULL,
    actor_type text,
    actor_id uuid,
    old_value jsonb,
    new_value jsonb,
    source_document_id uuid REFERENCES source_documents(id) ON DELETE SET NULL,
    model_name text,
    confidence numeric CHECK (confidence IS NULL OR confidence BETWEEN 0 AND 1),
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS project_memberships (
    project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    role text NOT NULL CHECK (role IN ('ADMIN','PLANNER','SUPERVISOR','VIEWER')),
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY(project_id, user_id)
);

CREATE INDEX IF NOT EXISTS ix_schedule_versions_project ON schedule_versions(project_id);
CREATE INDEX IF NOT EXISTS ix_planned_activities_discipline ON planned_activities(discipline);
CREATE INDEX IF NOT EXISTS ix_planned_activities_wbs ON planned_activities(wbs_code);
CREATE INDEX IF NOT EXISTS ix_planned_activities_embedding_status ON planned_activities(embedding_status);
CREATE INDEX IF NOT EXISTS ix_planned_activities_embedding_hnsw
    ON planned_activities USING hnsw (embedding extensions.vector_cosine_ops)
    WHERE embedding IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_actual_events_project ON actual_events(project_id);
CREATE INDEX IF NOT EXISTS ix_actual_events_source ON actual_events(source_document_id);
CREATE INDEX IF NOT EXISTS ix_actual_events_discipline ON actual_events(discipline);
CREATE INDEX IF NOT EXISTS ix_actual_events_timestamp ON actual_events(event_timestamp);
CREATE INDEX IF NOT EXISTS ix_actual_events_processing_status ON actual_events(processing_status);
CREATE INDEX IF NOT EXISTS ix_actual_events_embedding_status ON actual_events(embedding_status);
CREATE INDEX IF NOT EXISTS ix_activity_matches_event ON activity_matches(actual_event_id);
CREATE INDEX IF NOT EXISTS ix_activity_matches_activity ON activity_matches(planned_activity_id);
CREATE INDEX IF NOT EXISTS ix_activity_matches_review_status ON activity_matches(review_status);
CREATE INDEX IF NOT EXISTS ix_activity_matches_selected ON activity_matches(is_selected) WHERE is_selected;
CREATE INDEX IF NOT EXISTS ix_source_documents_project ON source_documents(project_id);
CREATE INDEX IF NOT EXISTS ix_source_documents_processing_status ON source_documents(processing_status);
CREATE INDEX IF NOT EXISTS ix_source_documents_type ON source_documents(document_type);
CREATE INDEX IF NOT EXISTS ix_embedding_jobs_status ON embedding_jobs(status);
CREATE INDEX IF NOT EXISTS ix_embedding_jobs_entity ON embedding_jobs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS ix_memberships_user ON project_memberships(user_id);

CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['projects','schedule_versions','planned_activities','source_documents','actual_events','activity_matches','profiles'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON %I', t);
    EXECUTE format('CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION touch_updated_at()', t);
  END LOOP;
END $$;

-- Incremental imports use (schedule_version_id, activity_id) as the upsert key.
-- Application code compares embedding_source_hash: unchanged hash retains vector;
-- changed/new hash queues one embedding_jobs row and updates only that activity.
CREATE OR REPLACE FUNCTION enqueue_planned_activity_embedding()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.embedding_source_hash IS DISTINCT FROM OLD.embedding_source_hash THEN
    NEW.embedding_status := 'PENDING';
    INSERT INTO embedding_jobs(entity_type, entity_id, job_type)
      VALUES ('planned_activity', NEW.id, 'GENERATE_EMBEDDING');
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS planned_activity_embedding_job ON planned_activities;
CREATE TRIGGER planned_activity_embedding_job
BEFORE INSERT OR UPDATE OF embedding_source_hash ON planned_activities
FOR EACH ROW EXECUTE FUNCTION enqueue_planned_activity_embedding();

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE planned_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE actual_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE embedding_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Project members can read project data. Backend service-role operations remain server-side.
CREATE POLICY project_member_read ON projects FOR SELECT USING (
  EXISTS (SELECT 1 FROM project_memberships m WHERE m.project_id = id AND m.user_id = auth.uid())
);
CREATE POLICY membership_self_read ON project_memberships FOR SELECT USING (user_id = auth.uid());
CREATE POLICY schedule_member_read ON schedule_versions FOR SELECT USING (
  EXISTS (SELECT 1 FROM project_memberships m WHERE m.project_id = schedule_versions.project_id AND m.user_id = auth.uid())
);
CREATE POLICY planned_member_read ON planned_activities FOR SELECT USING (
  EXISTS (SELECT 1 FROM schedule_versions s JOIN project_memberships m ON m.project_id = s.project_id
          WHERE s.id = planned_activities.schedule_version_id AND m.user_id = auth.uid())
);
CREATE POLICY documents_member_read ON source_documents FOR SELECT USING (
  EXISTS (SELECT 1 FROM project_memberships m WHERE m.project_id = source_documents.project_id AND m.user_id = auth.uid())
);
CREATE POLICY events_member_read ON actual_events FOR SELECT USING (
  EXISTS (SELECT 1 FROM project_memberships m WHERE m.project_id = actual_events.project_id AND m.user_id = auth.uid())
);
CREATE POLICY matches_member_read ON activity_matches FOR SELECT USING (
  EXISTS (SELECT 1 FROM actual_events e JOIN project_memberships m ON m.project_id = e.project_id
          WHERE e.id = activity_matches.actual_event_id AND m.user_id = auth.uid())
);
CREATE POLICY profile_self_read ON profiles FOR SELECT USING (id = auth.uid());

-- Example similarity query:
-- SELECT id, activity_id, description, 1 - (embedding <=> :query_vector) AS similarity
-- FROM planned_activities WHERE schedule_version_id = :version_id AND embedding IS NOT NULL
-- ORDER BY embedding <=> :query_vector LIMIT 5;
