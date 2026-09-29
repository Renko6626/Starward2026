import type {
  PortalProfile,
  UpdatePortalProfileInput,
} from "../../src/shared/portal";
import { normalizeOptionalText } from "../lib/strings";
import { nowIso } from "../lib/time";

type PortalProfileRow = {
  credit_name: string;
  contact_email: string;
  primary_contact_channel: string;
  primary_contact_handle: string;
  backup_contact: string | null;
  is_anonymous: number;
  updated_at: string;
};

export async function getPortalProfileByUserId(db: D1Database, userId: string) {
  const row = await db
    .prepare(
      `SELECT
        credit_name,
        contact_email,
        primary_contact_channel,
        primary_contact_handle,
        backup_contact,
        is_anonymous,
        updated_at
      FROM portal_profiles
      WHERE user_id = ?
      LIMIT 1`,
    )
    .bind(userId)
    .first<PortalProfileRow>();

  return row ? mapPortalProfile(row) : null;
}

export async function upsertPortalProfile(
  db: D1Database,
  input: {
    userId: string;
    data: UpdatePortalProfileInput;
  },
) {
  const now = nowIso();
  await db
    .prepare(
      `INSERT INTO portal_profiles (
        user_id,
        credit_name,
        contact_email,
        primary_contact_channel,
        primary_contact_handle,
        backup_contact,
        is_anonymous,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        credit_name = excluded.credit_name,
        contact_email = excluded.contact_email,
        primary_contact_channel = excluded.primary_contact_channel,
        primary_contact_handle = excluded.primary_contact_handle,
        backup_contact = excluded.backup_contact,
        is_anonymous = excluded.is_anonymous,
        updated_at = excluded.updated_at`,
    )
    .bind(
      input.userId,
      input.data.creditName.trim(),
      input.data.contactEmail.trim().toLowerCase(),
      input.data.primaryContactChannel.trim(),
      input.data.primaryContactHandle.trim(),
      normalizeOptionalText(input.data.backupContact),
      input.data.isAnonymous ? 1 : 0,
      now,
      now,
    )
    .run();

  return getPortalProfileByUserId(db, input.userId);
}

function mapPortalProfile(row: PortalProfileRow): PortalProfile {
  return {
    creditName: row.credit_name,
    contactEmail: row.contact_email,
    primaryContactChannel: row.primary_contact_channel,
    primaryContactHandle: row.primary_contact_handle,
    backupContact: row.backup_contact,
    isAnonymous: Boolean(row.is_anonymous),
    updatedAt: row.updated_at,
  };
}
