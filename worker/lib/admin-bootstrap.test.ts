import { expect, it } from 'vitest';
import { verifyPassword } from 'better-auth/crypto';
import { SqliteD1Fixture } from '../test/sqlite-d1';
// @ts-expect-error Node provisioning command intentionally remains JavaScript.
import { buildAdminBootstrap } from '../../scripts/bootstrap-admin.mjs';
it('bootstraps one owner with a random Better Auth password and never overwrites an existing account', async () => {
  const db = new SqliteD1Fixture();
  try {
    const first = await buildAdminBootstrap(), second = await buildAdminBootstrap();
    expect(first.password).toHaveLength(32); expect(first.password).not.toBe(second.password);
    const retry = await buildAdminBootstrap({ password: first.password, userId: first.userId });
    expect(retry.password).toBe(first.password); expect(retry.userId).toBe(first.userId);
    expect(first.sql).not.toContain(first.password);
    db.sqlite.exec(first.sql);
    const account = db.sqlite.prepare('SELECT password FROM account WHERE userId=?').get(first.userId)!;
    expect(await verifyPassword({ hash: String(account.password), password: first.password })).toBe(true);
    expect(db.sqlite.prepare('SELECT role FROM admin_roles').get()).toEqual({ role: 'owner' });
    expect(() => db.sqlite.exec(second.sql)).toThrow();
    expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM admin_roles').get()).toEqual({ n: 1 });
  } finally { db.sqlite.close(); }
});
