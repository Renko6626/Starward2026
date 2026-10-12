import { generateRandomString } from 'better-auth/crypto';
import type { AdminAssistedAccessResponse } from '../../src/shared/admin-access';
import { PORTAL_EMAIL_OTP_EXPIRES_IN_SECONDS, PORTAL_EMAIL_OTP_LENGTH } from '../../src/shared/email-otp';

export async function issueAdminAssistedAccess(
  db: D1Database,
  email: string,
  actorUserId: string,
): Promise<AdminAssistedAccessResponse> {
  const otp = generateRandomString(PORTAL_EMAIL_OTP_LENGTH, '0-9');
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + PORTAL_EMAIL_OTP_EXPIRES_IN_SECONDS * 1000).toISOString();
  const identifier = `sign-in-otp-${email}`;
  await db.batch([
    db.prepare('DELETE FROM verification WHERE identifier = ?').bind(identifier),
    // Match Better Auth Email OTP's configured plain storage and attempt counter.
    db.prepare('INSERT INTO verification (id, identifier, value, expiresAt, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(crypto.randomUUID(), identifier, `${otp}:0`, expiresAt, now, now),
    db.prepare('INSERT INTO admin_account_events (id, email, actor_user_id, created_at, expires_at) VALUES (?, ?, ?, ?, ?)')
      .bind(crypto.randomUUID(), email, actorUserId, now, expiresAt),
  ]);
  return { email, otp, expiresAt };
}
