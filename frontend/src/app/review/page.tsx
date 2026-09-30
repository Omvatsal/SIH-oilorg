"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, RotateCcw, X } from "lucide-react";
import { useWorkspace } from "../../components/workspace-provider";
import { EmptyState, IssueNote, PageHeading, PatchSummary, SectionHeading, SourceEvidence, StatusBadge, TimeInterval } from "../../components/ui";
import { api } from "../../lib/api";
import type { AuditEntry } from "../../lib/types";

export default function ReviewPage() {
  const { summary, workspace, busy, patchAction, answerQuestion } = useWorkspace();
  const patch = workspace?.patches[0];
  const [audit, setAudit] = useState<AuditEntry[]>([]);

  useEffect(() => {
    if (!patch) return;
    let active = true;
    api<{ entries: AuditEntry[] }>(`/audit/${patch.id}`).then(result => { if (active) setAudit(result.entries); }).catch(() => { if (active) setAudit([]); });
    return () => { active = false; };
  }, [patch?.id, patch?.status]);

  if (!summary) return <><PageHeading eyebrow="03 / DECISION" title="Review changes" description="Check proposed updates against the schedule." /><EmptyState title="Import a schedule first" description="Start with a schedule, then add a report to review." href="/import" action="Go to import" /></>;
  if (!workspace || !patch) return <><PageHeading eyebrow="03 / DECISION" title="Review changes" description="Check proposed updates against source evidence and safety rules." /><EmptyState title="No report to review" description="Add a field message or upload a report to generate proposed changes." href="/reports" action="Add a report" /></>;

  const blocking = patch.approval_tier === "BLOCKED";
  const canApply = patch.status === "PENDING" && !blocking && patch.updates.length > 0;
  const needsAttention = patch.rules.filter(rule => rule.verdict !== "SAFE").length + workspace.conflicts.length + workspace.time_conflicts.length + workspace.unmatched_work.length;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const overdue = summary.activities?.filter(activity => activity.planned_finish && activity.planned_finish.slice(0, 10) < today && activity.status !== "COMPLETE") ?? [];

  return <>
    <PageHeading eyebrow="03 / DECISION" title="Review changes" description="Compare every proposed update with its source evidence before changing the schedule." aside={<Link href="/reports" className="button ghost"><ArrowLeft size={16} aria-hidden="true" /> Back to reports</Link>} />
    <div className="review-overview"><PatchSummary patch={patch} /><div className="review-count"><strong>{needsAttention}</strong><span>item{needsAttention === 1 ? "" : "s"} needing attention</span></div></div>
    <div className="page-grid review-grid">
      <div>
        {overdue.length > 0 && <section className="page-section first-section"><SectionHeading title="Past planned finish" meta={overdue.length} /><div className="list-surface">{overdue.map(activity => <div className="finding-row" key={activity.id}><StatusBadge value="OVERDUE" /><div><strong>{activity.id} · {activity.name}</strong><p>Planned finish: {activity.planned_finish?.slice(0, 10)} · Status: {activity.status.toLowerCase()}</p></div></div>)}</div></section>}
        <section className={`page-section ${overdue.length ? "" : "first-section"}`}><SectionHeading title="Proposed activity changes" meta={patch.updates.length} />
          {patch.updates.length ? <div className="list-surface">{patch.updates.map(update => {
            const evidenceIds = update.evidence_event_ids.length ? update.evidence_event_ids : [update.evidence_event_id];
            const evidence = workspace.events.filter(event => evidenceIds.includes(event.id));
            return <article className="update-row" key={update.activity_id}><div className="update-title"><span className="mono event-tag">{update.activity_id}</span><strong>{update.activity_name}</strong>{update.inferred && <StatusBadge value="INFERRED" />}</div><div className="change-line"><span>{update.before.replaceAll("_", " ")}</span><span aria-hidden="true">→</span><strong>{update.after.replaceAll("_", " ")}</strong></div><div className="update-evidence">{evidence.length ? evidence.map(event => <div key={event.id}><span className="evidence-label">SOURCE</span> {workspace.sources.find(source => source.id === event.source_id)?.filename || "Field message"} · {event.action.replaceAll("_", " ").toLowerCase()}</div>) : <div>Evidence reference unavailable</div>}</div><TimeInterval interval={update.time_interval} /></article>;
          })}</div> : <div className="inline-empty">No schedule changes were matched. Inspect unmatched work below or add more evidence.</div>}
        </section>
        {(workspace.conflicts.length > 0 || workspace.time_conflicts.length > 0 || workspace.unmatched_work.length > 0 || workspace.silent_progress.length > 0) && <section className="page-section"><SectionHeading title="Needs attention" />
          <div className="list-surface">
            {workspace.conflicts.map(conflict => <div className="attention-row" key={conflict.activity_id}><strong>Conflicting reports · {conflict.activity_name}</strong><p>Proposed state: {conflict.resolution}. Compare the claims before applying.</p>{conflict.claims.map((claim, index) => <div className="claim-line" key={`${claim.source_id}-${index}`}><StatusBadge value={claim.state} /><span>{workspace.sources.find(source => source.id === claim.source_id)?.filename || "Field message"}</span></div>)}</div>)}
            {workspace.time_conflicts.map((conflict, index) => <div className="attention-row" key={index}><strong>Conflicting time evidence · {conflict.activity_id || "Reported work"}</strong><p>The reported time ranges do not overlap. Review the sources.</p></div>)}
            {workspace.silent_progress.map((finding, index) => <div className="attention-row" key={`${finding.predecessor_activity_id}-${index}`}><strong>Missing predecessor evidence</strong><p>{finding.successor_activity_name} is reported, but {finding.predecessor_activity_name} has no completion evidence.</p>{finding.predecessor_finish_upper_bound && <small>Latest possible finish: {new Date(finding.predecessor_finish_upper_bound).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST</small>}</div>)}
            {workspace.unmatched_work.map(event => <div className="attention-row" key={event.id}><strong>Unmatched work</strong><p>{event.object_tag || "No equipment tag"} · {event.action.replaceAll("_", " ").toLowerCase()}. This statement has no matching schedule activity.</p></div>)}
          </div>
        </section>}
        {workspace.ask_back_questions.length > 0 && <section className="page-section"><SectionHeading title="Clarification" />{workspace.ask_back_questions.map(question => <div className="question-row" key={question.id}><strong>{question.question}</strong><p>Current estimate: {question.candidate_distribution_before.map(item => `${item.candidate === "PREDECESSOR_COMPLETE" ? "Complete" : "Incomplete"} ${(item.probability * 100).toFixed(0)}%`).join(" · ")}</p>{question.selected_answer ? <p className="answer-result">Recorded: {question.selected_answer === "YES" ? "Yes" : "No"}. Updated estimate: {question.candidate_distribution_after.map(item => `${item.candidate === "PREDECESSOR_COMPLETE" ? "Complete" : "Incomplete"} ${(item.probability * 100).toFixed(0)}%`).join(" · ")}</p> : <div className="button-row"><button className="button secondary" type="button" disabled={busy} onClick={() => answerQuestion(question.id, "YES")}>Yes, completed</button><button className="button secondary" type="button" disabled={busy} onClick={() => answerQuestion(question.id, "NO")}>No, not completed</button></div>}</div>)}</section>}
        <section className="page-section"><SectionHeading title="Source evidence" meta={workspace.sources.length} /><div className="list-surface evidence-list">{workspace.sources.map(source => <SourceEvidence key={source.id} source={source} events={workspace.events.filter(event => event.source_id === source.id)} />)}</div></section>
      </div>
      <div>
        <section className="panel decision-panel"><SectionHeading title="Safety checks" meta={patch.rules.length} /><p className="section-intro">Each proposed change is checked before it can be applied.</p>{patch.rules.length ? <div className="rules-list">{patch.rules.map((rule, index) => <div className="rule-row" key={`${rule.name}-${index}`}><div><strong>{rule.name}</strong><p>{rule.reason}</p></div><StatusBadge value={rule.verdict} /></div>)}</div> : <p className="muted">No activity checks were generated.</p>}
          <div className="decision-actions"><div className="decision-title"><span>Decision</span><StatusBadge value={patch.approval_tier} /></div>{blocking && <IssueNote>Blocked checks must be resolved in the report before changes can be applied.</IssueNote>}{patch.approval_tier === "PLANNER" && <IssueNote>Planner review is recommended for these changes.</IssueNote>}
            <button type="button" className="button primary full-width" onClick={() => patchAction(patch.id, "accept")} disabled={busy || !canApply}><Check size={17} aria-hidden="true" />Apply changes</button>
            <div className="button-row"><button type="button" className="button secondary" onClick={() => patchAction(patch.id, "reject")} disabled={busy || patch.status !== "PENDING"}><X size={16} aria-hidden="true" />Reject</button><button type="button" className="button secondary" onClick={() => patchAction(patch.id, "undo")} disabled={busy || patch.status !== "ACCEPTED"}><RotateCcw size={16} aria-hidden="true" />Undo</button></div>
          </div>
        </section>
        <section className="page-section"><SectionHeading title="Patch history" meta={workspace.patches.length} /><div className="list-surface">{workspace.patches.map(item => <div className="history-row" key={item.id}><div><strong>Revision {item.revision}</strong><small>{item.id}</small></div><StatusBadge value={item.status} /></div>)}</div></section>
        <section className="page-section"><SectionHeading title="Audit trail" meta={audit.length} /><div className="list-surface">{audit.length ? audit.map((entry, index) => <div className="history-row" key={index}><strong>{entry.action.replaceAll("_", " ").toLowerCase()}</strong><StatusBadge value={entry.status} /></div>) : <div className="inline-empty">Audit entries are unavailable.</div>}</div></section>
      </div>
    </div>
  </>;
}
