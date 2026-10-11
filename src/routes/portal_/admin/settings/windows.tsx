import { createFileRoute } from "@tanstack/react-router";
import { AdminEventWindowsPage } from "../../../../admin/pages/AdminEventWindowsPage";

export const Route = createFileRoute("/portal_/admin/settings/windows")({
  component: AdminEventWindowsPage,
});
