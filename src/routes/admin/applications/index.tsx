import { createFileRoute } from "@tanstack/react-router";
import { AdminApplicationsPage } from "../../../admin/pages/AdminApplicationsPage";

export const Route = createFileRoute("/admin/applications/")({
  component: AdminApplicationsPage,
});
