import Link from "next/link";
import { ArrowRight, CircleAlert, FileText } from "lucide-react";
import type { Event, Interval, Patch, Source } from "../lib/types";

export function PageHeading({ eyebrow, title, description, aside }: { eyebrow: string; title: string; description: string; aside?: React.ReactNode }) {
  return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{aside && <div className="page-heading-aside">{aside}</div>}</div>;
}

export function EmptyState({ title, description, href, action }: { title: string; description: string; href?: string; action?: string }) {
  return <div className="empty-state"><FileText size={24} strokeWidth={1.6} aria-hidden="true" /><h2>{title}</h2><p>{description}</p>{href && action && <Link className="button primary" href={href}>{action}<ArrowRight size={16} aria-hidden="true" /></Link>}</div>;
}

export function StatusBadge({ value }: { value: string }) {
  const tone = /^(SAFE|COMPLETE|ACCEPTED|AUTO)$/i.test(value) ? "success" : /^(BLOCKED|REJECTED|ERROR)$/i.test(value) ? "danger" : /^(PENDING|SUSPICIOUS|PARTIAL|PLANNER|WARNING|OVERDUE)$/i.test(value) ? "warning" : "neutral";
  return <span className={`status-badge ${tone}`}>{value.replaceAll("_", " ").toLowerCase()}</span>;
}

export function SectionHeading({ title, meta }: { title: string; meta?: string | number }) {
  return <div className="section-heading"><h2>{title}</h2>{meta !== undefined && <span>{meta}</span>}</div>;
}

export function TimeInterval({ interval }: { interval?: Interval | null }) {
  if (!interval) return null;
  const start = new Date(interval.earliest);
  const end = new Date(interval.latest);
  const fmt = (value: Date) => new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(value);
  return <div className="interval"><span className="interval-line" aria-hidden="true" /><span>{fmt(start)}–{fmt(end)} IST</span><small>{interval.confidence.toLowerCase()} confidence</small></div>;
}

function highlighted(text: string, events: Event[]) {
  const spans = events.flatMap(event => event.spans).sort((a, b) => a.start - b.start);
  const nodes: React.ReactNode[] = [];
  let position = 0;
  spans.forEach((span, index) => {
    if (span.start < position || span.end > text.length) return;
    if (span.start > position) nodes.push(text.slice(position, span.start));
    nodes.push(<mark key={index} title={span.kind}>{text.slice(span.start, span.end)}</mark>);
    position = span.end;
  });
  nodes.push(text.slice(position));
  return nodes;
}

export function SourceEvidence({ source, events }: { source: Source; events: Event[] }) {
  return <article className="source-evidence"><div className="source-meta"><strong>{source.filename || (source.kind === "MESSAGE" ? "Field message" : source.kind)}</strong><span>{source.kind.toLowerCase()} · {source.received_at}</span></div><p>{highlighted(source.text, events)}</p></article>;
}

export function PatchSummary({ patch }: { patch: Patch }) {
  return <div className="patch-summary"><span>Revision {patch.revision}</span><StatusBadge value={patch.status} /><StatusBadge value={patch.approval_tier} /><span>{patch.updates.length} proposed {patch.updates.length === 1 ? "change" : "changes"}</span></div>;
}

export function IssueNote({ children }: { children: React.ReactNode }) {
  return <div className="issue-note"><CircleAlert size={18} aria-hidden="true" /><div>{children}</div></div>;
}
