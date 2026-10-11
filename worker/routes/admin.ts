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
  createSegmentInputSchema,
  appendSegmentsInputSchema,
  updateProjectDraftInputSchema,
  updateSegmentInputSchema,
  updateParticipantInputSchema,
} from "../../src/shared/admin";
import { eventWindowKeySchema, updateEventWindowInputSchema } from "../../src/shared/windows";
import {
  bootstrapActiveScheduleSegments,
  createActiveScheduleSegment,
  appendActiveScheduleSegments,
  getParticipantDetail,
  listProjectDrafts,
  listParticipants,
  listSegments,
  updateActiveScheduleSegment,
  updateParticipant,
} from "../data/admin";
import {
  getApplicationDetail,
  listApplications,
  reviewApplication,
} from "../data/applications";
import { listEventWindows, updateEventWindow } from "../data/event-windows";

import { getAdminProjectDraftDetail, updateAdminProjectDraftReview } from "../data/project-drafts";
import { getAdminIdentity, requireAdminAccess, requireAdminOwner } from "../lib/admin";
import { getRealAuthEmail } from "../../src/shared/auth-identity";
import { getRequiredDb, jsonError } from "../lib/http";
import type { AppRouteConfig } from "../lib/types";

const adminApi = new Hono<AppRouteConfig>();

adminApi.use("*", async (c, next) => {
  await requireAdminAccess(c);
  await next();
});

adminApi.get('/session', c => c.json({ email: getAdminIdentity(c), role: c.get('adminRole') }));

adminApi.get('/users', async c => {
  requireAdminOwner(c);
  const query = (c.req.query('q') ?? '').trim().slice(0, 200);
  const result = await getRequiredDb(c).prepare(`SELECT u.id, u.name, u.email, u.emailVerified, r.role
    FROM "user" u LEFT JOIN admin_roles r ON r.user_id = u.id
    WHERE (? = '' AND r.role IS NOT NULL) OR (? <> '' AND (instr(lower(u.email), lower(?)) > 0 OR instr(lower(u.name), lower(?)) > 0))
    ORDER BY CASE r.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, u.email LIMIT 50`)
    .bind(query, query, query, query).all<{ id: string; name: string; email: string; emailVerified: number; role: string | null }>();
  return c.json({ users: result.results.map(user => ({ ...user, emailVerified: Boolean(user.emailVerified) })) });
});

adminApi.put('/users/:userId/role', async c => {
  requireAdminOwner(c);
  const body = await c.req.json().catch(() => null);
  if (!body || !['admin', null].includes(body.role)) return jsonError(c, 422, 'invalid_request', '请选择授予或撤销管理员权限。');
  const db = getRequiredDb(c), userId = c.req.param('userId');
  const user = await db.prepare(`SELECT u.email, u.emailVerified, r.role FROM "user" u LEFT JOIN admin_roles r ON r.user_id = u.id WHERE u.id = ?`)
    .bind(userId).first<{ email: string; emailVerified: number; role: string | null }>();
  if (!user) return jsonError(c, 404, 'not_found', '未找到账号。');
  if (user.role === 'owner') return jsonError(c, 403, 'owner_protected', '初始管理员的权限不能在此修改。');
  if (body.role === 'admin' && (!user.emailVerified || !getRealAuthEmail(user.email))) return jsonError(c, 422, 'email_not_verified', '请先让该用户验证登录邮箱。');
  if (body.role === user.role) return c.json({ ok: true });
  await db.batch([
    body.role === 'admin'
      ? db.prepare(`INSERT INTO admin_roles (user_id, role, granted_by) VALUES (?, 'admin', ?) ON CONFLICT(user_id) DO NOTHING`).bind(userId, c.get('adminUserId'))
      : db.prepare(`DELETE FROM admin_roles WHERE user_id = ? AND role = 'admin'`).bind(userId),
    db.prepare('INSERT INTO admin_role_events (id, user_id, actor_user_id, action) VALUES (?, ?, ?, ?)')
      .bind(crypto.randomUUID(), userId, c.get('adminUserId'), body.role === 'admin' ? 'grant' : 'revoke'),
  ]);
  return c.json({ ok: true });
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

  const response: AdminApplicationDetailResponse = { application };
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

adminApi.post("/participants/:participantId/invite", (c) => {
  return jsonError(c, 410, "email_notifications_disabled", "已停用邮件提醒，请在作者页面查看审核状态。");
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

adminApi.post("/segments", async c => {
  const parsed = createSegmentInputSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return jsonError(c, 422, "invalid_request", "请填写席位类型、名称和发布时间。", parsed.error.flatten());
  const result = await createActiveScheduleSegment(getRequiredDb(c), parsed.data);
  if (!result.ok) return jsonError(c, result.status, result.code, result.message);
  return c.json(result, 201);
});

adminApi.post("/segments/bootstrap", bootstrapSegmentsHandler);

adminApi.post('/segments/append', async c => {
  const parsed = appendSegmentsInputSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return jsonError(c, 422, 'invalid_request', '追加数量必须是 1 到 120 之间的整数。', parsed.error.flatten());
  const result = await appendActiveScheduleSegments(getRequiredDb(c), parsed.data);
  if (!result.ok) return jsonError(c, result.status, result.code, result.message);
  return c.json({ ok: true, message: result.message, items: result.items } satisfies AdminSegmentBootstrapResponse, 201);
});

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
