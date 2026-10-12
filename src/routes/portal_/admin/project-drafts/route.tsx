import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/portal_/admin/project-drafts")({
  validateSearch: (search: Record<string, unknown>): { scope?: "pending" | "all" | "has-files"; q?: string } => ({
    scope: search.scope === "all" || search.scope === "has-files" ? search.scope : "pending",
    q: typeof search.q === "string" ? search.q : undefined,
  }),
  component: AdminProjectDraftsOutlet,
});

function AdminProjectDraftsOutlet() {
  return <Outlet />;
}
