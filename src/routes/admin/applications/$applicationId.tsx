import { createFileRoute } from "@tanstack/react-router";
import { AdminApplicationDetailPage } from "../../../admin/pages/AdminApplicationDetailPage";

export const Route = createFileRoute("/admin/applications/$applicationId")({
  component: AdminApplicationDetailPage,
});
