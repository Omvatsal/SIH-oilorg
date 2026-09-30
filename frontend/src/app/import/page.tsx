"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, FileSpreadsheet, Upload } from "lucide-react";
import { useWorkspace } from "../../components/workspace-provider";
import { PageHeading, SectionHeading, StatusBadge } from "../../components/ui";

export default function ImportPage() {
  const { busy, summary, importSchedule } = useWorkspace();
  const [file, setFile] = useState<File | null>(null);
  const [demoError, setDemoError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function importDemo() {
    setDemoError("");
    try {
      const response = await fetch("/project_schedule.csv");
      if (!response.ok) throw new Error("The sample schedule could not be loaded.");
      await importSchedule(new File([await response.blob()], "project_schedule.csv", { type: "text/csv" }));
    } catch (cause) { setDemoError(cause instanceof Error ? cause.message : "The sample schedule could not be loaded."); }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return;
    if (await importSchedule(file)) { setFile(null); if (inputRef.current) inputRef.current.value = ""; }
  }

  const graph = summary?.dependency_graph;
  return <>
    <PageHeading eyebrow="01 / START" title="Import schedule" description="Bring in a project schedule to connect site reports with planned activities." />
    <div className="page-grid import-grid">
      <section className="panel">
        <SectionHeading title="Schedule file" />
        <p className="section-intro">Choose a Primavera XER or CSV file. The schedule stays available while this workspace is open.</p>
        <form noValidate onSubmit={submit} className="upload-form">
          <label htmlFor="schedule-file" className="field-label">CSV or XER schedule</label>
          <input id="schedule-file" ref={inputRef} type="file" accept=".csv,.xer" onChange={event => setFile(event.target.files?.[0] ?? null)} />
          <button className="button primary" type="submit" disabled={!file || busy}><Upload size={17} aria-hidden="true" />{busy ? "Importing…" : "Import schedule"}</button>
        </form>
        <div className="divider-label"><span>OR</span></div>
        <button type="button" className="button secondary" onClick={importDemo} disabled={busy}><FileSpreadsheet size={17} aria-hidden="true" />Load sample schedule</button>
        {demoError && <p role="alert" className="field-error">{demoError}</p>}
      </section>
      <section className="panel">
        <SectionHeading title="Current schedule" />
        {summary && graph ? <>
          <div className="schedule-identity"><strong>{summary.schedule_id}</strong><span>{summary.source_format.toUpperCase()} imported</span></div>
          <div className="stat-strip"><div><strong>{summary.activity_count}</strong><span>Activities</span></div><div><strong>{summary.relationship_count}</strong><span>Dependencies</span></div><div><strong>{summary.tag_count}</strong><span>Equipment tags</span></div></div>
          <div className="summary-line"><span>Dependency check</span><StatusBadge value={graph.is_consistent ? "SAFE" : "WARNING"} /></div>
          <p className="muted compact">{graph.issues.length ? `${graph.issues.length} issue${graph.issues.length === 1 ? "" : "s"} to inspect on the Schedule page.` : "No dependency issues found."}</p>
          <Link href="/reports" className="button primary full-width">Add a field report <ArrowRight size={17} aria-hidden="true" /></Link>
        </> : <div className="panel-empty"><FileSpreadsheet size={26} strokeWidth={1.5} aria-hidden="true" /><strong>No schedule imported</strong><p>Import a file or load the sample schedule to begin.</p></div>}
      </section>
    </div>
    {graph && graph.issues.length > 0 && <section className="page-section"><SectionHeading title="Import findings" meta={graph.issues.length} /><div className="list-surface">{graph.issues.slice(0, 5).map((issue, index) => <div className="list-row" key={`${issue.code}-${index}`}><StatusBadge value={issue.severity} /><div><strong>{issue.code.replaceAll("_", " ")}</strong><p>{issue.message}</p></div></div>)}</div>{graph.issues.length > 5 && <Link className="text-link" href="/schedule">View all dependency findings <ArrowRight size={15} /></Link>}</section>}
  </>;
}
