import { afterEach, describe, expect, it } from 'vitest';
import app from '../app';
import { SqliteD1Fixture } from '../test/sqlite-d1';
import { adminTestSession } from '../test/admin-session';
import { ACTIVITY_RULES_VERSION } from '../../src/shared/activity-rules';
import { issueAdminAssistedAccess } from '../data/admin-assisted-access';

const fixtures: SqliteD1Fixture[] = [];
afterEach(() => fixtures.splice(0).forEach(f => f.sqlite.close()));

async function setup() {
  const fixture = new SqliteD1Fixture(); fixtures.push(fixture);
  const admin = await adminTestSession(fixture.db, 'admin');
  const env = { ...admin.env, TURNSTILE_SECRET_KEY: 'test-turnstile-secret' };
  const issue = (email: string, headers: Record<string, string> = admin.headers) => app.request('/api/admin/assisted-access', {
    method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify({ email }),
  }, env);
  const signIn = (email: string, otp: string, consent = false) => app.request('/api/auth/sign-in/email-otp', {
    method: 'POST', headers: { origin: 'http://localhost', 'content-type': 'application/json',
      ...(consent ? { 'x-starward-rules-version': ACTIVITY_RULES_VERSION } : {}) },
    body: JSON.stringify({ email, otp }),
  }, env);
  return { fixture, admin, env, issue, signIn };
}

describe('administrator assisted registration and login', () => {
  it('registers through the existing OTP flow without Turnstile, records consent and keeps the password on assisted login', async () => {
    const t = await setup();
    const issued = await t.issue(' Creator@Example.com ');
    expect(issued.status).toBe(200);
    expect(issued.headers.get('cache-control')).toContain('no-store');
    const access = await issued.json() as { email: string; otp: string; expiresAt: string };
    expect(access.email).toBe('creator@example.com');
    expect(access.otp).toMatch(/^\d{6}$/);
    expect(Date.parse(access.expiresAt) - Date.now()).toBeGreaterThan(590_000);
    expect(t.fixture.sqlite.prepare('SELECT COUNT(*) AS n FROM "user" WHERE email=?').get(access.email)?.n).toBe(0);
    expect((await t.signIn(access.email, access.otp)).status).toBe(403);
    const signedIn = await t.signIn(access.email, access.otp, true);
    expect(signedIn.status).toBe(200);
    expect(signedIn.headers.get('x-starward-password-setup-required')).toBe('true');
    const { user } = await signedIn.json() as { user: { id: string; emailVerified: boolean } };
    expect(user.emailVerified).toBe(true);
    expect(t.fixture.sqlite.prepare('SELECT rules_version FROM activity_rule_acceptances WHERE user_id=?').get(user.id)?.rules_version).toBe(ACTIVITY_RULES_VERSION);
    expect(t.fixture.sqlite.prepare('SELECT status FROM participants WHERE user_id=?').get(user.id)?.status).toBe('pending');
    expect((await t.signIn(access.email, access.otp, true)).ok).toBe(false);
    const cookie = signedIn.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
    const password = 'creator-password-123';
    expect((await app.request('/api/auth/set-password', {
      method: 'POST', headers: { origin: 'http://localhost', cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ newPassword: password }),
    }, t.env)).status).toBe(200);
    const credential = t.fixture.sqlite.prepare('SELECT password FROM account WHERE userId=?').get(user.id);
    expect(credential?.password).toBeTruthy(); expect(credential?.password).not.toBe(password);
    const next = await (await t.issue(access.email)).json() as { otp: string };
    expect((await t.signIn(access.email, next.otp)).status).toBe(200);
    expect(t.fixture.sqlite.prepare('SELECT password FROM account WHERE userId=?').get(user.id)).toEqual(credential);
    expect(t.fixture.sqlite.prepare('SELECT email, actor_user_id FROM admin_account_events ORDER BY rowid').all()).toEqual([
      { email: access.email, actor_user_id: t.admin.id }, { email: access.email, actor_user_id: t.admin.id },
    ]);
    expect(t.fixture.sqlite.prepare('SELECT COUNT(*) AS n FROM "user" WHERE email=?').get(access.email)?.n).toBe(1);
  });

  it('requires an administrator and same-site origin, validates email and refuses management accounts', async () => {
    const t = await setup();
    const regular = await adminTestSession(t.fixture.db, null, 'regular@example.com');
    expect((await t.issue('creator@example.com', {})).status).toBe(401);
    expect((await t.issue('creator@example.com', regular.headers)).status).toBe(403);
    expect((await t.issue('creator@example.com', { ...t.admin.headers, origin: 'https://evil.example' })).status).toBe(403);
    expect((await t.issue('creator@example.com', { cookie: t.admin.headers.cookie })).status).toBe(403);
    expect((await t.issue('invalid')).status).toBe(422);
    expect((await t.issue('qq@accounts.invalid')).status).toBe(422);
    expect((await t.issue('admin@example.com')).status).toBe(403);
    const owner = await adminTestSession(t.fixture.db, 'owner', 'owner@example.com');
    expect((await t.issue('owner@example.com')).status).toBe(403);
    expect(t.fixture.sqlite.prepare('SELECT COUNT(*) AS n FROM verification').get()?.n).toBe(0);
    expect(t.fixture.sqlite.prepare('SELECT COUNT(*) AS n FROM admin_account_events').get()?.n).toBe(0);
    expect((await t.issue('creator@example.com', owner.headers)).status).toBe(200);
  });

  it('replaces previous codes and rejects expired codes and codes after three wrong attempts', async () => {
    const t = await setup(), email = 'creator@example.com';
    await t.issue(email);
    const next = await (await t.issue(email)).json() as { otp: string };
    expect(t.fixture.sqlite.prepare('SELECT COUNT(*) AS n FROM verification WHERE identifier=?').get(`sign-in-otp-${email}`)?.n).toBe(1);
    t.fixture.sqlite.prepare('UPDATE verification SET expiresAt=?').run('2000-01-01T00:00:00.000Z');
    expect((await t.signIn(email, next.otp, true)).ok).toBe(false);
    const access = await (await t.issue(email)).json() as { otp: string };
    const wrong = access.otp === '000000' ? '111111' : '000000';
    for (let i = 0; i < 3; i++) expect((await t.signIn(email, wrong, true)).ok).toBe(false);
    expect((await t.signIn(email, access.otp, true)).ok).toBe(false);
    expect(t.fixture.sqlite.prepare('SELECT COUNT(*) AS n FROM "user" WHERE email=?').get(email)?.n).toBe(0);
  });

  it('keeps the previous code if recording the administrator action fails', async () => {
    const t = await setup(), email = 'creator@example.com';
    const access = await (await t.issue(email)).json() as { otp: string };
    t.fixture.sqlite.exec("CREATE TRIGGER fail_access_log BEFORE INSERT ON admin_account_events BEGIN SELECT RAISE(ABORT, 'log unavailable'); END");
    await expect(issueAdminAssistedAccess(t.fixture.db, email, t.admin.id)).rejects.toThrow('log unavailable');
    expect((await t.signIn(email, access.otp, true)).status).toBe(200);
    expect(t.fixture.sqlite.prepare('SELECT COUNT(*) AS n FROM admin_account_events').get()?.n).toBe(1);
  });
});
