# SETU Phase 1 Progress Report

**Date:** 2026-09-30  
**Overall status:** Phase 1 offline demo implemented; Phase 2 demo features extended

## Scope delivered

The repository now contains an offline-first Phase 1 demo. It runs without Supabase or an external language model and keeps demo schedules, reports, patches, and audit history in API process memory. Restarting the API resets that demo state.

## Subphase status

| # | Deliverable | Status and evidence |
|---:|---|---|
| 1 | Shared Pydantic models and synthetic fixtures | **Complete.** Typed contracts are in `src/construction_reconciliation/demo/models.py`. Fixtures cover 40 CSV activities, a supported XER subset, P-201 chat, unmapped grouting, hydrotest without NDT evidence, an Excel DPR, and expected results under `src/construction_reconciliation/demo_data/`. |
| 2 | CSV and minimal XER import | **Complete.** `demo/importer.py` reads CSV and XER `TASK`, `TASKPRED`, and `PROJWBS` blocks, extracts schedule tags/actions, and returns activity, relationship, and tag counts. Unit tests cover CSV fixture counts, XER dependency mapping, and WBS mapping. |
| 3 | Chat, text DPR, and Excel ingestion | **Complete.** Deterministic extraction is in `demo/pipeline.py`; API ingestion supports text, CSV, and XLSX. Events retain source text and span offsets, and extraction covers P-201 status, area/date, cause, and quantity examples. |
| 4 | Tag linker and 1:N activity compiler | **Complete.** Exact equipment-tag/action matching proposes activity updates; an alignment claim can infer pump positioning, and unmatched work remains visible for review. Pipeline tests cover the P-201 fan-out and grouting case. |
| 5 | Safety checks and patch lifecycle | **Complete.** Four checks cover date order, area consistency, predecessor evidence, and backward progress. The in-memory store supports accept, reject, undo, and audit history. Tests cover hydrotest-before-NDT, future dates, area mismatch, backwards progress, accept/reject, and undo. |
| 6 | FastAPI demo endpoints | **Complete.** `main.py` exposes schedule import, message/file ingestion, workspace retrieval, accept/reject/undo, audit, metrics, config, and health routes. API tests cover CSV import, message processing, Excel upload, workspace, accept/undo, audit, and invalid format handling. |
| 7 | Next.js workspace | **Complete.** The frontend uses the product-name config and palette/tokens. One screen supports schedule import, text/Excel upload, event evidence, proposed updates, safety checks, patch actions, and import counts. |
| 8 | Tests, measured counts, and demo route | **Complete for the Phase 1 demo.** Unit/pipeline and API integration tests are present in `tests/demo/`; the workspace shows activity, relationship, and tag counts. The browser route was manually walked through import → compile → apply → undo, and the repeatable route is documented in `README.md`. |

## Verification record

- The prior implementation run reported **27 Python tests passing** and a successful frontend production build.
- The current frontend production build passed on 2026-09-30 (`npm run build`).
- The previous browser walkthrough reported successful import → compile → apply → undo behavior.
- A fresh Python test run was not available in this shell: its selected MSYS Python has no pytest module. The installed Windows Python packages were not reachable through that shell's interpreter.
- The UI flow has manual browser evidence; there is no automated Playwright browser spec. The API integration tests automate the core lifecycle independently of the browser.

## Demo files

- Schedule and report fixtures: `src/construction_reconciliation/demo_data/`
- Excel DPR copy at project root: `contractor_dpr.xlsx` (matches the fixture copy)
- Local run and walkthrough instructions: `README.md`

## Explicit Phase 1 exclusions

Supabase persistence, external LLM extraction, CPM delay calculations, interval times, source conflict resolution, and ask-back capabilities remain out of scope, as specified in the Phase 1 plan.

## Phase 2 additions in current working tree

The following Phase 2 demo behavior is now implemented in the current uncommitted working tree:

- **Dependency graph checks:** schedule import returns a directed graph, topological order, and missing-link/cycle/date consistency findings; the API exposes the graph separately and the workspace UI displays its issues.
- **Silent Progress and one ask-back:** successor progress with an unobserved predecessor produces a finding and a bound on the predecessor finish when a time interval is available. The UI presents one clarification question with a before distribution and updates the distribution after an answer.
- **Accumulated quantity progress:** distinct report sources add quantities against optional planned totals on schedule activities; a report revision replaces its prior version in the rollup.
- **AUTO approval tier:** only non-critical, forward, unambiguous updates backed by two agreeing sources and passing safety checks qualify. Other updates retain existing review tiers.

These remain in-memory demo features. They do not add Supabase persistence or migrations. The Python suite currently passes 43 tests. The Next.js build was started but did not complete during this run, so frontend production-build status is unverified for these latest UI changes.
