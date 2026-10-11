import { createFileRoute } from "@tanstack/react-router";
import { AdminProjectDraftsPage } from "../../../../admin/pages/AdminProjectDraftsPage";

export const Route = createFileRoute("/portal_/admin/project-drafts/")({
  component: AdminProjectDraftsPage,
});
