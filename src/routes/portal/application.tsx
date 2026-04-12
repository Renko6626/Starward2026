import { createFileRoute } from "@tanstack/react-router";
import { PortalApplicationPage } from "../../portal/pages/PortalApplicationPage";

export const Route = createFileRoute("/portal/application")({
  component: PortalApplicationPage,
});
