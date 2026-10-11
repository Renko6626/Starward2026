import { createFileRoute } from "@tanstack/react-router";
import { PortalLoginPage } from "../../portal/pages/PortalLoginPage";
import { scheduleSelectionSearch } from "../../portal/lib/schedule-selection";
import { adminReturnTo } from '../../shared/admin-access';

// Keep the login page outside the `/portal` outlet so future auth guards can cover only portal pages.
export const Route = createFileRoute("/portal_/login")({
  validateSearch: (search): { segment?: string; returnTo?: string; reset?: 'password' } => ({ ...scheduleSelectionSearch(search), returnTo: adminReturnTo(search.returnTo), ...(search.reset === 'password' ? { reset: 'password' as const } : {}) }),
  component: PortalLoginPage,
});
