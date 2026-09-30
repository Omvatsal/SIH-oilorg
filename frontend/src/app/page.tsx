"use client";

import { useState } from "react";
import { BRAND } from "../config/brand";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";
const P201 = "P-201 fitted yesterday evening. Alignment done this morning, but discharge couldn't happen because the valve hasn't arrived.";

type Span = { start: number; end: number; kind: string };
type Event = { id: string; action: string; state: string; object_tag?: string; event_date?: string; cause?: string; quantity?: number; quantity_unit?: string; spans: Span[] };
type Update = { activity_id: string; activity_name: string; before: string; after: string };
type Rule = { name: string; verdict: string; reason: string };
type Patch = { id: string; status: string; approval_tier: string; updates: Update[]; rules: Rule[] };
type Workspace = { report_id: string; source_text: string; events: Event[]; patches: Patch[]; unmatched_work: Event[] };
type Summary = { schedule_id: string; activity_count: number; relationship_count: number; tag_count: number };

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

export default function Home() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [message, setMessage] = useState(P201);
  const [reportDate, setReportDate] = useState("2026-09-30");
  const [area, setArea] = useState("Unit-2");
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

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
        body: JSON.stringify({ schedule_id: summary.schedule_id, text: message, area, received_at: reportDate }),
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
      const query = new URLSearchParams({ schedule_id: summary.schedule_id, area, received_at: reportDate });
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

  const patch = workspace?.patches[0];
  return <main>
    <header><h1>{BRAND.name}</h1><p className="subtitle">{BRAND.tagline} · Phase 1 demo</p></header>
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
        <h3>Field message</h3>
        <label>Report date<input type="date" value={reportDate} onChange={event => setReportDate(event.target.value)} /></label>
        <label>Area<input type="text" value={area} onChange={event => setArea(event.target.value)} /></label>
        <textarea aria-label="Field message" value={message} onChange={event => setMessage(event.target.value)} />
        <button onClick={processMessage} disabled={busy || !summary}>Compile report</button>
        <label>Or upload text/Excel DPR<input type="file" accept=".txt,.csv,.xlsx" onChange={event => event.target.files?.[0] && uploadReport(event.target.files[0])} /></label>
      </section>
      <section className="card">
        <h2>2. Compiler</h2>
        {workspace ? <>
          <p className="source-text">{sourceWithHighlights(workspace.source_text, workspace.events)}</p>
          <h3>Extracted events</h3>
          {workspace.events.map(event => <div className="row" key={event.id}><span className="mono">{event.object_tag || "No tag"}</span> · {event.action} · <b>{event.state}</b>{event.event_date && <> · {event.event_date}</>}{event.quantity != null && <> · {event.quantity} {event.quantity_unit}</>}{event.cause && <><br />Cause: {event.cause}</>}</div>)}
          <h3>Proposed schedule changes</h3>
          {patch?.updates.map(update => <div className="row" key={update.activity_id}><span className="mono">{update.activity_id}</span> {update.activity_name}<br />{update.before} → <b>{update.after}</b></div>)}
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
