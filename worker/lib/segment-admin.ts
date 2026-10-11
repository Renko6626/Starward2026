import type { PortalSegmentStatus } from "../../src/shared/portal";

export type ResolvedAdminSegmentState = {
  nextStatus: PortalSegmentStatus;
  nextParticipantId: string | null;
  claimedAt: string | null;
  releasedAt: string | null;
};

export function resolveAdminSegmentState(input: {
  currentStatus: PortalSegmentStatus;
  currentParticipantId: string | null;
  currentClaimedAt: string | null;
  nextStatus: PortalSegmentStatus;
  nextParticipantId: string | null;
  now: string;
}): ResolvedAdminSegmentState {
  if (input.nextStatus === "open" || input.nextStatus === "released") {
    return {
      nextStatus: input.nextStatus,
      nextParticipantId: null,
      claimedAt: null,
      releasedAt: null,
    };
  }

  if (!input.nextParticipantId && input.nextStatus === "held") {
    throw new Error("held 状态必须指定认领人。");
  }

  const isSameHeldAssignment =
    input.currentParticipantId === input.nextParticipantId;

  return {
    nextStatus: input.nextStatus,
    nextParticipantId: input.nextParticipantId,
    claimedAt: input.nextParticipantId ? isSameHeldAssignment ? input.currentClaimedAt ?? input.now : input.now : null,
    releasedAt: null,
  };
}
