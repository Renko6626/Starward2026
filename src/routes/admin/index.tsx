import { createFileRoute } from "@tanstack/react-router";
import { AdminOverviewPage } from "../../admin/pages/AdminOverviewPage";

export const Route = createFileRoute("/admin/")({
  component: AdminOverviewPage,
});
