# Construction execution reconciliation database

This repository contains the Python backend foundation for reconciling construction schedule activities with reported site execution. The package separates database access, extraction, embeddings, matching, and authentication so each area can grow independently.

## Offline Phase 1 and Phase 2 demo

The repository also contains an offline SETU demonstration. It does not require Supabase or an LLM at runtime: it imports a synthetic CSV/XER schedule, extracts events from chat/text/Excel input, compiles tag-anchored activity updates, runs safety checks, and exposes reviewable patches with undo. The sample CSV contains 40 industrial activities; the XER sample is a smaller supported subset.

Install the dependencies, then run the API and frontend in separate terminals:

```bash
pip install -e .
uvicorn construction_reconciliation.main:app --reload
```

```bash
cd frontend && npm install && npm run dev
```

Open `http://localhost:3000`. The workspace has four routes: Import, Field reports, Review changes, and Schedule. Import the sample schedule, then compile the prefilled P-201 report. The API also exposes `/docs` at `http://127.0.0.1:8000/docs`.

Demo route (about two minutes): import the 40-activity schedule, compile the prefilled P-201 chat, inspect the three proposed activity updates and four checks per update, apply the patch, then undo it. Replace the message with `Grouting completed for P-201.` to see unmatched work retained for review. Upload `src/construction_reconciliation/demo_data/contractor_dpr.xlsx` to exercise Excel ingestion; use `hydrotest_chat.txt` to see a missing NDT predecessor flagged.

Run the focused tests with `pytest tests/demo -q`. The frontend production check is `cd frontend && npm run build`. Phase 1 data and patch state are held in the API process memory and reset on restart; the Supabase schema remains available for later integration.

Phase 2 adds timezone-aware evidence intervals and multi-source workspaces. Time phrases use `Asia/Kolkata`; overlapping evidence narrows to an intersection, while disjoint ranges remain visible for planner review. To exercise the conflict route, upload `src/construction_reconciliation/demo_data/conflict_dpr.xlsx`, then append the text from `p201_discharge_blocked_chat.txt` in the same workspace. The revised patch retains both sources, supersedes revision 1, proposes `PARTIAL` for L6-424, and requires planner review.

Schedule import also returns a dependency graph (`prerequisite → dependent`) with its topological order and consistency findings. The graph analyzer is available to Python callers as `analyze_dependency_graph(schedule)` from `construction_reconciliation.demo`, and via `GET /schedule/{schedule_id}/dependencies`. It reports missing references, self-dependencies, cycles, duplicate edges, and possible finish-to-start date overlaps; findings are returned with the graph instead of rejecting the schedule import.

Field reports displays extracted time intervals as confidence-labeled bands on a 24-hour IST track. Schedule shows planned dates, activity status, overdue work, and the dependency map. Review changes lists conflicting evidence and activities past their planned finish. A time range is not presented as a precise timestamp.

## Folder organization

```text
.
├── .env                         # Local secrets and connection settings; never commit
├── .env.example                 # Environment variable template
├── DATABASE_ARCHITECTURE.md     # Detailed schema and workflow requirements
├── README.md                    # Setup and repository guide
├── pyproject.toml               # Python package metadata and dependencies
└── src/
    └── construction_reconciliation/
        ├── __init__.py
        ├── config.py            # Loads typed settings from environment/.env
        ├── auth/                # Authentication, authorization, and project RBAC
        ├── database/            # PostgreSQL sessions and database changes
        │   ├── migrations/      # SQL migrations applied to Supabase
        │   └── session.py       # SQLAlchemy engine/session setup
        ├── embeddings/          # Semantic text, hashing, and vector generation
        ├── extraction/          # Parsing reports and producing actual events
        └── matching/            # Planned activity candidate search and review
```

### Package responsibilities

- **`config.py`** centralizes application settings. Secrets and environment-specific values belong in `.env`, not source files.
- **`database/`** owns PostgreSQL connectivity and schema migrations. The initial migration creates the Supabase tables, pgvector columns, indexes, RLS policies, and embedding-job trigger.
- **`extraction/`** will turn uploaded files and text into normalized actual execution events while retaining original source content and provenance.
- **`embeddings/`** will normalize semantic text, compute source hashes, generate vectors, and process retryable embedding jobs.
- **`matching/`** will search for planned activity candidates, preserve multiple candidate results, and support planner review.
- **`auth/`** will handle authenticated user context, project membership, and role-based access checks.

The PostgreSQL schema and vectors live in Supabase PostgreSQL. Uploaded binaries belong in a private Supabase Storage bucket; only object metadata and paths are stored in `source_documents`.

The extraction, embedding, matching, and auth folders are currently boundaries for future implementation; the database migration and connection configuration are the implemented foundation.

## Setup

1. Create a Supabase project with PostgreSQL and Auth enabled.
2. Fill in the existing `.env` file. `DATABASE_URL` should be a SQLAlchemy URL such as `postgresql+psycopg://...`. Keep the service role key and database password on the backend; do not commit `.env`.
3. Run `src/construction_reconciliation/database/migrations/001_initial_schema.sql` in the Supabase SQL editor (or your migration runner). This enables pgvector and creates the schema, indexes, project membership RLS, and the incremental embedding job trigger.
4. Optionally run `src/construction_reconciliation/database/migrations/002_seed_sample_data.sql` to add a repeatable synthetic project, 17 planned activities, five actual events, candidate matches, audit examples, and embedding jobs.
5. Create a private Storage bucket named `project-documents` and restrict access to authorized backend operations.
6. Install the Python package with `pip install -e .`.

## Run the API

Start the development server with either command:

```bash
uvicorn construction_reconciliation.main:app --reload
# or
python -m construction_reconciliation
```

The health endpoint is available at `http://127.0.0.1:8000/health` and returns `{"status":"ok"}`. Importing the API does not connect to PostgreSQL, run migrations, or seed data.

### Demo upload data flow

The frontend separates **Planned schedule** uploads from **Actual work** reports. A schedule upload is sent to `POST /schedule/import`, parsed into schedule/activity objects, and held in the API process memory under `store.schedules`. An actual work message or voice transcript is sent to `POST /ingest/message`; `.txt`, `.csv`, and `.xlsx` reports go to `POST /ingest/file`. The API extracts text/events, keeps source text and parsed events in the in-memory workspace (`store.workspaces`), and returns that workspace to the frontend. The original uploaded files are not saved. This demo does not write these uploads to PostgreSQL, Supabase, or browser storage; restarting the API clears the schedules and workspaces.

Run the repeatable sample seed separately with `python -m construction_reconciliation.database.seed`. To seed and then start the development server, use `python -m construction_reconciliation --seed`. The seed command requires a configured database and an already-applied schema migration.

The same opt-in is available from the API module with `python -m construction_reconciliation.main --seed`. Importing `main:app` or starting the server without `--seed` never runs the seed.

The migration is not run automatically by the application. Apply it once to the Supabase database after creating the project. The repository contains separate `extraction/`, `embeddings/`, `matching/`, `auth/`, and `database/` packages so those workflows can evolve independently.

Database access is lazy: importing application modules does not connect. Use `get_session()` from `construction_reconciliation.database.session` when a DB operation is needed, then close the returned SQLAlchemy session (prefer a `try/finally` or context manager in the calling service). It raises `DatabaseNotConfiguredError` if `DATABASE_URL` is blank.

The migration sets the initial vector width to 384, matching the default MiniLM model. If changing model dimensions, update `EMBEDDING_DIMENSION` and both vector column declarations and indexes before applying the migration.

The seed leaves vector columns null and queues embedding jobs; it does not insert fake vectors or execute the embedding model. It can be rerun without duplicating sample rows or planned-activity jobs. It does not create a Supabase Auth user or project membership; create a real auth user first if you want to exercise membership-based RLS.

## Incremental schedule import and embeddings

Upsert each activity by `(schedule_version_id, activity_id)`. Build semantic `embedding_text` from normalized identity fields (for example `Piping | Erection | Line 24 XX | Unit 3`), excluding IDs and planned dates. Hash its UTF-8 bytes with SHA-256 into `embedding_source_hash`. An insert or changed hash queues one `embedding_jobs` row; changing only dates does not. The worker claims pending jobs, computes the vector, writes the vector/model/version/generated timestamp, and marks both entity and job complete. On failure it records an error and marks the entity/job failed so it can be retried. Database inserts do not depend on the embedding service.

For duplicate safe imports, use `INSERT ... ON CONFLICT (schedule_version_id, activity_id) DO UPDATE` and update semantic fields/hash only when changed. Read the prior hash (or use a conditional update) to report new, modified, unchanged and jobs created. A new row queues one job; an identical re-import queues none; semantic modification queues just that activity.

## Matching and review

Persist each extracted report event, including its original `raw_text`. Similarity search uses the event vector against planned activity vectors with cosine distance (`<=>`). Store all candidate scores in `activity_matches`; keep unmatched events and mark them for planner review in application workflow. A planner decision updates review status, reviewer, timestamp and comment. Raw events and audit entries remain available for history.

RLS is enabled, with project member read policies. Add narrowly scoped write policies as application workflows become concrete; use authenticated backend authorization and never expose service credentials to the frontend. Seed/sample data and full importer/worker logic can be added in the next implementation slice.
