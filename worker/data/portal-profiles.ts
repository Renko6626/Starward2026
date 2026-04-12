import type {
  PortalProfile,
  UpdatePortalProfileInput,
} from "../../src/shared/portal";
import { normalizeOptionalText } from "../lib/strings";
import { nowIso } from "../lib/time";

type PortalProfileRow = {
  pen_name: string;
  contact_email: string;
  primary_contact_channel: string;
  primary_contact_handle: string;
  backup_contact: string | null;
  public_credit_mode: PortalProfile["publicCreditMode"];
  public_credit_name: string | null;
  updated_at: string;
};

export async function getPortalProfileByUserId(db: D1Database, userId: string) {
  const row = await db
    .prepare(
      `SELECT
        pen_name,
        contact_email,
        primary_contact_channel,
        primary_contact_handle,
        backup_contact,
        public_credit_mode,
        public_credit_name,
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
        pen_name,
        contact_email,
        primary_contact_channel,
        primary_contact_handle,
        backup_contact,
        public_credit_mode,
        public_credit_name,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        pen_name = excluded.pen_name,
        contact_email = excluded.contact_email,
        primary_contact_channel = excluded.primary_contact_channel,
        primary_contact_handle = excluded.primary_contact_handle,
        backup_contact = excluded.backup_contact,
        public_credit_mode = excluded.public_credit_mode,
        public_credit_name = excluded.public_credit_name,
        updated_at = excluded.updated_at`,
    )
    .bind(
      input.userId,
      normalizeOptionalText(input.data.penName) ?? "",
      input.data.contactEmail.trim().toLowerCase(),
      input.data.primaryContactChannel.trim(),
      input.data.primaryContactHandle.trim(),
      normalizeOptionalText(input.data.backupContact),
      input.data.publicCreditMode,
      normalizeOptionalText(input.data.publicCreditName),
      now,
      now,
    )
    .run();

  return getPortalProfileByUserId(db, input.userId);
}

function mapPortalProfile(row: PortalProfileRow): PortalProfile {
  return {
    penName: row.pen_name.trim() ? row.pen_name : null,
    contactEmail: row.contact_email,
    primaryContactChannel: row.primary_contact_channel,
    primaryContactHandle: row.primary_contact_handle,
    backupContact: row.backup_contact,
    publicCreditMode: row.public_credit_mode,
    publicCreditName: row.public_credit_name,
    updatedAt: row.updated_at,
  };
}
