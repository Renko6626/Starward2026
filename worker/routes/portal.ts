import { Hono } from "hono";
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
import { getPortalProfileByUserId, upsertPortalProfile } from "../data/portal-profiles";
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

type PortalSessionState = NonNullable<Awaited<ReturnType<typeof requireParticipantSession>>>;

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

  const response: PortalDashboardResponse = await getPortalDashboard(access.db, {
    user: mapPortalAuthUser(access.session.user),
    participant: access.participant,
    windows: await listEventWindows(access.db),
  });

  return c.json(response);
});

portalApi.get("/profile", async (c) => {
  const access = await getPortalSessionAccess(c);

  if ("response" in access) {
    return access.response;
  }

  const response: PortalProfileResponse = {
    user: mapPortalAuthUser(access.session.user),
    participant: access.participant ? mapPortalParticipant(access.participant) : null,
    profile: await getPortalProfileByUserId(access.db, access.session.user.id),
    application: await getPortalApplicationByUserId(access.db, access.session.user.id),
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
    return jsonError(c, 422, "invalid_request", "资料参数不正确。", parsed.error.flatten());
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

portalApi.get("/application", async (c) => {
  const access = await getPortalSessionAccess(c);

  if ("response" in access) {
    return access.response;
  }

  const application = await getPortalApplicationByUserId(access.db, access.session.user.id);
  const profile = await getPortalProfileByUserId(access.db, access.session.user.id);
  const windows = await listEventWindows(access.db);
  const applicationWindow = getWindowOrFallback(windows, "application_open");
  const mutation = resolvePortalApplicationMutation(application?.status ?? null, applicationWindow.isOpen);
  const profileRequirement = resolvePortalApplicationProfileRequirement(
    profile ? { userId: access.session.user.id } : null,
  );

  const response: PortalApplicationResponse = {
    user: mapPortalAuthUser(access.session.user),
    participant: access.participant ? mapPortalParticipant(access.participant) : null,
    profile,
    application,
    editable: mutation.editable,
    editState: mutation.mode,
    message: !profileRequirement.ok
      ? profileRequirement.message
      : mutation.message ?? null,
  };

  return c.json(response);
});

portalApi.post("/application", async (c) => {
  const access = await getPortalSessionAccess(c);

  if ("response" in access) {
    return access.response;
  }

  const existing = await getPortalApplicationByUserId(access.db, access.session.user.id);
  const profile = await getPortalProfileByUserId(access.db, access.session.user.id);
  const profileRequirement = resolvePortalApplicationProfileRequirement(
    profile ? { userId: access.session.user.id } : null,
  );
  const windows = await listEventWindows(access.db);
  const applicationWindow = getWindowOrFallback(windows, "application_open");

  if (!profileRequirement.ok) {
    return jsonError(c, profileRequirement.status, profileRequirement.code, profileRequirement.message);
  }

  const mutation = resolvePortalApplicationMutation(existing?.status ?? null, applicationWindow.isOpen);

  if (mutation.mode !== "create") {
    return jsonError(c, 409, "portal_application_exists", "当前账号已有报名记录，请使用更新操作。");
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
    return jsonError(c, 422, "invalid_request", "报名资料参数不正确。", parsed.error.flatten());
  }

  const guard = await enforceApplicationSubmissionGuards(c, {
    contactEmail: parsed.data.contactEmail,
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

  const existing = await getPortalApplicationByUserId(access.db, access.session.user.id);
  const profile = await getPortalProfileByUserId(access.db, access.session.user.id);
  const profileRequirement = resolvePortalApplicationProfileRequirement(
    profile ? { userId: access.session.user.id } : null,
  );
  const windows = await listEventWindows(access.db);
  const applicationWindow = getWindowOrFallback(windows, "application_open");

  if (!profileRequirement.ok) {
    return jsonError(c, profileRequirement.status, profileRequirement.code, profileRequirement.message);
  }

  const mutation = resolvePortalApplicationMutation(existing?.status ?? null, applicationWindow.isOpen);

  if (mutation.mode === "create") {
    return jsonError(c, 404, "portal_application_missing", "当前账号还没有报名记录。");
  }

  if (!mutation.editable) {
    return jsonError(
      c,
      mutation.reason === "window_closed" ? 403 : 409,
      mutation.reason === "window_closed" ? "portal_application_closed" : "portal_application_locked",
      mutation.message ?? "当前报名不可修改。",
    );
  }

  const body = await c.req.json().catch(() => null);
  const parsed = upsertPortalApplicationInputSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError(c, 422, "invalid_request", "报名资料参数不正确。", parsed.error.flatten());
  }

  const guard = await enforceApplicationSubmissionGuards(c, {
    contactEmail: parsed.data.contactEmail,
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
    application: await getPortalApplicationByUserId(access.db, access.session.user.id),
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
    return jsonError(c, 422, "invalid_request", "时间段认领参数不正确。", parsed.error.flatten());
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
    return jsonError(c, 422, "invalid_request", "时间段变更参数不正确。", parsed.error.flatten());
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
  const draft = await getPortalProjectDraftDetail(access.db, access.participant.id);

  if (!draft) {
    return jsonError(c, 404, "project_draft_missing", "未找到当前作品资料。");
  }

  const response: PortalProjectResponse = {
    user: mapPortalAuthUser(access.session.user),
    participant: mapPortalParticipant(access.participant),
    profile: await getPortalProfileByUserId(access.db, access.session.user.id),
    application: await getPortalApplicationByUserId(access.db, access.session.user.id),
    draft,
    windows,
  };

  return c.json(response);
});

portalApi.patch("/project/preview", async (c) => {
  const access = await getProjectWorkspaceAccess(c);

  if ("response" in access) {
    return access.response;
  }

  const body = await c.req.json().catch(() => null);
  const parsed = updatePortalProjectPreviewInputSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError(c, 422, "invalid_request", "预告信息参数不正确。", parsed.error.flatten());
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
    return jsonError(c, 422, "invalid_request", "审查说明参数不正确。", parsed.error.flatten());
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
  const access = await getParticipantActionAccess(c);

  if ("response" in access) {
    return access.response;
  }

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

async function getPortalSessionAccess(c: AppContext): Promise<PortalSessionAccess> {
  const sessionState = await requireParticipantSession(c);

  if (!sessionState?.session) {
    return {
      response: jsonError(c, 401, "portal_not_authenticated", "请先完成参与者登录。"),
    };
  }

  return {
    db: getRequiredDb(c),
    session: sessionState.session,
    participant: sessionState.participant,
  };
}

async function getParticipantActionAccess(c: AppContext): Promise<ParticipantActionAccess> {
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
      response: jsonError(c, 403, "portal_creator_missing", "当前账号尚未完成创作者工作台初始化，请重新登录或联系主催。"),
    };
  }

  return {
    db: access.db,
    session: access.session,
    participant,
  };
}

async function getProjectWorkspaceAccess(c: AppContext): Promise<ProjectWorkspaceAccess> {
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
      response: jsonError(c, 403, "portal_creator_missing", "当前账号尚未完成创作者工作台初始化，请重新登录或联系主催。"),
    };
  }

  return {
    db: access.db,
    session: access.session,
    participant,
  };
}
