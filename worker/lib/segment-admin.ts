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
  if (input.nextStatus !== "held") {
    return {
      nextStatus: input.nextStatus,
      nextParticipantId: null,
      claimedAt: null,
      releasedAt: null,
    };
  }

  if (!input.nextParticipantId) {
    throw new Error("held 状态必须指定认领人。");
  }

  const isSameHeldAssignment =
    input.currentStatus === "held" && input.currentParticipantId === input.nextParticipantId;

  return {
    nextStatus: "held",
    nextParticipantId: input.nextParticipantId,
    claimedAt: isSameHeldAssignment ? input.currentClaimedAt ?? input.now : input.now,
    releasedAt: null,
  };
}
