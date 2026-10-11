import { createFileRoute } from "@tanstack/react-router";
import { AdminSchedulePage } from "../../../admin/pages/AdminSchedulePage";

export const Route = createFileRoute("/portal_/admin/schedule")({
  component: AdminSchedulePage,
});
