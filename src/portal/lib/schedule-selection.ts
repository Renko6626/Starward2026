import type { CollaborationSegment } from "../../shared/collaboration";

type RegistrationTime = Pick<CollaborationSegment, "id" | "name" | "scheduledAt">;
export type RegistrationTimeChange = { from: RegistrationTime; to: RegistrationTime };

export function requiresRegistrationTimeConfirmation(
  current: RegistrationTime | undefined,
  selected: RegistrationTime,
  confirmation?: RegistrationTimeChange,
) {
  if (!current || current.id === selected.id) return false;
  return !confirmation || confirmation.from.id !== current.id || confirmation.to.id !== selected.id
    || confirmation.from.scheduledAt !== current.scheduledAt || confirmation.to.scheduledAt !== selected.scheduledAt;
}

/** Carry only a slot identifier through login; reservation happens on submission. */
export function scheduleSelectionSearch(search: Record<string, unknown>): { segment?: string } {
  return { segment: typeof search.segment === "string" && search.segment.length <= 64 ? search.segment : undefined };
}

export function isRegistrationSegmentSelectable(
  segment: Pick<CollaborationSegment, "status" | "participantId">,
  participantId: string,
) {
  return segment.status === "available" || (segment.status === "reserved" && segment.participantId === participantId);
}

export function getScheduleAction(
  segment: Pick<CollaborationSegment, "status" | "participantId">,
  participantId: string,
  operationSucceeded = false,
) {
  if (operationSucceeded) return null;
  if (segment.status === "available") return "select";
  if (participantId && segment.participantId === participantId) return "release";
  return segment.status === "confirmed" ? "swap" : null;
}

const scheduleIntentKey = (userId: string) => `starward-schedule-intent:${userId}`;

export function readScheduleIntent(userId: string) {
  try {
    return scheduleSelectionSearch({ segment: sessionStorage.getItem(scheduleIntentKey(userId)) }).segment;
  } catch { return undefined; }
}

export function saveScheduleIntent(userId: string, segmentId: string) {
  try {
    if (segmentId) sessionStorage.setItem(scheduleIntentKey(userId), segmentId);
    else sessionStorage.removeItem(scheduleIntentKey(userId));
  } catch { /* The selected slot can still travel through the route search. */ }
}
