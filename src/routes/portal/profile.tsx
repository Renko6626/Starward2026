import { createFileRoute } from "@tanstack/react-router";
import { PortalProfilePage } from "../../portal/pages/PortalProfilePage";

export const Route = createFileRoute("/portal/profile")({
  component: PortalProfilePage,
});
