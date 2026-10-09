import { Hono } from "hono";
import { publicHttpsUrlSchema } from "../../src/shared/works";
import { confirmPortalProjectRelease, getPortalReleaseState } from "../data/relay-publication";
import { Resend } from "resend";
import {
  workspaceApplicationInputSchema,
  createSwapInputSchema,
  respondSwapInputSchema,
  type CollaborationMutationResponse,
} from "../../src/shared/collaboration";
import {
  CollaborationConflict,
  saveWorkspaceApplication,
  getCollaboration,
  getPortalNeighbors,
  createSwap,
  respondSwap,
  withdrawApplication,
} from "../data/collaboration";
import { upsertPortalApplicationInputSchema } from "../../src/shared/applications";
import type {
  PortalApplicationMutationResponse,
  PortalApplicationResponse,
  PortalAvailableSegmentListResponse,
  PortalCurrentSegmentResponse,
  PortalDashboardResponse,
  PortalHistoryResponse,
  PortalMeResponse,
  PortalProfileMutationResponse,
  PortalProfileResponse,
  PortalProjectMutationResponse,
  PortalProjectResponse,
} from "../../src/shared/portal";
import {
  segmentMutationInputSchema,
  updatePortalProfileInputSchema,
  updatePortalProjectPreviewInputSchema,
  updatePortalProjectReviewInputSchema,
} from "../../src/shared/portal";
import {
  getPortalApplicationByUserId,
  upsertPortalApplication,
} from "../data/applications";
import { listEventWindows } from "../data/event-windows";
import {
  getPortalDashboard,
  getPortalHistory,
  getPortalMe,
  mapPortalAuthUser,
  mapPortalParticipant,
} from "../data/portal";
import {
  getPortalProfileByUserId,
  upsertPortalProfile,
} from "../data/portal-profiles";
import {
  getPortalProjectDraftDetail,
  submitPortalProjectPreview,
  submitPortalProjectReview,
  updatePortalProjectPreview,
  updatePortalProjectReview,
} from "../data/project-drafts";
import {
  changeParticipantSegment,
  claimParticipantSegment,
  getPortalSegmentState,
  listAvailableSegments,
  releaseParticipantSegment,
} from "../data/segments";
import type { ParticipantAuthRow } from "../data/participants";
import { enforceApplicationSubmissionGuards } from "../lib/application-submission-guards";
import { requireParticipantSession } from "../lib/auth";
import { getRequiredDb, jsonError } from "../lib/http";
import {
  resolveParticipantActionEligibility,
  resolveProjectWorkspaceEligibility,
} from "../lib/portal-access";
import {
  resolvePortalApplicationMutation,
  resolvePortalApplicationProfileRequirement,
} from "../lib/portal-application";
import type { AppContext, AppRouteConfig } from "../lib/types";
import { getWindowOrFallback } from "../lib/windows";

const portalApi = new Hono<AppRouteConfig>();

type PortalSessionState = NonNullable<
  Awaited<ReturnType<typeof requireParticipantSession>>
>;

type PortalSessionAccess =
  | {
      response: ReturnType<typeof jsonError>;
    }
  | {
      db: D1Database;
      session: PortalSessionState["session"];
      participant: ParticipantAuthRow | null;
    };

type ParticipantActionAccess =
  | {
      response: ReturnType<typeof jsonError>;
    }
  | {
      db: D1Database;
      session: PortalSessionState["session"];
      participant: ParticipantAuthRow;
    };

type ProjectWorkspaceAccess =
  | {
      response: ReturnType<typeof jsonError>;
    }
  | {
      db: D1Database;
      session: PortalSessionState["session"];
      participant: ParticipantAuthRow;
    };

portalApi.get("/me", async (c) => {
  const access = await getPortalSessionAccess(c);

  if ("response" in access) {
    return access.response;
  }

  const response: PortalMeResponse = await getPortalMe(access.db, {
    user: mapPortalAuthUser(access.session.user),
    participant: access.participant,
  });

  return c.json(response);
});

portalApi.get("/dashboard", async (c) => {
  const access = await getPortalSessionAccess(c);

  if ("response" in access) {
    return access.response;
  }

  const response: PortalDashboardResponse = await getPortalDashboard(
    access.db,
    {
      user: mapPortalAuthUser(access.session.user),
      participant: access.participant,
      windows: await listEventWindows(access.db),
    },
  );

  return c.json(response);
});

portalApi.get("/profile", async (c) => {
  const access = await getPortalSessionAccess(c);

  if ("response" in access) {
    return access.response;
  }

  const response: PortalProfileResponse = {
    user: mapPortalAuthUser(access.session.user),
    participant: access.participant
      ? mapPortalParticipant(access.participant)
      : null,
    profile: await getPortalProfileByUserId(access.db, access.session.user.id),
    application: await getPortalApplicationByUserId(
      access.db,
      access.session.user.id,
    ),
  };

  return c.json(response);
});

portalApi.patch("/profile", async (c) => {
  const access = await getPortalSessionAccess(c);

  if ("response" in access) {
    return access.response;
  }

  const body = await c.req.json().catch(() => null);
  const parsed = updatePortalProfileInputSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError(
      c,
      422,
      "invalid_request",
      "资料参数不正确。",
      parsed.error.flatten(),
    );
  }

  const profile = await upsertPortalProfile(access.db, {
    userId: access.session.user.id,
    data: parsed.data,
  });

  if (!profile) {
    return jsonError(c, 500, "profile_missing", "资料已写入，但未能重新读取。");
  }

  const response: PortalProfileMutationResponse = {
    ok: true,
    message: "已更新联系资料与公开署名设置。",
    profile,
  };

  return c.json(response);
});

portalApi.post("/application-with-segment", async (c) => {
  const access = await getPortalSessionAccess(c);
  if ("response" in access) return access.response;
  const parsed = workspaceApplicationInputSchema.safeParse(
    await c.req.json().catch(() => null),
  );
  if (!parsed.success)
    return jsonError(
      c,
      422,
      "invalid_request",
      "报名资料参数不正确。",
      parsed.error.flatten(),
    );
  const submissionGuard = await enforceApplicationSubmissionGuards(c, {
    contactEmail: access.session.user.email,
    turnstileToken: parsed.data.turnstileToken,
  });
  if (!submissionGuard.ok)
    return jsonError(
      c,
      submissionGuard.status,
      submissionGuard.code,
      submissionGuard.message,
    );
  try {
    const application = await saveWorkspaceApplication(
      access.db,
      access.session.user.id,
      access.session.user.email,
      parsed.data,
    );
    return c.json({
      ok: true,
      message: "已提交报名并预留时段，等待主催审核。",
      application,
    } satisfies PortalApplicationMutationResponse);
  } catch (error) {
    if (error instanceof CollaborationConflict)
      return jsonError(c, 409, "application_segment_conflict", error.message);
    throw error;
  }
});

portalApi.post("/application/withdraw", async (c) => {
  const access = await getPortalSessionAccess(c);
  if ("response" in access) return access.response;
  try {
    await withdrawApplication(access.db, access.session.user.id);
    return c.json({ ok: true, message: "已撤回报名并释放时段。" });
  } catch (error) {
    if (error instanceof CollaborationConflict)
      return jsonError(c, 409, "application_withdraw_conflict", error.message);
    throw error;
  }
});

portalApi.get("/collaboration", async (c) => {
  const access = await getPortalSessionAccess(c);
  if ("response" in access) return access.response;
  return c.json(await getCollaboration(access.db, access.session.user.id));
});

portalApi.get("/neighbors", async (c) => {
  const access = await getPortalSessionAccess(c);
  if ("response" in access) return access.response;
  return c.json(await getPortalNeighbors(access.db, access.session.user.id));
});

portalApi.post("/swaps", async (c) => {
  const access = await getParticipantActionAccess(c);
  if ("response" in access) return access.response;
  const parsed = createSwapInputSchema.safeParse(
    await c.req.json().catch(() => null),
  );
  if (!parsed.success)
    return jsonError(
      c,
      422,
      "invalid_request",
      "交换请求参数不正确。",
      parsed.error.flatten(),
    );
  try {
    const request = await createSwap(
      access.db,
      access.participant.id,
      parsed.data.segmentId,
      parsed.data.message,
    );
    let notification: CollaborationMutationResponse["notification"] =
      "not_configured";
    if (c.env.RESEND_API_KEY && c.env.RESEND_FROM_EMAIL && request.email) {
      notification = "failed";
      try {
        const link = new URL(
          "/portal",
          c.env.BETTER_AUTH_URL || c.req.url,
        ).toString();
        const result = await new Resend(c.env.RESEND_API_KEY).emails.send({
          from: `${c.env.RESEND_FROM_NAME?.trim() || "Starward2026"} <${c.env.RESEND_FROM_EMAIL}>`,
          to: request.email,
          subject: "你收到了一条时段交换请求",
          text: `有创作者希望与你交换时段。请登录工作台查看请求并决定是否同意：${link}\n请求仅能在工作台内处理。`,
        });
        notification = result.error ? "failed" : "sent";
      } catch {
        notification = "failed";
      }
    }
    return c.json(
      {
        ok: true,
        message:
          notification === "failed"
            ? "已保存交换请求，邮件提醒发送失败，对方仍可在工作台查看。"
            : "已发送交换请求，等待对方回复。",
        notification,
      } satisfies CollaborationMutationResponse,
      201,
    );
  } catch (error) {
    if (error instanceof CollaborationConflict)
      return jsonError(c, 409, "swap_conflict", error.message);
    throw error;
  }
});

portalApi.post("/swaps/:requestId/respond", async (c) => {
  const access = await getParticipantActionAccess(c);
  if ("response" in access) return access.response;
  const parsed = respondSwapInputSchema.safeParse(
    await c.req.json().catch(() => null),
  );
  if (!parsed.success)
    return jsonError(
      c,
      422,
      "invalid_request",
      "交换操作参数不正确。",
      parsed.error.flatten(),
    );
  try {
    await respondSwap(
      access.db,
      access.participant.id,
      c.req.param("requestId"),
      parsed.data.action,
    );
    return c.json({
      ok: true,
      message:
        parsed.data.action === "accept"
          ? "已完成时段交换。"
          : parsed.data.action === "reject"
            ? "已拒绝交换请求。"
            : "已取消交换请求。",
    } satisfies CollaborationMutationResponse);
  } catch (error) {
    if (error instanceof CollaborationConflict)
      return jsonError(c, 409, "swap_conflict", error.message);
    throw error;
  }
});

portalApi.get("/application", async (c) => {
  const access = await getPortalSessionAccess(c);

  if ("response" in access) {
    return access.response;
  }

  const application = await getPortalApplicationByUserId(
    access.db,
    access.session.user.id,
  );
  const profile = await getPortalProfileByUserId(
    access.db,
    access.session.user.id,
  );
  const windows = await listEventWindows(access.db);
  const applicationWindow = getWindowOrFallback(windows, "application_open");
  const mutation = resolvePortalApplicationMutation(
    application?.status ?? null,
    applicationWindow.isOpen,
  );
  const profileRequirement = resolvePortalApplicationProfileRequirement(
    profile ? { userId: access.session.user.id } : null,
  );

  const response: PortalApplicationResponse = {
    window: applicationWindow,
    user: mapPortalAuthUser(access.session.user),
    participant: access.participant
      ? mapPortalParticipant(access.participant)
      : null,
    profile,
    application,
    editable: mutation.editable,
    editState: mutation.mode,
    message: !profileRequirement.ok
      ? profileRequirement.message
      : (mutation.message ?? null),
  };

  return c.json(response);
});

portalApi.post("/application", async (c) => {
  const access = await getPortalSessionAccess(c);

  if ("response" in access) {
    return access.response;
  }

  const existing = await getPortalApplicationByUserId(
    access.db,
    access.session.user.id,
  );
  const profile = await getPortalProfileByUserId(
    access.db,
    access.session.user.id,
  );
  const profileRequirement = resolvePortalApplicationProfileRequirement(
    profile ? { userId: access.session.user.id } : null,
  );
  const windows = await listEventWindows(access.db);
  const applicationWindow = getWindowOrFallback(windows, "application_open");

  if (!profileRequirement.ok) {
    return jsonError(
      c,
      profileRequirement.status,
      profileRequirement.code,
      profileRequirement.message,
    );
  }

  const mutation = resolvePortalApplicationMutation(
    existing?.status ?? null,
    applicationWindow.isOpen,
  );

  if (mutation.mode !== "create") {
    return jsonError(
      c,
      409,
      "portal_application_exists",
      "当前账号已有报名记录，请使用更新操作。",
    );
  }

  if (!mutation.editable) {
    return jsonError(
      c,
      403,
      "portal_application_closed",
      mutation.message ?? "当前报名窗口未开放，请等待主催开启。",
    );
  }

  const body = await c.req.json().catch(() => null);
  const parsed = upsertPortalApplicationInputSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError(
      c,
      422,
      "invalid_request",
      "报名资料参数不正确。",
      parsed.error.flatten(),
    );
  }

  const guard = await enforceApplicationSubmissionGuards(c, {
    contactEmail: access.session.user.email,
    turnstileToken: readTurnstileToken(body),
  });

  if (!guard.ok) {
    return jsonError(c, guard.status, guard.code, guard.message);
  }

  const result = await upsertPortalApplication(access.db, {
    userId: access.session.user.id,
    authEmail: access.session.user.email,
    data: parsed.data,
  });

  if (!result.ok) {
    return jsonError(c, result.status, result.code, result.message);
  }

  const response: PortalApplicationMutationResponse = {
    ok: true,
    message: result.message,
    application: result.application,
  };

  return c.json(response, 201);
});

portalApi.patch("/application", async (c) => {
  const access = await getPortalSessionAccess(c);

  if ("response" in access) {
    return access.response;
  }

  const existing = await getPortalApplicationByUserId(
    access.db,
    access.session.user.id,
  );
  const profile = await getPortalProfileByUserId(
    access.db,
    access.session.user.id,
  );
  const profileRequirement = resolvePortalApplicationProfileRequirement(
    profile ? { userId: access.session.user.id } : null,
  );
  const windows = await listEventWindows(access.db);
  const applicationWindow = getWindowOrFallback(windows, "application_open");

  if (!profileRequirement.ok) {
    return jsonError(
      c,
      profileRequirement.status,
      profileRequirement.code,
      profileRequirement.message,
    );
  }

  const mutation = resolvePortalApplicationMutation(
    existing?.status ?? null,
    applicationWindow.isOpen,
  );

  if (mutation.mode === "create") {
    return jsonError(
      c,
      404,
      "portal_application_missing",
      "当前账号还没有报名记录。",
    );
  }

  if (!mutation.editable) {
    return jsonError(
      c,
      mutation.reason === "window_closed" ? 403 : 409,
      mutation.reason === "window_closed"
        ? "portal_application_closed"
        : "portal_application_locked",
      mutation.message ?? "当前报名不可修改。",
    );
  }

  const body = await c.req.json().catch(() => null);
  const parsed = upsertPortalApplicationInputSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError(
      c,
      422,
      "invalid_request",
      "报名资料参数不正确。",
      parsed.error.flatten(),
    );
  }

  const guard = await enforceApplicationSubmissionGuards(c, {
    contactEmail: access.session.user.email,
    turnstileToken: readTurnstileToken(body),
  });

  if (!guard.ok) {
    return jsonError(c, guard.status, guard.code, guard.message);
  }

  const result = await upsertPortalApplication(access.db, {
    userId: access.session.user.id,
    authEmail: access.session.user.email,
    data: parsed.data,
  });

  if (!result.ok) {
    return jsonError(c, result.status, result.code, result.message);
  }

  const response: PortalApplicationMutationResponse = {
    ok: true,
    message: result.message,
    application: result.application,
  };

  return c.json(response);
});

const getCurrentSegmentHandler = async (c: AppContext) => {
  const access = await getParticipantActionAccess(c);

  if ("response" in access) {
    return access.response;
  }

  const windows = await listEventWindows(access.db);
  const segmentState = await getPortalSegmentState(access.db, {
    participant: access.participant,
    windows,
  });
  const response: PortalCurrentSegmentResponse = {
    user: mapPortalAuthUser(access.session.user),
    participant: mapPortalParticipant(access.participant),
    profile: await getPortalProfileByUserId(access.db, access.session.user.id),
    application: await getPortalApplicationByUserId(
      access.db,
      access.session.user.id,
    ),
    currentSegment: segmentState.currentSegment,
    actions: segmentState.actions,
    windows: segmentState.windows,
  };

  return c.json(response);
};

const listAvailableSegmentsHandler = async (c: AppContext) => {
  const access = await getParticipantActionAccess(c);

  if ("response" in access) {
    return access.response;
  }

  const response: PortalAvailableSegmentListResponse = {
    items: await listAvailableSegments(access.db),
  };

  return c.json(response);
};

const claimSegmentHandler = async (c: AppContext) => {
  const access = await getParticipantActionAccess(c);

  if ("response" in access) {
    return access.response;
  }

  const body = await c.req.json().catch(() => null);
  const parsed = segmentMutationInputSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError(
      c,
      422,
      "invalid_request",
      "时间段认领参数不正确。",
      parsed.error.flatten(),
    );
  }

  const result = await claimParticipantSegment(access.db, {
    participant: access.participant,
    windows: await listEventWindows(access.db),
    segmentId: parsed.data.segmentId,
  });

  if (!result.ok) {
    return jsonError(c, result.status, result.code, result.message);
  }

  return c.json(result.response);
};

const changeSegmentHandler = async (c: AppContext) => {
  const access = await getParticipantActionAccess(c);

  if ("response" in access) {
    return access.response;
  }

  const body = await c.req.json().catch(() => null);
  const parsed = segmentMutationInputSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError(
      c,
      422,
      "invalid_request",
      "时间段变更参数不正确。",
      parsed.error.flatten(),
    );
  }

  const result = await changeParticipantSegment(access.db, {
    participant: access.participant,
    windows: await listEventWindows(access.db),
    segmentId: parsed.data.segmentId,
  });

  if (!result.ok) {
    return jsonError(c, result.status, result.code, result.message);
  }

  return c.json(result.response);
};

const releaseSegmentHandler = async (c: AppContext) => {
  const access = await getParticipantActionAccess(c);

  if ("response" in access) {
    return access.response;
  }

  const result = await releaseParticipantSegment(access.db, {
    participant: access.participant,
    windows: await listEventWindows(access.db),
  });

  if (!result.ok) {
    return jsonError(c, result.status, result.code, result.message);
  }

  return c.json(result.response);
};

portalApi.get("/segments/current", getCurrentSegmentHandler);
portalApi.get("/segments/available", listAvailableSegmentsHandler);
portalApi.post("/segments/claim", claimSegmentHandler);
portalApi.post("/segments/change", changeSegmentHandler);
portalApi.post("/segments/release", releaseSegmentHandler);

portalApi.get("/project", async (c) => {
  const access = await getProjectWorkspaceAccess(c);

  if ("response" in access) {
    return access.response;
  }

  const windows = await listEventWindows(access.db);
  const draft = await getPortalProjectDraftDetail(
    access.db,
    access.participant.id,
  );

  if (!draft) {
    return jsonError(c, 404, "project_draft_missing", "未找到当前作品资料。");
  }

  const response: PortalProjectResponse = {
    user: mapPortalAuthUser(access.session.user),
    participant: mapPortalParticipant(access.participant),
    profile: await getPortalProfileByUserId(access.db, access.session.user.id),
    application: await getPortalApplicationByUserId(
      access.db,
      access.session.user.id,
    ),
    draft,
    release: await getPortalReleaseState(access.db, access.participant.id),
    windows,
  };

  return c.json(response);
});

portalApi.post("/project/release", async (c) => {
  const access = await getProjectWorkspaceAccess(c);
  if ("response" in access) return access.response;
  const body = await c.req.json().catch(() => null);
  const parsed = publicHttpsUrlSchema.safeParse(body?.workUrl);
  if (!parsed.success) return jsonError(c, 422, "invalid_work_url", "请填写有效的 HTTPS 作品链接。");
  const result = await confirmPortalProjectRelease(access.db, { participant: access.participant, workUrl: parsed.data });
  if (!result.ok) return jsonError(c, result.status, result.code, result.message);
  return c.json(result);
});

portalApi.patch("/project/preview", async (c) => {
  const access = await getProjectWorkspaceAccess(c);

  if ("response" in access) {
    return access.response;
  }

  const body = await c.req.json().catch(() => null);
  const parsed = updatePortalProjectPreviewInputSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError(
      c,
      422,
      "invalid_request",
      "预告信息参数不正确。",
      parsed.error.flatten(),
    );
  }

  const result = await updatePortalProjectPreview(access.db, {
    participant: access.participant,
    data: parsed.data,
  });

  if (!result.ok) {
    return jsonError(c, result.status, result.code, result.message);
  }

  const response: PortalProjectMutationResponse = {
    ok: true,
    message: result.message,
    draft: result.draft,
  };

  return c.json(response);
});

portalApi.post("/project/preview/submit", async (c) => {
  const access = await getProjectWorkspaceAccess(c);

  if ("response" in access) {
    return access.response;
  }

  const result = await submitPortalProjectPreview(access.db, {
    participant: access.participant,
    windows: await listEventWindows(access.db),
  });

  if (!result.ok) {
    return jsonError(c, result.status, result.code, result.message);
  }

  const response: PortalProjectMutationResponse = {
    ok: true,
    message: result.message,
    draft: result.draft,
  };

  return c.json(response);
});

portalApi.patch("/project/review", async (c) => {
  const access = await getProjectWorkspaceAccess(c);

  if ("response" in access) {
    return access.response;
  }

  const body = await c.req.json().catch(() => null);
  const parsed = updatePortalProjectReviewInputSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError(
      c,
      422,
      "invalid_request",
      "审查说明参数不正确。",
      parsed.error.flatten(),
    );
  }

  const result = await updatePortalProjectReview(access.db, {
    participant: access.participant,
    data: parsed.data,
  });

  if (!result.ok) {
    return jsonError(c, result.status, result.code, result.message);
  }

  const response: PortalProjectMutationResponse = {
    ok: true,
    message: result.message,
    draft: result.draft,
  };

  return c.json(response);
});

portalApi.post("/project/review/submit", async (c) => {
  const access = await getProjectWorkspaceAccess(c);

  if ("response" in access) {
    return access.response;
  }

  const result = await submitPortalProjectReview(access.db, {
    participant: access.participant,
    windows: await listEventWindows(access.db),
  });

  if (!result.ok) {
    return jsonError(c, result.status, result.code, result.message);
  }

  const response: PortalProjectMutationResponse = {
    ok: true,
    message: result.message,
    draft: result.draft,
  };

  return c.json(response);
});

portalApi.get("/history", async (c) => {
  const access = await getPortalSessionAccess(c);

  if ("response" in access) {
    return access.response;
  }

  if (!access.participant)
    return jsonError(
      c,
      404,
      "portal_creator_missing",
      "当前账号还没有参与记录。",
    );

  const response: PortalHistoryResponse = await getPortalHistory(access.db, {
    user: mapPortalAuthUser(access.session.user),
    participant: access.participant,
  });

  return c.json(response);
});

export { portalApi };

function readTurnstileToken(body: unknown): string | undefined {
  if (body && typeof body === "object" && "turnstileToken" in body) {
    const token = (body as { turnstileToken?: unknown }).turnstileToken;
    if (typeof token === "string" && token.trim().length > 0) {
      return token.trim();
    }
  }

  return undefined;
}

async function getPortalSessionAccess(
  c: AppContext,
): Promise<PortalSessionAccess> {
  const sessionState = await requireParticipantSession(c);

  if (!sessionState?.session) {
    return {
      response: jsonError(
        c,
        401,
        "portal_not_authenticated",
        "请先完成参与者登录。",
      ),
    };
  }

  return {
    db: getRequiredDb(c),
    session: sessionState.session,
    participant: sessionState.participant,
  };
}

async function getParticipantActionAccess(
  c: AppContext,
): Promise<ParticipantActionAccess> {
  const access = await getPortalSessionAccess(c);

  if ("response" in access) {
    return access;
  }

  const participant = access.participant;
  const eligibility = resolveParticipantActionEligibility(participant);

  if (!eligibility.ok) {
    return {
      response: jsonError(c, 403, eligibility.code, eligibility.message),
    };
  }

  if (!participant) {
    return {
      response: jsonError(
        c,
        403,
        "portal_creator_missing",
        "当前账号尚未完成创作者工作台初始化，请重新登录或联系主催。",
      ),
    };
  }

  return {
    db: access.db,
    session: access.session,
    participant,
  };
}

async function getProjectWorkspaceAccess(
  c: AppContext,
): Promise<ProjectWorkspaceAccess> {
  const access = await getPortalSessionAccess(c);

  if ("response" in access) {
    return access;
  }

  const participant = access.participant;
  const eligibility = resolveProjectWorkspaceEligibility(participant);

  if (!eligibility.ok) {
    return {
      response: jsonError(c, 403, eligibility.code, eligibility.message),
    };
  }

  if (!participant) {
    return {
      response: jsonError(
        c,
        403,
        "portal_creator_missing",
        "当前账号尚未完成创作者工作台初始化，请重新登录或联系主催。",
      ),
    };
  }

  return {
    db: access.db,
    session: access.session,
    participant,
  };
}
