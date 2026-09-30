import type { PortalMeResponse } from "../../shared/portal";

export type PortalEntryDestination = "/portal" | "/portal/profile" | "/portal/application" | "/portal/project";

export function resolvePortalEntryDestination(state: PortalMeResponse): PortalEntryDestination {
  if (!state.profile) {
    return "/portal/profile";
  }

  if (!state.application) {
    return "/portal/application";
  }

  if (state.participant?.status === "pending") {
    return "/portal/application";
  }

  return "/portal";
}
