import type { PortalMeResponse } from "../../shared/portal";

export type PortalEntryDestination = "/portal" | "/works";

export function resolvePortalEntryDestination(
  state: PortalMeResponse | null,
  { newRegistration = false, segment }: { newRegistration?: boolean; segment?: string } = {},
): PortalEntryDestination {
  if (newRegistration && !segment && !state?.application
    && state?.participant?.status !== "approved" && state?.participant?.status !== "completed") {
    return "/works";
  }
  return "/portal";
}
