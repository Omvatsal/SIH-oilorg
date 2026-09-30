"use client";

import { KeyboardEvent, useEffect, useRef, useState } from "react";
import { BRAND } from "../../config/brand";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";
const MAX_FILES = 10;
const MAX_FILE_BYTES = 15 * 1024 * 1024;

type Span = { start: number; end: number; kind: string };
type Interval = { earliest: string; latest: string; confidence: string; phrase?: string | null };
type Event = { id: string; source_id: string; action: string; state: string; object_tag?: string; event_date?: string; cause?: string; quantity?: number; quantity_unit?: string; spans: Span[]; time_interval?: Interval | null };
type Source = { id: string; kind: string; filename?: string | null; text: string; received_at: string };
type Conflict = { activity_id: string; activity_name: string; resolution: string; claims: { source_id: string; state: string; text: string }[] };
type Update = { activity_id: string; activity_name: string; before: string; after: string; time_interval?: Interval | null };
type Rule = { name: string; verdict: string; reason: string };
type Patch = { id: string; status: string; approval_tier: string; updates: Update[]; rules: Rule[] };
type Probability = { candidate: string; probability: number };
type SilentProgress = { predecessor_activity_id: string; predecessor_activity_name: string; successor_activity_id: string; successor_activity_name: string; predecessor_finish_upper_bound?: string | null };
type AskBackQuestion = { id: string; question: string; information_gain_bits: number; candidate_distribution_before: Probability[]; selected_answer?: string | null; candidate_distribution_after: Probability[] };
type QuantityProgress = { activity_id: string; activity_name: string; observed_quantity: number; quantity_unit: string; planned_quantity?: number | null; percent_complete?: number | null };
type Workspace = { report_id: string; source_text: string; sources: Source[]; events: Event[]; patches: Patch[]; unmatched_work: Event[]; conflicts: Conflict[]; time_conflicts: { activity_id?: string | null; activity_name?: string | null; intervals: Interval[] }[]; silent_progress: SilentProgress[]; ask_back_questions: AskBackQuestion[]; quantity_progress: QuantityProgress[] };
type DependencyIssue = { code: string; severity: "ERROR" | "WARNING"; message: string; activity_ids: string[] };
type DependencyNode = { activity_id: string; activity_name: string; predecessor_ids: string[]; successor_ids: string[] };
type DependencyGraph = { node_count: number; edge_count: number; nodes: DependencyNode[]; edges: { predecessor_id: string; successor_id: string; resolved: boolean }[]; topological_order: string[]; issues: DependencyIssue[]; is_acyclic: boolean; is_consistent: boolean };
type PlannedActivity = { id: string; name: string; wbs?: string; discipline?: string; area?: string; planned_start?: string | null; planned_finish?: string | null; predecessors: string[]; object_tag?: string | null; status: string; quantity_total?: number | null; quantity_unit?: string | null };
type Summary = { schedule_id: string; source_format: string; activity_count: number; relationship_count: number; tag_count: number; dependency_graph: DependencyGraph; activities: PlannedActivity[] };
type DraftFile = { key: string; file: File };
type TabId = "schedule" | "actual" | "progress" | "approvals" | "memory" | "settings";
type SpeechRecognitionAlternativeLike = { transcript: string };
type SpeechRecognitionResultLike = { 0: SpeechRecognitionAlternativeLike; isFinal: boolean };
type SpeechRecognitionEventLike = { resultIndex: number; results: ArrayLike<SpeechRecognitionResultLike> };
type SpeechRecognitionErrorLike = { error: string };
type SpeechRecognitionLike = { continuous: boolean; interimResults: boolean; lang: string; onresult: ((event: SpeechRecognitionEventLike) => void) | null; onerror: ((event: SpeechRecognitionErrorLike) => void) | null; onend: (() => void) | null; start(): void; stop(): void; abort(): void };
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;
type SpeechWindow = Window & { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor };

const TABS: { id: TabId; label: string; eyebrow: string }[] = [
  { id: "schedule", label: "Planned schedule", eyebrow: "BASELINE" },
  { id: "actual", label: "Actual work", eyebrow: "FIELD REPORTS" },
  { id: "progress", label: "Progress", eyebrow: "EXECUTION" },
  { id: "approvals", label: "Punch list", eyebrow: "REVIEW QUEUE" },
  { id: "memory", label: "Institutional memory", eyebrow: "LESSONS" },
  { id: "settings", label: "Settings", eyebrow: "PROFILE & SITE" },
];

function NavIcon({ name }: { name: TabId }) {
  const paths: Record<TabId, React.ReactNode> = {
    schedule: <><path d="M5 3.75h9l4 4v12.5H5z" /><path d="M14 3.75v4h4M8 12h7M8 15.5h7" /></>,
    actual: <><path d="M12 3.5a7.5 7.5 0 1 0 7.5 7.5" /><path d="M12 7v5l3.2 2M16.5 3.5h4v4" /></>,
    progress: <><path d="M4 18V6M4 18h16" /><path d="m7 14 3-3 3 2 5-6" /><path d="M15 7h3v3" /></>,
    approvals: <><path d="M6 4.5h12v15H6z" /><path d="m8.5 9 1.5 1.5 2.5-3M14 9h2M8.5 15l1.5 1.5 2.5-3M14 15h2" /></>,
    memory: <><path d="M5 5.5h5l2 2h7v11H5z" /><path d="M8 12h8M8 15h5" /></>,
    settings: <><circle cx="12" cy="12" r="3.5" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.7 2.9-.1-.1a1.7 1.7 0 0 0-1.9-.3l-.1.1h-3.4l-.1-.1a1.7 1.7 0 0 0-1.9.3l-.1.1-1.7-2.9.1-.1a1.7 1.7 0 0 0 .3-1.9l-.1-.1v-3.4l.1-.1a1.7 1.7 0 0 0-.3-1.9l-.1-.1 1.7-2.9.1.1a1.7 1.7 0 0 0 1.9.3l.1-.1h3.4l.1.1a1.7 1.7 0 0 0 1.9-.3l.1-.1 1.7 2.9-.1.1a1.7 1.7 0 0 0-.3 1.9l.1.1v3.4z" /></>,
  };
  return <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
function sourceWithHighlights(text: string, events: Event[]) {
  const spans = events.flatMap(event => event.spans).sort((a, b) => a.start - b.start);
  const nodes: React.ReactNode[] = [];
  let position = 0;
  spans.forEach((span, index) => {
    if (span.start < position) return;
    if (span.start > position) nodes.push(text.slice(position, span.start));
    nodes.push(<mark key={index} title={span.kind}>{text.slice(span.start, span.end)}</mark>);
    position = span.end;
  });
  nodes.push(text.slice(position));
  return nodes;
}

const IST_DATE = new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
const IST_TIME = new Intl.DateTimeFormat("en-IN", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Asia/Kolkata" });

function localMinute(value: string) {
  const parts = IST_TIME.formatToParts(new Date(value));
  const hour = Number(parts.find(part => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find(part => part.type === "minute")?.value ?? 0);
  return hour * 60 + minute;
}

function localDay(value: string) {
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Kolkata" }).format(new Date(value));
}

function TimeWindowView({ events, sources }: { events: Event[]; sources: Source[] }) {
  const timedEvents = events.filter(event => event.time_interval && !Number.isNaN(Date.parse(event.time_interval.earliest)) && !Number.isNaN(Date.parse(event.time_interval.latest)));
  if (!timedEvents.length) return null;
  const sourceNames = new Map(sources.map(source => [source.id, source.filename || (source.kind === "MESSAGE" ? "Supervisor note" : `${source.kind} report`)]));

  return <article className="surface time-evidence-surface">
    <div className="surface-head"><div><span className="micro-label">TIME EVIDENCE</span><h3>Reported work windows</h3><p>Ranges are shown in India Standard Time. A bar is a window, not an exact start time.</p></div><span className="status-chip status-neutral">IST · UTC+05:30</span></div>
    <div className="time-axis" aria-hidden="true"><span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>24:00</span></div>
    <ul className="time-window-list">{timedEvents.map(event => {
      const interval = event.time_interval!;
      const start = localMinute(interval.earliest);
      const finish = localMinute(interval.latest);
      const crossesDay = localDay(interval.earliest) !== localDay(interval.latest);
      const left = crossesDay ? 0 : Math.min(99, start / 1440 * 100);
      const width = crossesDay ? 100 : Math.max(1.5, Math.min(100 - left, (finish - start) / 1440 * 100));
      const source = sourceNames.get(event.source_id) ?? "Field report";
      return <li className="time-window-row" key={event.id}>
        <div className="time-window-heading"><b>{event.object_tag || event.action}</b><span className={`confidence-tag confidence-${interval.confidence.toLowerCase()}`}>{interval.confidence.toLowerCase()} confidence</span></div>
        <div className="time-window-track" role="img" aria-label={`${event.action}: ${IST_DATE.format(new Date(interval.earliest))}, ${IST_TIME.format(new Date(interval.earliest))} to ${IST_DATE.format(new Date(interval.latest))}, ${IST_TIME.format(new Date(interval.latest))}, ${interval.confidence.toLowerCase()} confidence`}>
          <span className={`time-window-band ${crossesDay ? "spans-days" : ""}`} style={{ left: `${left}%`, width: `${width}%` }} />
        </div>
        <div className="time-window-detail"><span>{IST_DATE.format(new Date(interval.earliest))}{crossesDay ? ` – ${IST_DATE.format(new Date(interval.latest))}` : ""}</span><b>{IST_TIME.format(new Date(interval.earliest))} – {IST_TIME.format(new Date(interval.latest))}</b><span>{source}</span></div>
        {interval.phrase && <p className="time-window-phrase">Heard as “{interval.phrase}”</p>}
      </li>;
    })}</ul>
  </article>;
}

function formatSize(size: number) {
  return size < 1024 * 1024 ? `${Math.max(1, Math.round(size / 1024))} KB` : `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function DependencyGraphView({ graph }: { graph: DependencyGraph }) {
  const nodesById = new Map(graph.nodes.map(node => [node.activity_id, node]));
  const ordered = graph.topological_order.length ? graph.topological_order : graph.nodes.map(node => node.activity_id).sort();
  const levels = new Map<string, number>();
  ordered.forEach(id => {
    const parents = (nodesById.get(id)?.predecessor_ids ?? []).map(parent => levels.get(parent)).filter((value): value is number => value !== undefined);
    levels.set(id, parents.length ? Math.max(...parents) + 1 : 0);
  });
  const missing = new Set<string>();
  graph.edges.forEach(edge => { if (!nodesById.has(edge.predecessor_id)) missing.add(edge.predecessor_id); if (!nodesById.has(edge.successor_id)) missing.add(edge.successor_id); });
  [...missing].sort().forEach(id => levels.set(id, 0));
  const ids = [...ordered, ...[...missing].sort()];
  const columns = new Map<number, string[]>();
  ids.forEach(id => { const level = levels.get(id) ?? 0; columns.set(level, [...(columns.get(level) ?? []), id]); });
  const boxWidth = 176, boxHeight = 54, gapX = 220, gapY = 78, pad = 24;
  const maxLevel = Math.max(0, ...columns.keys());
  const maxRows = Math.max(1, ...[...columns.values()].map(items => items.length));
  const width = pad * 2 + maxLevel * gapX + boxWidth;
  const height = pad * 2 + (maxRows - 1) * gapY + boxHeight;
  const positions = new Map<string, { x: number; y: number }>();
  columns.forEach((items, column) => items.forEach((id, row) => positions.set(id, { x: pad + column * gapX, y: pad + row * gapY })));
  return <div className="graph-scroll" role="region" aria-label="Task dependency graph" tabIndex={0}>
    <svg className="graph-svg" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-labelledby="graph-title">
      <title id="graph-title">Task dependencies. Arrows run from prerequisites to dependent tasks.</title>
      <defs><marker id="edge-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="currentColor" /></marker></defs>
      {graph.edges.map((edge, index) => { const a = positions.get(edge.predecessor_id), b = positions.get(edge.successor_id); return a && b ? <line key={`${edge.predecessor_id}-${edge.successor_id}-${index}`} className={`graph-edge ${edge.resolved ? "" : "is-missing"}`} x1={a.x + boxWidth} y1={a.y + boxHeight / 2} x2={b.x} y2={b.y + boxHeight / 2} markerEnd="url(#edge-arrow)" /> : null; })}
      {ids.map(id => { const point = positions.get(id); if (!point) return null; const node = nodesById.get(id); return <g key={id} className={`graph-node ${node ? "" : "is-missing"}`} transform={`translate(${point.x},${point.y})`}><rect width={boxWidth} height={boxHeight} rx="7" /><text className="graph-id" x="11" y="21">{id}</text><text className="graph-name" x="11" y="40">{node?.activity_name.slice(0, 24) ?? "Missing activity"}</text></g>; })}
    </svg>
  </div>;
}

function ProgressBar({ value, label }: { value: number; label: string }) {
  const bounded = Math.max(0, Math.min(100, value));
  return <div className="progress-meter"><div className="meter-track" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(bounded)}><span style={{ width: `${bounded}%` }} /></div><b>{Math.round(bounded)}%</b></div>;
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabId>("schedule");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<DraftFile[]>([]);
  const [fileError, setFileError] = useState("");
  const [reportDate, setReportDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [area, setArea] = useState("Unit-2");
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [scheduleName, setScheduleName] = useState("");
  const [schedulePage, setSchedulePage] = useState(0);
  const [listening, setListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const tabRefs = useRef<Record<TabId, HTMLButtonElement | null>>({ schedule: null, actual: null, progress: null, approvals: null, memory: null, settings: null });

  useEffect(() => {
    const speech = window as SpeechWindow;
    setSpeechSupported(Boolean(speech.SpeechRecognition || speech.webkitSpeechRecognition));
    const requested = new URLSearchParams(window.location.search).get("view") as TabId | null;
    if (requested && TABS.some(tab => tab.id === requested)) setActiveTab(requested);
    const onPopState = () => {
      const view = new URLSearchParams(window.location.search).get("view") as TabId | null;
      if (view && TABS.some(tab => tab.id === view)) setActiveTab(view);
    };
    window.addEventListener("popstate", onPopState);
    return () => { window.removeEventListener("popstate", onPopState); recognitionRef.current?.abort(); };
  }, []);

  useEffect(() => {
    const pageTitle = TABS.find(tab => tab.id === activeTab)?.label ?? "Workspace";
    document.title = `${pageTitle} — ${BRAND.name}`;
  }, [activeTab]);

  function changeTab(tab: TabId) {
    setActiveTab(tab);
    const url = new URL(window.location.href);
    url.searchParams.set("view", tab);
    window.history.pushState({}, "", url);
  }

  function onTabKeyDown(event: KeyboardEvent<HTMLElement>, index: number) {
    let next = index;
    if (event.key === "ArrowDown") next = (index + 1) % TABS.length;
    else if (event.key === "ArrowUp") next = (index - 1 + TABS.length) % TABS.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = TABS.length - 1;
    else return;
    event.preventDefault();
    const tab = TABS[next].id;
    changeTab(tab);
    tabRefs.current[tab]?.focus();
  }

  function toggleVoiceInput() {
    if (listening) { recognitionRef.current?.stop(); setListening(false); return; }
    const speech = window as SpeechWindow;
    const Recognition = speech.SpeechRecognition || speech.webkitSpeechRecognition;
    if (!Recognition) return setError("Voice input is not supported in this browser. Use a recent Chrome or Edge browser.");
    setError("");
    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "en-IN";
    recognition.onresult = event => {
      const finalText = Array.from(event.results).slice(event.resultIndex).filter(item => item.isFinal).map(item => item[0].transcript.trim()).filter(Boolean).join(" ");
      if (finalText) setMessage(current => current.trim() ? `${current.trim()} ${finalText}` : finalText);
    };
    recognition.onerror = event => { setListening(false); if (event.error !== "aborted" && event.error !== "no-speech") setError(event.error === "not-allowed" ? "Microphone access was denied. Allow access in browser settings and try again." : `Voice input failed (${event.error}).`); };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    try { recognition.start(); setListening(true); } catch { setListening(false); setError("Could not start voice input. Check microphone access and try again."); }
  }

  async function importSchedule(file: File) {
    const suffix = file.name.toLowerCase().split(".").pop();
    if (!["csv", "xer"].includes(suffix ?? "")) { setError("Choose a CSV or XER schedule file."); return; }
    if (file.size === 0) { setError("The selected schedule is empty."); return; }
    if (file.size > MAX_FILE_BYTES) { setError("Schedule files must be 15 MB or smaller."); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      const form = new FormData(); form.append("file", file);
      const response = await fetch(`${API}/schedule/import`, { method: "POST", body: form });
      if (!response.ok) throw new Error(response.status === 422 ? "Schedule format is not valid. Check the file and required columns." : `Schedule import failed (${response.status}).`);
      const imported: Summary = await response.json();
      setSummary(imported); setWorkspace(null); setFiles([]); setMessage(""); setScheduleName(file.name); setSchedulePage(0);
      setNotice(`${file.name} loaded · ${imported.activity_count} activities ready for review.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Schedule import failed. Try again."); }
    finally { setBusy(false); }
  }

  function addFiles(fileList: FileList | null) {
    if (!fileList) return;
    const selected = Array.from(fileList);
    const next = [...files];
    const problems: string[] = [];
    for (const file of selected) {
      const extension = file.name.toLowerCase().split(".").pop();
      if (!["txt", "csv", "xlsx"].includes(extension ?? "")) { problems.push(`${file.name}: use TXT, CSV, or XLSX.`); continue; }
      if (file.size === 0) { problems.push(`${file.name}: file is empty.`); continue; }
      if (file.size > MAX_FILE_BYTES) { problems.push(`${file.name}: exceeds the 15 MB limit.`); continue; }
      if (next.length >= MAX_FILES) { problems.push(`You can submit up to ${MAX_FILES} files at a time.`); break; }
      if (next.some(item => item.file.name === file.name && item.file.size === file.size)) { problems.push(`${file.name}: already in the upload list.`); continue; }
      next.push({ key: `${file.name}-${file.size}-${crypto.randomUUID()}`, file });
    }
    setFiles(next);
    setFileError(problems.join(" "));
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeFile(key: string) { setFiles(current => current.filter(item => item.key !== key)); setFileError(""); }

  async function submitActualWork() {
    if (!summary) { setError("Import a planned schedule before submitting actual work."); return; }
    if (!message.trim() && files.length === 0) { setError("Add a voice or written update, or choose at least one report file."); return; }
    setBusy(true); setError(""); setNotice("");
    let activeWorkspace = workspace;
    let completedSources = 0;
    const totalSources = (message.trim() ? 1 : 0) + files.length;
    try {
      if (message.trim()) {
        const response = await fetch(`${API}/ingest/message`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ schedule_id: summary.schedule_id, text: message.trim(), area, received_at: reportDate, ...(activeWorkspace ? { report_id: activeWorkspace.report_id } : {}) }) });
        if (!response.ok) throw new Error(`Text/voice report was not accepted (${response.status}).`);
        activeWorkspace = await response.json(); setWorkspace(activeWorkspace); setMessage(""); completedSources += 1;
      }
      for (const queued of [...files]) {
        const form = new FormData(); form.append("file", queued.file);
        const query = new URLSearchParams({ schedule_id: summary.schedule_id, area, received_at: reportDate, ...(activeWorkspace ? { report_id: activeWorkspace.report_id } : {}) });
        const response = await fetch(`${API}/ingest/file?${query}`, { method: "POST", body: form });
        if (!response.ok) throw new Error(`${queued.file.name} was not accepted (${response.status}).`);
        activeWorkspace = await response.json(); setWorkspace(activeWorkspace); setFiles(current => current.filter(item => item.key !== queued.key)); completedSources += 1;
      }
      if (activeWorkspace) { changeTab("progress"); setNotice(`${completedSources} source${completedSources === 1 ? "" : "s"} submitted and compiled.`); }
    } catch (cause) {
      if (activeWorkspace) setWorkspace(activeWorkspace);
      setError(`${cause instanceof Error ? cause.message : "Submission failed."} ${completedSources ? `${completedSources} of ${totalSources} sources were submitted; remaining files are still queued.` : "Your draft is still available to retry."}`);
    } finally { setBusy(false); }
  }

  async function patchAction(patchId: string, action: "accept" | "reject" | "undo") {
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch(`${API}/patches/${patchId}/${action}`, { method: "POST" });
      if (!response.ok) throw new Error(response.status === 409 ? "The schedule changed or this patch is no longer pending. Reload the report and review it again." : `Could not ${action} this change (${response.status}).`);
      const changed: Patch = await response.json();
      setWorkspace(current => current ? { ...current, patches: current.patches.map(patch => patch.id === changed.id ? changed : patch) } : current);
      if (summary && (action === "accept" || action === "undo")) {
        const statuses = new Map(changed.updates.map(update => [update.activity_id, action === "accept" ? update.after : update.before]));
        setSummary(current => current ? { ...current, activities: current.activities.map(activity => statuses.has(activity.id) ? { ...activity, status: statuses.get(activity.id) ?? activity.status } : activity) } : current);
      }
      setNotice(action === "accept" ? "Schedule changes applied." : action === "reject" ? "Schedule changes rejected." : "Applied schedule changes undone.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Review action failed. Try again."); }
    finally { setBusy(false); }
  }

  async function answerQuestion(questionId: string, answer: "YES" | "NO") {
    if (!workspace) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`${API}/workspace/${workspace.report_id}/questions/${questionId}/answer`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answer }) });
      if (!response.ok) throw new Error(`Could not save clarification (${response.status}).`);
      const updated: AskBackQuestion = await response.json();
      setWorkspace(current => current ? { ...current, ask_back_questions: current.ask_back_questions.map(question => question.id === updated.id ? updated : question) } : current);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save the answer."); }
    finally { setBusy(false); }
  }

  const tabsPending = workspace?.patches[0]?.status === "PENDING" ? workspace.patches[0].updates.length : 0;
  const approvalPendingCount = workspace?.patches[0]?.status === "PENDING" ? 1 : 0;
  const currentPatch = workspace?.patches[0];
  const quantityByActivity = new Map((workspace?.quantity_progress ?? []).map(item => [item.activity_id, item]));
  const proposedCompleted = new Set(currentPatch?.updates.filter(update => update.after === "COMPLETE").map(update => update.activity_id) ?? []);
  const completedCount = summary?.activities.filter(activity => activity.status === "COMPLETE" || proposedCompleted.has(activity.id)).length ?? 0;
  const completionPercent = summary?.activity_count ? completedCount / summary.activity_count * 100 : 0;
  const today = new Date();
  const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const overdueActivities = (summary?.activities ?? []).filter(activity => {
    if (!activity.planned_finish || activity.status === "COMPLETE" || proposedCompleted.has(activity.id)) return false;
    const finish = new Date(`${activity.planned_finish.slice(0, 10)}T00:00:00`);
    return !Number.isNaN(finish.getTime()) && finish < todayDate;
  });
  const maxOverdueDays = overdueActivities.reduce((max, activity) => Math.max(max, Math.floor((todayDate.getTime() - new Date(`${activity.planned_finish?.slice(0, 10)}T00:00:00`).getTime()) / 86400000)), 0);
  const pageSize = 8;
  const pageActivities = (summary?.activities ?? []).slice(schedulePage * pageSize, (schedulePage + 1) * pageSize);
  const issueCount = summary?.dependency_graph.issues.length ?? 0;
  const punchCount = approvalPendingCount + (workspace?.conflicts.length ?? 0) + (workspace?.time_conflicts.length ?? 0) + (workspace?.silent_progress.length ?? 0) + (workspace?.ask_back_questions.filter(question => !question.selected_answer).length ?? 0) + (workspace?.unmatched_work.length ?? 0) + (summary?.dependency_graph.issues.length ?? 0) + overdueActivities.length;

  return <div className="app-frame">
    <aside className="workspace-sidebar">
      <div className="brand-lockup"><div className="brand-mark" aria-hidden="true"><span /><span /><span /></div><div><p className="overline">CONSTRUCTION CONTROL</p><h1>{BRAND.name}<span className="brand-period">.</span></h1></div></div>
      <div className="sidebar-project"><span className="micro-label">ACTIVE PROJECT</span><b>{scheduleName || "No schedule loaded"}</b><small>{summary ? `${summary.activity_count} planned activities` : "Import a baseline to begin"}</small></div>
      <nav className="tab-nav" role="tablist" aria-orientation="vertical" aria-label="Project workspace" onKeyDown={event => { const index = TABS.findIndex(tab => tab.id === activeTab); onTabKeyDown(event, index); }}>
        {TABS.map(tab => <button key={tab.id} ref={element => { tabRefs.current[tab.id] = element; }} id={`tab-${tab.id}`} className={`tab-button ${activeTab === tab.id ? "is-active" : ""}`} role="tab" aria-selected={activeTab === tab.id} aria-controls={`panel-${tab.id}`} tabIndex={activeTab === tab.id ? 0 : -1} onClick={() => changeTab(tab.id)}>
          <NavIcon name={tab.id} /><span className="tab-label">{tab.label}</span>{tab.id === "approvals" && punchCount > 0 && <span className="tab-count" aria-label={`${punchCount} open punch list items`}>{punchCount}</span>}
        </button>)}
      </nav>
      <div className="sidebar-bottom"><div className="sidebar-user"><span className="user-avatar" aria-hidden="true">DP</span><span><b>Demo planner</b><small>Planner · prototype</small></span></div><span className="sidebar-state"><i className="environment-dot" /> Session data resets with API</span></div>
    </aside>

    <main className="workspace-main">
    <header className="masthead"><div><p className="overline">FIELD TO SCHEDULE · RECONCILIATION DESK</p><h2>{TABS.find(tab => tab.id === activeTab)?.label}</h2></div><div className="masthead-meta"><span className="environment-dot" />PROTOTYPE WORKSPACE<span className="meta-divider" />API MEMORY</div></header>

    <section className="page-intro"><div><p className="overline">ONE WORKSPACE · SIX VIEWS</p><h2>Planned work,<br /><em>clearly reconciled.</em></h2></div><p className="intro-copy">Load a baseline, collect site evidence, and resolve open items before schedule changes are applied.</p></section>

    {error && <div className="page-alert alert-error" role="alert"><span className="alert-symbol">!</span><span>{error}</span><button type="button" className="alert-close" aria-label="Dismiss error" onClick={() => setError("")}>×</button></div>}
    {notice && <div className="page-alert alert-success" role="status"><span className="alert-symbol">✓</span><span>{notice}</span><button type="button" className="alert-close" aria-label="Dismiss message" onClick={() => setNotice("")}>×</button></div>}

    <section id="panel-schedule" role="tabpanel" aria-labelledby="tab-schedule" hidden={activeTab !== "schedule"} className="tab-panel">
      <div className="section-heading"><div><p className="overline">BASELINE INPUT</p><h2>Planned schedule</h2><p>Import CSV or XER. Inspect the activities and dependency order before reporting actuals.</p></div><span className="step-stamp">01 / 06</span></div>
      <div className="panel-grid schedule-layout">
        <article className="surface upload-surface">
          <div className="surface-head"><div><span className="micro-label">SCHEDULE FILE</span><h3>Choose a project baseline</h3></div><span className="file-type">CSV · XER</span></div>
          <label className="schedule-drop" htmlFor="schedule-file"><span className="upload-glyph" aria-hidden="true">↑</span><strong>{busy ? "Importing schedule…" : "Select schedule file"}</strong><span>CSV or Primavera XER · up to 15 MB</span><input id="schedule-file" type="file" accept=".csv,.xer" disabled={busy} onChange={event => { const file = event.target.files?.[0]; if (file) void importSchedule(file); event.target.value = ""; }} /></label>
          {scheduleName && <div className="selected-schedule"><span className="file-badge">SCH</span><span className="file-name"><b>{scheduleName}</b><small>Loaded into this workspace</small></span><span className="status-chip status-ready">READY</span></div>}
          {!summary && <div className="empty-inline"><span className="empty-line" />No baseline loaded yet<span className="empty-line" /></div>}
          {summary && <div className="schedule-stats"><div><b>{summary.activity_count}</b><span>activities</span></div><div><b>{summary.relationship_count}</b><span>dependencies</span></div><div><b>{summary.tag_count}</b><span>equipment tags</span></div></div>}
        </article>
        <article className="surface graph-surface">
          <div className="surface-head"><div><span className="micro-label">LOGIC CHECK</span><h3>Dependency map</h3></div>{summary && <span className={`status-chip ${issueCount ? "status-review" : "status-ready"}`}>{issueCount ? `${issueCount} FINDING${issueCount === 1 ? "" : "S"}` : "ORDER VALID"}</span>}</div>
          {summary ? <><p className="surface-caption">Arrows show prerequisite → dependent. Checks missing links, duplicate IDs, cycles, and finish-to-start date overlap.</p><DependencyGraphView graph={summary.dependency_graph} />{summary.dependency_graph.issues.length > 0 && <ul className="issue-list">{summary.dependency_graph.issues.slice(0, 4).map((issue, index) => <li key={`${issue.code}-${index}`}><span className={`issue-dot ${issue.severity === "ERROR" ? "is-error" : "is-warning"}`} /><span><b>{issue.code.replaceAll("_", " ")}</b><small>{issue.message}</small></span></li>)}</ul>}{summary.dependency_graph.topological_order.length > 0 && <details className="order-disclosure"><summary>View topological order</summary><p>{summary.dependency_graph.topological_order.join(" → ")}</p></details>}<p className="prototype-note">Prototype assumption: finish-to-start links; relationship types, calendars, and lag are not modeled.</p></> : <div className="graph-empty"><span className="graph-empty-icon">↗</span><b>Dependency map appears after import</b><small>Schedule logic is checked as soon as a file loads.</small></div>}
        </article>
      </div>
      {summary && <article className="surface schedule-table-surface">
        <div className="surface-head table-heading"><div><span className="micro-label">IMPORTED ACTIVITIES</span><h3>Schedule preview</h3><p>Review imported task names, dates, status, and predecessors.</p></div><span className="table-range">{Math.min(schedulePage * pageSize + 1, summary.activity_count)}–{Math.min((schedulePage + 1) * pageSize, summary.activity_count)} of {summary.activity_count}</span></div>
        <div className="table-scroll"><table><thead><tr><th>Activity ID</th><th>Planned activity</th><th>Area</th><th>Start</th><th>Finish</th><th>Predecessors</th></tr></thead><tbody>{pageActivities.map(activity => <tr key={activity.id}><td className="mono-cell">{activity.id}</td><td><b>{activity.name}</b><small>{activity.discipline || "GENERAL"}{activity.object_tag ? ` · ${activity.object_tag}` : ""}</small></td><td>{activity.area || "—"}</td><td>{activity.planned_start?.slice(0, 10) || "—"}</td><td>{activity.planned_finish?.slice(0, 10) || "—"}</td><td className="mono-cell">{activity.predecessors.length ? activity.predecessors.join(", ") : "—"}</td></tr>)}</tbody></table></div>
        <div className="table-footer"><span>Preview only · original schedule file is not retained by this prototype.</span><div className="pager"><button type="button" className="quiet-button" disabled={schedulePage === 0} onClick={() => setSchedulePage(value => Math.max(0, value - 1))}>Previous</button><span>Page {schedulePage + 1} of {Math.max(1, Math.ceil(summary.activity_count / pageSize))}</span><button type="button" className="quiet-button" disabled={(schedulePage + 1) * pageSize >= summary.activity_count} onClick={() => setSchedulePage(value => value + 1)}>Next</button></div></div>
      </article>}
    </section>

    <section id="panel-actual" role="tabpanel" aria-labelledby="tab-actual" hidden={activeTab !== "actual"} className="tab-panel">
      <div className="section-heading"><div><p className="overline">FIELD EVIDENCE</p><h2>Actual work</h2><p>Collect notes and reports together. Nothing is processed until you submit this batch.</p></div><span className="step-stamp">02 / 06</span></div>
      {!summary && <div className="page-alert alert-info"><span className="alert-symbol">i</span><span>Import a planned schedule before compiling actual work.</span><button type="button" className="text-action" onClick={() => changeTab("schedule")}>Go to schedule →</button></div>}
      <div className="panel-grid actual-layout">
        <article className="surface report-surface">
          <div className="surface-head"><div><span className="micro-label">SUPERVISOR NOTE</span><h3>Voice or written update</h3></div><span className="draft-chip">DRAFT</span></div>
          <div className="form-row"><label htmlFor="report-date">Report date</label><input id="report-date" type="date" value={reportDate} onChange={event => setReportDate(event.target.value)} /></div>
          <div className="form-row"><label htmlFor="report-area">Work area</label><input id="report-area" type="text" value={area} onChange={event => setArea(event.target.value)} /></div>
          <div className="voice-row"><button type="button" className={`voice-button ${listening ? "is-recording" : ""}`} onClick={toggleVoiceInput} disabled={!speechSupported && !listening} aria-pressed={listening}><span className="mic-icon" aria-hidden="true">●</span>{listening ? "Stop recording" : "Record update"}</button><span aria-live="polite">{listening ? "Listening · transcript appears in the note" : speechSupported ? "Speech is transcribed in your browser." : "Voice input needs a supported Chrome or Edge browser."}</span></div>
          <label className="field-label" htmlFor="actual-note">Activity details</label><textarea id="actual-note" value={message} onChange={event => setMessage(event.target.value)} placeholder="Describe the task, equipment tag, quantity, or site condition…" />
          <p className="field-help">Voice transcription and typed notes use the same activity parser.</p>
        </article>
        <article className="surface source-surface">
          <div className="surface-head"><div><span className="micro-label">SUPPORTING DOCUMENTS</span><h3>Add report files</h3></div><span className="file-type">TXT · CSV · XLSX</span></div>
          <p className="surface-caption">Add up to {MAX_FILES} report files to this submission. Each file is parsed as evidence.</p>
          <label htmlFor="actual-files" className={`file-picker ${busy ? "is-disabled" : ""}`}><span className="upload-glyph" aria-hidden="true">＋</span><span><b>Choose report files</b><small>Up to 15 MB each</small></span><input ref={fileInputRef} id="actual-files" type="file" accept=".txt,.csv,.xlsx" multiple disabled={busy} onChange={event => addFiles(event.target.files)} /></label>
          {fileError && <p className="field-error" role="alert">{fileError}</p>}
          {files.length ? <ul className="file-queue" aria-label="Selected reports">{files.map(item => <li key={item.key}><span className="file-badge">{item.file.name.split(".").pop()?.toUpperCase()}</span><span className="file-name"><b>{item.file.name}</b><small>{formatSize(item.file.size)} · queued</small></span><button type="button" className="remove-file" aria-label={`Remove ${item.file.name}`} disabled={busy} onClick={() => removeFile(item.key)}>×</button></li>)}</ul> : <div className="empty-files"><span>▤</span><b>No supporting reports selected</b><small>Selected reports stay queued until you submit.</small></div>}
          <div className="submission-summary"><span>Ready to submit</span><b>{(message.trim() ? 1 : 0) + files.length} source{(message.trim() ? 1 : 0) + files.length === 1 ? "" : "s"}</b></div>
          <button type="button" className="primary-action submit-action" onClick={() => void submitActualWork()} disabled={busy || !summary || (!message.trim() && files.length === 0)}>{busy ? <><span className="spinner" />Submitting sources…</> : "Submit actual work"}<span aria-hidden="true">→</span></button>
          {busy && <div className="indeterminate-track" role="progressbar" aria-label="Submitting actual work"><span /></div>}
          {workspace && <p className="field-help">Adding new sources revises the pending report {workspace.report_id}.</p>}
        </article>
      </div>
    </section>

    <section id="panel-progress" role="tabpanel" aria-labelledby="tab-progress" hidden={activeTab !== "progress"} className="tab-panel">
      <div className="section-heading"><div><p className="overline">EXECUTION SNAPSHOT</p><h2>Progress & schedule exposure</h2><p>Progress reflects completed schedule tasks and quantities in the current report.</p></div><span className="step-stamp">LIVE · SESSION</span></div>
      {!summary && <div className="empty-state surface"><span className="empty-state-mark">01</span><h3>Load a schedule to see project progress</h3><p>The progress view needs a baseline and at least one actual work report.</p><button type="button" className="primary-action" onClick={() => changeTab("schedule")}>Import planned schedule <span>→</span></button></div>}
      {summary && <>
        <div className="metric-row">
          <article className="metric-card completion-card"><span className="micro-label">TASKS REPORTED COMPLETE</span><strong>{completedCount}<small> / {summary.activity_count}</small></strong><ProgressBar value={completionPercent} label="Activities reported complete" /><p>Includes current report evidence and applied schedule states.</p></article>
          <article className="metric-card"><span className="micro-label">OVERDUE TASKS</span><strong>{overdueActivities.length}<small> tasks</small></strong><p>{maxOverdueDays ? `Longest overdue task is ${maxOverdueDays} calendar day${maxOverdueDays === 1 ? "" : "s"} past planned finish.` : "No unfinished tasks are past their planned finish date."}</p></article>
          <article className="metric-card"><span className="micro-label">QUANTITY EVIDENCE</span><strong>{workspace?.quantity_progress.length ?? 0}<small> activities</small></strong><p>Activity quantities extracted from current and prior session reports.</p></article>
        </div>
        {workspace && <TimeWindowView events={workspace.events} sources={workspace.sources} />}
        <div className="page-alert alert-info forecast-note"><span className="alert-symbol">i</span><span><b>Delay forecast unavailable.</b> This prototype flags tasks past their planned finish; it does not estimate a project completion date or critical path delay.</span></div>
        <div className="panel-grid progress-layout">
          <article className="surface execution-surface"><div className="surface-head"><div><span className="micro-label">WORK STATUS</span><h3>Activity completion</h3></div><span className="table-range">{workspace?.events.length ?? 0} extracted events</span></div><div className="progress-list">{summary.activities.slice(0, 14).map(activity => { const qty = quantityByActivity.get(activity.id); const isDone = activity.status === "COMPLETE" || proposedCompleted.has(activity.id); const update = currentPatch?.updates.find(item => item.activity_id === activity.id); return <div className="progress-item" key={activity.id}><div className="progress-item-title"><span className={`task-state-dot ${isDone ? "is-done" : update ? "is-reported" : ""}`} /><span className="mono-cell">{activity.id}</span><b>{activity.name}</b><span className={`status-text ${isDone ? "is-complete" : update ? "is-reported" : ""}`}>{isDone ? "COMPLETE" : update?.after ?? activity.status}</span></div>{qty && <div className="quantity-line"><span>{qty.observed_quantity} {qty.quantity_unit}{qty.planned_quantity != null ? ` of ${qty.planned_quantity}` : ""}</span>{qty.percent_complete != null && <ProgressBar value={qty.percent_complete} label={`Quantity progress for ${activity.name}`} />}</div>}</div>; })}</div>{summary.activities.length > 14 && <p className="prototype-note">Showing first 14 activities. Review the complete schedule on the Planned schedule tab.</p>}</article>
          <article className="surface logic-surface"><div className="surface-head"><div><span className="micro-label">LOGIC HEALTH</span><h3>Dependency health</h3></div><span className={`status-chip ${summary.dependency_graph.is_acyclic ? "status-ready" : "status-error"}`}>{summary.dependency_graph.is_acyclic ? "ACYCLIC" : "CYCLE FOUND"}</span></div><div className="logic-number"><b>{summary.dependency_graph.edge_count}</b><span>dependency links checked</span></div><p>{summary.dependency_graph.issues.length ? `${summary.dependency_graph.issues.length} dependency finding${summary.dependency_graph.issues.length === 1 ? "" : "s"} need attention.` : "No dependency inconsistencies detected in this schedule."}</p><DependencyGraphView graph={summary.dependency_graph} /><button type="button" className="text-action" onClick={() => changeTab("schedule")}>Review baseline and graph →</button></article>
        </div>
      </>}
    </section>

    <section id="panel-approvals" role="tabpanel" aria-labelledby="tab-approvals" hidden={activeTab !== "approvals"} className="tab-panel">
      <div className="section-heading"><div><p className="overline">FIELD QUALITY · LOGIC · APPROVALS</p><h2>Punch list</h2><p>One queue for overdue tasks, schedule logic, conflicting evidence, and changes awaiting human approval.</p></div><span className="step-stamp">{punchCount} OPEN ITEMS</span></div>
      <div className="punch-summary" aria-label="Punch list counts"><div><b>{approvalPendingCount}</b><span>approval waiting</span></div><div><b>{(workspace?.conflicts.length ?? 0) + (workspace?.time_conflicts.length ?? 0) + (workspace?.unmatched_work.length ?? 0)}</b><span>evidence checks</span></div><div><b>{(summary?.dependency_graph.issues.length ?? 0) + overdueActivities.length}</b><span>schedule checks</span></div><div><b>{workspace?.ask_back_questions.filter(question => !question.selected_answer).length ?? 0}</b><span>questions open</span></div></div>
      {summary && <article className="surface punch-schedule-surface"><div className="surface-head"><div><span className="micro-label">SCHEDULE CHECKS</span><h3>Overdue work & dependency findings</h3></div><span className={`status-chip ${overdueActivities.length + issueCount ? "status-review" : "status-ready"}`}>{overdueActivities.length + issueCount} ITEMS</span></div>
        {overdueActivities.map(activity => <div className="finding-card finding-warning" key={`overdue-${activity.id}`}><span className="finding-label">PAST PLANNED FINISH</span><h4>{activity.name}</h4><p>Activity {activity.id} remains {activity.status.toLowerCase()}. Planned finish: {activity.planned_finish?.slice(0, 10)}.</p></div>)}
        {summary.dependency_graph.issues.map((issue, index) => <div className={`finding-card ${issue.severity === "ERROR" ? "finding-error" : "finding-warning"}`} key={`logic-${issue.code}-${index}`}><span className="finding-label">DEPENDENCY · {issue.severity}</span><h4>{issue.code.replaceAll("_", " ")}</h4><p>{issue.message}</p></div>)}
        {!overdueActivities.length && !issueCount && <div className="empty-inline">No overdue tasks or dependency findings in the current baseline.</div>}
      </article>}      {!workspace && <div className="empty-state surface"><span className="empty-state-mark">02</span><h3>Your punch list is clear</h3><p>Submit actual work to surface evidence checks, overdue tasks, and proposed schedule changes.</p><button type="button" className="primary-action" onClick={() => changeTab(summary ? "actual" : "schedule")}>{summary ? "Add actual work" : "Import a schedule"}<span>→</span></button></div>}
      {workspace && <div className="review-layout">
        <article className="surface approval-surface"><div className="surface-head"><div><span className="micro-label">SCHEDULE PATCH</span><h3>Pending human approval</h3><p>Report {workspace.report_id} · {workspace.sources.length} source{workspace.sources.length === 1 ? "" : "s"}</p></div>{currentPatch && <span className={`status-chip ${currentPatch.status === "PENDING" ? "status-review" : currentPatch.status === "ACCEPTED" ? "status-ready" : "status-neutral"}`}>{currentPatch.status}</span>}</div>
          {currentPatch ? <><div className="approval-tier"><span className="tier-mark">{currentPatch.approval_tier === "BLOCKED" ? "!" : "✓"}</span><span><b>{currentPatch.approval_tier} REVIEW</b><small>{currentPatch.rules.filter(rule => rule.verdict !== "SAFE").length} checks need attention · {currentPatch.updates.length} proposed changes</small></span></div>
            {currentPatch.updates.length ? <div className="change-list">{currentPatch.updates.map(update => <div className="change-row" key={update.activity_id}><span className="mono-cell">{update.activity_id}</span><span><b>{update.activity_name}</b><small>{update.before} → {update.after}</small></span><span className={`change-state ${update.after === "BLOCKED" || update.after === "PARTIAL" ? "is-warning" : ""}`}>{update.after}</span></div>)}</div> : <div className="empty-inline">No schedule changes were proposed.</div>}
            {currentPatch.rules.map((rule, index) => <div className={`rule-row rule-${rule.verdict.toLowerCase()}`} key={`${rule.name}-${index}`}><span>{rule.verdict === "SAFE" ? "✓" : "!"}</span><span><b>{rule.name}</b><small>{rule.reason}</small></span></div>)}
            <div className="approval-actions"><button type="button" className="primary-action" disabled={busy || currentPatch.status !== "PENDING" || currentPatch.approval_tier === "BLOCKED" || currentPatch.updates.length === 0} onClick={() => void patchAction(currentPatch.id, "accept")}>{busy ? "Saving…" : "Approve & apply"}<span>→</span></button><button type="button" className="quiet-button danger-action" disabled={busy || currentPatch.status !== "PENDING"} onClick={() => void patchAction(currentPatch.id, "reject")}>Reject changes</button><button type="button" className="quiet-button" disabled={busy || currentPatch.status !== "ACCEPTED"} onClick={() => void patchAction(currentPatch.id, "undo")}>Undo applied changes</button></div>
          </> : <div className="empty-inline">No patch is available.</div>}
        </article>
        <article className="surface findings-surface"><div className="surface-head"><div><span className="micro-label">EVIDENCE REVIEW</span><h3>Conflicts & open questions</h3></div><span className="status-chip status-neutral">{workspace.conflicts.length + workspace.time_conflicts.length + workspace.silent_progress.length + workspace.unmatched_work.length} ITEMS</span></div>
          {workspace.conflicts.length + workspace.time_conflicts.length + workspace.silent_progress.length + workspace.unmatched_work.length === 0 && <div className="empty-inline">No evidence conflicts or open questions in this report.</div>}
          {workspace.conflicts.map(conflict => <div className="finding-card finding-warning" key={conflict.activity_id}><span className="finding-label">CLAIM CONFLICT · {conflict.resolution}</span><h4>{conflict.activity_name}</h4>{conflict.claims.map((claim, index) => <p key={`${claim.source_id}-${index}`}><b>{claim.state}</b> — {claim.text}</p>)}</div>)}
          {workspace.time_conflicts.map((conflict, index) => <div className="finding-card finding-warning" key={`time-${index}`}><span className="finding-label">TIME CONFLICT</span><h4>{conflict.activity_name || conflict.activity_id || "Reported work"}</h4><p>Evidence has incompatible time bounds; planner review is required.</p></div>)}
          {workspace.silent_progress.map((finding, index) => <div className="finding-card finding-info" key={`silent-${index}`}><span className="finding-label">SILENT PROGRESS</span><h4>{finding.successor_activity_name}</h4><p>No report evidence for prerequisite {finding.predecessor_activity_name}.</p>{finding.predecessor_finish_upper_bound && <small>Predecessor finish bound: {new Date(finding.predecessor_finish_upper_bound).toLocaleString()}</small>}</div>)}
          {workspace.ask_back_questions.map(question => <div className="finding-card finding-info" key={question.id}><span className="finding-label">CLARIFICATION · {question.information_gain_bits} BIT INFORMATION GAIN</span><h4>{question.question}</h4><p>Before: {question.candidate_distribution_before.map(item => `${item.candidate.replaceAll("_", " ")} ${Math.round(item.probability * 100)}%`).join(" · ")}</p>{question.selected_answer ? <p><b>Answer {question.selected_answer}.</b> After: {question.candidate_distribution_after.map(item => `${item.candidate.replaceAll("_", " ")} ${Math.round(item.probability * 100)}%`).join(" · ")}</p> : <div className="button-row"><button type="button" className="quiet-button" disabled={busy} onClick={() => void answerQuestion(question.id, "YES")}>Yes, completed</button><button type="button" className="quiet-button" disabled={busy} onClick={() => void answerQuestion(question.id, "NO")}>No</button></div>}</div>)}
          {workspace.unmatched_work.map(event => <div className="finding-card finding-error" key={event.id}><span className="finding-label">UNMATCHED WORK</span><h4>{event.object_tag || "No equipment tag"} · {event.action}</h4><p>This event could not be linked to a planned activity.</p></div>)}
        </article>
      </div>}
    </section>

    <section id="panel-memory" role="tabpanel" aria-labelledby="tab-memory" hidden={activeTab !== "memory"} className="tab-panel">
      <div className="section-heading"><div><p className="overline">PROJECT KNOWLEDGE</p><h2>Institutional memory</h2><p>Reusable lessons from completed work, decisions, and site outcomes.</p></div><span className="step-stamp">NOT CONNECTED</span></div>
      <article className="memory-hero surface"><div className="memory-illustration" aria-hidden="true"><div className="memory-sheet sheet-back" /><div className="memory-sheet sheet-front"><span /><span /><span /><i>↗</i></div><div className="memory-node node-one" /><div className="memory-node node-two" /><div className="memory-link link-one" /><div className="memory-link link-two" /></div><div className="memory-copy"><span className="micro-label">A PLACE FOR EXPERIENCE TO ACCUMULATE</span><h3>Past jobs should make the next one easier.</h3><p>This prototype has no historical memory store or retrieval API connected yet. Accepted decisions remain inside the current API session and are cleared when it restarts.</p><div className="memory-tags"><span>Execution patterns</span><span>Resolved conflicts</span><span>Lessons learned</span></div></div></article>
      <div className="memory-columns"><article className="surface memory-column"><span className="memory-index">01</span><h3>Work sequences</h3><p>Common task dependencies, field conditions, and successful execution order.</p><span className="status-chip status-neutral">SOURCE NOT CONNECTED</span></article><article className="surface memory-column"><span className="memory-index">02</span><h3>Resolved decisions</h3><p>Human-reviewed outcomes that could help explain similar future reports.</p><span className="status-chip status-neutral">SOURCE NOT CONNECTED</span></article><article className="surface memory-column"><span className="memory-index">03</span><h3>Measured outcomes</h3><p>Actual durations and quantities compared with the original plan.</p><span className="status-chip status-neutral">SOURCE NOT CONNECTED</span></article></div>
    </section>


    <section id="panel-settings" role="tabpanel" aria-labelledby="tab-settings" hidden={activeTab !== "settings"} className="tab-panel">
      <div className="section-heading"><div><p className="overline">WORKSPACE PREFERENCES</p><h2>Profile & institution</h2><p>Review the account and site context associated with this workspace.</p></div><span className="step-stamp">DEMO DETAILS</span></div>
      <div className="settings-grid">
        <article className="surface settings-card"><div className="settings-card-head"><span className="user-avatar user-avatar-large">DP</span><div><span className="micro-label">PROFILE</span><h3>Demo planner</h3><p>Planner · Prototype workspace</p></div></div><div className="settings-row"><span>Account access</span><b>Authentication not connected</b></div><div className="settings-row"><span>Role</span><b>Planner (demo)</b></div><p className="settings-note">A signed-in user profile and role based access have not been configured yet.</p></article>
        <article className="surface settings-card"><div className="surface-head"><div><span className="micro-label">INSTITUTION & SITE</span><h3>Workspace details</h3></div><span className="status-chip status-neutral">SESSION ONLY</span></div><div className="settings-row"><span>Organization</span><b>Demo construction organization</b></div><div className="settings-row"><span>Project</span><b>{scheduleName || "No project schedule loaded"}</b></div><div className="settings-row"><span>Work area</span><b>{area || "Not specified"}</b></div><div className="settings-row"><span>Report date</span><b>{reportDate}</b></div><p className="settings-note">These labels describe the current prototype session; they are not saved institution records.</p></article>
      </div>
    </section>
    <footer className="app-footer"><span>{BRAND.name} · CONSTRUCTION EXECUTION RECONCILIATION</span><span>Prototype data is held in API memory and resets when the backend restarts.</span></footer>
    </main>
  </div>;
}
