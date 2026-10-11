import type { PortalMeResponse } from "../../shared/portal";

export type PortalEntryDestination = "/portal" | "/works";

export function resolvePortalEntryDestination(
  _state: PortalMeResponse | null,
  _options: { newRegistration?: boolean; segment?: string } = {},
): PortalEntryDestination {
  return "/portal";
}
