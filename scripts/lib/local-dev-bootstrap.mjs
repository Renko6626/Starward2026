import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export const LOCAL_D1_DATABASE_NAME = "starward2026";
export const LOCAL_D1_STATE_PATH = ".wrangler/state/v3/d1";
export const LOCAL_PORTAL_COOKIE_NAME = "better-auth.session_token";

const FIXTURE_TIMESTAMP = "2026-04-12T00:00:00.000Z";
const SESSION_EXPIRES_AT = "2099-01-01T00:00:00.000Z";

export const localDevSeedFixtures = {
  users: [
    {
      id: "usr_seed_pending",
      name: "宇佐见莲子",
      email: "portal-pending@seed.starward.local",
      emailVerified: 1,
      image: null,
      createdAt: FIXTURE_TIMESTAMP,
      updatedAt: FIXTURE_TIMESTAMP,
    },
    {
      id: "usr_seed_active",
      name: "玛艾露贝莉",
      email: "portal-approved@seed.starward.local",
      emailVerified: 1,
      image: null,
      createdAt: FIXTURE_TIMESTAMP,
      updatedAt: FIXTURE_TIMESTAMP,
    },
  ],
  portalProfiles: [
    {
      user_id: "usr_seed_pending",
      credit_name: "宇佐见莲子",
      bilibili_uid: "202600001",
      contact_email: "portal-pending@seed.starward.local",
      primary_contact_channel: "Discord",
      primary_contact_handle: "renko#2026",
      backup_contact: "Telegram @renko_alt",
      is_anonymous: 1,
      created_at: FIXTURE_TIMESTAMP,
      updated_at: FIXTURE_TIMESTAMP,
    },
    {
      user_id: "usr_seed_active",
      credit_name: "结界观测者",
      bilibili_uid: "202600002",
      contact_email: "portal-approved@seed.starward.local",
      primary_contact_channel: "Bluesky",
      primary_contact_handle: "@merry-seed",
      backup_contact: "Email portal-approved@seed.starward.local",
      is_anonymous: 0,
      created_at: FIXTURE_TIMESTAMP,
      updated_at: FIXTURE_TIMESTAMP,
    },
  ],
  applications: [
    {
      id: "app_seed_portal_pending",
      user_id: "usr_seed_pending",
      contact_email: "portal-pending@seed.starward.local",
      contact_handle: "Discord renko#2026",
      interest_format: "novel",
      intro_text: "已建立入口账号并补充联系资料，当前仍在等待主催审核。",
      portfolio_url: "https://example.com/pending-seed",
      message_to_hosts: "当前先使用匿名公开模式，后续如需署名会再补充。",
      status: "pending",
      reviewed_by: null,
      reviewed_at: null,
      admin_note: null,
      created_at: FIXTURE_TIMESTAMP,
      updated_at: FIXTURE_TIMESTAMP,
    },
    {
      id: "app_seed_portal_approved",
      user_id: "usr_seed_active",
      contact_email: "portal-approved@seed.starward.local",
      contact_handle: "Bluesky @merry-seed",
      interest_format: "mixed",
      intro_text: "已审核通过并进入参与者工作区。",
      portfolio_url: "https://example.com/approved-seed",
      message_to_hosts: "已准备进入时间段与资料阶段。",
      status: "approved",
      reviewed_by: "seed-admin@local.test",
      reviewed_at: "2026-04-12T00:30:00.000Z",
      admin_note: "本地 smoke 参与者样本。",
      created_at: FIXTURE_TIMESTAMP,
      updated_at: "2026-04-12T00:30:00.000Z",
    },
  ],
  participants: [
    {
      id: "part_seed_pending",
      user_id: "usr_seed_pending",
      application_id: "app_seed_portal_pending",
      invite_email: "portal-pending@seed.starward.local",
      contact_handle: "Discord renko#2026",
      status: "pending",
      invited_at: null,
      activated_at: "2026-04-12T00:05:00.000Z",
      created_at: FIXTURE_TIMESTAMP,
      updated_at: "2026-04-12T00:05:00.000Z",
    },
    {
      id: "part_seed_active",
      user_id: "usr_seed_active",
      application_id: "app_seed_portal_approved",
      invite_email: "portal-approved@seed.starward.local",
      contact_handle: "Bluesky @merry-seed",
      status: "approved",
      invited_at: "2026-04-12T00:30:00.000Z",
      activated_at: "2026-04-12T00:35:00.000Z",
      created_at: FIXTURE_TIMESTAMP,
      updated_at: "2026-04-12T00:35:00.000Z",
    },
  ],
  scheduleSegments: [
    {
      id: "seg_seed_101",
      schedule_version_id: "schedule_default",
      code: "SEED-101",
      name: "本地样本时间段 A",
      description: "保持开放，便于认领 smoke。",
      status: "open",
      current_participant_id: null,
      claimed_at: null,
      released_at: null,
      sort_order: 101,
      created_at: FIXTURE_TIMESTAMP,
      updated_at: FIXTURE_TIMESTAMP,
    },
    {
      id: "seg_seed_102",
      schedule_version_id: "schedule_default",
      code: "SEED-102",
      name: "本地样本时间段 B",
      description: "由已批准参与者持有。",
      status: "held",
      current_participant_id: "part_seed_active",
      claimed_at: "2026-04-12T00:36:00.000Z",
      released_at: null,
      sort_order: 102,
      created_at: FIXTURE_TIMESTAMP,
      updated_at: "2026-04-12T00:36:00.000Z",
    },
    {
      id: "seg_seed_103",
      schedule_version_id: "schedule_default",
      code: "SEED-103",
      name: "本地样本时间段 C",
      description: "锁定样本。",
      status: "locked",
      current_participant_id: null,
      claimed_at: null,
      released_at: null,
      sort_order: 103,
      created_at: FIXTURE_TIMESTAMP,
      updated_at: FIXTURE_TIMESTAMP,
    },
  ],
  projectDrafts: [
    {
      id: "draft_seed_pending",
      participant_id: "part_seed_pending",
      segment_id: null,
      preview_title: "待审核样本预告",
      preview_summary: "用于本地 smoke 的待审核作品资料样本。",
      format_label: "小说",
      public_tags_json: JSON.stringify(["秘封", "待审核"]),
      content_note: "待主催确认的内容说明。",
      content_warnings: "",
      review_note: "",
      preview_status: "draft",
      review_status: "draft",
      preview_submitted_at: null,
      review_submitted_at: null,
      reviewed_at: null,
      reviewed_by: null,
      admin_feedback: null,
      created_at: FIXTURE_TIMESTAMP,
      updated_at: "2026-04-12T00:20:00.000Z",
    },
    {
      id: "draft_seed_active",
      participant_id: "part_seed_active",
      segment_id: "seg_seed_102",
      preview_title: "结界观测预告",
      preview_summary: "用于本地 smoke 的预告资料样本。",
      format_label: "小说 + 插画",
      public_tags_json: JSON.stringify(["秘封", "示例"]),
      content_note: "本地测试用内容说明。",
      content_warnings: "无",
      review_note: "等待最终确认。",
      preview_status: "submitted",
      review_status: "draft",
      preview_submitted_at: "2026-04-12T00:40:00.000Z",
      review_submitted_at: null,
      reviewed_at: null,
      reviewed_by: null,
      admin_feedback: null,
      created_at: FIXTURE_TIMESTAMP,
      updated_at: "2026-04-12T00:40:00.000Z",
    },
  ],
  participantEvents: [
    {
      id: "pevt_seed_pending_activate",
      participant_id: "part_seed_pending",
      actor_type: "system",
      actor_id: "usr_seed_pending",
      event_type: "portal_activated",
      target_type: "participant",
      target_id: "part_seed_pending",
      payload_json: JSON.stringify({
        email: "portal-pending@seed.starward.local",
      }),
      created_at: "2026-04-12T00:05:00.000Z",
    },
    {
      id: "pevt_seed_active_claim",
      participant_id: "part_seed_active",
      actor_type: "participant",
      actor_id: "part_seed_active",
      event_type: "segment_claimed",
      target_type: "segment",
      target_id: "seg_seed_102",
      payload_json: JSON.stringify({
        segmentCode: "SEED-102",
        segmentName: "本地样本时间段 B",
      }),
      created_at: "2026-04-12T00:36:00.000Z",
    },
    {
      id: "pevt_seed_active_preview",
      participant_id: "part_seed_active",
      actor_type: "participant",
      actor_id: "part_seed_active",
      event_type: "preview_saved",
      target_type: "project_draft",
      target_id: "draft_seed_active",
      payload_json: JSON.stringify({ previewTitle: "结界观测预告" }),
      created_at: "2026-04-12T00:40:00.000Z",
    },
  ],
  eventWindows: [
    {
      key: "application_open",
      label: "报名开放",
      is_enabled: 1,
      opens_at: null,
      closes_at: null,
      created_at: FIXTURE_TIMESTAMP,
      updated_at: FIXTURE_TIMESTAMP,
    },
    {
      key: "segment_claim_open",
      label: "时间段认领开放",
      is_enabled: 1,
      opens_at: null,
      closes_at: null,
      created_at: FIXTURE_TIMESTAMP,
      updated_at: FIXTURE_TIMESTAMP,
    },
    {
      key: "segment_change_open",
      label: "时间段变更 / 释放开放",
      is_enabled: 1,
      opens_at: null,
      closes_at: null,
      created_at: FIXTURE_TIMESTAMP,
      updated_at: FIXTURE_TIMESTAMP,
    },
    {
      key: "preview_submit_open",
      label: "预告资料提交开放",
      is_enabled: 1,
      opens_at: null,
      closes_at: null,
      created_at: FIXTURE_TIMESTAMP,
      updated_at: FIXTURE_TIMESTAMP,
    },
    {
      key: "review_submit_open",
      label: "审查说明提交开放",
      is_enabled: 1,
      opens_at: null,
      closes_at: null,
      created_at: FIXTURE_TIMESTAMP,
      updated_at: FIXTURE_TIMESTAMP,
    },
    {
      key: "public_release_open",
      label: "公开发布开放",
      is_enabled: 0,
      opens_at: null,
      closes_at: null,
      created_at: FIXTURE_TIMESTAMP,
      updated_at: FIXTURE_TIMESTAMP,
    },
  ],
  portalSessions: [
    {
      slug: "pending-review",
      label: "待审核门户样本",
      userId: "usr_seed_pending",
      userEmail: "portal-pending@seed.starward.local",
      sessionId: "sess_seed_pending",
      sessionToken: "starward-local-pending-session",
      createdAt: FIXTURE_TIMESTAMP,
      updatedAt: FIXTURE_TIMESTAMP,
      expiresAt: SESSION_EXPIRES_AT,
      ipAddress: "127.0.0.1",
      userAgent: "Starward2026 local seed",
      targetPath: "/portal",
    },
    {
      slug: "approved-participant",
      label: "已批准参与者样本",
      userId: "usr_seed_active",
      userEmail: "portal-approved@seed.starward.local",
      sessionId: "sess_seed_active",
      sessionToken: "starward-local-approved-session",
      createdAt: FIXTURE_TIMESTAMP,
      updatedAt: FIXTURE_TIMESTAMP,
      expiresAt: SESSION_EXPIRES_AT,
      ipAddress: "127.0.0.1",
      userAgent: "Starward2026 local seed",
      targetPath: "/portal",
    },
  ],
};

export function buildLocalSeedSql() {
  const sqlChunks = [
    cleanupSeedSql(),
    upsertEventWindowsSql(),
    buildInsertStatement(
      '"user"',
      [
        "id",
        "name",
        "email",
        "emailVerified",
        "image",
        "createdAt",
        "updatedAt",
      ],
      localDevSeedFixtures.users,
    ),
    buildInsertStatement(
      "applications",
      [
        "id",
        "user_id",
        "contact_email",
        "contact_handle",
        "interest_format",
        "intro_text",
        "portfolio_url",
        "message_to_hosts",
        "status",
        "reviewed_by",
        "reviewed_at",
        "admin_note",
        "created_at",
        "updated_at",
      ],
      localDevSeedFixtures.applications,
    ),
    buildInsertStatement(
      "portal_profiles",
      [
        "user_id",
        "credit_name",
        "bilibili_uid",
        "contact_email",
        "primary_contact_channel",
        "primary_contact_handle",
        "backup_contact",
        "is_anonymous",
        "created_at",
        "updated_at",
      ],
      localDevSeedFixtures.portalProfiles,
    ),
    buildInsertStatement(
      "participants",
      [
        "id",
        "user_id",
        "application_id",
        "invite_email",
        "contact_handle",
        "status",
        "invited_at",
        "activated_at",
        "created_at",
        "updated_at",
      ],
      localDevSeedFixtures.participants,
    ),
    buildInsertStatement(
      "schedule_segments",
      [
        "id",
        "schedule_version_id",
        "code",
        "name",
        "description",
        "status",
        "current_participant_id",
        "claimed_at",
        "released_at",
        "sort_order",
        "created_at",
        "updated_at",
      ],
      localDevSeedFixtures.scheduleSegments,
    ),
    buildInsertStatement(
      "project_drafts",
      [
        "id",
        "participant_id",
        "segment_id",
        "preview_title",
        "preview_summary",
        "format_label",
        "public_tags_json",
        "content_note",
        "content_warnings",
        "review_note",
        "preview_status",
        "review_status",
        "preview_submitted_at",
        "review_submitted_at",
        "reviewed_at",
        "reviewed_by",
        "admin_feedback",
        "created_at",
        "updated_at",
      ],
      localDevSeedFixtures.projectDrafts,
    ),
    buildInsertStatement(
      "participant_events",
      [
        "id",
        "participant_id",
        "actor_type",
        "actor_id",
        "event_type",
        "target_type",
        "target_id",
        "payload_json",
        "created_at",
      ],
      localDevSeedFixtures.participantEvents,
    ),
    buildInsertStatement(
      "session",
      [
        "id",
        "expiresAt",
        "token",
        "createdAt",
        "updatedAt",
        "ipAddress",
        "userAgent",
        "userId",
      ],
      localDevSeedFixtures.portalSessions.map((session) => ({
        id: session.sessionId,
        expiresAt: session.expiresAt,
        token: session.sessionToken,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        ipAddress: session.ipAddress,
        userAgent: session.userAgent,
        userId: session.userId,
      })),
    ),
  ];

  return sqlChunks.filter(Boolean).join("\n\n");
}

export async function createSignedSessionCookieValue(input) {
  const signature = createHmac("sha256", input.secret)
    .update(input.sessionToken)
    .digest("base64");

  return `${input.sessionToken}.${signature}`;
}

export async function buildLocalPortalSessionSummaries(input) {
  return Promise.all(
    localDevSeedFixtures.portalSessions.map(async (session) => {
      const signedValue = await createSignedSessionCookieValue({
        sessionToken: session.sessionToken,
        secret: input.secret,
      });

      return {
        slug: session.slug,
        label: session.label,
        userEmail: session.userEmail,
        cookieName: LOCAL_PORTAL_COOKIE_NAME,
        cookieValue: signedValue,
        cookieHeader: `${LOCAL_PORTAL_COOKIE_NAME}=${signedValue}`,
        browserSnippet: `document.cookie = "${LOCAL_PORTAL_COOKIE_NAME}=${signedValue}; path=/"; location.href = "${session.targetPath}";`,
      };
    }),
  );
}

export function readBetterAuthSecret(repoRoot) {
  if (process.env.BETTER_AUTH_SECRET?.trim()) {
    return process.env.BETTER_AUTH_SECRET.trim();
  }

  try {
    const devVarsPath = resolve(repoRoot, ".dev.vars");
    const raw = readFileSync(devVarsPath, "utf8");

    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      const separator = trimmed.indexOf("=");
      if (separator === -1) {
        continue;
      }

      const key = trimmed.slice(0, separator).trim();
      const value = trimmed.slice(separator + 1).trim();

      if (key === "BETTER_AUTH_SECRET" && value) {
        const quote = value[0];
        return (quote === '"' || quote === "'") && value.endsWith(quote)
          ? value.slice(1, -1)
          : value;
      }
    }
  } catch {
    return null;
  }

  return null;
}

function cleanupSeedSql() {
  const userIds = localDevSeedFixtures.users.map((item) => item.id);
  const applicationIds = localDevSeedFixtures.applications.map(
    (item) => item.id,
  );
  const participantIds = localDevSeedFixtures.participants.map(
    (item) => item.id,
  );
  const sessionIds = localDevSeedFixtures.portalSessions.map(
    (item) => item.sessionId,
  );
  const sessionTokens = localDevSeedFixtures.portalSessions.map(
    (item) => item.sessionToken,
  );
  const segmentIds = localDevSeedFixtures.scheduleSegments.map(
    (item) => item.id,
  );
  const draftIds = localDevSeedFixtures.projectDrafts.map((item) => item.id);
  const eventIds = localDevSeedFixtures.participantEvents.map(
    (item) => item.id,
  );

  return [
    buildDeleteStatement("participant_events", "id", eventIds),
    buildDeleteStatement("project_drafts", "id", draftIds),
    buildDeleteStatement("schedule_segments", "id", segmentIds),
    buildDeleteStatement("participants", "id", participantIds),
    buildDeleteStatement("portal_profiles", "user_id", userIds),
    buildDeleteStatement("session", "id", sessionIds),
    buildDeleteStatement("session", "token", sessionTokens),
    buildDeleteStatement("applications", "id", applicationIds),
    buildDeleteStatement('"user"', "id", userIds),
  ]
    .filter(Boolean)
    .join("\n");
}

function upsertEventWindowsSql() {
  return buildInsertStatement(
    "event_windows",
    [
      "key",
      "label",
      "is_enabled",
      "opens_at",
      "closes_at",
      "created_at",
      "updated_at",
    ],
    localDevSeedFixtures.eventWindows,
    `ON CONFLICT("key") DO UPDATE SET
  "label" = excluded."label",
  "is_enabled" = excluded."is_enabled",
  "opens_at" = excluded."opens_at",
  "closes_at" = excluded."closes_at",
  "updated_at" = excluded."updated_at"`,
  );
}

function buildDeleteStatement(tableName, columnName, values) {
  if (!values.length) {
    return "";
  }

  return `DELETE FROM ${tableName} WHERE "${columnName}" IN (${values.map(toSqlLiteral).join(", ")});`;
}

function buildInsertStatement(tableName, columns, rows, conflictClause = "") {
  if (!rows.length) {
    return "";
  }

  const valuesSql = rows
    .map(
      (row) =>
        `  (${columns.map((column) => toSqlLiteral(row[column])).join(", ")})`,
    )
    .join(",\n");

  return [
    `INSERT INTO ${tableName} (${columns.map((column) => `"${column}"`).join(", ")}) VALUES`,
    valuesSql,
    conflictClause ? conflictClause : "",
    ";",
  ]
    .filter(Boolean)
    .join("\n");
}

function toSqlLiteral(value) {
  if (value === null || value === undefined) {
    return "NULL";
  }

  if (typeof value === "number") {
    return String(value);
  }

  return `'${String(value).replaceAll("'", "''")}'`;
}
