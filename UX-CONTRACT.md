# SETU Frontend UX Contract

The frontend is a four-step workspace: Import, Reports, Review, Schedule. The FastAPI response models in `src/construction_reconciliation/demo/models.py` and routes in `src/construction_reconciliation/main.py` own business states. This document records how the UI presents them.

## Canonical UI Map

| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
|---|---|---|---|---|
| Date | Native report-date input | `frontend/src/app/reports/page.tsx` | Browser calendar, English UI | Build and field validation |
| Form | Route form and `WorkspaceProvider` action | `frontend/src/components/workspace-provider.tsx` | Schedule import, message, file report | Build and API flow |
| Scrollbar | Global application stylesheet | `frontend/src/app/globals.css` | Table-owned overflow | Browser reflow check |
| Toast | `AppShell` feedback region | `frontend/src/components/app-shell.tsx` | Success and error | Accessible role and action result |

## Navigation and State

- Import a schedule before submitting reports. The Reports, Review, and Schedule routes remain navigable and show a direct recovery action when their data is absent.
- A report may append sources while its current patch is pending. After a decision, submitting a report creates a new workspace.
- Review displays the current patch first and retains earlier revisions for context. Apply is unavailable when the API marks a patch blocked or has no matched updates. Reject applies to pending patches; Undo applies to accepted patches.
- The browser session stores schedule and report identifiers plus the report draft. On refresh, the UI checks those IDs against the API. When the API process has restarted, the user is directed to import again.
- Errors preserve field values and appear in a shared alert. Successful actions appear in the same feedback location. Native dialogs are not used.
- The Schedule table filters locally because the demo schedule is small. Search and issue filtering do not change server data.
- The legacy `/workspace?view=` URL redirects to the matching route. The landing page has been replaced by the task workspace.
- Report uploads accept up to ten queued TXT, CSV, or XLSX files, 15 MB each. Uploads are sequential; files confirmed by the API leave the queue while the rest remain available after an error.
- The Schedule view uses the activity records returned by schedule import for planned dates, status, overdue flags, and the dependency map.

## Responsive Behavior

The desktop sidebar and mobile bottom navigation expose the same destinations. Review decisions follow the evidence on narrow screens. Long schedule tables scroll within their own surface; report forms use normal page scrolling.
