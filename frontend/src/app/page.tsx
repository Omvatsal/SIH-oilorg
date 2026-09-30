"use client";

import { useEffect, useRef, useState } from "react";
import { BRAND } from "../config/brand";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";
const P201 = "P-201 fitted yesterday evening. Alignment done this morning, but discharge couldn't happen because the valve hasn't arrived.";

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
type Workspace = { report_id: string; source_text: string; sources: Source[]; events: Event[]; patches: Patch[]; unmatched_work: Event[]; conflicts: Conflict[]; time_conflicts: { activity_id?: string | null; intervals: Interval[] }[]; silent_progress: SilentProgress[]; ask_back_questions: AskBackQuestion[]; quantity_progress: QuantityProgress[] };
type DependencyIssue = { code: string; severity: "ERROR" | "WARNING"; message: string; activity_ids: string[] };
type DependencyGraph = { node_count: number; edge_count: number; nodes: { activity_id: string; activity_name: string; predecessor_ids: string[]; successor_ids: string[] }[]; edges: { predecessor_id: string; successor_id: string; resolved: boolean }[]; topological_order: string[]; issues: DependencyIssue[]; is_acyclic: boolean; is_consistent: boolean };
type Summary = { schedule_id: string; activity_count: number; relationship_count: number; tag_count: number; dependency_graph: DependencyGraph };
type SpeechRecognitionAlternativeLike = { transcript: string };
type SpeechRecognitionResultLike = { 0: SpeechRecognitionAlternativeLike; isFinal: boolean };
type SpeechRecognitionEventLike = { resultIndex: number; results: ArrayLike<SpeechRecognitionResultLike> };
type SpeechRecognitionErrorLike = { error: string };
type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorLike) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;
type SpeechWindow = Window & { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor };

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

function TimeBar({ interval }: { interval?: Interval | null }) {
  if (!interval) return null;
  const start = new Date(interval.earliest);
  const end = new Date(interval.latest);
  const hour = (value: Date) => Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(value).slice(0, 2)) + Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(value).slice(3, 5)) / 60;
  const left = Math.max(0, Math.min(100, hour(start) / 24 * 100));
  const width = Math.max(1, Math.min(100 - left, (hour(end) - hour(start)) / 24 * 100));
  const fmt = (value: Date) => new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(value);
  return <div className="time-wrap"><div className="time-track"><span className="time-band" style={{ left: `${left}%`, width: `${width}%` }} /></div><small>{fmt(start)}–{fmt(end)} IST · {interval.confidence.toLowerCase()} confidence</small></div>;
}

export default function Home() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [message, setMessage] = useState(P201);
  const [reportDate, setReportDate] = useState("2026-09-30");
  const [area, setArea] = useState("Unit-2");
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    const speechWindow = window as SpeechWindow;
    setSpeechSupported(Boolean(speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition));
    return () => recognitionRef.current?.abort();
  }, []);

  function toggleVoiceInput() {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const speechWindow = window as SpeechWindow;
    const Recognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setError("Voice input is not supported by this browser. Try a recent version of Chrome or Edge.");
      return;
    }
    setError("");
    const recognition = new Recognition();
    recognition.continuous = true;
    // Interim results are revised and replayed by some browsers. Appending them
    // creates duplicate text, so only accept each final segment once.
    recognition.interimResults = false;
    recognition.lang = "en-IN";
    recognition.onresult = event => {
      const transcript = Array.from(event.results)
        .slice(event.resultIndex)
        .filter(result => result.isFinal)
        .map(result => result[0].transcript.trim())
        .filter(Boolean)
        .join(" ");
      if (transcript) setMessage(current => current.trim() ? `${current.trim()} ${transcript}` : transcript);
    };
    recognition.onerror = event => {
      setListening(false);
      if (event.error !== "aborted" && event.error !== "no-speech") {
        setError(event.error === "not-allowed" ? "Microphone access was denied. Allow microphone access in your browser settings." : `Voice input failed (${event.error}).`);
      }
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    try {
      recognition.start();
      setListening(true);
    } catch {
      setListening(false);
      setError("Could not start voice input. Check microphone permission and try again.");
    }
  }

  async function sendSchedule(file: File) {
    setBusy(true); setError(""); setWorkspace(null);
    try {
      const form = new FormData(); form.append("file", file);
      const response = await fetch(`${API}/schedule/import`, { method: "POST", body: form });
      if (!response.ok) throw new Error(await response.text());
      setSummary(await response.json());
    } catch (cause) { setError(String(cause)); } finally { setBusy(false); }
  }

  async function importDemo() {
    try {
      const response = await fetch("/project_schedule.csv");
      if (!response.ok) throw new Error("Demo schedule is unavailable.");
      await sendSchedule(new File([await response.blob()], "project_schedule.csv", { type: "text/csv" }));
    } catch (cause) { setError(String(cause)); }
  }

  async function processMessage() {
    if (!summary) return setError("Import a schedule first.");
    setBusy(true); setError("");
    try {
      const response = await fetch(`${API}/ingest/message`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schedule_id: summary.schedule_id, text: message, area, received_at: reportDate, ...(workspace ? { report_id: workspace.report_id } : {}) }),
      });
      if (!response.ok) throw new Error(await response.text());
      setWorkspace(await response.json());
    } catch (cause) { setError(String(cause)); } finally { setBusy(false); }
  }

  async function uploadReport(file: File) {
    if (!summary) return setError("Import a schedule first.");
    setBusy(true); setError("");
    try {
      const form = new FormData(); form.append("file", file);
      const query = new URLSearchParams({ schedule_id: summary.schedule_id, area, received_at: reportDate, ...(workspace ? { report_id: workspace.report_id } : {}) });
      const response = await fetch(`${API}/ingest/file?${query}`, { method: "POST", body: form });
      if (!response.ok) throw new Error(await response.text());
      setWorkspace(await response.json());
    } catch (cause) { setError(String(cause)); } finally { setBusy(false); }
  }

  async function patchAction(patchId: string, action: string) {
    setBusy(true); setError("");
    try {
      const response = await fetch(`${API}/patches/${patchId}/${action}`, { method: "POST" });
      if (!response.ok) throw new Error(await response.text());
      const changed: Patch = await response.json();
      setWorkspace(current => current ? { ...current, patches: current.patches.map(patch => patch.id === changed.id ? changed : patch) } : current);
    } catch (cause) { setError(String(cause)); } finally { setBusy(false); }
  }

  async function answerAskBack(questionId: string, answer: "YES" | "NO") {
    if (!workspace) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`${API}/workspace/${workspace.report_id}/questions/${questionId}/answer`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answer }),
      });
      if (!response.ok) throw new Error(await response.text());
      const changed: AskBackQuestion = await response.json();
      setWorkspace(current => current ? { ...current, ask_back_questions: current.ask_back_questions.map(question => question.id === changed.id ? changed : question) } : current);
    } catch (cause) { setError(String(cause)); } finally { setBusy(false); }
  }

  const patch = workspace?.patches[0];
  return <main>
    <header><h1>{BRAND.name}</h1><p className="subtitle">{BRAND.tagline} · Phase 2 demo</p></header>
    <div className="grid">
      <section className="card">
        <h2>1. Sources</h2>
        <div className="button-row"><button onClick={importDemo} disabled={busy}>Import demo schedule</button></div>
        <label>Or upload CSV/XER schedule<input type="file" accept=".csv,.xer" onChange={event => event.target.files?.[0] && sendSchedule(event.target.files[0])} /></label>
        {summary && <div className="metric-grid" aria-label="Import summary">
          <div className="metric"><strong>{summary.activity_count}</strong>activities</div>
          <div className="metric"><strong>{summary.relationship_count}</strong>links</div>
          <div className="metric"><strong>{summary.tag_count}</strong>tags</div>
        </div>}
        {summary && <div className={`row ${summary.dependency_graph.is_consistent ? "safe" : "review"}`}>
          <h3>Dependency graph</h3>
          <p>{summary.dependency_graph.node_count} tasks · {summary.dependency_graph.edge_count} dependencies</p>
          {summary.dependency_graph.is_acyclic
            ? <p>No cycles detected. A topological order is available.</p>
            : <p>A dependency cycle blocks a complete task order.</p>}
          {summary.dependency_graph.issues.length === 0
            ? <p>No dependency inconsistencies found.</p>
            : <ul>{summary.dependency_graph.issues.map((issue, index) => <li key={`${issue.code}-${index}`}>
                <b>{issue.severity}: {issue.code}</b> — {issue.message}
              </li>)}</ul>}
          {summary.dependency_graph.edges.length > 0 && <details>
            <summary>Show task dependency edges</summary>
            <ul>{summary.dependency_graph.edges.map(edge => <li key={`${edge.predecessor_id}-${edge.successor_id}`}>
              {edge.predecessor_id} → {edge.successor_id}{!edge.resolved && " (missing predecessor)"}
            </li>)}</ul>
          </details>}
        </div>}
        <h3>Field message</h3>
        <label>Report date<input type="date" value={reportDate} onChange={event => setReportDate(event.target.value)} /></label>
        <label>Area<input type="text" value={area} onChange={event => setArea(event.target.value)} /></label>
        <div className="voice-controls">
          <button type="button" className={listening ? "recording" : "secondary"} onClick={toggleVoiceInput} disabled={!speechSupported && !listening} aria-pressed={listening}>
            {listening ? "Stop voice recording" : "Record activity by voice"}
          </button>
          <span className={listening ? "recording-status" : "muted"} aria-live="polite">{listening ? "Listening… transcript is added below" : speechSupported ? "Review the transcript before compiling." : "Voice input requires a supported browser such as Chrome or Edge."}</span>
        </div>
        <textarea aria-label="Field message" value={message} onChange={event => setMessage(event.target.value)} />
        <button onClick={processMessage} disabled={busy || !summary}>{workspace ? "Add message to workspace" : "Compile report"}</button>
        <label>Or upload text/Excel DPR<input type="file" accept=".txt,.csv,.xlsx" onChange={event => event.target.files?.[0] && uploadReport(event.target.files[0])} /></label>
      </section>
      <section className="card">
        <h2>2. Compiler</h2>
        {workspace ? <>
          <p className="muted">Report {workspace.report_id} · {workspace.sources.length} source(s)</p>
          {workspace.sources.map(source => <div className="source-card" key={source.id}><div className="source-heading"><b>{source.filename || source.kind}</b><span>{source.kind} · received {source.received_at}</span></div><p className="source-text">{sourceWithHighlights(source.text, workspace.events.filter(event => event.source_id === source.id))}</p></div>)}
          <h3>Extracted events</h3>
          {workspace.events.map(event => <div className="row" key={event.id}><span className="mono">{event.object_tag || "No tag"}</span> · {event.action} · <b>{event.state}</b>{event.event_date && <> · {event.event_date}</>}{event.quantity != null && <> · {event.quantity} {event.quantity_unit}</>}{event.cause && <><br />Cause: {event.cause}</>}<TimeBar interval={event.time_interval} /></div>)}
          {workspace.conflicts.map(conflict => <div className="conflict-card" key={`${conflict.activity_id}-${conflict.activity_name}`}><b>Source conflict · {conflict.activity_name}</b><p>Conflicting claims resolve to <strong>{conflict.resolution}</strong>; planner review required.</p>{conflict.claims.map((claim, index) => <div className="claim" key={`${claim.source_id}-${index}`}>{claim.state}: {workspace.sources.find(source => source.id === claim.source_id)?.filename || workspace.sources.find(source => source.id === claim.source_id)?.kind || "Source"} — “{claim.text}”</div>)}</div>)}
          {workspace.time_conflicts.map((conflict, index) => <div className="row review" key={index}>Conflicting time bounds for {conflict.activity_id || "reported work"}; planner review required.</div>)}
          {workspace.silent_progress.map((finding, index) => <div className="row review" key={`${finding.successor_activity_id}-${finding.predecessor_activity_id}-${index}`}>
            <b>Silent Progress</b>: {finding.successor_activity_name} is reported, but no evidence was found for predecessor {finding.predecessor_activity_name}.
            {finding.predecessor_finish_upper_bound && <p>Predecessor finish must be no later than {new Date(finding.predecessor_finish_upper_bound).toLocaleString()}.</p>}
          </div>)}
          {workspace.ask_back_questions.map(question => <div className="row review" key={question.id}>
            <b>Clarification · {question.information_gain_bits} bit expected information gain</b><p>{question.question}</p>
            <small>Before: {question.candidate_distribution_before.map(item => `${item.candidate.replaceAll("_", " ")} ${(item.probability * 100).toFixed(0)}%`).join(" · ")}</small>
            {question.selected_answer ? <p>Answer: {question.selected_answer}. After: {question.candidate_distribution_after.map(item => `${item.candidate.replaceAll("_", " ")} ${(item.probability * 100).toFixed(0)}%`).join(" · ")}</p> : <div className="button-row"><button disabled={busy} onClick={() => answerAskBack(question.id, "YES")}>Yes, predecessor completed</button><button className="secondary" disabled={busy} onClick={() => answerAskBack(question.id, "NO")}>No</button></div>}
          </div>)}
          {workspace.quantity_progress.map(progress => <div className="row" key={progress.activity_id}>
            <b>Accumulated progress · {progress.activity_name}</b><p>{progress.observed_quantity} {progress.quantity_unit} reported{progress.planned_quantity != null ? ` of ${progress.planned_quantity} ${progress.quantity_unit}` : ""}{progress.percent_complete != null ? ` · ${progress.percent_complete.toFixed(1)}%` : ""}</p>
          </div>)}
          <h3>Proposed schedule changes</h3>
          {patch?.updates.map(update => <div className="row" key={update.activity_id}><span className="mono">{update.activity_id}</span> {update.activity_name}<br />{update.before} → <b>{update.after}</b><TimeBar interval={update.time_interval} /></div>)}
          {workspace.unmatched_work.map(event => <div className="row review" key={event.id}>Unmapped work: {event.action} {event.object_tag}</div>)}
        </> : <p className="muted">Import a schedule, then compile a report.</p>}
      </section>
      <section className="card">
        <h2>3. Safety gate</h2>
        {patch ? <>
          <p>Approval: <b>{patch.approval_tier}</b> · Patch: <b>{patch.status}</b></p>
          {patch.rules.map((rule, index) => <div className={`row ${rule.verdict === "SAFE" ? "safe" : rule.verdict === "BLOCKED" ? "block" : "review"}`} key={`${rule.name}-${index}`}><b>{rule.verdict}</b> {rule.name}<br /><small>{rule.reason}</small></div>)}
          <div className="button-row">
            <button onClick={() => patchAction(patch.id, "accept")} disabled={busy || patch.status !== "PENDING" || patch.approval_tier === "BLOCKED" || patch.updates.length === 0}>Apply</button>
            <button className="secondary" onClick={() => patchAction(patch.id, "reject")} disabled={busy || patch.status !== "PENDING"}>Reject</button>
            <button className="secondary" onClick={() => patchAction(patch.id, "undo")} disabled={busy || patch.status !== "ACCEPTED"}>Undo</button>
          </div>
          <p className="muted">{patch.updates.length} proposed updates · {patch.rules.filter(rule => rule.verdict !== "SAFE").length} checks need attention</p>
        </> : <p className="muted">Rule results and patch actions appear here.</p>}
      </section>
    </div>
    {error && <p role="alert" className="notice block">{error}</p>}
  </main>;
}
