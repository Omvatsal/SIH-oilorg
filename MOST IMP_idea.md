# SETU: Site Execution Truth Unifier
### Mega Idea Document v2 | SIH Problem Statement 26122 | Oil India Limited

*Intelligent Data Capture & Schedule-Linking Layer: the Planning-to-Execution Bridge*
Theme: Smart Automation | Category: Software

> **Naming rule (important for implementation):** "SETU" is a placeholder. In this document it stands for the config variable `PRODUCT_NAME`. In code, never type the name; read it from one config (Section 15.2). Renaming the product must be a one-line change.
>
> **Theming rule:** every color, font, radius and shadow in the UI comes from design tokens (CSS variables) defined in one place (Section 15.3). Changing the theme must mean editing token files, not components.

> **One-line pitch:** **SETU turns messy site reports into verified L5/L6 schedule updates, and detects the progress that was never reported.**

---

## How to read this document

| Part | Sections | Purpose |
|---|---|---|
| **Pitch** | 1-8 | What we are building and why it stands out |
| **Build** | 9-14 | Architecture, importer, data, 10-hour plan, evaluation, live memory |
| **Design** | 15 | Design language, tokens, components, screens (implementation guide) |
| **Case** | 16-21 | Feasibility, viability, adoption, impact, risks, research |
| **Deliver** | 22-24 | SIH slide content, demo storyboard, Q&A preparation |
| **Backup** | Appendices | Full flow, data model, algorithms, SWOT, dropped ideas, feedback log |

Tags used throughout: **LIVE-1 / LIVE-2 / LIVE-3** = built in prototype phase 1/2/3. **ROADMAP** = described, not coded.

---

## Table of Contents

1. Executive summary
2. Problem statement coverage (LIVE vs ROADMAP)
3. Where we overlap with existing work, and the residual gap
4. Design principles
5. The flow in five stages
6. The three flagship USPs
7. Supporting capabilities and roadmap
8. Worked example: the P-201 story
9. Architecture (lean prototype first)
10. Schedule importer
11. Industrial synthetic data
12. Prototype plan: 10 hours, 3 submittable phases
13. Evaluation plan
14. Live institutional memory (minimum viable)
15. Design language and implementation guide
16. Feasibility (with proof, not labels)
17. Viability and business case
18. Adoption strategy
19. Impact: three KPIs
20. Top risks and honest limits
21. Research foundation
22. SIH slide content
23. Demo storyboard (5 scenes)
24. "Isn't this already done?" Q&A preparation
25. Appendices (A-R)

---

## 1. Executive summary

**Problem.** The plan lives at L5/L6 in Primavera/MS Project. Progress arrives as DPRs, spreadsheets, diaries and verbal updates that never carry activity IDs. Reconciliation is manual and late, so analytics, forecasts and lessons learned inherit poor data.

**SETU.** A layer between the field and the schedule:

```
MESSY FIELD DATA → UNDERSTAND → COMPILE → VERIFY → SAFE SCHEDULE UPDATE → LEARN
```

**Three things we do extremely well**

1. **Compile reality:** one field update can change several L5/L6 activities (1:N), many updates can drive one activity (N:1), and work with no plan node is flagged.
2. **Verify before write:** the AI proposes; schedule logic, evidence and risk decide. Nothing corrupts Primavera silently.
3. **The schedule asks back:** SETU detects progress that should have been reported but wasn't, and asks the single most valuable question.

**Positioning statement (use verbatim):**
> Existing work addresses parts of report extraction, schedule matching and constraint validation. SETU differentiates itself through the combination of granularity-aware compilation, uncertainty-preserving actuals, schedule-to-field reasoning and gated schedule updates.

**Prototype honesty:** about 10 hours, three phases, each independently submittable. Every claim on a slide says whether it is live or roadmap. Accuracy is reported as measured counts on a labelled set, not percentages we cannot support.

---

## 2. Problem statement coverage (LIVE vs ROADMAP)

| PS requirement | SETU answer | Status |
|---|---|---|
| Ingest DPR text, spreadsheets, P6/MSP exports | Text DPR, Excel, chat messages; **CSV/XER schedule importer** | **LIVE-1** |
| Scanned diaries | OCR or vision-LLM into the same pipeline | ROADMAP |
| Extract activity-level actual start/end events | Rules for tags/quantities + LLM with strict JSON schema | **LIVE-1** |
| Conversational/voice "time agent" | Chat with tap-to-confirm cards; voice is roadmap (noisy sites) | **LIVE-1** chat / ROADMAP voice |
| Fuzzy-match to L5/L6, terminology mismatch | Tag-anchored linker with explainable scores | **LIVE-1** |
| Granularity mismatch | **Activity Compiler** (1:N, N:1, partial, no-match) | **LIVE-1** (1:N, no-match) / **LIVE-2** (N:1) |
| Flag unmatched/new activities | Review queue with suggested parent | **LIVE-1** flag / ROADMAP clustering |
| Auto-update actuals with confidence and audit trail | Rule checks, approval tiers, git-style patch, provenance | **LIVE-1** / **LIVE-2** |
| Structured discipline-tagged dataset | Actuals ledger with evidence links | **LIVE-1** |
| Institutional memory | **Historical-actuals table with median vs plan warning** | **LIVE-3** (minimum) / ROADMAP (fingerprints, causal graph) |
| Working prototype on 2-3 formats | Text DPR + Excel + chat on an industrial-looking project | **LIVE-1** |

---

## 3. Where we overlap with existing work, and the residual gap

We do not claim that nobody does any of this. Existing products and research cover parts of it.

| Commodity capability (do not headline) | Where SETU goes further |
|---|---|
| LLM extraction from DPR/Excel | Compiles one statement into **several** activity-state updates |
| Semantic/fuzzy matching, confidence score | Uses tags, area and **schedule logic** to reject impossible matches; handles N:1 running progress |
| Human review, audit trail, schedule update | **Gated writes**: risk-tiered approval and a rule layer between AI and the schedule |
| Multilingual input, auto-report generation | Used for adoption (supervisor payoff), not as a differentiator |
| Analytics on top of actuals | Also reasons **backwards**: what evidence should exist but doesn't |

**Residual gaps we target**
1. **Granularity:** similarity matching maps one report to one activity; the PS says field work is more granular than the plan.
2. **Trust:** the step between "AI suggests" and "schedule changes" needs deterministic checks.
3. **Time realism:** field time is vague, yet systems store exact timestamps.
4. **Missing evidence:** most tools process what is reported, not what should have been reported.
5. **Learning loop:** structured actuals rarely flow back into planning.

*Before quoting a specific competitor gap on a slide, look up two or three actual products and confirm it.*

---

## 4. Design principles (four)

| Principle | Meaning |
|---|---|
| **Compile** | One report is not one activity. Turn statements into sets of state updates. |
| **Verify** | The AI never writes to the schedule. Rules, evidence and risk decide. |
| **Explain** | Every update shows its source, score, checks and approver. Uncertainty is shown, not hidden. |
| **Learn** | Verified actuals feed a queryable memory; planner corrections improve matching. |

---

## 5. The flow in five stages

```
 CAPTURE ──► UNDERSTAND ──► COMPILE ──► VERIFY ──► LEARN
```

| Stage | What happens | Key output |
|---|---|---|
| **Capture** | Text DPR, Excel and chat arrive; schedule imported from XER/CSV | Report units + schedule graph |
| **Understand** | Rules extract tags/quantities; LLM extracts events; vague time becomes an interval | Structured events |
| **Compile** | Events linked to L5/L6 nodes; 1:N / N:1 / partial / no-match resolved; sources reconciled | Proposed activity-state updates |
| **Verify** | Rule checks (SAFE / SUSPICIOUS / BLOCKED) and approval tier; missing evidence detected | Git-style patch or review item |
| **Learn** | Ledger, delay impact, historical-actuals memory, next best question | Dataset, warnings, questions |

The detailed 11-stage pipeline is in Appendix A.

---

## 6. The three flagship USPs

### USP 1: Activity Compiler ("compile reality")

**Message:** solve granularity mismatch, not just semantic similarity.

```
"P-201 installed + aligned, suction connected, discharge pending"
                        │
        ├──► L6-421 Position P-201        ✓ COMPLETE
        ├──► L6-422 Align P-201           ✓ COMPLETE
        ├──► L6-423 Connect suction       ✓ COMPLETE
        └──► L6-424 Connect discharge     ⏸ NOT COMPLETE
```

**Four mapping modes**

| Mode | Example | Result |
|---|---|---|
| 1:1 | "Backfill started at grid B3" | One activity start |
| 1:N | Pump statement above | Several activities updated with different states |
| N:1 | 12 of 40 spools erected across many reports | One activity: actual start from the first, 30% progress, finish from the last |
| No match | "Grouting completed for P-201" (no grouting activity) | Flag with suggested parent WBS and insertion point |

**How it works (implementable)**
1. **At import**, each plan activity is parsed into `(action, object_tag, area, discipline)` using rules plus a cached LLM classification. "Align Pump P-201" → `(ALIGN, P-201, Unit-2, mechanical)`.
2. **At extraction**, each field claim is parsed the same way: `(state_reached, object_tag, area)`.
3. **Compile:** for each claim, look up plan activities with the same object tag (tag anchor) and an action that matches the claimed state via a **state template** (Appendix G). One claim can imply earlier states are complete ("aligned" implies "positioned"), flagged as inferred.
4. **N:1:** count quantities against the activity's total; first event sets start, last sets finish.
5. **No match:** if the object has no activity for that action, raise a "new work" candidate.
6. Everything goes to verification before any update.

### USP 2: Verify before write ("the AI cannot silently corrupt Primavera")

```
AI PROPOSES ──► RULE CHECKS ──► APPROVAL TIER ──► PATCH
                ✓ safe   ⚠ review   ✕ block     auto / confirm / planner / block
```

**Rule checks (LIVE-1, four rules):** date order, area consistency, predecessor evidence, backward progress without a rework tag. More rules are roadmap (plausible quantity, shutdown-day date, discipline consistency, weather advisory).

**Approval tiers (LIVE-2):**

| Tier | When | Needs |
|---|---|---|
| Auto | Non-critical, forward change, rules SAFE, agreeing sources | Logged |
| Confirm | Non-critical single source or mid confidence | Supervisor tap or second source |
| Planner | Critical path, or rules SUSPICIOUS, or state jump over missing evidence | Planner approval |
| Blocked | Rules BLOCKED | Rejected with reason |

**Framing:** a flag means "suspicious, needs a look", never "wrong". Field sequences legitimately deviate from plan.

**Patch (LIVE-1):** a git-style before/after diff with evidence, accept/edit/reject/undo. Audit and provenance support it (hash-chaining is a supporting detail, not a headline).

### USP 3: The schedule asks back (bidirectional progress intelligence)

**Message:** SETU does not only interpret what was reported. It detects what should have been reported but is missing.

```
Reports → Schedule           AND           Schedule → Missing evidence → Ask the field

"Hydrotest started"  ──►  NDT completion has no evidence  ──►  "Was NDT completed?"
```

**Parts**
- **Silent Progress rule (LIVE-2):** a successor is reported started, but its predecessor has no evidence → flag undocumented progress and bound the missing date (predecessor finished on or before the successor's start).
- **Ask-back (LIVE-2):** one scripted clarification question with a visible before/after candidate distribution (chosen by information gain, Appendix I).
- **Top open question (LIVE-3):** rank open items by interval width × criticality (Appendix H) and ask the highest first, for example "Has the valve arrived?"
- **Evidence-backed completion (LIVE-3):** claimed vs evidence-backed progress by discipline.

**Enabling technologies underneath the three USPs:** interval-valued actual time, source reconciliation, explainable scores, provenance. They support the story but are not sold separately.

---

## 7. Supporting capabilities and roadmap

**Supporting (live)**

| Capability | Tag |
|---|---|
| Tag-anchored linker with score breakdown and runner-up reason | LIVE-1 |
| Interval-valued actual time and soft-edged Gantt bars | LIVE-2 |
| Source reconciliation (Excel 100% vs chat "blocked") | LIVE-2 |
| Progress state templates (pump, piping spool) with rework moves | LIVE-2 |
| Delay impact on a 40-node graph ("+N days") | LIVE-3 |
| Historical-actuals memory (median vs plan warning) | LIVE-3 |
| Auto-generated DPR text from confirmed events (supervisor payoff) | LIVE-3 if time |
| Actuals queries (planned vs actual by discipline) | LIVE-3 |

**Roadmap (described on a slide, not coded)**

| Group | Items |
|---|---|
| Capture | Scanned diaries, voice for noisy sites, offline queue, Telegram-style channel, copy-paste report detector, proxy evidence (permits, material issues, attendance) |
| Time | Bounds propagation across the network, calendar-effective durations |
| Linking | Phrase memory from planner corrections, embeddings at scale, spoken correction, quantity-based progress |
| Trust | More rules, source-channel reliability, evidence freshness decay, EOT evidence pack |
| Planning quality | Ghost-activity clustering, Self-Healing WBS, scope-deviation vs execution-delay classification, rework/HSE/handover events |
| Memory | Execution fingerprints, plan-realism score, pre-mortem, project autopsy, dependency learner, causal delay chains, PPC |
| Forecast | Evidence-aware forecast band, full value-of-information with scenario runs, workfront readiness |
| Integration | P6 REST write-back, MSP XML, P6 scheduling-mode advisor, test-pack roll-up, photo as weak evidence |

---

## 8. Worked example: the P-201 story

This story is the center of the pitch, the demo and the video.

**Input (typed chat):**
> "P-201 fitted yesterday evening. Alignment done this morning, but discharge couldn't happen because the valve hasn't arrived."

Report time: 30 Sep 2026, 08:40 IST. Imported schedule includes L6-421 Position P-201, L6-422 Align P-201, L6-423 Connect suction, L6-424 Connect discharge, then hydrotest and commissioning.

| Scene | What happens | What the viewer sees |
|---|---|---|
| **1 Understand** | Tag `P-201`; placement complete, alignment complete, discharge blocked, cause "valve unavailable"; times as intervals | Sentence with colour-coded spans (tag, state, time, cause) |
| **2 Compile** | One message fans out to L6-421 ✓, L6-422 ✓, L6-424 ⚠ blocked | Fan-out diagram, 20-25 seconds |
| **3 Contradiction** | Contractor Excel says "Pump installation = 100%"; chat says discharge blocked | Conflict card resolving to PARTIAL |
| **4 Verify and patch** | Tag ✓, area ✓, predecessor logic ✓, blocked critical item ⚠; tier badges; diff card with Apply/Review | Rule checklist and patch |
| **5 Reason forward** | Valve unavailable → discharge connection → hydrotest → commissioning → **+N project days** (computed from the graph) | Delay chain, then the next-best question: **"Has the valve arrived?"** |

Every number on screen is computed from the imported schedule and shown with its calculation.

---

## 9. Architecture (lean prototype first)

### 9.1 Lean prototype (what we build)

```
 Next.js frontend ──HTTP──► One FastAPI process (monolith)
                              ├─ importer/  (CSV, minimal XER → graph)
                              ├─ ingest/    (txt, xlsx, chat)
                              ├─ extract/   (regex + LLM JSON, cached)
                              ├─ link/      (tag anchor, filters, rapidfuzz, LLM re-rank)
                              ├─ compile/   (state templates, 1:N, N:1, no-match)
                              ├─ rules/     (validation checks, approval tiers)
                              ├─ schedule/  (NetworkX graph, patches, CPM)
                              ├─ memory/    (historical actuals)
                              └─ audit/     (append-only, hash-chained log)
                           SQLite or JSON files  +  LLM response cache
```

| Item | Choice |
|---|---|
| Storage | SQLite or JSON files |
| Search | In-memory Python; tags + rapidfuzz + LLM re-rank of the top 5 (embeddings optional) |
| LLM | Claude API, **cached by input hash**, live-mode toggle so a network failure cannot break the demo |
| Graph/CPM | NetworkX; finish-to-start links, working-day durations, **no calendars** (stated openly) |
| Voice, offline sync, Docker, Redis, vector DB | Not in prototype |
| Frontend | Next.js + Tailwind using the design tokens in Section 15 |

### 9.2 Production direction (roadmap, small)

PostgreSQL (+ pgvector), a job queue, local LLM option (Llama/Qwen via Ollama/vLLM) for on-prem sites, P6 XER/REST and MSP XML adapters, role-based access, faster-whisper and OCR for scans, Docker on-prem. Full production diagram in Appendix P.

### 9.3 Core data (four relationships to remember)

```
activity  ↔  evidence (source sentence/cell)  ↔  actual interval  ↔  patch
```

Full model in Appendix B.

---

## 10. Schedule importer

**Why it is a priority:** it makes SETU look like a product Oil India could pilot, not a student demo. It ranks above hash-chain polish, calibration charts, dashboards and heatmaps.

**What the evaluator sees**

```
Upload Primavera export:  project_schedule.xer
 ✓ 246 activities      ✓ 312 relationships     ✓ 38 equipment tags
 ✓ 7 disciplines       ✓ critical path detected
```

Then a messy DPR updates that imported schedule.

**Scope**
- **CSV first** (columns: id, name, wbs, discipline, area, planned_start, planned_finish, predecessors). Always works.
- **Minimal XER reader:** XER is tab-delimited text with table blocks. Parse `TASK` (id, code, name, target dates, wbs), `TASKPRED` (predecessor links and types), `PROJWBS`, and optionally `CALENDAR`. Ignore everything else.
- **On import:** build the NetworkX graph, run a forward/backward pass for float and critical path, parse each activity into `(action, object_tag, area, discipline)`, build the tag index, and show the summary card.
- **Not in scope:** real P6 connectivity, calendars, resource-loaded schedules.

**How we get 246 activities without months of work:** hand-craft about 40 "hot" activities used by the test set, and use a small time-boxed script (about 30 minutes) that expands templates (pump chain, piping line chain, cable run chain, foundation chain) into about 200 background activities, then export as XER and CSV. This is filler for realism, not a general data generator.

---

## 11. Industrial synthetic data

The PS allows synthetic data; the risk is that it looks like a classroom example. The vocabulary must look like oil and gas execution.

**Vocabulary to use throughout**

`P-201`, `P-201A/B`, `24"-P-112`, spool erection, RT films, NDT, hydrotest, test pack (TP-24), MCC, cable termination, megger test, foundation handover, PTW / hot-work permit, punch list, grouting, alignment, line list, isometric, welder ID, inch-dia, area codes (Unit-2, Unit-3), grid references (B3).

**Hot schedule:** 40 activities across piping, civil, mechanical (static/rotating), electrical, instrumentation, HSE. Include:
- Pump chain: position, align, grout, connect suction, connect discharge
- Piping chain: spool erection, weld, NDT/RT, hydrotest
- Electrical chain: cable tray, cable laying, termination, megger
- Civil: excavation, foundation, backfill, foundation handover

**Labelled test set: 42 cases**

| Category | Count | Purpose |
|---|---:|---|
| Clean | 8 | Baseline |
| Typos and abbreviations | 8 | Robustness |
| Vague time | 4 | Interval handling |
| Hindi-English mixed | 3 | Code-mixing |
| Conflicting sources | 4 | Reconciliation |
| Rule-breaking (should be caught) | 5 | Validation |
| Unmapped/new work | 3 | No-match detection |
| Ambiguous | 2 | Ask-back |
| **Adversarial look-alike** | 5 | Text similar but tag/area differs |
| **Total** | **42** | |

**Adversarial examples (make linking honest)**
- `24"-P-112` vs `24"-P-121` (transposed digits)
- `P-201A` vs `P-201B` (twin pumps)
- Same description in Unit-2 vs Unit-3
- Same tag, different discipline (piping vs electrical work on the same skid)
- A finished predecessor with a similar name ("Hydrotest" vs "Pneumatic test")

**Method:** draft variants with an LLM once, offline; fix labels by hand. Split roughly 28 development and 14 held-out; tune prompts and rules on development only, and report on held-out cases (and on all 42).

**Formats:** one text DPR, one Excel sheet, a set of chat messages, plus the schedule file.

---

## 12. Prototype plan: 10 hours, 3 submittable phases

**Assumption:** two or more people working in parallel (backend and frontend). If solo, use CSV only (skip XER) and treat Phase 3 as optional.

**Uncuttable core (never sacrifice for dashboards):**
```
3 input formats → extraction → Activity Compiler → linking → 4 rule checks → patch/approval
```

| Phase | Hours | Cumulative | What you can honestly say |
|---|---|---|---|
| **1: Core bridge** | 4.0 | 4.0 | "Messy reports become verified, linked, auditable updates on an imported schedule" |
| **2: Trust, time and the schedule asks back** | 2.75 | 6.75 | "It reconciles conflicts, keeps time uncertain, applies risk tiers and asks for missing evidence" |
| **3: Proof and memory** | 2.25 | 9.0 | "It quantifies delay impact, learns from history, and we report measured results" |
| Buffer | 1.0 | 10.0 | Video, screenshots, slides |

After each phase, record a 2-minute screen capture as insurance.

### Phase 1: Core bridge (4.0 h)

| Time | Task |
|---|---|
| 0:00-0:40 | Industrial hot schedule (40 activities), first 12 test cases, vocabulary list |
| 0:40-1:05 | Filler script → about 240-activity XER and CSV |
| 1:05-1:50 | **Importer** (CSV, minimal XER), graph, summary card, activity parsing into (action, object, area, discipline) |
| 1:50-2:30 | Ingestion (text, Excel, chat) and extraction (regex tags + LLM JSON, cached) |
| 2:30-3:20 | **Linker** (tag anchor, filters, fuzzy, LLM re-rank, score breakdown) and **Compiler** (1:N and no-match) |
| 3:20-4:00 | **4 rule checks** and **patch view** (before/after, source highlight, accept/reject/undo) |

**Checkpoint:** the P-201 statement fans out into three completions and one open item; hydrotest-before-NDT is flagged; grouting goes to the review queue; the importer summary card shows real counts.

### Phase 2: Trust, time and the schedule asks back (2.75 h)

1. **Contradiction card:** Excel 100% vs chat "blocked" → PARTIAL (0:40)
2. **Silent Progress rule** and **one ask-back question** with before/after candidate distribution (0:50)
3. **Time intervals:** vague phrases → `{earliest, latest}`, narrowing by intersection, soft-edged Gantt bar (0:50)
4. **N:1 progress:** running count of erected spools (0:20)
5. **Approval tiers:** auto / confirm / planner / blocked (0:15)

**Checkpoint:** a conflict is shown and resolved; an unreported predecessor is flagged and questioned; an interval narrows on screen.

### Phase 3: Proof and memory (2.25 h)

1. **Delay impact:** NetworkX forward/backward pass, float, critical path, "+N days", delay chain visual (0:45)
2. **Live memory table:** historical planned vs actual, median, warning on a new plan (0:30, Section 14)
3. **Measured results:** run the held-out and full sets; report absolute counts and an ablation (fuzzy-only vs full) (0:40)
4. **Evidence-backed completion** by discipline and **top open question** (0:20)
5. **Auto-DPR text** only if time remains

### If you fall behind, cut in this order (never cut the checkpoints)

1. XER parsing (keep CSV; keep the summary card)
2. Auto-DPR
3. Top open question ranking (keep the one scripted question)
4. Evidence-backed completion chart
5. Heatmap styling (a plain list of downstream delays suffices)
6. Third approval tier (keep auto vs planner)

### Rules for the 10 hours

- Before each phase, write what is **live** and what is **roadmap**; use those exact words on slides.
- Cache every LLM output for scripted inputs; keep a live-mode toggle.
- Never demo a feature that is not running; never add one that cannot be drawn on screen.
- No hardcoded colors or product name in components (Section 15).
- Commit to git at the end of each phase.

### Live vs roadmap strip (put on a slide)

| Live | Roadmap |
|---|---|
| Text DPR, Excel, chat; CSV/XER schedule import | Scans, voice, live P6 connector |
| Tag-anchored linking with explainable scores | Phrase memory, embeddings at scale |
| Activity Compiler (1:N, N:1, no-match) | Ghost clustering, Self-Healing WBS |
| 4+ rule checks, approval tiers, patch, audit | More rules, freshness decay, source reliability |
| Interval time, Silent Progress, ask-back | Bounds propagation, full value-of-information |
| Delay impact (no calendars) | Calendars, forecast bands |
| Historical-actuals warning | Fingerprints, dependency learner, causal graph |

---

## 13. Evaluation plan

**Principle:** report absolute counts on a labelled set. Do not make calibration claims from about 40 examples.

**Slide format (fill in only what you measured):**

```
42 LABELLED CASES  (14 held-out)
Top-1 correct:              x / 42     (held-out: x / 14)
Top-3 correct:              x / 42
Look-alike traps handled:   x / 5
Invalid updates caught:     x / 5
Unmatched work detected:    x / 3
False flags on clean cases: x / 8
Ablation: fuzzy-only  x / 42   →   full pipeline  x / 42
```

| Area | Metric |
|---|---|
| Extraction | Events correct; tags exact |
| Time | True time falls inside the interval |
| Linking | Top-1, top-3; 1:N and N:1 cases; look-alike traps |
| Validation | Injected errors caught; false flags on clean cases |
| Approval | Share auto / confirm / planner; wrong auto-applies |
| Reality Lag | Event-to-update time on scripted inputs, before vs with SETU (labelled as prototype measurement) |

Calibration (reliability curves) is a production direction, not a claim. Real-data validation is the purpose of the shadow-mode pilot.

---

## 14. Live institutional memory (minimum viable)

**Goal:** honestly demonstrate that the same structured dataset serves live control and future learning.

**Data:** `historical_actuals.json`, clearly labelled synthetic, 3 past projects × about 6 activity classes.

```
HISTORICAL ACTUALS (synthetic)
24" line erection      Project A  plan 5d  actual 7d
                       Project B  plan 6d  actual 8d
                       Project C  plan 5d  actual 6d

NEW PLAN: 5d
⚠ Similar historical work: median actual = 7d
  Most common delay cause: crane availability (2 of 3)
```

**How:** match a new plan activity to a class by action + object type (+ size when present); compute median and range; show the warning on the planning view and next to the activity in the patch. Sample size is always displayed ("3 comparables").

**Also live:** simple actuals queries (average actual vs planned duration by discipline; top delay causes) via parameterised endpoints.

**Roadmap:** execution fingerprints (crew, terrain, weather), plan-realism score for a whole baseline, pre-mortem and project autopsy, dependency learner, causal delay chains.

---

## 15. Design language and implementation guide

### 15.1 Design concept: "Site Logbook"

A warm, paper-and-ink interface that feels like a site engineer's logbook with stamped verdicts, not a neon AI dashboard. Warm neutrals dominate; a terracotta/burnt-orange primary carries actions; amber, olive and brick express status. Data-dense but calm.

**Design principles**
1. **Evidence first:** every date, status and number has a visible source (chip or drawer).
2. **Calm over alarm:** color is used for status only; never color alone (always icon + text).
3. **Uncertainty is visible:** soft edges, hatching and ranges instead of false precision.
4. **One screen, one story:** the workspace shows the P-201 story end to end without navigation.
5. **Field-friendly:** large tap targets, chat-first, works on a phone-width column.
6. **Machine text looks like machine text:** tags, IDs and dates are set in monospace.

### 15.2 Product name as a variable

**Single source of truth**

```ts
// frontend/src/config/brand.ts
export const BRAND = {
  name:     process.env.NEXT_PUBLIC_PRODUCT_NAME      ?? "SETU",
  fullName: process.env.NEXT_PUBLIC_PRODUCT_FULL_NAME ?? "Site Execution Truth Unifier",
  tagline:  process.env.NEXT_PUBLIC_PRODUCT_TAGLINE   ?? "Verified actuals for every schedule",
  defaultTheme: "light",            // "light" | "dark" | any data-theme in tokens.css
} as const;
```

```python
# backend/app/config.py
import os
PRODUCT_NAME      = os.getenv("PRODUCT_NAME", "SETU")
PRODUCT_FULL_NAME = os.getenv("PRODUCT_FULL_NAME", "Site Execution Truth Unifier")
```

```
# .env (both apps read from here)
PRODUCT_NAME=SETU
NEXT_PUBLIC_PRODUCT_NAME=SETU
```

**Where the name must come from the variable**
- UI: header, page titles, empty states, onboarding text
- Backend: LLM system prompts ("You are the {PRODUCT_NAME} extraction module"), audit log actor (`system:{PRODUCT_NAME}`), exported file names, auto-generated DPR footer, API `/api/config` (frontend can fetch brand at runtime)
- Docs and README: use a placeholder token, replaced at build time

**Rules**
- Internal package and module names are neutral (`core`, `bridge`, `app`); never `setu_*`.
- **Check before every commit:** `rg -i "setu" frontend/src backend/app` must return nothing except the default value in the two config files.

### 15.3 Design tokens (theming system)

Three layers so the whole theme changes from one place:

```
palette.css   raw color scales (only file with hex values)
tokens.css    semantic tokens per theme (light, dark, any future theme)
Tailwind/CSS  components use semantic tokens only
```

**`styles/palette.css`** (the only place with hex values)

```css
:root {
  /* Sand: warm neutrals */
  --sand-25:#FFFDF8; --sand-50:#FBF6EE; --sand-100:#F4EBDD; --sand-200:#E9DBC5;
  --sand-300:#D9C7AE; --sand-400:#B9A184; --sand-500:#8F7A62; --sand-600:#6E5A48;
  --sand-700:#4E3E31; --sand-800:#3A2A1E; --sand-900:#2B1D14; --sand-950:#1E1510;

  /* Terracotta: primary */
  --terracotta-100:#FBE3D2; --terracotta-300:#F0A878; --terracotta-500:#D9662B;
  --terracotta-600:#B34A12; --terracotta-700:#963C0C; --terracotta-800:#6F2C08;

  /* Amber: review / attention */
  --amber-100:#FCEFC7; --amber-300:#F2C55C; --amber-500:#E0A030;
  --amber-600:#B7791F; --amber-700:#8A5A14;

  /* Olive: safe / verified */
  --olive-100:#E3EBD6; --olive-300:#A9C08A; --olive-500:#6E9450;
  --olive-600:#4E7A3A; --olive-700:#3B5E2C;

  /* Brick: blocked / error */
  --brick-100:#F6D9D3; --brick-300:#E19A8C; --brick-500:#C4503F;
  --brick-600:#A32A1E; --brick-700:#7D1F16;

  /* Plum: ask-back / questions */
  --plum-100:#EEDDE4; --plum-500:#9A5B74; --plum-600:#7B4B5E;
}
```

**`styles/tokens.css`** (semantic; edit this to re-theme)

```css
:root, [data-theme="light"] {
  /* Surfaces */
  --color-bg:            var(--sand-50);
  --color-surface:       var(--sand-25);
  --color-surface-sunken:var(--sand-100);
  --color-border:        var(--sand-200);
  --color-border-strong: var(--sand-300);

  /* Text */
  --color-text:          var(--sand-900);
  --color-text-muted:    var(--sand-600);
  --color-text-inverse:  var(--sand-25);

  /* Brand / actions */
  --color-primary:       var(--terracotta-600);
  --color-primary-hover: var(--terracotta-700);
  --color-on-primary:    var(--sand-25);
  --color-accent:        var(--amber-500);
  --color-focus-ring:    var(--terracotta-500);

  /* Status */
  --color-safe:   var(--olive-600);
  --color-review: var(--amber-600);
  --color-block:  var(--brick-600);
  --color-ask:    var(--plum-600);

  /* Domain: extracted spans in source text */
  --span-tag:   var(--terracotta-600);
  --span-state: var(--olive-600);
  --span-time:  var(--amber-600);
  --span-qty:   var(--sand-600);
  --span-cause: var(--brick-600);

  /* Domain: schedule visuals */
  --gantt-planned:   var(--sand-300);
  --gantt-actual:    var(--terracotta-600);
  --gantt-uncertain: var(--terracotta-300);
  --heat-0: var(--amber-100);  --heat-1: var(--amber-300);
  --heat-2: var(--terracotta-300); --heat-3: var(--terracotta-600); --heat-4: var(--brick-600);

  /* Diff */
  --diff-remove: var(--brick-600);
  --diff-add:    var(--olive-600);

  /* Shape, elevation, type */
  --radius-sm: 6px; --radius-md: 10px; --radius-lg: 16px; --radius-pill: 999px;
  --shadow-color: 43 29 20;                          /* rgb of warm ink */
  --shadow-1: 0 1px 2px rgb(var(--shadow-color) / .08);
  --shadow-2: 0 4px 14px rgb(var(--shadow-color) / .10);
  --font-sans: "IBM Plex Sans", system-ui, sans-serif;
  --font-mono: "IBM Plex Mono", ui-monospace, monospace;
  --font-display: var(--font-sans);                  /* swap to a serif here if desired */
}

/* Soft status backgrounds are computed, so retheming needs no extra tokens */
:root, [data-theme] {
  --color-primary-soft: color-mix(in srgb, var(--color-primary) 12%, var(--color-surface));
  --color-safe-soft:    color-mix(in srgb, var(--color-safe)    14%, var(--color-surface));
  --color-review-soft:  color-mix(in srgb, var(--color-review)  16%, var(--color-surface));
  --color-block-soft:   color-mix(in srgb, var(--color-block)   14%, var(--color-surface));
  --color-ask-soft:     color-mix(in srgb, var(--color-ask)     14%, var(--color-surface));
}

[data-theme="dark"] {
  --color-bg:            var(--sand-950);
  --color-surface:       var(--sand-900);
  --color-surface-sunken:var(--sand-800);
  --color-border:        var(--sand-700);
  --color-border-strong: var(--sand-600);
  --color-text:          var(--sand-100);
  --color-text-muted:    var(--sand-400);
  --color-text-inverse:  var(--sand-950);
  --color-primary:       var(--terracotta-500);
  --color-primary-hover: var(--terracotta-300);
  --color-on-primary:    var(--sand-950);
  --color-safe:   var(--olive-300);
  --color-review: var(--amber-300);
  --color-block:  var(--brick-300);
  --color-ask:    var(--plum-500);
  --gantt-planned: var(--sand-600);
  --diff-remove: var(--brick-300); --diff-add: var(--olive-300);
  --shadow-color: 0 0 0;
}
```

**Tailwind mapping (`tailwind.config.ts`)**

```ts
export default {
  theme: { extend: {
    colors: {
      bg: "var(--color-bg)", surface: "var(--color-surface)",
      sunken: "var(--color-surface-sunken)", border: "var(--color-border)",
      text: "var(--color-text)", muted: "var(--color-text-muted)",
      primary: "var(--color-primary)", "primary-soft": "var(--color-primary-soft)",
      safe: "var(--color-safe)", "safe-soft": "var(--color-safe-soft)",
      review: "var(--color-review)", "review-soft": "var(--color-review-soft)",
      block: "var(--color-block)", "block-soft": "var(--color-block-soft)",
      ask: "var(--color-ask)", "ask-soft": "var(--color-ask-soft)",
    },
    borderRadius: { sm:"var(--radius-sm)", md:"var(--radius-md)", lg:"var(--radius-lg)" },
    boxShadow: { 1:"var(--shadow-1)", 2:"var(--shadow-2)" },
    fontFamily: { sans:"var(--font-sans)", mono:"var(--font-mono)", display:"var(--font-display)" },
  }},
};
```

**Theming rules**
- No hex, rgb or named colors in components. Check: `rg "#[0-9A-Fa-f]{3,8}\b" frontend/src --glob '!**/styles/palette.css'` returns nothing.
- Charts and SVG read tokens via a helper: `const token = (n:string)=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();`
- To restyle the entire app: edit `palette.css` (new colors) or add a `[data-theme="name"]` block in `tokens.css`. Switch with `document.documentElement.dataset.theme = "name"`.
- The contrast pairs above were estimated by hand; verify body text, status text and button text with a contrast checker before finalising.

### 15.4 Typography

| Role | Font (via variable) | Use |
|---|---|---|
| UI and body | IBM Plex Sans | Text, labels, buttons |
| Machine text | IBM Plex Mono | Tags (`P-201`), activity IDs (`L6-421`), dates, quantities |
| Display (optional) | `--font-display` (default = sans) | Headings; swap for a warm serif if desired |

Type scale (rem): 0.75 caption, 0.875 small, 1 body, 1.125 lead, 1.375 h3, 1.75 h2, 2.25 h1. Line-height 1.5 body, 1.25 headings. Load fonts with `next/font` so they can be swapped in one file.

### 15.5 Spacing, shape and motion

- **Spacing:** 4px base scale (4, 8, 12, 16, 24, 32, 48).
- **Radius:** small chips 6px, cards 10px, panels 16px, pills fully round.
- **Elevation:** at most two levels (`shadow-1` cards, `shadow-2` popovers); prefer borders to shadows.
- **Icons:** Lucide, 1.5px stroke, always paired with text for status.
- **Motion:** 150-250 ms ease-out. The compiler fan-out animates children with an 80 ms stagger. Interval narrowing animates the soft edge shrinking. Respect `prefers-reduced-motion` (show the final state).

### 15.6 Signature components (each maps to a USP or scene)

| Component | Purpose | Notes |
|---|---|---|
| **SourceText** | Report text with highlighted spans | Span colors from `--span-*`; hover shows type; each span also has an underline style so color is not the only cue |
| **ScoreBars** | Top-3 link candidates | Horizontal bars, winner emphasised, expandable breakdown, runner-up reason |
| **FanOut** (USP 1) | One statement → several activities | SVG; source node left, activity rows right with status pills; staged animation |
| **RuleChecklist** (USP 2) | ✓ / ⚠ / ✕ per check with reason | Icon + text + token color |
| **TierBadge** | auto / confirm / planner / blocked | Pill with icon; tokens `safe/review/ask/block` |
| **PatchCard** (USP 2) | Before/after diff with evidence chips, Apply/Review/Undo | Diff lines use `--diff-*`; evidence chips open provenance |
| **ConflictCard** | Two or more sources disagree → resolved state | Side-by-side sources, resolution line, dissent listed |
| **GanttBar** | Planned vs actual, soft-edged uncertainty | See snippet below |
| **GhostRow** (USP 3) | Activity with claimed progress but missing evidence | Dashed outline, plum "ask" accent |
| **AskBackCard** (USP 3) | One question with tap answers and before/after candidate distribution | Plum accent |
| **DelayChain** | Root delay → downstream → "+N days" | Heat tokens `--heat-0..4` |
| **ImportSummaryCard** | Counts after import | Big numerals in mono |
| **MemoryTable** | Historical planned vs actual, median warning | Sample size always shown |
| **ProvenanceDrawer** | "Why do we believe this?" | Source → extraction → match → checks → approver |
| **BrandMark** | Product name/logo text | Reads `BRAND.name` only |

**Soft-edged Gantt bar (SVG)**

```tsx
// interval: start [s0, s1] (earliest, latest), finish [f0, f1]
// solid between s1 and f0; fade in over [s0, s1] and fade out over [f0, f1]
<defs>
  <linearGradient id="fadeIn"  x1="0" x2="1">
    <stop offset="0" style={{ stopColor: "var(--gantt-actual)", stopOpacity: 0 }} />
    <stop offset="1" style={{ stopColor: "var(--gantt-actual)", stopOpacity: 1 }} />
  </linearGradient>
  <linearGradient id="fadeOut" x1="0" x2="1">
    <stop offset="0" style={{ stopColor: "var(--gantt-actual)", stopOpacity: 1 }} />
    <stop offset="1" style={{ stopColor: "var(--gantt-actual)", stopOpacity: 0 }} />
  </linearGradient>
</defs>
<rect x={x(s0)} width={x(s1)-x(s0)} height={h} fill="url(#fadeIn)" />
<rect x={x(s1)} width={x(f0)-x(s1)} height={h} fill="var(--gantt-actual)" />
<rect x={x(f0)} width={x(f1)-x(f0)} height={h} fill="url(#fadeOut)" />
```

Wide intervals look blurry; confirmed times look sharp.

### 15.7 Screens and layout

**Main workspace (the P-201 story on one screen, desktop)**

```
┌───────────────────────────────────────────────────────────────────────┐
│ [BrandMark]   Project: Compressor Station U2      [theme] [import]    │
├───────────────┬───────────────────────────────────┬───────────────────┤
│ SOURCES       │ COMPILER + VERIFY                 │ SCHEDULE          │
│ • Chat        │ SourceText (colored spans)        │ Gantt (soft edges)│
│ • DPR text    │ ScoreBars                         │ Delay chain       │
│ • Excel       │ FanOut → activity rows            │ +N days           │
│               │ ConflictCard                      │ Evidence coverage │
│ [message box] │ RuleChecklist + TierBadge         │ AskBackCard       │
│               │ PatchCard [Apply][Review][Undo]   │ MemoryTable       │
└───────────────┴───────────────────────────────────┴───────────────────┘
```

**Other screens**
1. **Import:** drop zone, then ImportSummaryCard, then the graph preview.
2. **Workspace:** above (default after import).
3. **Review queue:** unmatched items, suspicious patches, planner approvals.
4. **Schedule:** full Gantt with uncertainty and critical path.
5. **Insights:** evidence coverage by discipline, memory table, actuals queries (kept light).

**Mobile (chat-first):** single column: message box, extracted-events confirmation card (large tap targets: Confirm / Edit), then the patch summary.

### 15.8 States, accessibility and microcopy

- **States for every component:** empty, loading (skeleton, not spinner), success, error, conflict, offline (roadmap).
- **Accessibility:** status is never color-only (icon + text); focus ring uses `--color-focus-ring`; keyboard reachable Apply/Review; minimum 44px tap targets in the chat UI; respect reduced motion; verify contrast.
- **Voice of the UI:** plain engineer language; short; no hype. Examples: "3 activities updated, 1 blocked." "Predecessor NDT-221 has no completion evidence." "Suspicious, needs a look." "Ask: has the valve arrived?"
- **Numbers:** monospace, aligned, with units; intervals shown as `17:00-21:00`.

### 15.9 Frontend structure

```
frontend/src/
  config/brand.ts
  styles/palette.css   styles/tokens.css   styles/globals.css
  lib/token.ts         (read CSS variables for charts)
  components/
    BrandMark  SourceText  ScoreBars  FanOut  RuleChecklist  TierBadge
    PatchCard  ConflictCard  GanttBar  GhostRow  AskBackCard  DelayChain
    ImportSummaryCard  MemoryTable  ProvenanceDrawer
  app/                 (import, workspace, review, schedule, insights)
```

---

## 16. Feasibility (with proof, not labels)

| Claim | How the prototype proves it |
|---|---|
| Extraction is reliable enough | Counts on the labelled set; tags come from rules, so they are exact |
| Granularity mismatch can be handled | Compiler results on 1:N, N:1 and no-match cases (counts) |
| Look-alike traps do not fool linking | Result on the 5 adversarial cases |
| Bad updates are stopped | Rule catch counts on injected errors; false flags on clean cases |
| Time uncertainty works | Interval contains the true time on the vague-time cases |
| Missing evidence is detectable | Silent Progress fires on the injected unreported-predecessor case |
| Product-like ingestion | Importer summary card on a 240-activity schedule |
| Delay impact is computable | CPM on the imported graph (FS links, no calendars) |
| Memory is usable | Historical-actuals warning appears on a new plan |

**Other feasibility dimensions**
- **Operational:** chat and tap-to-confirm need little training; planners keep control through the approval queue; contractors keep their templates through column mapping.
- **Economic:** low prototype cost; production value measured by a shadow-mode pilot before any purchase decision.
- **Security:** on-prem and local-LLM option, role-based access, append-only audit.
- **Schedule:** the three-phase plan gives a working, submittable system at 4, 6.75 and 9 hours.
- **Hard parts (honest):** live P6 write-back, calendars, OCR of handwritten diaries and noisy-site voice need pilot work and are roadmap.

---

## 17. Viability and business case

- **Customer:** operators running large capital projects (Oil India first), then EPC contractors and other Primavera/MSP users.
- **Pilot first:** one Oil India project, two disciplines (piping, civil), shadow mode; the pilot measures reconciliation effort, reporting lag and error rates that a purchase decision needs.
- **Revenue (brief):** per-project or per-site licence, integration services, and a cross-project memory subscription whose value grows with data.
- **Moat:** compile-and-verify architecture, domain logic, provenance for audit-heavy operators, accumulating memory, on-prem option.
- **Value formula (fill with pilot data, no ROI quoted):** planner hours saved + delay cost avoided by earlier detection + reduced dispute effort + better baselines.

---

## 18. Adoption strategy

**Give supervisors value back first.** Auto-generated DPR text from the same chat message is the strongest adoption lever: they type a few lines and get the report their contractor must submit anyway.

| Barrier | Answer |
|---|---|
| "Another form" | No forms: type naturally in English or Hindi-English |
| "No benefit to me" | Auto-DPR and shift-handover text |
| "Too many questions" | One or two ranked questions a day |
| "Blame" | Reliability scored for channels, not people; scope changes separated from execution delay |
| "Poor network" | Offline queue (roadmap) with timestamps preserved |

**Trust ladder (rollout)**

| Stage | Mode | Exit criterion |
|---|---|---|
| 0 | **Shadow:** runs alongside manual updates; compare | Extraction/linking meets agreed targets |
| 1 | **Assisted:** planners accept patches from a queue | High acceptance, falling review load |
| 2 | **Gated auto:** low-risk updates apply automatically | Auto-applied error rate under agreed limit |
| 3 | **Continuous:** proactive questions, cross-project memory | KPIs below improve |

Start with one project and champion supervisors; keep contractors' existing templates working; add data-submission language at the next contract cycle.

---

## 19. Impact: three KPIs

| KPI | What it measures | Prototype evidence |
|---|---|---|
| **Reality Lag** | Time from physical event to schedule update | Measured on scripted inputs: manual path vs SETU path (labelled prototype measurement) |
| **Evidence coverage** | Share of claimed progress backed by evidence | Evidence-backed vs claimed completion by discipline |
| **Planner review load** | Share of updates needing planner attention | Auto / confirm / planner counts from the approval tiers |

Broader benefits (trust, delay decisions, claim traceability, retained knowledge, planning realism) support these three. No percentage savings are claimed before a shadow-mode baseline exists.

---

## 20. Top risks and honest limits

| Risk | Mitigation |
|---|---|
| **Wrong updates reach the schedule** | Rule checks, approval tiers, undo, shadow mode first, counts reported per category |
| **Synthetic results may not transfer to real sites** | Say so plainly; hold out cases; adversarial look-alikes; pilot in shadow mode before any automation |
| **Adoption resistance** | Auto-DPR payoff, chat-first, existing templates kept, channel-level (not person-level) scoring |

**Other limits we state openly**
- **Noisy sites defeat voice.** Compressor and rig areas are very loud, so ASR will degrade badly. Chat and tap-to-confirm are primary. Voice, if added, is dictated from a quieter place or after the task, uses push-to-talk with a close-talk noise-cancelling microphone, always shows the transcript for confirmation, and never drives a decision without a tap.
- CPM is simplified (no calendars, FS links).
- Field sequences differ from plans, so rules say "suspicious", not "wrong".
- Calibration claims are not made from a 42-case set.
- We do not claim field-validated accuracy, a specific ROI, or production-grade OCR/ASR.

Full risk table in Appendix O.

---

## 21. Research foundation

**Positioning.** Research and products already address report-to-schedule matching, constraint-based schedule validation and probabilistic scheduling. Our contribution is the **integrated, safety-gated pipeline**: granularity-aware compilation, interval-valued actuals, schedule-to-field reasoning, gated updates and a memory loop. State the overlap plainly on the slide.

**Foundations (open and confirm each before citing)**

| Design element | Foundation |
|---|---|
| Critical path, float, delay impact | Critical Path Method (Kelley and Walker, 1959); scheduling texts; P6 documentation |
| Progress weighting, earned value | Earned value practice; company progress-measurement procedures |
| Plan reliability | Last Planner System (Ballard); Percent Plan Complete |
| Vague time as intervals | Allen's interval algebra (1983); temporal reasoning |
| Question selection | Entropy and information gain (Shannon); active learning |
| Retrieval | BM25; Sentence-BERT (Reimers and Gurevych, 2019) |
| Speech | Whisper (Radford et al., 2022) and noise-robust ASR |
| Tamper evidence | Hash chains, append-only logs |
| Integration | Primavera XER, P6 web services/REST, scheduling options (Retained Logic, Progress Override, Actual Dates) |
| Calibration (production direction) | Platt scaling, isotonic regression, Guo et al. (2017) |

**Recent related work: your homework (do not cite what you have not opened)**

Search and read a few papers on: automated schedule updating from daily reports; NLP extraction from construction daily reports; semantic matching of progress reports to schedule activities; neuro-symbolic or constraint-based schedule reasoning; implicit dependency constraints in construction scheduling; causal analysis of construction delays; lessons-learned retrieval in construction. For each, note (1) what it does, (2) what overlaps with SETU, (3) what SETU adds. Put a two-column "Exists / SETU adds" table on the Research slide.

---

## 22. SIH slide content

Visual-first slides: headline, minimal on-slide text, a visual, and speaker notes. The evaluator should remember three things: **Compile, Verify, the schedule asks back.**

### Slide 1: Idea

**Headline:** *The plan knows activities. The field speaks in reality. Nobody reliably connects them.*

**On the slide**
- Left/right visual: field phrases ("spool erected", "pump fitted", Excel %, site diary, chat) → Primavera IDs ("Erect 24"-P-112", L6-421).
- Center: **SETU turns messy site reports into verified L5/L6 schedule updates, and detects the progress that was never reported.**
- Three icons: **Compile reality** (1:N / N:1 / no-match), **Verify before write** (AI proposes, rules decide), **The schedule asks back** (missing evidence).
- Small line: "Gaps today: manual reconciliation, similarity-only matching, no safe write layer, no learning loop."

**Notes:** open with the spool example; say plainly that extraction and matching exist elsewhere and our differences are the three above.

### Slide 2: Technical architecture

**Headline:** *AI proposes. Rules decide. Every change is explained.*

**On the slide**
- Flow: `CAPTURE → UNDERSTAND → COMPILE → VERIFY → LEARN`
- Under it, a lean stack strip: Next.js · FastAPI · SQLite · NetworkX · LLM (cached, on-prem option)
- Callout: `Rule checks: dates · area · predecessor evidence · backward progress` → `auto / confirm / planner / blocked`
- LIVE vs ROADMAP strip (Section 12).
- Proof line: "42 labelled cases: x correct, x/5 invalid updates caught" (only measured numbers).

**Notes:** the LLM proposes; deterministic checks decide; everything is cached for a reliable demo.

### Slide 3: Feasibility and viability

**Headline:** *Provable in a prototype, safe to roll out, valuable to Oil India.*

**On the slide (three columns)**
- **Feasible:** importer summary card on a 240-activity schedule; compiler and rule counts on a labelled set; delay impact on the imported graph.
- **Adoptable:** supervisors get their DPR back from one chat message; rollout Shadow → Assisted → Gated auto.
- **Viable:** pilot on one Oil India project with two disciplines; licence plus integration; memory value grows per project.
- Top 3 risks with mitigations: wrong updates, synthetic-to-real transfer, adoption.

**Notes:** SWOT is in the appendix (use only if asked). Mention noisy-site voice limitation as a design choice.

### Slide 4: Impact and benefits

**Headline:** *Faster, more trustworthy actuals, and knowledge that survives the project.*

**On the slide**
- Three big KPIs: **Reality Lag** · **Evidence coverage** · **Planner review load**
- Before/after strip: event → report → planner → schedule (days) versus event → confirm → verified update (minutes), labelled "prototype measurement".
- One line: "Historical actuals warn that a 5-day plan usually takes 7."

**Notes:** do not quote percentage savings; targets are set after the shadow phase.

### Slide 5: Research

**Headline:** *Built on established methods; new in the integration.*

**On the slide**
- Table "Exists / SETU adds": report extraction and matching / granularity-aware compilation; constraint checks / gated writes with risk tiers; analytics on actuals / schedule-to-field missing-evidence reasoning.
- Foundations strip: CPM · earned value · Last Planner · interval reasoning · information gain · BM25/SBERT.

**Notes:** cite only papers you have read.

### Optional slides (if the template allows)
- **Demo and proof:** one screenshot of the P-201 workspace and the measured-counts panel.
- **Roadmap:** phase after the hackathon (pilot, P6 connector, voice for quiet zones, calendars, fingerprints).

---

## 23. Demo storyboard (5 scenes, about 3 minutes)

One continuous story, the P-201 statement. Avoid raw JSON unless needed for proof.

| Time | Scene | On screen |
|---|---|---|
| 0:00-0:20 | **Import** | Drop `project_schedule.xer`; summary card "246 activities, 312 relationships, critical path detected" |
| 0:20-0:50 | **1 Understand** | P-201 message; colour-coded spans; three events, cause "valve unavailable"; time intervals |
| 0:50-1:20 | **2 Compile** | Fan-out to L6-421 ✓, L6-422 ✓, L6-424 ⚠ (20-25 s); "grouting" flagged as new work |
| 1:20-1:45 | **3 Contradiction** | Excel says 100%; conflict card resolves to PARTIAL |
| 1:45-2:15 | **4 Verify and patch** | Rule checklist; tier badges; diff card; Apply; Undo; provenance drawer |
| 2:15-2:50 | **5 Reason forward** | Valve → discharge → hydrotest → commissioning → +N days; ghost row for the unreported predecessor; ask-back card; final line "Next question: has the valve arrived?" |
| 2:50-3:10 | **Proof** | Measured counts; live-vs-roadmap strip |

If only Phase 1 is finished, record Import through Verify and patch. If Phase 2, add Contradiction and the ask-back.

---

## 24. "Isn't this already done?" Q&A preparation

**Q: Extraction and matching already exist. What is new?**
A: Yes, and we build on that. Similarity matching maps one report to one activity. The PS says field work is finer than the plan, so we compile one-to-many and many-to-one, and flag work with no node.

**Q: Why not let the LLM update Primavera directly?**
A: Because one wrong update silently corrupts the plan. The LLM only proposes; deterministic rule checks and risk-based approval decide, and every update is a reviewable diff with undo.

**Q: How accurate is it?**
A: On our 42 labelled cases, x correct at top-1, and y of 5 invalid updates caught. This is synthetic data with held-out cases and look-alike traps. Real-data accuracy is what the shadow-mode pilot measures.

**Q: Your data is synthetic. Why trust it?**
A: The PS provides no live data. We used industrial vocabulary, an importable XER, and adversarial cases. We claim measured counts, not field-validated accuracy.

**Q: What if the field sequence differs from the plan?**
A: Rules say "suspicious, needs review", never "wrong". Those flags are useful data about real sequencing.

**Q: Voice on a noisy site?**
A: We do not depend on it. Chat and tap-to-confirm are primary; voice is roadmap with push-to-talk, close-talk mics and transcript confirmation.

**Q: How does it connect to Primavera?**
A: The prototype imports XER/CSV and exports updated actuals. A production connector targets Primavera's supported interfaces, starting read-only in shadow mode.

**Q: Why would supervisors use it?**
A: One chat message produces their DPR and handover note, so reporting gets easier, not heavier.

**Q: What is live and what is roadmap?**
A: Section 12's strip; we say it at the start of the demo.

---

## 25. Appendices

### Appendix A: Full pipeline (11 stages)

```
1 Ingest → 2 Extract → 3 Time intervals → 4 Link → 5 Compile → 6 Reconcile sources
→ 7 Rule check → 8 Approval tier → 9 Patch → 10 Output/PMIS export → 11 Learn
Proactive loop: silent progress · evidence gaps · delay impact · top open question
```

### Appendix B: Full data model

```
activities(id, wbs, name, action, object_tag, discipline, area, planned_start, planned_finish,
           predecessors[], is_critical, float, state_template, qty_total, qty_unit)
raw_reports(id, source_type, author_role, discipline, received_at, file_ref)
report_units(id, report_id, text, row_ref)
events(id, unit_id, work_desc, event_type, state, object_tag, quantity, cause, time_phrase)
event_time(event_id, earliest, latest, confidence)
links(id, event_id, activity_id, target_state, score, breakdown, alternatives, status)
new_work_candidates(id, description, event_ids, suggested_parent, suggested_position, status)
actuals_ledger(id, activity_id, field, earliest, latest, confidence, evidence_ids,
               rule_result, approval_tier, patch_id)
schedule_patches(id, diff, status, approver, prev_hash)
audit_log(id, ts, actor, action, payload, prev_hash, hash)
historical_actuals(id, project, activity_class, features, planned_d, actual_d, delay_cause)
proxy_records(id, type, ref, area, discipline, ts)                      -- roadmap
```

### Appendix C: Extraction prompt skeleton

```
SYSTEM: You are the {PRODUCT_NAME} extraction module. Convert construction site report
text into structured events. Return ONLY JSON matching the schema. Do not infer facts
not stated. If time is vague, copy the phrase verbatim into time_phrase. Preserve
technical tags exactly as written. Hindi/Assamese may be mixed with English.
Tags already extracted by rules (do not alter): {rule_tags}
Metadata: date={date}, discipline={disc}, author_role={role}, area={area}

SCHEMA: list of {work_desc, event_type[START|COMPLETE|PROGRESS|BLOCKED|REWORK],
        state_reached, object_tag, quantity, time_phrase, blocked_reason,
        cause_category, source_span}
TEXT: {report_unit_text}
```

### Appendix D: Rule checks (prototype set)

| Rule | If violated |
|---|---|
| Finish before start, or event dated in the future | BLOCKED |
| Reported area differs from the activity's area | SUSPICIOUS |
| Successor progress without predecessor evidence | SUSPICIOUS (also triggers Silent Progress) |
| State moves backward without a rework tag | SUSPICIOUS |
| Roadmap: implausible quantity for crew, shutdown-day date, discipline mismatch, weather advisory | SUSPICIOUS |

Limitation: rules encode the modeled sequence; legitimate overlaps (partial hydrotests) will be flagged for review, not rejected.

### Appendix E: Approval tier policy (example)

| Tier | Condition | Required |
|---|---|---|
| Auto | non-critical, forward change, rules SAFE, agreeing sources | Logged |
| Confirm | non-critical single source or mid score | Tap or second source |
| Planner | critical path, or SUSPICIOUS, or state jump over missing evidence | Approval |
| Blocked | rules BLOCKED | Rejected with reason |

Limitation: thresholds are set by hand for the prototype and tuned on the development split only.

### Appendix F: Interval logic

```
merge(a, b):
    lo = max(a.earliest, b.earliest); hi = min(a.latest, b.latest)
    if lo <= hi: return Interval(lo, hi)
    else:        return Conflict(a, b)            # shown, not silently resolved
pmis_point(interval, policy="midpoint")           # policy logged with the patch
```
Shift lexicon (configurable): morning 06-12, after lunch 13-15, evening 17-21, "around 3" = 14:45-15:15. Limitation: fixed lexicon; unusual phrases fall back to the whole day with low confidence.

### Appendix G: State templates (examples)

```
pump:   POSITIONED(30%) → ALIGNED(25%) → GROUTED(15%) → CONNECTED(20%) → TESTED(10%)
spool:  FABRICATED(30%) → ERECTED(40%) → WELDED(20%) → TESTED(10%)
```
A claim of a later state marks earlier states as *inferred complete* (flagged). Backward moves need a rework tag. Weights are illustrative and configurable.

### Appendix H: Top open question (prototype)

`priority = interval_width_hours × 1 / (1 + float_days)` over activities with open or uncertain states. Ask the highest. Limitation: a proxy for value-of-information; the full version runs scenarios over interval endpoints and measures the change in projected finish (roadmap).

### Appendix I: Clarification question (information gain)

For candidate distribution `p` and a question with answers `a`, choose the question minimising expected posterior entropy `E[H(p | a)]`. Show before/after candidate probabilities. Prototype uses one scripted case.

### Appendix J: Delay impact (prototype CPM)

```
forward:  ES = max(EF of predecessors);  EF = ES + duration
backward: LF = min(LS of successors);    LS = LF - duration
float = LS - ES;  critical = (float == 0)
delay impact = max(0, delay - float) along the downstream path; finish shift = increase in final EF
```
Limitations: FS links only, working-day durations, no calendars or resource limits.

### Appendix K: API endpoints (prototype)

```
POST /schedule/import            XER / CSV
POST /ingest/file                DPR text / xlsx
POST /ingest/message             chat message
GET  /events?report_id=          extracted events
GET  /links/{event_id}           candidates, breakdown, alternatives
GET  /patches?status=            pending patches
POST /patches/{id}/accept|edit|reject|undo
GET  /activities/{id}/provenance
GET  /analytics/evidence         claimed vs evidence-backed completion
GET  /analytics/delay-impact
GET  /agent/question             top open question
GET  /memory/historical          historical actuals and median warning
GET  /ledger/query               parameterised actuals queries
GET  /audit/verify               hash-chain integrity
GET  /api/config                 brand (name, tagline) for the frontend
```

### Appendix L: Repository layout

```
repo/
  .env                         # PRODUCT_NAME etc.
  backend/app/
    main.py  config.py         # config.py reads PRODUCT_NAME
    importer.py  ingest.py  extract.py  timeparse.py
    link.py  compiler.py  rules.py  approval.py
    schedule.py  memory.py  analytics.py  audit.py
  backend/data/
    schedule_hot.json  schedule.xer  schedule.csv  filler_gen.py
    inputs/ (dpr.txt, civil.xlsx, chat.json)
    labels.json  historical_actuals.json  llm_cache.json
  backend/eval/run_eval.py
  frontend/src/   (see Section 15.9)
```

### Appendix M: SWOT (backup only)

| Strengths | Weaknesses |
|---|---|
| Compiler for granularity; verify-before-write; interval time; provenance; measured results; phased plan | Synthetic data; small test set; simplified CPM; LLM dependence (mitigated by rules, caching, local model) |
| **Opportunities** | **Threats** |
| Large recurring pain; fits Primavera workflows; memory value grows per project | Incumbents adding features; contractor resistance; security/procurement hurdles; messier real data; one visible wrong update eroding trust |

### Appendix N: Ideas dropped or de-emphasised, and why

| Idea | Reason |
|---|---|
| Vision "verification" of photos | Unreliable; would create false confidence (weak evidence only, roadmap) |
| Geofence/GPS checks | Privacy, poor accuracy in plants, low value |
| Scoring individual supervisors | Ethical/political risk; channel-level only (roadmap) |
| Costed recovery advisor | Would require invented cost/productivity data |
| Calibration and reliability curves as a headline | Not defensible from about 40 cases |
| Hash-chain as a headline | Supporting detail only |
| PPC, source reliability, forecast bands, dependency learner, Self-Healing WBS, P6 mode advisor, EOT packs, workfront readiness | Valuable but steal attention; roadmap |
| Synthetic project *generator* | Replaced by hand-crafted hot schedule plus a small filler script |
| Docker, Redis, Celery, vector DB, offline PWA sync | Integration risk in 10 hours |
| Voice as a primary channel | Noisy industrial sites |
| Branded/trademark-style names for features | Marketing noise |
| Claims of "nobody does this" and stated ROI/accuracy percentages | Unverifiable |

### Appendix O: Full risk table

| Risk | Mitigation |
|---|---|
| LLM extraction errors | Schema validation, rule-extracted tags, rule checks, tiers |
| Wrong auto-updates | Tiers, shadow mode, undo, counts reported |
| Plan-vs-field sequence differences | "Suspicious" not "wrong"; configurable rules |
| Synthetic-to-real transfer | Held-out cases, adversarial traps, pilot |
| Users distrust or game the system | Auto-DPR payoff; channel-level scoring |
| Noisy sites defeat voice | Chat/tap primary; voice roadmap with mitigations |
| Poor connectivity | Offline queue (roadmap) |
| Missing permit/material feeds | Proxy features degrade to "unknown" |
| Scope creep | Uncuttable core; cut order; live-vs-roadmap strip |
| PMIS write-back permissions | Export/read-only first |
| Fragile demo | Cached LLM outputs, live toggle, recorded fallback per phase |

### Appendix P: Production architecture (roadmap)

```
Clients: supervisor app (chat, voice, offline) · planner console · management dashboard
API: FastAPI + role-based access
Services: ingest · extract/time · link/compile · rules/approval · analytics/CPM · memory
Stores: PostgreSQL (+ pgvector) · job queue · object store
Adapters: P6 (XER/REST) · MSP XML · CSV
Models: LLM (cloud or local Llama/Qwen) · faster-whisper · OCR
Deploy: Docker Compose on-prem, read-only PMIS mode first
```

### Appendix Q: Sample inputs and test-case JSON

| Format | Example |
|---|---|
| Chat (P-201 story) | "P-201 fitted yesterday evening. Alignment done this morning, but discharge couldn't happen because the valve hasn't arrived." |
| Free-text piping DPR | "24" disch spool erected @ P-112 unit2, 6 nos welded, 2 RT film pending. crane avail. issue afternoon." |
| Civil spreadsheet row | `Area: U2-B3 \| Activity: Backfill \| Qty: 120 m3 \| Status: Started \| Date: 29/09` |
| Code-mixed chat | "aaj morning me cable tray erection start kiya, MCC-2 ki taraf, 40 m done" |
| Ambiguous | "Line 24 work finished" |
| Unmapped | "Grouting completed for P-201" (no grouting activity) |
| Contradiction | Excel "Pump installation 100%" vs chat "discharge blocked" |
| Rule-breaking | "Hydrotest Line 24 completed" while NDT has no evidence |
| Look-alike trap | "24"-P-121 erected" when only 24"-P-112 is planned in that area |

```json
{
  "input_id": "T-014", "source": "chat", "category": "vague_time", "split": "heldout",
  "report_time": "2026-09-30T08:40:00+05:30",
  "text": "P-201 fitted yesterday evening. Alignment done this morning, but discharge couldn't happen because the valve hasn't arrived.",
  "expected": [
    {"activity": "L6-421", "state": "COMPLETE", "time_from": "2026-09-29T17:00", "time_to": "2026-09-29T21:00"},
    {"activity": "L6-422", "state": "COMPLETE", "time_from": "2026-09-30T06:00", "time_to": "2026-09-30T08:40"},
    {"activity": "L6-424", "state": "BLOCKED", "cause": "material"}
  ]
}
```

### Appendix R: Feedback resolution log

| Feedback point | Where addressed |
|---|---|
| Features already exist elsewhere; sell the combination | Sections 1, 3, 6, 24 |
| Only three flagship USPs | Section 6; everything else in Section 7 |
| Shorten executive summary; four principles; five-stage flow | Sections 1, 4, 5 |
| LIVE / ROADMAP column | Sections 2, 12 |
| Avoid overclaiming "no tool does this" | Section 3 |
| Build a real schedule importer | Sections 10, 12 (Phase 1) |
| Institutional memory live | Sections 12 (Phase 3), 14 |
| Calibration overclaimed | Section 13; dropped as headline (Appendix N) |
| Scope still too large; uncuttable core | Section 12 |
| Synthetic data must look industrial; adversarial cases | Section 11 |
| One continuous demo story, about five scenes | Sections 8, 23 |
| Report absolute counts, held-out cases | Sections 11, 13 |
| Auto-DPR earlier in adoption | Section 18 |
| Three KPIs only | Section 19 |
| SWOT, dropped ideas, data model to appendix; top 3 risks in main | Sections 20, Appendices B, M, N |
| Strengthen research with overlap statement | Section 21 |
| Rewrite PPT visually | Section 22 |
| Bidirectional/silent progress must be early | Phase 2 in Section 12 |
| Noisy-site voice | Section 20 |
| Product name as a variable; theme tokens; design language | Section 15 |

---

*End of document.*
