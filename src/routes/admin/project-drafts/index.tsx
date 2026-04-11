import { createFileRoute } from "@tanstack/react-router";
import { AdminProjectDraftsPage } from "../../../admin/pages/AdminProjectDraftsPage";

export const Route = createFileRoute("/admin/project-drafts/")({
  component: AdminProjectDraftsPage,
});
