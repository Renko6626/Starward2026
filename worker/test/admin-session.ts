import { randomUUID } from 'node:crypto';
import { createAuth } from '../lib/auth';
import { createSignedSessionCookieValue } from '../../scripts/lib/local-dev-bootstrap.mjs';
import type { AppBindings } from '../lib/types';

export async function adminTestSession(db: D1Database, role: 'owner' | 'admin' | null = 'owner', email = 'admin@example.com') {
  const env: AppBindings = { DB: db, BETTER_AUTH_SECRET: 'test-admin-session-secret-at-least-32-characters', BETTER_AUTH_URL: 'http://localhost', ALLOW_LOCAL_DEV_ORIGINS: 'true' };
  const id = randomUUID(), now = new Date().toISOString();
  await db.prepare('INSERT INTO "user" (id, name, email, emailVerified, createdAt, updatedAt) VALUES (?, ?, ?, 1, ?, ?)').bind(id, 'Test administrator', email, now, now).run();
  if (role) await db.prepare('INSERT INTO admin_roles (user_id, role) VALUES (?, ?)').bind(id, role).run();
  const auth = createAuth(env);
  const session = await (await auth.$context).internalAdapter.createSession(id);
  const value = await createSignedSessionCookieValue({ sessionToken: session.token, secret: env.BETTER_AUTH_SECRET! });
  return { env, id, auth, session, headers: { cookie: `better-auth.session_token=${value}`, origin: 'http://localhost' } };
}
