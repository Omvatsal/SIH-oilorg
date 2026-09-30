# SETU Prototype UX Contract

## Product context

- **Audience:** Construction planners and field supervisors.
- **Primary jobs:** Import a schedule, submit actual-work evidence, review progress and punch list items, approve/reject proposed updates, inspect institutional-memory availability.
- **Target market(s):** Construction execution; no country-specific rules established.
- **Active locales:** English.
- **Timezone/calendar policy:** Schedule dates are date-only ISO values; source time intervals retain their backend timezone metadata. Date input is browser-native.
- **Accessibility target:** WCAG 2.2 AA baseline.

## Business-context sources

| Domain / scope | Authoritative source | Source type | Reviewed date |
|---|---|---|---|
| Schedule, report, patch lifecycle | `src/construction_reconciliation/main.py` and `demo/pipeline.py` | API implementation | 2026-09-30 |
| Dependency rules | `src/construction_reconciliation/demo/dependency_graph.py` | Domain implementation | 2026-09-30 |
| Data lifecycle | `PHASE1_PROGRESS_REPORT.md` and current in-memory DemoStore | API/implementation | 2026-09-30 |

## Visual contract

- **Project `DESIGN.md`:** Root `DESIGN.md`.
- **Token ownership:** Existing runtime palette and semantic token files remain canonical.
- **Runtime source:** `frontend/src/styles/palette.css`, `frontend/src/styles/tokens.css`, consumed by `frontend/src/app/globals.css`.
- **Token drift gate:** Compare DESIGN frontmatter colors/type/radii against palette/tokens when changing them.
- **Supported themes:** Light only.

## Canonical UI Map

| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
|---|---|---|---|---|
| Landing | `frontend/src/app/page.tsx` | This contract | Links into workspace views | Responsive layout and route links |
| Sidebar navigation | Workspace tablist in `frontend/src/app/workspace/page.tsx` | This contract | Query-backed peer views | Keyboard and URL state |
| Form | Native labeled controls in workspace panels | This contract | Schedule / actual report | Typecheck and browser flow |
| Date | Native `input[type=date]` | English prototype | Native | Browser locale accepted |
| Upload | Schedule picker and queued actual-work files | This contract | Single schedule / multi-source batch | Validation and partial failure |
| Table | Schedule preview native table | This contract | Eight rows per page; horizontal overflow | Pager and narrow layout |
| Scrollbar | `globals.css` | DESIGN.md | Geometry-specific internal table/graph/queue scroll | Keyboard/visible scrollbar |
| Review actions | Existing patch API | Backend patch lifecycle | Apply / reject / undo | API tests |

## Flow ledger

| Operation | Trigger | Pending | Success destination | Success feedback | Failure recovery |
|---|---|---|---|---|---|
| Import schedule | Select CSV/XER | Button disabled and importing label | Planned schedule tab with activity preview | Imported count and filename | Keep prior UI; show inline alert |
| Submit actual work | Explicit final submit | Preserve form; show indeterminate progress | Progress tab after all sources finish | Source count submitted | Keep unsent files and note, explain partial completion |
| Review patch | Approve/reject/undo | Disable actions | Punch list view | Inline page status | Preserve workspace and explain stale/invalid state |
| Change workspace view | Select tab or arrow keys | Immediate tab activation | Selected tab panel | Query parameter updated | Browser Back restores selected view |
| Enter workspace | Landing page link | Immediate route navigation | Selected workspace view | `/workspace` or `?view=` link | Browser Back returns to landing |

## Navigation and responsive behavior

- Six peer views: Planned schedule, Actual work, Progress, Punch list, Institutional memory, Settings. Desktop uses a persistent project sidebar with a demo profile at its foot. Settings exposes clearly labeled placeholder account and organization details.
- Workspace selection lives at `/workspace`; its active view is represented by `?view=` and restored on refresh/popstate.
- Arrow Up/Down, Home, End move focus and activate the selected tab.
- Panels scroll with the document. Schedule table and dependency graph have their own visible overflow regions.
- At narrow widths the sidebar turns into a horizontally scrollable navigation strip and multi-column panels stack. The landing page uses a single-column hero and feature list.

## Async and resilience

- Mutations are pessimistic; no success appears before server response.
- Actual report submissions are sequential because the current backend appends sources to one pending report. Successful sources are removed from the local queue; later failed sources remain queued.
- The API currently stores data only in process memory. This shell does not claim durable save or offline queue behavior.
- No automatic retry is performed for uncertain server outcomes.

## Validation

- Schedule: CSV/XER, nonempty, max 15 MB.
- Reports: TXT/CSV/XLSX, nonempty, max 15 MB each, up to ten queued files.
- At least one written/voice note or file is required to submit.
- Inline error alerts retain unsubmitted user input.

## Prototype feature boundaries

- The Progress view shows complete task ratio, extracted quantity evidence, overdue unfinished task exposure, dependency graph health, and each reported time interval on a 24 hour India Standard Time track with its confidence label. A time bar represents an interval, not an exact timestamp. The Punch list groups overdue tasks, dependency findings, evidence conflicts, unmatched work, open clarification questions, and the pending schedule patch.
- It does not predict project completion date or calculate CPM/critical-path delay.
- The Institutional memory view is an honest disconnected state; no durable historical-memory service exists yet.
- Workspaces, schedule uploads, and decisions reset when the API process restarts.

## Verification

- Typecheck: `cd frontend && npx tsc --noEmit`.
- Backend integration: `python -m pytest -q` from repository root.
- Dependency graph: `python -m pytest tests/demo/test_dependency_graph.py -q`.
