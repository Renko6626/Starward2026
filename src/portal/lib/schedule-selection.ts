import type { CollaborationSegment } from "../../shared/collaboration";

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
