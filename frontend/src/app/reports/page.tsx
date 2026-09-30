"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Mic, MicOff, Send, Upload, X } from "lucide-react";
import { useWorkspace } from "../../components/workspace-provider";
import { TimeWindows } from "../../components/time-windows";
import { EmptyState, PageHeading, SectionHeading, SourceEvidence, StatusBadge, TimeInterval } from "../../components/ui";

type SpeechResult = { 0: { transcript: string }; isFinal: boolean };
type SpeechEvent = { resultIndex: number; results: ArrayLike<SpeechResult> };
type Recognition = { continuous: boolean; interimResults: boolean; lang: string; onresult: ((event: SpeechEvent) => void) | null; onerror: ((event: { error: string }) => void) | null; onend: (() => void) | null; start: () => void; stop: () => void; abort: () => void };
type SpeechWindow = Window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };

export default function ReportsPage() {
  const { summary, workspace, message, setMessage, area, setArea, reportDate, setReportDate, busy, processMessage, uploadReports } = useWorkspace();
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState("");
  const [listening, setListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [speechError, setSpeechError] = useState("");
  const recognitionRef = useRef<Recognition | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const speechWindow = window as SpeechWindow;
    setSpeechSupported(Boolean(speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition));
    return () => recognitionRef.current?.abort();
  }, []);

  function toggleVoice() {
    if (listening) { recognitionRef.current?.stop(); setListening(false); return; }
    const speechWindow = window as SpeechWindow;
    const Constructor = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!Constructor) return;
    setSpeechError("");
    const recognition = new Constructor();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "en-IN";
    recognition.onresult = event => {
      const transcript = Array.from(event.results).slice(event.resultIndex).filter(result => result.isFinal).map(result => result[0].transcript.trim()).filter(Boolean).join(" ");
      if (transcript) setMessage(current => current.trim() ? `${current.trim()} ${transcript}` : transcript);
    };
    recognition.onerror = event => { setListening(false); if (event.error !== "aborted" && event.error !== "no-speech") setSpeechError(event.error === "not-allowed" ? "Microphone permission was denied. Check browser settings." : `Voice input stopped: ${event.error}.`); };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    try { recognition.start(); setListening(true); } catch { setSpeechError("Could not start voice input. Check microphone permission."); }
  }

  function addFiles(selected: FileList | null) {
    if (!selected) return;
    const queued = [...files];
    const errors: string[] = [];
    for (const file of Array.from(selected)) {
      if (!/\.(txt|csv|xlsx)$/i.test(file.name)) { errors.push(`${file.name}: use TXT, CSV, or XLSX.`); continue; }
      if (!file.size || file.size > 15 * 1024 * 1024) { errors.push(`${file.name}: files must be nonempty and no larger than 15 MB.`); continue; }
      if (queued.length >= 10) { errors.push("You can queue up to 10 files."); break; }
      if (queued.some(item => item.name === file.name && item.size === file.size)) { errors.push(`${file.name}: already queued.`); continue; }
      queued.push(file);
    }
    setFiles(queued); setFileError(errors.join(" "));
    if (fileRef.current) fileRef.current.value = "";
  }

  if (!summary) return <><PageHeading eyebrow="02 / EVIDENCE" title="Field reports" description="Connect site updates to the imported schedule." /><EmptyState title="Import a schedule first" description="Reports need a schedule to match against." href="/import" action="Go to import" /></>;

  const currentPatch = workspace?.patches[0];
  return <>
    <PageHeading eyebrow="02 / EVIDENCE" title="Field reports" description="Add site evidence, then inspect the extracted activities before making a schedule decision." aside={workspace && <Link href="/review" className="button primary">Review changes <ArrowRight size={17} aria-hidden="true" /></Link>} />
    <div className="page-grid reports-grid">
      <section className="panel">
        <SectionHeading title="New evidence" />
        <div className="field-grid"><div><label className="field-label" htmlFor="report-date">Report date</label><input id="report-date" type="date" value={reportDate} onChange={event => setReportDate(event.target.value)} /></div><div><label className="field-label" htmlFor="report-area">Area</label><input id="report-area" type="text" value={area} onChange={event => setArea(event.target.value)} placeholder="e.g. Unit-2" /></div></div>
        <form noValidate onSubmit={async event => { event.preventDefault(); await processMessage(); }}>
          <div className="label-row"><label className="field-label" htmlFor="field-message">Field message</label><button className="button ghost voice-button" type="button" onClick={toggleVoice} disabled={!speechSupported && !listening} aria-pressed={listening} title={speechSupported ? "Dictate field message" : "Voice input is unavailable in this browser"}>{listening ? <MicOff size={16} /> : <Mic size={16} />}{listening ? "Stop recording" : "Dictate"}</button></div>
          <textarea id="field-message" className="resize-none" value={message} onChange={event => setMessage(event.target.value)} rows={7} placeholder="Describe completed work, blockers, equipment tags, and timing." />
          {listening && <p className="field-help" role="status">Listening. Your transcript will appear above.</p>}{speechError && <p className="field-error" role="alert">{speechError}</p>}
          <button type="submit" className="button primary" disabled={busy || !message.trim()}><Send size={16} aria-hidden="true" />{busy ? "Compiling…" : currentPatch?.status === "PENDING" ? "Add to current report" : "Compile report"}</button>
        </form>
        <div className="divider-label"><span>OR UPLOAD A REPORT</span></div>
        <form noValidate onSubmit={async event => { event.preventDefault(); const uploaded = await uploadReports(files); if (uploaded) setFiles(current => current.slice(uploaded)); }}>
          <label className="field-label" htmlFor="report-file">Text, CSV, or Excel DPR</label><input id="report-file" ref={fileRef} type="file" multiple accept=".txt,.csv,.xlsx" onChange={event => addFiles(event.target.files)} />
          <p className="field-help">Up to 10 files, 15 MB each.</p>
          {fileError && <p className="field-error" role="alert">{fileError}</p>}
          {files.length > 0 && <ul className="upload-queue">{files.map((item, index) => <li key={`${item.name}-${item.size}`}><span>{item.name} <small>{(item.size / (1024 * 1024)).toFixed(1)} MB</small></span><button type="button" className="icon-button" aria-label={`Remove ${item.name}`} title={`Remove ${item.name}`} onClick={() => setFiles(current => current.filter((_, position) => position !== index))}><X size={16} /></button></li>)}</ul>}
          <button type="submit" className="button secondary" disabled={!files.length || busy}><Upload size={16} aria-hidden="true" />{busy ? "Uploading…" : `Upload ${files.length} report${files.length === 1 ? "" : "s"}`}</button>
        </form>
      </section>
      <section className="panel evidence-panel">
        <SectionHeading title="Evidence" meta={workspace ? `${workspace.sources.length} source${workspace.sources.length === 1 ? "" : "s"}` : undefined} />
        {workspace ? <><div className="report-id">{workspace.report_id} <StatusBadge value={currentPatch?.status ?? "PENDING"} /></div>{workspace.sources.map(source => <SourceEvidence key={source.id} source={source} events={workspace.events.filter(event => event.source_id === source.id)} />)}</> : <div className="panel-empty"><strong>No report compiled yet</strong><p>Submit a field message or upload a DPR to see its evidence here.</p></div>}
      </section>
    </div>
    {workspace && <><section className="page-section"><SectionHeading title="Extracted events" meta={workspace.events.length} />{workspace.events.length ? <div className="list-surface">{workspace.events.map(event => <article className="event-row" key={event.id}><div className="event-main"><span className="mono event-tag">{event.object_tag || "No tag"}</span><strong>{event.action.replaceAll("_", " ").toLowerCase()}</strong><StatusBadge value={event.state} /></div><div className="event-detail">{event.event_date && <span>{event.event_date}</span>}{event.quantity != null && <span>{event.quantity} {event.quantity_unit}</span>}{event.cause && <span>Cause: {event.cause}</span>}{workspace.links[event.id]?.length ? <span>Matched to {workspace.links[event.id].map(item => item.activity_id).join(", ")}</span> : <span>Needs matching review</span>}</div><TimeInterval interval={event.time_interval} /></article>)}</div> : <div className="inline-empty">No activity statements were extracted. Check the report wording or add more detail.</div>}
      <div className="section-action"><Link className="button primary" href="/review">Review proposed changes <ArrowRight size={17} aria-hidden="true" /></Link></div></section><TimeWindows events={workspace.events} sources={workspace.sources} /></>}
  </>;
}
