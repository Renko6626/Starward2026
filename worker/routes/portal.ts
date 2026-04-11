import { Hono } from "hono";
import type {
  PortalAvailableSegmentListResponse,
  PortalCurrentSegmentResponse,
  PortalDashboardResponse,
  PortalHistoryResponse,
  PortalMeResponse,
  PortalProjectMutationResponse,
  PortalProjectResponse,
} from "../../src/shared/portal";
import {
  segmentMutationInputSchema,
  updatePortalProjectPreviewInputSchema,
  updatePortalProjectReviewInputSchema,
} from "../../src/shared/portal";
import {
  getPortalDashboard,
  getPortalHistory,
  getPortalMe,
  mapPortalAuthUser,
  mapPortalParticipant,
} from "../data/portal";
import {
  getPortalProjectDraftDetail,
  submitPortalProjectPreview,
  submitPortalProjectReview,
  updatePortalProjectPreview,
  updatePortalProjectReview,
} from "../data/project-drafts";
import { listEventWindows } from "../data/event-windows";
import {
  changeParticipantSegment,
  claimParticipantSegment,
  getPortalSegmentState,
  listAvailableSegments,
  releaseParticipantSegment,
} from "../data/segments";
import { requireParticipantSession } from "../lib/auth";
import { getRequiredDb, jsonError } from "../lib/http";
import type { AppBindings, AppContext } from "../lib/types";

const portalApi = new Hono<{ Bindings: AppBindings }>();

portalApi.get("/me", async (c) => {
  const sessionState = await requireParticipantSession(c);

  if (!sessionState?.session) {
    return jsonError(c, 401, "portal_not_authenticated", "请先完成参与者登录。");
  }

  if (!sessionState.participant) {
    return jsonError(c, 403, "portal_not_bound", "当前账号尚未绑定有效参与者身份，请联系主催处理。");
  }

  const response: PortalMeResponse = await getPortalMe(
    mapPortalAuthUser(sessionState.session.user),
    sessionState.participant,
  );

  return c.json(response);
});

portalApi.get("/dashboard", async (c) => {
  const access = await getPortalAccess(c);

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

portalApi.get("/history", async (c) => {
  const access = await getPortalAccess(c);

  if ("response" in access) {
    return access.response;
  }

  const response: PortalHistoryResponse = await getPortalHistory(access.db, {
    user: mapPortalAuthUser(access.session.user),
    participant: access.participant,
  });

  return c.json(response);
});

const getCurrentSegmentHandler = async (c: AppContext) => {
  const access = await getPortalAccess(c);

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
    currentSegment: segmentState.currentSegment,
    actions: segmentState.actions,
    windows: segmentState.windows,
  };

  return c.json(response);
};

const listAvailableSegmentsHandler = async (c: AppContext) => {
  const access = await getPortalAccess(c);

  if ("response" in access) {
    return access.response;
  }

  const response: PortalAvailableSegmentListResponse = {
    items: await listAvailableSegments(access.db),
  };

  return c.json(response);
};

const claimSegmentHandler = async (c: AppContext) => {
  const access = await getPortalAccess(c);

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
  const access = await getPortalAccess(c);

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
  const access = await getPortalAccess(c);

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
  const access = await getPortalAccess(c);

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
    draft,
    windows,
  };

  return c.json(response);
});

portalApi.patch("/project/preview", async (c) => {
  const access = await getPortalAccess(c);

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
  const access = await getPortalAccess(c);

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
  const access = await getPortalAccess(c);

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
  const access = await getPortalAccess(c);

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

export { portalApi };

async function getPortalAccess(c: AppContext) {
  const sessionState = await requireParticipantSession(c);

  if (!sessionState?.session) {
    return {
      response: jsonError(c, 401, "portal_not_authenticated", "请先完成参与者登录。"),
    };
  }

  if (!sessionState.participant) {
    return {
      response: jsonError(c, 403, "portal_not_bound", "当前账号尚未绑定有效参与者身份，请联系主催处理。"),
    };
  }

  return {
    db: getRequiredDb(c),
    session: sessionState.session,
    participant: sessionState.participant,
  };
}
