import { z } from "zod";
import { upsertPortalApplicationInputSchema } from "./applications";
import { updatePortalProfileInputSchema, type PortalApplicationMutationResponse } from "./portal";

export const workspaceApplicationInputSchema = z.object({
  profile: updatePortalProfileInputSchema,
  application: upsertPortalApplicationInputSchema,
  segmentId: z.string().trim().min(1).max(64),
});
export type WorkspaceApplicationInput = z.infer<typeof workspaceApplicationInputSchema>;
export type WorkspaceApplicationResponse = PortalApplicationMutationResponse;

export type CollaborationSegment = {
  scheduledAt: string | null;
  id: string;
  code: string;
  name: string;
  description: string | null;
  status: "available" | "reserved" | "confirmed" | "unavailable";
  participantId: string | null;
  publicName: string | null;
};
export type SwapRequest = {
  id: string;
  requesterId: string;
  recipientId: string;
  requesterName: string;
  recipientName: string;
  requesterSegmentId: string;
  recipientSegmentId: string;
  requesterSegmentName: string;
  recipientSegmentName: string;
  message: string | null;
  status: "pending" | "accepted" | "rejected" | "cancelled" | "expired";
  createdAt: string;
};
export type CollaborationResponse = {
  participantId: string;
  segments: CollaborationSegment[];
  requests: SwapRequest[];
  canSwap: boolean;
};
export const createSwapInputSchema = z.object({
  segmentId: z.string().trim().min(1).max(64),
  message: z.string().trim().max(500).optional(),
});
export const respondSwapInputSchema = z.object({ action: z.enum(["accept", "reject", "cancel"]) });
export type CollaborationMutationResponse = { ok: true; message: string; notification?: "sent" | "failed" | "not_configured" };

export type PortalNeighbor = {
  segmentId: string;
  segmentCode: string;
  segmentName: string;
  status: CollaborationSegment["status"];
  publicName: string | null;
  bilibiliUid: string | null;
};
export type PortalNeighborsResponse = {
  currentSegmentId: string | null;
  previous: PortalNeighbor | null;
  next: PortalNeighbor | null;
};
