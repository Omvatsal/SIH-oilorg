import { redirect } from "next/navigation";

export default async function WorkspaceRedirect({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view } = await searchParams;
  const routes: Record<string, string> = {
    schedule: "/schedule",
    actual: "/reports",
    progress: "/schedule",
    approvals: "/review",
    memory: "/review",
    settings: "/import",
  };
  redirect(routes[view ?? ""] ?? "/import");
}
