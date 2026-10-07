import type { PortalMeResponse } from "../../shared/portal";

export type PortalEntryDestination = "/portal";

export function resolvePortalEntryDestination(_state: PortalMeResponse): PortalEntryDestination {
  return "/portal";
}
