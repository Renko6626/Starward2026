import { createFileRoute } from "@tanstack/react-router";
import { PortalSchedulePage } from "../../portal/pages/PortalSchedulePage";

export const Route = createFileRoute("/portal/schedule")({
  component: PortalSchedulePage,
});
