"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, ClipboardCheck, FileInput, FileText, Network, X } from "lucide-react";
import { BRAND } from "../config/brand";
import { useWorkspace } from "./workspace-provider";

const sections = [
  { href: "/import", label: "Import", icon: FileInput },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/review", label: "Review", icon: ClipboardCheck },
  { href: "/schedule", label: "Schedule", icon: Network },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { ready, summary, workspace, feedback, clearFeedback } = useWorkspace();
  const patch = workspace?.patches[0];

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand-block"><span className="brand-mark" aria-hidden="true">S</span><div><strong>{BRAND.name}</strong><small>Site execution</small></div></div>
      <div className="sidebar-label">WORKSPACE</div>
      <nav aria-label="Main navigation" className="main-nav">
        {sections.map(({ href, label, icon: Icon }) => <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined} className={pathname === href ? "nav-link active" : "nav-link"}><Icon size={18} strokeWidth={1.9} aria-hidden="true" /><span>{label}</span>{label === "Review" && patch?.status === "PENDING" && <span className="nav-dot" aria-label="Pending" />}</Link>)}
      </nav>
      <div className="sidebar-bottom"><span className="connection-dot" />Local workspace</div>
    </aside>
    <div className="app-area">
      <header className="topbar">
        <div className="mobile-brand">{BRAND.name}</div>
        <div className="topbar-context"><span className="topbar-label">ACTIVE SCHEDULE</span><strong>{summary ? summary.schedule_id : "None imported"}</strong></div>
        {summary && <Link href="/import" className="topbar-action">Change schedule <ArrowRight size={15} aria-hidden="true" /></Link>}
      </header>
      {feedback && <div role={feedback.tone === "error" ? "alert" : "status"} className={`feedback ${feedback.tone}`}><span>{feedback.message}</span><button type="button" className="icon-button" onClick={clearFeedback} aria-label="Dismiss notification" title="Dismiss notification"><X size={17} /></button></div>}
      <main className="content">{ready ? children : <div className="loading-state" role="status">Opening workspace…</div>}</main>
      <nav className="mobile-nav" aria-label="Mobile navigation">{sections.map(({ href, label, icon: Icon }) => <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined} className={pathname === href ? "mobile-nav-link active" : "mobile-nav-link"}><Icon size={20} aria-hidden="true" /><span>{label}</span></Link>)}</nav>
    </div>
  </div>;
}
