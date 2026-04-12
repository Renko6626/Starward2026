import type {
  ApplicationDetail,
  ApplicationInterestFormat,
  ApplicationListItem,
  ApplicationStatus,
  CreateApplicationInput,
  UpsertPortalApplicationInput,
  UpdateApplicationReviewInput,
} from "../../src/shared/applications";
import type { PortalApplicationDetail } from "../../src/shared/portal";
import { resolveApplicationDisplayName } from "../../src/shared/application-identity";
import { createPrefixedId } from "../lib/ids";
import { resolvePortalApplicationMutation } from "../lib/portal-application";
import { normalizeOptionalText } from "../lib/strings";
import { nowIso } from "../lib/time";

type ApplicationListRow = {
  id: string;
  display_name: string;
  contact_email: string;
  contact_handle: string | null;
  interest_format: ApplicationInterestFormat;
  status: ApplicationStatus;
  created_at: string;
  reviewed_at: string | null;
  auth_email: string | null;
  profile_user_id: string | null;
  participant_id: string | null;
  participant_status: "invited" | "active" | "withdrawn" | "completed" | null;
};

type ApplicationDetailRow = ApplicationListRow & {
  user_id: string | null;
  auth_email: string | null;
  intro_text: string | null;
  portfolio_url: string | null;
  message_to_hosts: string | null;
  admin_note: string | null;
  reviewed_by: string | null;
  updated_at: string;
  profile_pen_name: string | null;
  profile_contact_email: string | null;
  profile_primary_contact_channel: string | null;
  profile_primary_contact_handle: string | null;
  profile_backup_contact: string | null;
  profile_public_credit_mode: "named" | "pseudonymous" | "anonymous" | null;
  profile_public_credit_name: string | null;
  invite_email: string | null;
  participant_status: "invited" | "active" | "withdrawn" | "completed" | null;
  activated_at: string | null;
};

type ParticipantRow = {
  id: string;
};

type PortalApplicationRow = {
  id: string;
  display_name: string;
  contact_email: string;
  contact_handle: string | null;
  interest_format: ApplicationInterestFormat;
  intro_text: string | null;
  portfolio_url: string | null;
  message_to_hosts: string | null;
  status: ApplicationStatus;
  admin_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  updated_at: string;
};

type AuthUserEmailRow = {
  email: string;
};

export async function createApplication(
  db: D1Database,
  input: CreateApplicationInput,
  options?: { userId?: string | null },
) {
  const id = createPrefixedId("app");
  const createdAt = nowIso();

  await db
    .prepare(
      `INSERT INTO applications (
        id,
        user_id,
        display_name,
        contact_email,
        contact_handle,
        interest_format,
        intro_text,
        portfolio_url,
        message_to_hosts,
        status,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
    )
    .bind(
      id,
      options?.userId ?? null,
      input.displayName?.trim() ?? "",
      input.contactEmail.trim().toLowerCase(),
      normalizeOptionalText(input.contactHandle),
      input.interestFormat,
      normalizeOptionalText(input.introText),
      normalizeOptionalText(input.portfolioUrl),
      normalizeOptionalText(input.messageToHosts),
      createdAt,
      createdAt,
    )
    .run();

  return id;
}

export async function getPortalApplicationByUserId(db: D1Database, userId: string, email: string) {
  const linked = await db
    .prepare(portalApplicationSelectSql + " WHERE applications.user_id = ? LIMIT 1")
    .bind(userId)
    .first<PortalApplicationRow>();

  if (linked) {
    return mapPortalApplicationRow(linked);
  }

  const candidate = await db
    .prepare(
      portalApplicationSelectSql +
        " WHERE applications.user_id IS NULL AND lower(applications.contact_email) = lower(?) ORDER BY applications.created_at DESC LIMIT 1",
    )
    .bind(email.trim().toLowerCase())
    .first<PortalApplicationRow>();

  if (!candidate) {
    return null;
  }

  await db
    .prepare("UPDATE applications SET user_id = ?, updated_at = ? WHERE id = ?")
    .bind(userId, nowIso(), candidate.id)
    .run();

  return getPortalApplicationByUserId(db, userId, email);
}

export async function upsertPortalApplication(
  db: D1Database,
  input: {
    userId: string;
    authEmail: string;
    data: UpsertPortalApplicationInput;
  },
) {
  const existing = await getPortalApplicationByUserId(db, input.userId, input.authEmail);
  const mutation = resolvePortalApplicationMutation(existing?.status ?? null, true);

  if (!mutation.editable) {
    return {
      ok: false as const,
      code: "portal_application_locked",
      status: 409,
      message:
        mutation.mode === "locked" ? mutation.message : "当前报名不可修改。",
    };
  }

  if (mutation.mode === "create") {
    const applicationId = await createApplication(
      db,
      {
        ...input.data,
        turnstileToken: undefined,
      },
      {
        userId: input.userId,
      },
    );

    const created = await getPortalApplicationByUserId(db, input.userId, input.authEmail);

    if (!created) {
      return {
        ok: false as const,
        code: "portal_application_missing",
        status: 500,
        message: "报名已写入，但未能重新读取。",
      };
    }

    return {
      ok: true as const,
      message: `已创建报名 ${applicationId}。`,
      application: created,
    };
  }

  await db
    .prepare(
      `UPDATE applications
       SET display_name = ?,
           contact_email = ?,
           contact_handle = ?,
           interest_format = ?,
           intro_text = ?,
           portfolio_url = ?,
           message_to_hosts = ?,
           status = 'pending',
           admin_note = NULL,
           reviewed_by = NULL,
           reviewed_at = NULL,
           updated_at = ?
       WHERE user_id = ?`,
    )
    .bind(
      input.data.displayName?.trim() ?? "",
      input.data.contactEmail.trim().toLowerCase(),
      normalizeOptionalText(input.data.contactHandle),
      input.data.interestFormat,
      normalizeOptionalText(input.data.introText),
      normalizeOptionalText(input.data.portfolioUrl),
      normalizeOptionalText(input.data.messageToHosts),
      nowIso(),
      input.userId,
    )
    .run();

  const updated = await getPortalApplicationByUserId(db, input.userId, input.authEmail);

  if (!updated) {
    return {
      ok: false as const,
      code: "portal_application_missing",
      status: 500,
      message: "报名已更新，但未能重新读取。",
    };
  }

  return {
    ok: true as const,
    message: "已更新报名资料。",
    application: updated,
  };
}

export async function listApplications(db: D1Database) {
  const result = await db
    .prepare(
      `SELECT
        applications.id,
        applications.display_name,
        applications.contact_email,
        applications.contact_handle,
        applications.interest_format,
        applications.status,
        applications.created_at,
        applications.reviewed_at,
        "user".email AS auth_email,
        portal_profiles.user_id AS profile_user_id,
        participants.id AS participant_id,
        participants.status AS participant_status
      FROM applications
      LEFT JOIN "user" ON "user".id = applications.user_id
      LEFT JOIN portal_profiles ON portal_profiles.user_id = applications.user_id
      LEFT JOIN participants ON participants.application_id = applications.id
      ORDER BY applications.created_at DESC`,
    )
    .all<ApplicationListRow>();

  return (result.results ?? []).map(mapApplicationListRow);
}

export async function getApplicationDetail(db: D1Database, applicationId: string) {
  const row = await db
    .prepare(
      `SELECT
        applications.id,
        applications.user_id,
        "user".email AS auth_email,
        applications.display_name,
        applications.contact_email,
        applications.contact_handle,
        applications.interest_format,
        applications.status,
        applications.created_at,
        applications.reviewed_at,
        applications.intro_text,
        applications.portfolio_url,
        applications.message_to_hosts,
        applications.admin_note,
        applications.reviewed_by,
        applications.updated_at,
        portal_profiles.pen_name AS profile_pen_name,
        portal_profiles.contact_email AS profile_contact_email,
        portal_profiles.primary_contact_channel AS profile_primary_contact_channel,
        portal_profiles.primary_contact_handle AS profile_primary_contact_handle,
        portal_profiles.backup_contact AS profile_backup_contact,
        portal_profiles.public_credit_mode AS profile_public_credit_mode,
        portal_profiles.public_credit_name AS profile_public_credit_name,
        participants.id AS participant_id,
        participants.invite_email,
        participants.status AS participant_status,
        participants.activated_at
      FROM applications
      LEFT JOIN "user" ON "user".id = applications.user_id
      LEFT JOIN portal_profiles ON portal_profiles.user_id = applications.user_id
      LEFT JOIN participants ON participants.application_id = applications.id
      WHERE applications.id = ?`,
    )
    .bind(applicationId)
    .first<ApplicationDetailRow>();

  if (!row) {
    return null;
  }

  return mapApplicationDetailRow(row);
}

export async function reviewApplication(
  db: D1Database,
  applicationId: string,
  input: UpdateApplicationReviewInput,
  reviewedBy: string,
) {
  const existing = await db
    .prepare(
      `SELECT
        id,
        user_id,
        display_name,
        contact_email,
        contact_handle
      FROM applications
      WHERE id = ?`,
    )
    .bind(applicationId)
    .first<{
      id: string;
      user_id: string | null;
      display_name: string;
      contact_email: string;
      contact_handle: string | null;
    }>();

  if (!existing) {
    return null;
  }

  const reviewedAt = nowIso();
  const participantPlan =
    input.status === "approved"
      ? await buildParticipantSyncPlan(db, existing, reviewedAt)
      : { participantId: null, statements: [] as D1PreparedStatement[] };
  const statements = [
    ...participantPlan.statements,
    db
      .prepare(
        `UPDATE applications
         SET status = ?, admin_note = ?, reviewed_by = ?, reviewed_at = ?, updated_at = ?
         WHERE id = ?`,
      )
      .bind(
        input.status,
        normalizeOptionalText(input.adminNote),
        reviewedBy,
        reviewedAt,
        reviewedAt,
        applicationId,
      ),
  ];

  if (participantPlan.participantId) {
    statements.push(
      db
        .prepare(
          `INSERT INTO project_drafts (
            id,
            participant_id,
            preview_status,
            review_status,
            created_at,
            updated_at
          ) VALUES (?, ?, 'not_started', 'not_started', ?, ?)
          ON CONFLICT(participant_id) DO NOTHING`,
        )
        .bind(createPrefixedId("draft"), participantPlan.participantId, reviewedAt, reviewedAt),
    );
  }

  await db.batch(statements);

  return getApplicationDetail(db, applicationId);
}

async function buildParticipantSyncPlan(
  db: D1Database,
  application: {
    id: string;
    user_id: string | null;
    display_name: string;
    contact_email: string;
    contact_handle: string | null;
  },
  now: string,
) {
  const authUser = application.user_id
    ? await db
        .prepare(`SELECT email FROM "user" WHERE id = ? LIMIT 1`)
        .bind(application.user_id)
        .first<AuthUserEmailRow>()
    : null;
  const email = authUser?.email?.toLowerCase() || application.contact_email.toLowerCase();
  const existingByApplication = await db
    .prepare(`SELECT id FROM participants WHERE application_id = ?`)
    .bind(application.id)
    .first<ParticipantRow>();

  if (existingByApplication) {
    return {
      participantId: existingByApplication.id,
      statements: [
        db.prepare(
        `UPDATE participants
         SET user_id = COALESCE(user_id, ?),
             invite_email = ?,
             display_name = ?,
             contact_handle = ?,
             updated_at = ?
         WHERE id = ?`,
        ).bind(
          application.user_id,
          email,
          resolveApplicationDisplayName({
            displayName: application.display_name,
            contactHandle: application.contact_handle,
            contactEmail: email,
          }),
          application.contact_handle,
          now,
          existingByApplication.id,
        ),
      ],
    };
  }

  const existingByEmail = await db
    .prepare(`SELECT id FROM participants WHERE lower(invite_email) = lower(?)`)
    .bind(email)
    .first<ParticipantRow>();

  if (existingByEmail) {
    return {
      participantId: existingByEmail.id,
      statements: [
        db.prepare(
        `UPDATE participants
         SET application_id = COALESCE(application_id, ?),
             user_id = COALESCE(user_id, ?),
             display_name = ?,
             contact_handle = ?,
             updated_at = ?
         WHERE id = ?`,
        ).bind(
          application.id,
          application.user_id,
          resolveApplicationDisplayName({
            displayName: application.display_name,
            contactHandle: application.contact_handle,
            contactEmail: email,
          }),
          application.contact_handle,
          now,
          existingByEmail.id,
        ),
      ],
    };
  }

  const participantId = createPrefixedId("part");
  return {
    participantId,
    statements: [
      db
        .prepare(
          `INSERT INTO participants (
            id,
            application_id,
            user_id,
            invite_email,
            display_name,
            contact_handle,
            status,
            invited_at,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, 'invited', ?, ?, ?)`,
        )
        .bind(
          participantId,
          application.id,
          application.user_id,
          email,
          resolveApplicationDisplayName({
            displayName: application.display_name,
            contactHandle: application.contact_handle,
            contactEmail: email,
          }),
          application.contact_handle,
          now,
          now,
          now,
        ),
    ],
  };
}

function mapApplicationListRow(row: ApplicationListRow): ApplicationListItem {
  return {
    id: row.id,
    displayName: row.display_name,
    contactEmail: row.contact_email,
    contactHandle: row.contact_handle,
    interestFormat: row.interest_format,
    status: row.status,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at,
    authUserEmail: row.auth_email,
    hasPortalProfile: Boolean(row.profile_user_id),
    participantId: row.participant_id,
    participantStatus: row.participant_status,
  };
}

function mapApplicationDetailRow(row: ApplicationDetailRow): ApplicationDetail {
  return {
    ...mapApplicationListRow(row),
    introText: row.intro_text,
    portfolioUrl: row.portfolio_url,
    messageToHosts: row.message_to_hosts,
    adminNote: row.admin_note,
    reviewedBy: row.reviewed_by,
    updatedAt: row.updated_at,
    authUser:
      row.user_id && row.auth_email
        ? {
            id: row.user_id,
            email: row.auth_email,
          }
        : null,
    portalProfile:
      row.profile_contact_email &&
      row.profile_primary_contact_channel &&
      row.profile_primary_contact_handle &&
      row.profile_public_credit_mode
        ? {
            penName: row.profile_pen_name?.trim() ? row.profile_pen_name : null,
            contactEmail: row.profile_contact_email,
            primaryContactChannel: row.profile_primary_contact_channel,
            primaryContactHandle: row.profile_primary_contact_handle,
            backupContact: row.profile_backup_contact,
            publicCreditMode: row.profile_public_credit_mode,
            publicCreditName: row.profile_public_credit_name,
          }
        : null,
    participant:
      row.participant_id && row.invite_email && row.participant_status
        ? {
            id: row.participant_id,
            inviteEmail: row.invite_email,
            status: row.participant_status,
            activatedAt: row.activated_at,
          }
        : null,
  };
}

function mapPortalApplicationRow(row: PortalApplicationRow): PortalApplicationDetail {
  return {
    id: row.id,
    displayName: row.display_name,
    contactEmail: row.contact_email,
    contactHandle: row.contact_handle,
    interestFormat: row.interest_format,
    introText: row.intro_text,
    portfolioUrl: row.portfolio_url,
    messageToHosts: row.message_to_hosts,
    status: row.status,
    adminNote: row.admin_note,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    updatedAt: row.updated_at,
  };
}

const portalApplicationSelectSql = `SELECT
  applications.id,
  applications.display_name,
  applications.contact_email,
  applications.contact_handle,
  applications.interest_format,
  applications.intro_text,
  applications.portfolio_url,
  applications.message_to_hosts,
  applications.status,
  applications.admin_note,
  applications.reviewed_by,
  applications.reviewed_at,
  applications.updated_at
FROM applications`;
