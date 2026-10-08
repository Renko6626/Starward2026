import { createFileRoute } from "@tanstack/react-router";
import { PortalOverviewPage } from "../../portal/pages/PortalOverviewPage";
import { scheduleSelectionSearch } from "../../portal/lib/schedule-selection";

export const Route = createFileRoute("/portal/")({
  validateSearch: scheduleSelectionSearch,
  component: PortalOverviewPage,
});
