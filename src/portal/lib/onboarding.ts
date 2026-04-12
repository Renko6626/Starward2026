import type { PortalMeResponse } from "../../shared/portal";

export type PortalEntryDestination = "/portal" | "/portal/profile" | "/portal/application";

export function resolvePortalEntryDestination(state: PortalMeResponse): PortalEntryDestination {
  if (!state.profile) {
    return "/portal/profile";
  }

  if (!state.application) {
    return "/portal/application";
  }

  return "/portal";
}
