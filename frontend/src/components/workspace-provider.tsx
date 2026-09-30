"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { api, uploadBody } from "../lib/api";
import type { AskBackQuestion, DependencyGraph, Patch, Summary, Workspace } from "../lib/types";

const STORAGE_KEY = "setu-workspace-v1";
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
type Feedback = { tone: "success" | "error"; message: string } | null;
type WorkspaceContextValue = {
  ready: boolean; busy: boolean; summary: Summary | null; workspace: Workspace | null;
  message: string; setMessage: (value: string | ((current: string) => string)) => void;
  reportDate: string; setReportDate: (value: string) => void;
  area: string; setArea: (value: string) => void;
  feedback: Feedback; clearFeedback: () => void;
  importSchedule: (file: File) => Promise<boolean>;
  processMessage: () => Promise<boolean>;
  uploadReport: (file: File) => Promise<boolean>;
  uploadReports: (files: File[]) => Promise<number>;
  patchAction: (patchId: string, action: "accept" | "reject" | "undo") => Promise<boolean>;
  answerQuestion: (questionId: string, answer: "YES" | "NO") => Promise<boolean>;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [message, setMessage] = useState("P-201 fitted yesterday evening. Alignment done this morning, but discharge couldn't happen because the valve hasn't arrived.");
  const [reportDate, setReportDate] = useState(today);
  const [area, setArea] = useState("Unit-2");
  const [feedback, setFeedback] = useState<Feedback>(null);

  useEffect(() => {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (!saved) { setReady(true); return; }
    let parsed: { summary: Summary; reportId?: string; message?: string; reportDate?: string; area?: string };
    try { parsed = JSON.parse(saved); } catch { sessionStorage.removeItem(STORAGE_KEY); setReady(true); return; }
    setMessage(parsed.message ?? "");
    setReportDate(parsed.reportDate ?? today());
    setArea(parsed.area ?? "Unit-2");
    if (!parsed.summary?.schedule_id) { setReady(true); return; }
    Promise.all([
      api<DependencyGraph>(`/schedule/${parsed.summary.schedule_id}/dependencies`),
      parsed.reportId ? api<Workspace>(`/workspace/${parsed.reportId}`) : Promise.resolve(null),
    ]).then(([graph, report]) => {
      setSummary({ ...parsed.summary, dependency_graph: graph });
      setWorkspace(report);
    }).catch(() => {
      sessionStorage.removeItem(STORAGE_KEY);
      setFeedback({ tone: "error", message: "The previous schedule is no longer available. Import it again to continue." });
    }).finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (!summary) { sessionStorage.removeItem(STORAGE_KEY); return; }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ summary, reportId: workspace?.report_id, message, reportDate, area }));
  }, [ready, summary, workspace, message, reportDate, area]);

  async function run(task: () => Promise<void>, success: string): Promise<boolean> {
    if (busy) return false;
    setBusy(true); setFeedback(null);
    try { await task(); setFeedback({ tone: "success", message: success }); return true; }
    catch (cause) { setFeedback({ tone: "error", message: cause instanceof Error ? cause.message : "Something went wrong. Try again." }); return false; }
    finally { setBusy(false); }
  }

  const importSchedule = (file: File) => run(async () => {
    if (!/\.(csv|xer)$/i.test(file.name)) throw new Error("Choose a CSV or XER schedule file.");
    if (!file.size || file.size > 15 * 1024 * 1024) throw new Error("Choose a nonempty schedule no larger than 15 MB.");
    const imported = await api<Summary>("/schedule/import", { method: "POST", body: uploadBody(file) });
    setSummary(imported); setWorkspace(null);
  }, "Schedule imported. You can add a report now.");

  const processMessage = () => run(async () => {
    if (!summary) throw new Error("Import a schedule first.");
    if (!message.trim()) throw new Error("Enter a field message before compiling.");
    if (!reportDate) throw new Error("Choose a report date.");
    const report = await api<Workspace>("/ingest/message", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ schedule_id: summary.schedule_id, text: message.trim(), area: area.trim() || null, received_at: reportDate, ...(workspace?.patches[0]?.status === "PENDING" ? { report_id: workspace.report_id } : {}) }),
    });
    setWorkspace(report);
  }, "Report compiled. Review the proposed changes.");

  const uploadReport = (file: File) => run(async () => {
    if (!summary) throw new Error("Import a schedule first.");
    if (!/\.(txt|csv|xlsx)$/i.test(file.name)) throw new Error("Choose a TXT, CSV, or XLSX report.");
    if (!reportDate) throw new Error("Choose a report date.");
    const query = new URLSearchParams({ schedule_id: summary.schedule_id, received_at: reportDate, ...(area.trim() ? { area: area.trim() } : {}), ...(workspace?.patches[0]?.status === "PENDING" ? { report_id: workspace.report_id } : {}) });
    setWorkspace(await api<Workspace>(`/ingest/file?${query}`, { method: "POST", body: uploadBody(file) }));
  }, "Report uploaded. Review the proposed changes.");

  const uploadReports = async (files: File[]): Promise<number> => {
    if (busy || !summary || !files.length) return 0;
    setBusy(true); setFeedback(null);
    let activeWorkspace = workspace;
    let uploaded = 0;
    try {
      if (!reportDate) throw new Error("Choose a report date.");
      for (const file of files) {
        if (!/\.(txt|csv|xlsx)$/i.test(file.name) || !file.size || file.size > 15 * 1024 * 1024) throw new Error(`${file.name}: choose a nonempty TXT, CSV, or XLSX file no larger than 15 MB.`);
        const query = new URLSearchParams({ schedule_id: summary.schedule_id, received_at: reportDate, ...(area.trim() ? { area: area.trim() } : {}), ...(activeWorkspace?.patches[0]?.status === "PENDING" ? { report_id: activeWorkspace.report_id } : {}) });
        activeWorkspace = await api<Workspace>(`/ingest/file?${query}`, { method: "POST", body: uploadBody(file) });
        setWorkspace(activeWorkspace);
        uploaded += 1;
      }
      setFeedback({ tone: "success", message: `${uploaded} report source${uploaded === 1 ? "" : "s"} uploaded. Review the proposed changes.` });
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : "Upload failed.";
      setFeedback({ tone: "error", message: `${detail} ${uploaded ? `${uploaded} of ${files.length} files uploaded; the rest remain queued.` : "Your files remain queued."}` });
    } finally { setBusy(false); }
    return uploaded;
  };

  const patchAction = (patchId: string, action: "accept" | "reject" | "undo") => run(async () => {
    const changed = await api<Patch>(`/patches/${patchId}/${action}`, { method: "POST" });
    setWorkspace(current => current ? { ...current, patches: current.patches.map(patch => patch.id === changed.id ? changed : patch) } : current);
    if (action === "accept" || action === "undo") {
      const statuses = new Map(changed.updates.map(update => [update.activity_id, action === "accept" ? update.after : update.before]));
      setSummary(current => current ? { ...current, activities: current.activities?.map(activity => statuses.has(activity.id) ? { ...activity, status: statuses.get(activity.id) ?? activity.status } : activity) } : current);
    }
  }, action === "accept" ? "Schedule changes applied." : action === "reject" ? "Patch rejected." : "Schedule changes undone.");

  const answerQuestion = (questionId: string, answer: "YES" | "NO") => run(async () => {
    if (!workspace) throw new Error("Open a report first.");
    const changed = await api<AskBackQuestion>(`/workspace/${workspace.report_id}/questions/${questionId}/answer`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answer }) });
    setWorkspace(current => current ? { ...current, ask_back_questions: current.ask_back_questions.map(item => item.id === changed.id ? changed : item) } : current);
  }, "Clarification recorded.");

  return <WorkspaceContext.Provider value={{ ready, busy, summary, workspace, message, setMessage, reportDate, setReportDate, area, setArea, feedback, clearFeedback: () => setFeedback(null), importSchedule, processMessage, uploadReport, uploadReports, patchAction, answerQuestion }}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error("WorkspaceProvider is missing.");
  return value;
}
