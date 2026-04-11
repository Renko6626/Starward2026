import { createFileRoute } from "@tanstack/react-router";
import { PortalOverviewPage } from "../../portal/pages/PortalOverviewPage";

export const Route = createFileRoute("/portal/")({
  component: PortalOverviewPage,
});
