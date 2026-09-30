import { setWorkPublication } from "../data/works";
import { getWindowOrFallback } from "../lib/windows";
import { Hono } from "hono";
import type {
  AdminApplicationDetailResponse,
  AdminApplicationListResponse,
} from "../../src/shared/applications";
import type {
  AdminEventWindowListResponse,
  AdminEventWindowMutationResponse,
  AdminParticipantDetailResponse,
  AdminParticipantInviteResponse,
  AdminParticipantListResponse,
  AdminProjectDraftDetailResponse,
  AdminProjectDraftListResponse,
  AdminProjectDraftMutationResponse,
  AdminSegmentBootstrapResponse,
  AdminSegmentListResponse,
  AdminSegmentMutationResponse,
} from "../../src/shared/admin";
import { updateApplicationReviewInputSchema } from "../../src/shared/applications";
import {
  bootstrapSegmentsInputSchema,
  updateProjectDraftInputSchema,
  updateSegmentInputSchema,
  updateParticipantInputSchema,
} from "../../src/shared/admin";
import { eventWindowKeySchema, updateEventWindowInputSchema } from "../../src/shared/windows";
import {
  bootstrapActiveScheduleSegments,
  getParticipantDetail,
  listProjectDrafts,
  listParticipants,
  listSegments,
  recordParticipantInviteSent,
  updateActiveScheduleSegment,
  updateParticipant,
} from "../data/admin";
import {
  getApplicationDetail,
  listApplications,
  reviewApplication,
} from "../data/applications";
import { isParticipantPortalEligible } from "../data/participants";
import { listEventWindows, updateEventWindow } from "../data/event-windows";
import {
  maybeSendParticipantApprovalNotice,
  sendParticipantPortalInviteEmail,
} from "../lib/participant-admin";
import { getAdminProjectDraftDetail, updateAdminProjectDraftReview } from "../data/project-drafts";
import { getAdminIdentity, requireAdminAccess } from "../lib/admin";
import { getRequiredDb, jsonError } from "../lib/http";
import type { AppRouteConfig } from "../lib/types";

const adminApi = new Hono<AppRouteConfig>();

adminApi.use("*", async (c, next) => {
  await requireAdminAccess(c);
  await next();
});

adminApi.get("/applications", async (c) => {
  const response: AdminApplicationListResponse = {
    items: await listApplications(getRequiredDb(c)),
  };

  return c.json(response);
});

adminApi.get("/applications/:applicationId", async (c) => {
  const application = await getApplicationDetail(getRequiredDb(c), c.req.param("applicationId"));

  if (!application) {
    return c.json(
      {
        error: {
          code: "not_found",
          message: "未找到对应报名。",
        },
      },
      404,
    );
  }

  const response: AdminApplicationDetailResponse = {
    application,
  };

  return c.json(response);
});

adminApi.patch("/applications/:applicationId", async (c) => {
  const db = getRequiredDb(c);
  const applicationId = c.req.param("applicationId");
  const body = await c.req.json().catch(() => null);
  const parsed = updateApplicationReviewInputSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      {
        error: {
          code: "invalid_request",
          message: "审核动作参数不正确。",
          details: parsed.error.flatten(),
        },
      },
      422,
    );
  }

  const existing = await getApplicationDetail(db, applicationId);

  if (!existing) {
    return c.json(
      {
        error: {
          code: "not_found",
          message: "未找到对应报名。",
        },
      },
      404,
    );
  }

  const adminIdentity = getAdminIdentity(c);
  const application = await reviewApplication(
    db,
    applicationId,
    parsed.data,
    adminIdentity,
  );

  if (!application) {
    return c.json(
      {
        error: {
          code: "not_found",
          message: "未找到对应报名。",
        },
      },
      404,
    );
  }

  const notification = await maybeSendParticipantApprovalNotice({
    env: c.env,
    db,
    actorId: adminIdentity,
    requestUrl: c.req.url,
    previousStatus: existing.status,
    application,
  });

  const response: AdminApplicationDetailResponse = {
    application,
    notification,
  };

  return c.json(response);
});

adminApi.get("/participants", async (c) => {
  const response: AdminParticipantListResponse = {
    items: await listParticipants(getRequiredDb(c)),
  };

  return c.json(response);
});

adminApi.get("/participants/:participantId", async (c) => {
  const participant = await getParticipantDetail(getRequiredDb(c), c.req.param("participantId"));

  if (!participant) {
    return jsonError(c, 404, "not_found", "未找到对应参与者。");
  }

  const response: AdminParticipantDetailResponse = {
    participant,
  };

  return c.json(response);
});

adminApi.patch("/participants/:participantId", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = updateParticipantInputSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError(c, 422, "invalid_request", "参与者更新参数不正确。", parsed.error.flatten());
  }

  const participant = await updateParticipant(
    getRequiredDb(c),
    c.req.param("participantId"),
    parsed.data,
    getAdminIdentity(c),
  );

  if (!participant) {
    return jsonError(c, 404, "not_found", "未找到对应参与者。");
  }

  const response: AdminParticipantDetailResponse = {
    participant,
  };

  return c.json(response);
});

adminApi.post("/participants/:participantId/invite", async (c) => {
  const db = getRequiredDb(c);
  const participant = await getParticipantDetail(db, c.req.param("participantId"));

  if (!participant) {
    return jsonError(c, 404, "not_found", "未找到对应参与者。");
  }

  if (!isParticipantPortalEligible(participant.status)) {
    return jsonError(c, 409, "participant_portal_disabled", "当前参与者状态不可发送通过提醒邮件。");
  }

  const portalLoginUrl = new URL("/portal/login", c.req.url).toString();
  await sendParticipantPortalInviteEmail(c.env, {
    displayName: participant.displayName,
    email: participant.inviteEmail,
    portalLoginUrl,
  });
  await recordParticipantInviteSent(db, {
    participantId: participant.id,
    actorId: getAdminIdentity(c),
    portalLoginUrl,
  });

  const refreshedParticipant = await getParticipantDetail(db, participant.id);

  if (!refreshedParticipant) {
    return jsonError(c, 404, "not_found", "未找到对应参与者。");
  }

  const response: AdminParticipantInviteResponse = {
    ok: true,
    message: `已向 ${participant.inviteEmail} 发送参与资格通过提醒邮件。`,
    participant: refreshedParticipant,
  };

  return c.json(response, 201);
});

const listSegmentsHandler = async (c: any) => {
  const response: AdminSegmentListResponse = {
    items: await listSegments(getRequiredDb(c)),
  };

  return c.json(response);
};

adminApi.get("/segments", listSegmentsHandler);

const bootstrapSegmentsHandler = async (c: any) => {
  const body = await c.req.json().catch(() => null);
  const parsed = bootstrapSegmentsInputSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError(c, 422, "invalid_request", "时间段初始化参数不正确。", parsed.error.flatten());
  }

  const result = await bootstrapActiveScheduleSegments(getRequiredDb(c), parsed.data);

  if (!result.ok) {
    return jsonError(c, result.status, result.code, result.message);
  }

  const response: AdminSegmentBootstrapResponse = {
    ok: true,
    message: result.message,
    items: result.items,
  };

  return c.json(response, 201);
};

adminApi.post("/segments/bootstrap", bootstrapSegmentsHandler);

const updateSegmentHandler = async (c: any) => {
  const body = await c.req.json().catch(() => null);
  const parsed = updateSegmentInputSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError(c, 422, "invalid_request", "时间段更新参数不正确。", parsed.error.flatten());
  }

  const segmentId = c.req.param("segmentId");
  const result = await updateActiveScheduleSegment(
    getRequiredDb(c),
    segmentId,
    parsed.data,
    getAdminIdentity(c),
  );

  if (!result.ok) {
    return jsonError(c, result.status, result.code, result.message);
  }

  const response: AdminSegmentMutationResponse = {
    ok: true,
    message: result.message,
    item: result.item,
  };

  return c.json(response);
};

adminApi.patch("/segments/:segmentId", updateSegmentHandler);

adminApi.get("/project-drafts", async (c) => {
  const response: AdminProjectDraftListResponse = {
    items: await listProjectDrafts(getRequiredDb(c)),
  };

  return c.json(response);
});

adminApi.get("/project-drafts/:draftId", async (c) => {
  const draft = await getAdminProjectDraftDetail(getRequiredDb(c), c.req.param("draftId"));

  if (!draft) {
    return jsonError(c, 404, "not_found", "未找到对应资料。");
  }

  const response: AdminProjectDraftDetailResponse = {
    publicationWindow: getWindowOrFallback(await listEventWindows(getRequiredDb(c)), "public_release_open"),
    draft,
  };

  return c.json(response);
});

adminApi.patch("/project-drafts/:draftId", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = updateProjectDraftInputSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError(c, 422, "invalid_request", "资料审核更新参数不正确。", parsed.error.flatten());
  }

  const result = await updateAdminProjectDraftReview(
    getRequiredDb(c),
    c.req.param("draftId"),
    parsed.data,
    getAdminIdentity(c),
  );

  if (!result.ok) {
    return jsonError(c, result.status, result.code, result.message);
  }

  const response: AdminProjectDraftMutationResponse = {
    ok: true,
    message: result.message,
    draft: result.draft,
  };

  return c.json(response);
});

for (const action of ["publish", "unpublish"] as const) {
  adminApi.post(`/project-drafts/:draftId/${action}`, async (c) => {
    const result = await setWorkPublication(getRequiredDb(c), c.req.param("draftId"), action === "publish", getAdminIdentity(c));
    if (!result.ok) return jsonError(c, result.status, result.code, result.message);
    return c.json(result);
  });
}

adminApi.get("/event-windows", async (c) => {
  const response: AdminEventWindowListResponse = {
    items: await listEventWindows(getRequiredDb(c)),
  };

  return c.json(response);
});

adminApi.patch("/event-windows/:key", async (c) => {
  const parsedKey = eventWindowKeySchema.safeParse(c.req.param("key"));

  if (!parsedKey.success) {
    return jsonError(c, 422, "invalid_request", "开放窗口键不正确。", parsedKey.error.flatten());
  }

  const body = await c.req.json().catch(() => null);
  const parsed = updateEventWindowInputSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError(c, 422, "invalid_request", "开放窗口更新参数不正确。", parsed.error.flatten());
  }

  const item = await updateEventWindow(getRequiredDb(c), parsedKey.data, parsed.data);

  if (!item) {
    return jsonError(c, 404, "not_found", "未找到对应开放窗口。");
  }

  const response: AdminEventWindowMutationResponse = {
    ok: true,
    message: `${item.label}已更新。`,
    item,
  };

  return c.json(response);
});

export { adminApi };
