import { createFileRoute } from "@tanstack/react-router";
import { PortalProjectPage } from "../../portal/pages/PortalProjectPage";

export const Route = createFileRoute("/portal/project")({
  component: PortalProjectPage,
});
