## 1. Technology requirements

Use:

* PostgreSQL through Supabase
* pgvector for embeddings and similarity search
* UUID primary keys where appropriate
* PostgreSQL enums where useful, but avoid excessive enum usage if values may evolve
* TIMESTAMPTZ for timestamps
* DATE for schedule dates where time-of-day is not relevant
* JSONB for flexible extraction metadata
* Foreign keys with appropriate ON DELETE behavior
* Unique constraints to prevent duplicate activities/events
* Indexes for all important lookup paths
* Row Level Security should be considered because this is Supabase

Do NOT create a separate "vector bucket". Embeddings must be stored as PostgreSQL vector columns using pgvector.

Supabase Storage will be used separately for uploaded files such as PDFs, Excel files, scanned reports, audio, etc. The database should store metadata and storage paths for these files.

---

# 2. Core entities

Create the following main tables:

1. projects
2. schedule_versions
3. planned_activities
4. source_documents
5. actual_events
6. activity_matches
7. embedding_jobs
8. audit_logs

Optionally create:

9. users / profiles
10. project_memberships

if authentication/authorization is being handled through Supabase Auth.

---

# 3. projects

Represents a construction project.

Columns:

* id UUID PRIMARY KEY
* project_code TEXT UNIQUE NOT NULL
* name TEXT NOT NULL
* description TEXT
* client_name TEXT
* location TEXT
* status TEXT
* created_at TIMESTAMPTZ
* updated_at TIMESTAMPTZ

Do not put schedule activities directly against only a project without a schedule version. Activities belong to a particular schedule version.

---

# 4. schedule_versions

A project can have multiple schedule versions.

Examples:

* Baseline
* Schedule Update 1
* Schedule Update 2
* Recovery Schedule

Columns:

* id UUID PRIMARY KEY
* project_id UUID NOT NULL REFERENCES projects(id)
* version_name TEXT NOT NULL
* version_number INTEGER
* source_file_id UUID REFERENCES source_documents(id), nullable
* is_baseline BOOLEAN DEFAULT FALSE
* is_current BOOLEAN DEFAULT FALSE
* imported_at TIMESTAMPTZ
* created_at TIMESTAMPTZ
* updated_at TIMESTAMPTZ

Constraints:

* Unique `(project_id, version_number)` where appropriate.
* Ensure that there is at most one current version per project if practical.
* Ensure there is at most one baseline version per project if practical.

---

# 5. planned_activities

This is the most important schedule table.

Each row represents an L5/L6 planned activity.

Columns:

* id UUID PRIMARY KEY
* schedule_version_id UUID NOT NULL REFERENCES schedule_versions(id)
* activity_id TEXT NOT NULL
* parent_activity_id UUID REFERENCES planned_activities(id), nullable
* wbs_code TEXT
* wbs_level INTEGER
* activity_code TEXT
* discipline TEXT
* activity_type TEXT
* description TEXT NOT NULL
* location TEXT
* equipment_tag TEXT
* planned_start DATE
* planned_finish DATE
* planned_duration NUMERIC
* calendar_name TEXT

Embedding-related columns:

* embedding_text TEXT
* embedding VECTOR(384)
* embedding_source_hash TEXT
* embedding_model TEXT
* embedding_version TEXT
* embedding_status TEXT DEFAULT 'PENDING'
* embedding_generated_at TIMESTAMPTZ

Metadata:

* source_row_number INTEGER
* source_data JSONB
* created_at TIMESTAMPTZ
* updated_at TIMESTAMPTZ

Important:

The embedding should represent the semantic identity of the activity, not the entire row.

For example:

"Piping | Erection | Line 24 XX | Unit 3"

Do NOT include activity IDs as semantic text.

Do NOT unnecessarily include planned dates in embedding_text.

The database must retain the original schedule fields separately.

Unique constraint:

`UNIQUE(schedule_version_id, activity_id)`

This prevents duplicate activities within a schedule version.

---

# 6. Important incremental embedding requirement

The system MUST NOT regenerate embeddings for the entire schedule whenever a new schedule row is added.

For every planned activity:

1. Normalize the semantic fields used for embedding.
2. Construct `embedding_text`.
3. Calculate a deterministic SHA-256 hash of `embedding_text`.
4. Store the hash in `embedding_source_hash`.
5. Check whether the same activity already exists.
6. If the activity is unchanged and the hash is identical, reuse the existing embedding.
7. If the activity is new, generate one embedding.
8. If semantic activity information changes and the hash changes, regenerate only that activity's embedding.
9. If only non-semantic fields such as planned dates change, do not regenerate the embedding.

Example:

Old:

`Piping | Erection | Line 24 XX`

New:

`Piping | Erection | Line 24 XX`

Same hash -> no new embedding.

If changed to:

`Piping | Erection | Line 24 XX | Unit 3`

hash changes -> regenerate embedding.

The coding implementation should support this logic.

---

# 7. pgvector configuration

Enable:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

Use a vector dimension appropriate to the selected embedding model.

For the initial prototype assume:

```text
VECTOR(384)
```

if using a 384-dimensional Sentence Transformer such as `all-MiniLM-L6-v2`.

However, make the embedding dimension easy to change through configuration.

Create a vector similarity index once the table is sufficiently populated.

Prefer an appropriate pgvector index such as HNSW.

The index should support cosine distance because semantic matching will use cosine similarity/distance.

---

# 8. source_documents

Represents every uploaded source document.

Examples:

* daily progress report
* piping Excel
* civil Excel
* electrical report
* scanned site diary
* schedule CSV
* schedule Excel
* PDF report

Columns:

* id UUID PRIMARY KEY
* project_id UUID NOT NULL REFERENCES projects(id)
* schedule_version_id UUID REFERENCES schedule_versions(id), nullable
* uploaded_by UUID nullable
* file_name TEXT NOT NULL
* storage_bucket TEXT
* storage_path TEXT NOT NULL
* file_type TEXT
* mime_type TEXT
* file_size BIGINT
* document_type TEXT
* discipline TEXT nullable
* document_date DATE nullable
* processing_status TEXT DEFAULT 'PENDING'
* processing_error TEXT nullable
* extracted_text TEXT nullable
* extraction_metadata JSONB
* uploaded_at TIMESTAMPTZ
* processed_at TIMESTAMPTZ
* created_at TIMESTAMPTZ
* updated_at TIMESTAMPTZ

Do not store the actual PDF/Excel binary in PostgreSQL. Store it in Supabase Storage and keep only metadata/path in this table.

---

# 9. actual_events

Represents structured events extracted from actual execution data.

An actual report may generate multiple events.

Examples:

* Activity started
* Activity completed
* Activity reached 60%
* Activity resumed
* Activity paused

Columns:

* id UUID PRIMARY KEY
* project_id UUID NOT NULL REFERENCES projects(id)
* source_document_id UUID REFERENCES source_documents(id)
* discipline TEXT
* raw_text TEXT
* normalized_activity_text TEXT
* event_type TEXT NOT NULL
* event_timestamp TIMESTAMPTZ
* event_date DATE
* reported_by UUID nullable
* location TEXT
* equipment_tag TEXT
* percentage_complete NUMERIC
* extraction_confidence NUMERIC
* extraction_model TEXT
* extraction_metadata JSONB

Embedding-related fields:

* embedding_text TEXT
* embedding VECTOR(384)
* embedding_model TEXT
* embedding_version TEXT
* embedding_source_hash TEXT
* embedding_status TEXT DEFAULT 'PENDING'
* embedding_generated_at TIMESTAMPTZ

Processing:

* processing_status TEXT DEFAULT 'PENDING'
* created_at TIMESTAMPTZ
* updated_at TIMESTAMPTZ

The raw original text must be retained for auditability.

---

# 10. actual events must NOT overwrite each other

Do not model actual progress simply as:

`planned_activity.actual_start`

because multiple reports may refer to the same activity.

Instead store immutable or append-oriented actual events.

Example:

PIP-101 could have:

```text
START     10 Sep 10:30
PROGRESS  11 Sep 60%
PROGRESS  12 Sep 80%
FINISH    15 Sep 16:00
```

These should all remain in `actual_events`.

A separate derived/current progress view can later determine the current actual start, finish, and progress.

This is important for auditability and historical analysis.

---

# 11. activity_matches

Represents the result of matching an actual event to a planned activity.

Columns:

* id UUID PRIMARY KEY
* actual_event_id UUID NOT NULL REFERENCES actual_events(id)
* planned_activity_id UUID NOT NULL REFERENCES planned_activities(id)
* similarity_score NUMERIC
* llm_confidence NUMERIC nullable
* final_confidence NUMERIC
* matching_method TEXT
* rank INTEGER
* is_selected BOOLEAN DEFAULT FALSE
* review_status TEXT DEFAULT 'PENDING'
* reviewed_by UUID nullable
* reviewed_at TIMESTAMPTZ nullable
* reviewer_comment TEXT nullable
* matching_metadata JSONB
* created_at TIMESTAMPTZ
* updated_at TIMESTAMPTZ

Possible matching methods:

* VECTOR_ONLY
* VECTOR_PLUS_RULES
* VECTOR_PLUS_LLM
* MANUAL

Possible review statuses:

* PENDING
* AUTO_ACCEPTED
* ACCEPTED
* REJECTED
* NEEDS_REVIEW

Do not silently discard unmatched actual events.

If no sufficiently good match exists, the actual event must remain stored and its match status should indicate that planner review is required.

---

# 12. Multiple candidates should be retained

For a single actual event, the matching engine may produce:

```text
PIP-101  0.94
PIP-102  0.72
PIP-103  0.51
```

Store these candidate matches in `activity_matches`.

Use:

* `rank = 1` for the best candidate
* `is_selected = true` only for the final selected activity

This allows the planner to review why the system chose a particular activity.

---

# 13. embedding_jobs

Create a table for asynchronous embedding processing.

Columns:

* id UUID PRIMARY KEY
* entity_type TEXT NOT NULL
* entity_id UUID NOT NULL
* job_type TEXT NOT NULL
* status TEXT DEFAULT 'PENDING'
* attempts INTEGER DEFAULT 0
* error_message TEXT nullable
* created_at TIMESTAMPTZ
* started_at TIMESTAMPTZ nullable
* completed_at TIMESTAMPTZ nullable

Example:

```text
entity_type = planned_activity
entity_id = PIP-101 UUID
job_type = GENERATE_EMBEDDING
status = PENDING
```

This is important because embedding generation can fail independently from database insertion.

The database must remain the source of truth even if the embedding service is temporarily unavailable.

---

# 14. Embedding processing flow

When a new planned activity arrives:

```text
API
 ↓
Validate
 ↓
Insert/update planned_activities
 ↓
Calculate embedding_source_hash
 ↓
Compare old hash
 ↓
If unchanged:
     reuse embedding
 ↓
If new/changed:
     create embedding_job
 ↓
Embedding worker
 ↓
Generate embedding
 ↓
Update planned_activities.embedding
 ↓
Set embedding_status = COMPLETED
```

Do not make successful database insertion dependent on successful embedding generation.

If embedding generation fails:

```text
planned_activity exists
embedding_status = FAILED
embedding_job = FAILED
error_message = ...
```

The job should be retryable.

---

# 15. audit_logs

Every important AI/data transformation should be auditable.

Columns:

* id UUID PRIMARY KEY
* project_id UUID REFERENCES projects(id)
* entity_type TEXT
* entity_id UUID
* action TEXT
* actor_type TEXT
* actor_id UUID nullable
* old_value JSONB
* new_value JSONB
* source_document_id UUID nullable
* model_name TEXT nullable
* confidence NUMERIC nullable
* metadata JSONB
* created_at TIMESTAMPTZ

Examples:

```text
ACTIVITY_CREATED
ACTIVITY_UPDATED
EMBEDDING_GENERATED
EMBEDDING_REGENERATED
EVENT_EXTRACTED
MATCH_CREATED
MATCH_ACCEPTED
MATCH_REJECTED
ACTUAL_START_RECORDED
ACTUAL_FINISH_RECORDED
```

The audit log should preserve the provenance of actual schedule updates.

---

# 16. Current actual progress should be derived

Do not immediately overwrite the original schedule data.

The system should derive current progress from actual events.

For example:

```text
actual_events

PIP-101
START  → 10 Sep 10:30
FINISH → 15 Sep 16:00
```

can produce:

```text
actual_start  = 10 Sep 10:30
actual_finish = 15 Sep 16:00
```

Later a database view can expose:

```text
activity_progress_view
```

containing:

* project
* schedule version
* activity
* planned start
* planned finish
* actual start
* actual finish
* latest percentage
* delay
* current status

Do not destroy the underlying events.

---

# 17. Historical execution data

The database must preserve enough information to later answer queries such as:

* How long did this type of activity actually take?
* What was the planned vs actual duration?
* Which discipline performed the activity?
* What were the common delay causes?
* How frequently did an activity start late?
* What terminology do supervisors use for the same planned activity?
* Which activities repeatedly required manual planner review?

Do not design the schema in a way that loses historical event information.

---

# 18. Important indexes

Create indexes for:

### planned_activities

* `(schedule_version_id, activity_id)`
* `(project_id)`
* `(discipline)`
* `(wbs_code)`
* `(embedding_status)`
* vector HNSW index on `embedding` using cosine distance

### actual_events

* `(project_id)`
* `(source_document_id)`
* `(discipline)`
* `(event_timestamp)`
* `(processing_status)`
* `(embedding_status)`

### activity_matches

* `(actual_event_id)`
* `(planned_activity_id)`
* `(review_status)`
* `(is_selected)`

### source_documents

* `(project_id)`
* `(processing_status)`
* `(document_type)`

### embedding_jobs

* `(status)`
* `(entity_type, entity_id)`

Use partial/appropriate indexes where beneficial.

---

# 19. Duplicate prevention

The system must distinguish between:

### Exact duplicate

Same project + schedule version + activity ID + same semantic content.

Do not create another activity or regenerate the embedding.

### Modified activity

Same activity ID but semantic content changed.

Update the activity and regenerate its embedding.

### New activity

New activity ID.

Insert and generate one embedding.

Use database constraints and application-level upsert logic together. Do not rely only on application code to prevent duplicates.

---

# 20. Schedule import behavior

Implement the database layer so a CSV import can report:

```json
{
  "total_rows": 10002,
  "new_rows": 2,
  "modified_rows": 3,
  "unchanged_rows": 9997,
  "embedding_jobs_created": 5
}
```

The import must NOT delete and recreate the entire schedule merely because a new CSV was uploaded.

Support incremental synchronization.

---

# 21. Supabase Storage

Create one private storage bucket for project documents, for example:

`project-documents`

Suggested logical paths:

```text
project-documents/
    {project_id}/
        schedules/
        daily-reports/
        discipline-reports/
        site-diaries/
        audio/
```

Keep the bucket private.

The database stores:

```text
storage_bucket
storage_path
```

Do not store document binaries in PostgreSQL.

---

# 22. Security

Use Supabase Auth for authentication.

The application backend should validate authenticated users and enforce project-level authorization.

Users should only access projects they are members of.

Recommended roles:

* ADMIN
* PLANNER
* SUPERVISOR
* VIEWER

Consider Supabase Row Level Security policies for project-level data access.

Never expose:

* Supabase service-role key
* database password
* private storage credentials

to the frontend.

The Next.js frontend should communicate with the FastAPI backend for protected business operations.

---

# 23. Deliverables

Create:

1. SQL migration(s)
2. SQLAlchemy models if the FastAPI backend uses SQLAlchemy
3. Database connection configuration
4. pgvector extension setup
5. All indexes
6. Constraints and foreign keys
7. Seed/sample data
8. Example vector similarity query
9. Incremental schedule upsert logic
10. Embedding hash/change-detection logic
11. Embedding job creation logic
12. README explaining the schema and data flow

Include a small synthetic dataset with:

* 1 project
* 1 baseline schedule
* approximately 10–20 planned activities
* multiple disciplines
* several actual events
* several successful activity matches
* at least one ambiguous/unmatched event

Demonstrate that:

1. Initial schedule import generates embeddings.
2. Re-importing the identical schedule does NOT generate duplicate embeddings.
3. Adding one new activity generates only one new embedding job.
4. Modifying one activity regenerates only that activity's embedding.
5. A new actual event can perform pgvector similarity search against planned activities.
6. Multiple candidate matches can be stored.
7. A planner can accept/reject a match.
8. Raw source data remains available for auditability.

Keep the schema normalized and avoid premature microservice complexity. PostgreSQL + pgvector should remain the single source of truth for structured data and embeddings for the prototype.
