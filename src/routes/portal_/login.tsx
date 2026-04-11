import { createFileRoute } from "@tanstack/react-router";
import { PortalLoginPage } from "../../portal/pages/PortalLoginPage";

// Keep the login page outside the `/portal` outlet so future auth guards can cover only portal pages.
export const Route = createFileRoute("/portal_/login")({
  component: PortalLoginPage,
});
