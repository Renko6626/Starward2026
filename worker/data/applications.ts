import type {
  ApplicationDetail,
  ApplicationInterestFormat,
  ApplicationListItem,
  ApplicationStatus,
  CreateApplicationInput,
  UpdateApplicationReviewInput,
} from "../../src/shared/applications";
import { createPrefixedId } from "../lib/ids";
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
  participant_id: string | null;
};

type ApplicationDetailRow = ApplicationListRow & {
  intro_text: string | null;
  portfolio_url: string | null;
  message_to_hosts: string | null;
  admin_note: string | null;
  reviewed_by: string | null;
  updated_at: string;
  invite_email: string | null;
  participant_status: "invited" | "active" | "withdrawn" | "completed" | null;
  activated_at: string | null;
};

type ParticipantRow = {
  id: string;
};

export async function createApplication(db: D1Database, input: CreateApplicationInput) {
  const id = createPrefixedId("app");
  const createdAt = nowIso();

  await db
    .prepare(
      `INSERT INTO applications (
        id,
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
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
    )
    .bind(
      id,
      input.displayName.trim(),
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
        participants.id AS participant_id
      FROM applications
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
        participants.id AS participant_id,
        participants.invite_email,
        participants.status AS participant_status,
        participants.activated_at
      FROM applications
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
        display_name,
        contact_email,
        contact_handle
      FROM applications
      WHERE id = ?`,
    )
    .bind(applicationId)
    .first<{
      id: string;
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
    display_name: string;
    contact_email: string;
    contact_handle: string | null;
  },
  now: string,
) {
  const email = application.contact_email.toLowerCase();
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
         SET invite_email = ?, display_name = ?, contact_handle = ?, updated_at = ?
         WHERE id = ?`,
        ).bind(
          email,
          application.display_name,
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
             display_name = ?,
             contact_handle = ?,
             updated_at = ?
         WHERE id = ?`,
        ).bind(
          application.id,
          application.display_name,
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
            invite_email,
            display_name,
            contact_handle,
            status,
            invited_at,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, 'invited', ?, ?, ?)`,
        )
        .bind(
          participantId,
          application.id,
          email,
          application.display_name,
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
    participantId: row.participant_id,
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
