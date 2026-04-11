import { createFileRoute } from "@tanstack/react-router";
import { PortalHistoryPage } from "../../portal/pages/PortalHistoryPage";

export const Route = createFileRoute("/portal/history")({
  component: PortalHistoryPage,
});
