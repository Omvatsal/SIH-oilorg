"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { DependencyMap } from "../../components/dependency-map";
import { useWorkspace } from "../../components/workspace-provider";
import { EmptyState, PageHeading, SectionHeading, StatusBadge } from "../../components/ui";

export default function SchedulePage() {
  const { summary, workspace } = useWorkspace();
  const [query, setQuery] = useState("");
  const [issuesOnly, setIssuesOnly] = useState(false);
  const graph = summary?.dependency_graph;
  const issueIds = useMemo(() => new Set(graph?.issues.flatMap(issue => issue.activity_ids) ?? []), [graph]);
  const activities = useMemo(() => new Map(summary?.activities?.map(activity => [activity.id, activity]) ?? []), [summary]);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const overdue = summary?.activities?.filter(activity => activity.planned_finish && activity.planned_finish.slice(0, 10) < today && activity.status !== "COMPLETE") ?? [];
  const nodes = useMemo(() => (graph?.nodes ?? []).filter(node => {
    const activity = activities.get(node.activity_id);
    const matches = `${node.activity_id} ${node.activity_name} ${activity?.area ?? ""} ${activity?.discipline ?? ""}`.toLowerCase().includes(query.trim().toLowerCase());
    return matches && (!issuesOnly || issueIds.has(node.activity_id));
  }), [graph, query, issuesOnly, issueIds, activities]);

  if (!summary || !graph) return <><PageHeading eyebrow="04 / PLAN" title="Schedule" description="Inspect the imported activity network." /><EmptyState title="No schedule imported" description="Import a schedule to view its activities and dependencies." href="/import" action="Go to import" /></>;

  return <>
    <PageHeading eyebrow="04 / PLAN" title="Schedule" description="Inspect dependencies, import findings, and reported quantities." />
    <div className="stat-strip schedule-stats"><div><strong>{graph.node_count}</strong><span>Activities</span></div><div><strong>{graph.edge_count}</strong><span>Dependencies</span></div><div><strong>{graph.issues.length}</strong><span>Findings</span></div><div><strong>{overdue.length}</strong><span>Past planned finish</span></div></div>
    <section className="page-section"><SectionHeading title="Activities" meta={`${nodes.length} of ${graph.node_count}`} /><div className="table-tools"><div className="search-field"><Search size={17} aria-hidden="true" /><input aria-label="Search activities" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search ID or activity" />{query && <button type="button" className="icon-button" title="Clear search" aria-label="Clear search" onClick={() => setQuery("")}><X size={16} /></button>}</div><label className="checkbox-control"><input type="checkbox" checked={issuesOnly} onChange={event => setIssuesOnly(event.target.checked)} />Issues only</label></div>
      <div className="table-scroll"><table><thead><tr><th scope="col">Activity</th><th scope="col">Area</th><th scope="col">Planned start</th><th scope="col">Planned finish</th><th scope="col">Status</th><th scope="col">Predecessors</th><th scope="col">Check</th></tr></thead><tbody>{nodes.map(node => { const activity = activities.get(node.activity_id); const isOverdue = activity?.planned_finish && activity.planned_finish.slice(0, 10) < today && activity.status !== "COMPLETE"; return <tr key={node.activity_id}><td><span className="mono table-id">{node.activity_id}</span><strong>{node.activity_name}</strong></td><td>{activity?.area || "—"}</td><td className="mono">{activity?.planned_start?.slice(0, 10) || "—"}</td><td className="mono">{activity?.planned_finish?.slice(0, 10) || "—"}</td><td><StatusBadge value={activity?.status ?? "PLANNED"} /></td><td className="mono">{node.predecessor_ids.length ? node.predecessor_ids.join(", ") : "—"}</td><td>{isOverdue ? <StatusBadge value="OVERDUE" /> : issueIds.has(node.activity_id) ? <StatusBadge value="WARNING" /> : <StatusBadge value="SAFE" />}</td></tr>; })}</tbody></table>{nodes.length === 0 && <div className="inline-empty">No activities match these filters. Clear the search or show all activities.</div>}</div>
    </section>
    <section className="page-section"><SectionHeading title="Task dependencies" meta={`${graph.edge_count} links`} /><p className="muted compact">Arrows run from prerequisites to dependent activities. Only finish-to-start links are checked.</p><DependencyMap graph={graph} /></section>
    <div className="page-grid schedule-lower"><section className="page-section"><SectionHeading title="Dependency findings" meta={graph.issues.length} />{graph.issues.length ? <div className="list-surface">{graph.issues.map((issue, index) => <div className="finding-row" key={`${issue.code}-${index}`}><StatusBadge value={issue.severity} /><div><strong>{issue.code.replaceAll("_", " ")}</strong><p>{issue.message}</p>{issue.activity_ids.length > 0 && <small className="mono">{issue.activity_ids.join(" · ")}</small>}</div></div>)}</div> : <div className="inline-empty">No dependency inconsistencies found.</div>}</section>
      <section className="page-section"><SectionHeading title="Reported quantities" meta={workspace?.quantity_progress.length ?? 0} />{workspace?.quantity_progress.length ? <div className="list-surface">{workspace.quantity_progress.map(progress => <div className="quantity-row" key={progress.activity_id}><div className="quantity-head"><div><span className="mono table-id">{progress.activity_id}</span><strong>{progress.activity_name}</strong></div><strong>{progress.observed_quantity} {progress.quantity_unit}</strong></div>{progress.planned_quantity != null && <><div className="progress-track"><span style={{ width: `${Math.min(100, Math.max(0, progress.percent_complete ?? 0))}%` }} /></div><small>{progress.percent_complete?.toFixed(1) ?? "0"}% of {progress.planned_quantity} {progress.quantity_unit} planned</small></>}</div>)}</div> : <div className="inline-empty">Quantity progress appears after a report includes measurable work.</div>}</section></div>
  </>;
}
