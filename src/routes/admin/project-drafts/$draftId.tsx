import { createFileRoute } from "@tanstack/react-router";
import { AdminProjectDraftDetailPage } from "../../../admin/pages/AdminProjectDraftDetailPage";

export const Route = createFileRoute("/admin/project-drafts/$draftId")({
  component: AdminProjectDraftDetailPage,
});
