import { createFileRoute } from "@tanstack/react-router";
import { AdminSchedulePage } from "../../admin/pages/AdminSchedulePage";

export const Route = createFileRoute("/admin/schedule")({
  component: AdminSchedulePage,
});
