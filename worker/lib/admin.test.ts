import { afterEach, describe, expect, it, vi } from 'vitest';
import { hashPassword } from 'better-auth/crypto';
import app from '../app';
import { SqliteD1Fixture } from '../test/sqlite-d1';
import { adminTestSession } from '../test/admin-session';
const fixtures: SqliteD1Fixture[] = [];
afterEach(() => fixtures.splice(0).forEach(f => f.sqlite.close()));
function fixture() { const f = new SqliteD1Fixture(); fixtures.push(f); return f; }

describe('website administrator boundary', () => {
  it('rejects anonymous and forged sessions and old trusted headers even on localhost', async () => {
    const f = fixture(), t = await adminTestSession(f.db);
    for (const headers of [{}, { cookie: 'better-auth.session_token=forged' }, { 'x-admin-email': 'admin@example.com', 'cf-access-authenticated-user-email': 'admin@example.com', 'cf-access-jwt-assertion': 'forged' }]) {
      const r = await app.request('/api/admin/session', { headers: headers as Record<string, string> }, { ...t.env, ALLOW_LOCAL_ADMIN_BYPASS: 'true' });
      expect(r.status).toBe(401); expect(r.headers.get('cache-control')).toContain('no-store');
    }
  });
  it('accepts real password login for the owner and preserves public pages', async () => {
    const f = fixture(), t = await adminTestSession(f.db);
    const now = new Date().toISOString();
    await f.db.prepare('INSERT INTO account (id, accountId, providerId, userId, password, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind('password-account', t.id, 'credential', t.id, await hashPassword('test-admin-password-123!'), now, now).run();
    const login = await t.auth.handler(new Request('http://localhost/api/auth/sign-in/email', { method: 'POST', headers: { origin: 'http://localhost', 'content-type': 'application/json' }, body: JSON.stringify({ email: 'admin@example.com', password: 'test-admin-password-123!' }) }));
    expect(login.status).toBe(200);
    const cookie = login.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
    const response = await app.request('/api/admin/session', { headers: { cookie } }, t.env);
    expect(await response.json()).toEqual({ email: 'admin@example.com', role: 'owner' });
    expect((await app.request('/api/admin/participants', { headers: { cookie } }, t.env)).status).toBe(200);
    expect((await app.request('/privacy')).status).toBe(200);
  });
  it('denies regular users, unverified emails, expired sessions and immediate revocation', async () => {
    const f = fixture(), regular = await adminTestSession(f.db, null, 'creator@example.com');
    expect((await app.request('/api/admin/session', { headers: regular.headers }, regular.env)).status).toBe(403);
    const t = await adminTestSession(f.db, 'admin');
    f.sqlite.prepare('UPDATE "user" SET emailVerified=0 WHERE id=?').run(t.id);
    expect((await app.request('/api/admin/session', { headers: t.headers }, t.env)).status).toBe(403);
    f.sqlite.prepare('UPDATE "user" SET emailVerified=1 WHERE id=?').run(t.id);
    f.sqlite.prepare('DELETE FROM admin_roles WHERE user_id=?').run(t.id);
    expect((await app.request('/api/admin/session', { headers: t.headers }, t.env)).status).toBe(403);
    f.sqlite.prepare('DELETE FROM session WHERE userId=?').run(t.id);
    expect((await app.request('/api/admin/session', { headers: t.headers }, t.env)).status).toBe(401);
    f.sqlite.prepare("UPDATE session SET expiresAt='2000-01-01' WHERE userId=?").run(regular.id);
    expect((await app.request('/api/admin/session', { headers: regular.headers }, regular.env)).status).toBe(401);
  });
  it('only the owner can promote verified users, revoke access, and record changes', async () => {
    const f = fixture(), owner = await adminTestSession(f.db), user = await adminTestSession(f.db, null, 'creator@example.com');
    const change = (id: string, role: string | null, headers = owner.headers) => app.request(`/api/admin/users/${id}/role`, { method: 'PUT', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify({ role }) }, owner.env);
    expect((await change(user.id, 'admin', { ...owner.headers, origin: 'https://evil.example' })).status).toBe(403);
    expect((await change(user.id, 'admin', { ...owner.headers, origin: '' })).status).toBe(403);
    expect((await change(user.id, 'owner')).status).toBe(422);
    expect((await change(owner.id, null)).status).toBe(403);
    f.sqlite.prepare('UPDATE "user" SET emailVerified=0 WHERE id=?').run(user.id);
    expect((await change(user.id, 'admin')).status).toBe(422);
    f.sqlite.prepare('UPDATE "user" SET emailVerified=1 WHERE id=?').run(user.id);
    expect((await change(user.id, 'admin')).status).toBe(200);
    expect((await app.request('/api/admin/session', { headers: user.headers }, user.env)).status).toBe(200);
    expect((await change(owner.id, null, user.headers)).status).toBe(403);
    expect((await app.request('/api/admin/users', { headers: user.headers }, user.env)).status).toBe(403);
    expect((await change(user.id, null)).status).toBe(200);
    expect((await app.request('/api/admin/session', { headers: user.headers }, user.env)).status).toBe(403);
    expect(f.sqlite.prepare('SELECT action FROM admin_role_events ORDER BY rowid').all()).toEqual([{ action: 'grant' }, { action: 'revoke' }]);
  });
  it('guards direct HTML navigation, aliases and nested routes before serving assets', async () => {
    const f = fixture(), t = await adminTestSession(f.db);
    const fetchAsset = vi.fn(async () => new Response('<html>admin app</html>', { headers: { 'content-type': 'text/html' } }));
    const env = { ...t.env, ASSETS: { fetch: fetchAsset } as unknown as Fetcher };
    for (const path of ['/portal/admin', '/portal/admin/', '/portal/admin/participants?view=all', '/PORTAL/ADMIN/schedule', '/portal/%61dmin/settings/admins']) {
      const denied = await app.request(path, {}, env);
      expect(denied.status).toBe(302); expect(denied.headers.get('location')).toMatch(/^\/portal\/login\?returnTo=/);
    }
    expect(fetchAsset).not.toHaveBeenCalled();
    for (const path of ['/admin', '/admin/participants?view=all', '/%61dmin/settings/admins', '/ADMIN', '/admin-access']) {
      const moved = await app.request(path, {}, env);
      expect(moved.status).toBe(404); expect(moved.headers.has('location')).toBe(false);
    }
    expect(fetchAsset).not.toHaveBeenCalled();
    const allowed = await app.request('/portal/admin/settings/admins', { headers: t.headers }, env);
    expect(allowed.status).toBe(200); expect(allowed.headers.get('cache-control')).toContain('no-store');
    expect(fetchAsset).toHaveBeenCalledOnce();
  });
});
