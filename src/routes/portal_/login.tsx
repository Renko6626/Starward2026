import { createFileRoute } from "@tanstack/react-router";
import { PortalLoginPage } from "../../portal/pages/PortalLoginPage";
import { scheduleSelectionSearch } from "../../portal/lib/schedule-selection";

// Keep the login page outside the `/portal` outlet so future auth guards can cover only portal pages.
export const Route = createFileRoute("/portal_/login")({
  validateSearch: search => ({ ...scheduleSelectionSearch(search), ...(search.reset === 'password' ? { reset: 'password' as const } : {}) }),
  component: PortalLoginPage,
});
