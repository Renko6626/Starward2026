import type { PortalSegmentActionState, PortalSegmentSummary } from "../../src/shared/portal";
import type { EventWindowSummary } from "../../src/shared/windows";
import { getWindowOrFallback } from "./windows";

export function buildPortalSegmentActions(input: {
  currentSegment: PortalSegmentSummary | null;
  windows: EventWindowSummary[];
}): PortalSegmentActionState {
  const claimWindow = getWindowOrFallback(input.windows, "segment_claim_open");
  const changeWindow = getWindowOrFallback(input.windows, "segment_change_open");

  if (!input.currentSegment) {
    return {
      canClaim: claimWindow.isOpen,
      canChange: false,
      canRelease: false,
      claimHint: claimWindow.isOpen ? "当前可以认领一个空闲发布时点。" : "当前未开放发布时点认领。",
      changeHint: "你还没有持有发布时点。",
      releaseHint: "你还没有持有发布时点。",
    };
  }

  if (input.currentSegment.status !== "held") {
    const hint = "当前席位已锁定或完成，请联系主催调整。";
    return { canClaim: false, canChange: false, canRelease: false, claimHint: hint, changeHint: hint, releaseHint: hint };
  }

  const segmentLabel = `${input.currentSegment.code} · ${input.currentSegment.name}`;
  const changeHint = changeWindow.isOpen ? "当前可以变更或释放发布时点。" : "当前未开放发布时点变更或释放。";

  return {
    canClaim: false,
    canChange: changeWindow.isOpen,
    canRelease: changeWindow.isOpen,
    claimHint: `你已经持有 ${segmentLabel}。如需调整，请使用发布时点变更或释放。`,
    changeHint,
    releaseHint: changeHint,
  };
}
