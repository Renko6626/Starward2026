import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import { createAuth } from "./auth";

// Exercise Better Auth's D1 adapter against the repository's real migrations.
class Statement {
  constructor(private db: DatabaseSync, private sql: string, private params: SQLInputValue[] = []) {}
  bind(...params: SQLInputValue[]) { return new Statement(this.db, this.sql, params); }
  async all() {
    const results = this.db.prepare(this.sql).all(...this.params);
    const meta = this.db.prepare("SELECT changes() AS changes, last_insert_rowid() AS last_row_id").get();
    return { success: true, results, meta };
  }
  async first<T>() { return (this.db.prepare(this.sql).get(...this.params) as T | undefined) ?? null; }
  async run() { return this.all(); }
}
class TestD1 {
  sqlite = new DatabaseSync(":memory:");
  prepare(sql: string) { return new Statement(this.sqlite, sql); }
  async exec(sql: string) { this.sqlite.exec(sql); }
  async batch(statements: Statement[]) {
    this.sqlite.exec("BEGIN");
    try {
      const results = [];
      for (const statement of statements) results.push(await statement.all());
      this.sqlite.exec("COMMIT");
      return results;
    } catch (error) {
      this.sqlite.exec("ROLLBACK");
      throw error;
    }
  }
}
const databases: TestD1[] = [];
afterEach(() => { for (const db of databases.splice(0)) db.sqlite.close(); });

function setup() {
  const db = new TestD1();
  databases.push(db);
  for (const file of readdirSync("migrations").filter((name) => name.endsWith(".sql")).sort()) {
    db.sqlite.exec(readFileSync(`migrations/${file}`, "utf8"));
  }
  db.sqlite.exec("PRAGMA foreign_keys = ON");
  const auth = createAuth({
    DB: db as unknown as D1Database,
    BETTER_AUTH_SECRET: "test-only-password-auth-secret-at-least-32-characters",
    BETTER_AUTH_URL: "http://localhost:20262",
  });
  async function request(path: string, body?: object, cookie?: string, origin = "http://localhost:20262", rulesVersion: string | null = path === "/sign-up/email" ? "2026-10-10-v8" : null) {
    // Better Auth disables origin checks in test mode; exercise production behavior.
    (await auth.$context).skipOriginCheck = false;
    return auth.handler(new Request(`http://localhost:20262/api/auth${path}`, {
      method: body ? "POST" : "GET",
      headers: { "content-type": "application/json", origin, ...(cookie ? { cookie } : {}), ...(rulesVersion ? { "x-starward-rules-version": rulesVersion } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    }));
  }
  return { db, auth, request };
}
function sessionCookie(response: Response) {
  return response.headers.getSetCookie().map((cookie) => cookie.split(";")[0]).join("; ");
}
const credentials = { email: "creator@example.com", password: "a-test-password-123", name: "Creator" };

describe("portal password authentication", () => {
  it("registers without mail or email verification, stores a hash and creates one pending workspace", async () => {
    const { db, request } = setup();
    const response = await request("/sign-up/email", { ...credentials, email: " Creator@Example.com " });
    expect(response.status).toBe(200);
    const payload = await response.json() as { user: { id: string; email: string; emailVerified: boolean } };
    expect(payload.user.email).toBe(credentials.email);
    expect(payload.user.emailVerified).toBe(false);
    expect(sessionCookie(response)).toContain("session_token");
    const account = db.sqlite.prepare('SELECT password, providerId FROM account').get();
    expect(account?.providerId).toBe("credential");
    expect(account?.password).toBeTruthy();
    expect(account?.password).not.toBe(credentials.password);
    expect(db.sqlite.prepare("SELECT user_id, status FROM participants").get()).toMatchObject({ user_id: payload.user.id, status: "pending" });
    const login = await request("/sign-in/email", { email: "CREATOR@example.com", password: credentials.password });
    expect(login.status).toBe(200);
    expect(db.sqlite.prepare("SELECT COUNT(*) AS count FROM participants").get()?.count).toBe(1);
    const session = await request("/get-session", undefined, sessionCookie(login));
    expect((await session.json() as { user: { id: string } }).user.id).toBe(payload.user.id);
  });

  it("rejects wrong passwords, short signup passwords, duplicate signup and foreign origins", async () => {
    const { request } = setup();
    expect((await request("/sign-up/email", { ...credentials, password: "short" })).status).toBe(400);
    expect((await request("/sign-up/email", credentials)).status).toBe(200);
    expect((await request("/sign-in/email", { email: credentials.email, password: "wrong-password" })).status).toBe(401);
    expect((await request("/sign-up/email", credentials)).ok).toBe(false);
    expect((await request("/sign-in/email", credentials, "existing=1", "https://evil.example.com")).status).toBe(403);
  });

  it("lets a signed-in OTP account set a password without creating a second user or workspace", async () => {
    const { db, request } = setup();
    const initial = await request("/sign-up/email", credentials);
    const cookie = sessionCookie(initial);
    // An existing OTP user has a user/session and participant, but no credential account.
    db.sqlite.exec("DELETE FROM account WHERE providerId = 'credential'");
    expect((await request("/set-password", { newPassword: "new-password-123" })).status).toBe(401);
    expect((await request("/set-password", { newPassword: "short" }, cookie)).status).toBe(400);
    expect((await request("/set-password", { newPassword: "new-password-123" }, cookie, "https://evil.example.com")).status).toBe(403);
    expect((await request("/set-password", { newPassword: "new-password-123" }, cookie)).status).toBe(200);
    expect((await request("/set-password", { newPassword: "overwrite-password" }, cookie)).ok).toBe(false);
    expect((await request("/sign-in/email", { email: credentials.email, password: "new-password-123" })).status).toBe(200);
    expect(db.sqlite.prepare('SELECT COUNT(*) AS count FROM "user"').get()?.count).toBe(1);
    expect(db.sqlite.prepare("SELECT COUNT(*) AS count FROM participants").get()?.count).toBe(1);
  });

  it("requires the current password to change credentials and invalidates other sessions", async () => {
    const { request } = setup();
    const initial = await request("/sign-up/email", credentials);
    const second = await request("/sign-in/email", credentials);
    const cookie = sessionCookie(initial);
    expect((await request("/change-password", { currentPassword: "wrong", newPassword: "changed-password-123" }, cookie)).ok).toBe(false);
    expect((await request("/change-password", { currentPassword: credentials.password, newPassword: "changed-password-123", revokeOtherSessions: true }, cookie)).status).toBe(200);
    expect(await (await request("/get-session", undefined, sessionCookie(second))).json()).toBeNull();
    expect((await request("/sign-in/email", credentials)).status).toBe(401);
    expect((await request("/sign-in/email", { email: credentials.email, password: "changed-password-123" })).status).toBe(200);
  });

  it("does not claim an unlinked invitation merely by registering its email", async () => {
    const { db, request } = setup();
    await request("/sign-up/email", credentials);
    db.sqlite.exec('UPDATE participants SET user_id = NULL; DELETE FROM session; DELETE FROM account; DELETE FROM "user";');
    const response = await request("/sign-up/email", credentials);
    expect(response.status).toBe(409);
    expect(db.sqlite.prepare("SELECT user_id FROM participants").get()?.user_id).toBeNull();
    expect(db.sqlite.prepare('SELECT COUNT(*) AS count FROM "user"').get()?.count).toBe(0);
  });
});

describe("activity rules acceptance during account creation", () => {
  async function issueOtp(auth: ReturnType<typeof createAuth>, email = credentials.email) {
    await (await auth.$context).internalAdapter.createVerificationValue({
      identifier: `sign-in-otp-${email}`, value: "123456:0", expiresAt: new Date(Date.now() + 600000),
    });
  }

  it("rejects password registration without consent or with an outdated rules version", async () => {
    const { db, request } = setup();
    const missing = await request("/sign-up/email", credentials, undefined, undefined, null);
    expect(missing.status).toBe(403);
    expect(await missing.json()).toMatchObject({ code: "ACTIVITY_RULES_REQUIRED" });
    const outdated = await request("/sign-up/email", credentials, undefined, undefined, "2026-10-10-v7");
    expect(outdated.status).toBe(409);
    expect(await outdated.json()).toMatchObject({ code: "ACTIVITY_RULES_CHANGED" });
    expect(db.sqlite.prepare('SELECT COUNT(*) AS count FROM "user"').get()?.count).toBe(0);
  });

  it("records the accepted version and server time once, without rewriting it on login", async () => {
    const { db, request } = setup();
    const before = Date.now();
    const response = await request("/sign-up/email", credentials);
    expect(response.status).toBe(200);
    const payload = await response.json() as { user: { id: string } };
    const acceptance = db.sqlite.prepare("SELECT user_id, rules_version, accepted_at FROM activity_rule_acceptances").get();
    expect(acceptance).toMatchObject({ user_id: payload.user.id, rules_version: "2026-10-10-v8" });
    expect(Date.parse(String(acceptance?.accepted_at))).toBeGreaterThanOrEqual(before);
    expect(Date.parse(String(acceptance?.accepted_at))).toBeLessThanOrEqual(Date.now());
    expect((await request("/sign-in/email", credentials)).status).toBe(200);
    expect(db.sqlite.prepare("SELECT user_id, rules_version, accepted_at FROM activity_rule_acceptances").all()).toEqual([acceptance]);
  });

  it("guards OTP account creation before consuming the code, then records consent on success", async () => {
    const { db, auth, request } = setup();
    await issueOtp(auth);
    const body = { email: credentials.email, otp: "123456" };
    expect((await request("/sign-in/email-otp", body)).status).toBe(403);
    expect((await request("/sign-in/email-otp", { ...body, type: "email-verification" })).status).toBe(403);
    expect((await request("/sign-in/email-otp", body, undefined, undefined, "old-version")).status).toBe(409);
    expect(db.sqlite.prepare('SELECT COUNT(*) AS count FROM "user"').get()?.count).toBe(0);
    const response = await request("/sign-in/email-otp", body, undefined, undefined, "2026-10-10-v8");
    expect(response.status).toBe(200);
    expect(response.headers.get("x-starward-account-created")).toBe("true");
    const payload = await response.json() as { user: { id: string } };
    expect(db.sqlite.prepare("SELECT user_id, rules_version FROM activity_rule_acceptances").get()).toMatchObject({ user_id: payload.user.id, rules_version: "2026-10-10-v8" });
  });

  it("requires consent before sending a signup OTP for a new email", async () => {
    const { db, request } = setup();
    const response = await request("/email-otp/send-verification-otp", { email: credentials.email, type: "sign-in" });
    expect(response.status).toBe(403);
    expect(db.sqlite.prepare("SELECT COUNT(*) AS count FROM verification").get()?.count).toBe(0);
  });

  it("keeps password and OTP login working for accounts with no historical consent record", async () => {
    const { db, auth, request } = setup();
    expect((await request("/sign-up/email", credentials)).status).toBe(200);
    db.sqlite.exec("DELETE FROM activity_rule_acceptances");
    expect((await request("/sign-in/email", credentials)).status).toBe(200);
    await issueOtp(auth);
    const login = await request("/sign-in/email-otp", { email: credentials.email, otp: "123456", __starwardNewAccount: true }, undefined, undefined, "2026-10-10-v8");
    expect(login.status).toBe(200);
    expect(login.headers.get("x-starward-account-created")).toBeNull();
    expect(db.sqlite.prepare("SELECT COUNT(*) AS count FROM activity_rule_acceptances").get()?.count).toBe(0);
  });

  it("removes a newly created account if its acceptance record cannot be saved", async () => {
    const { db, request } = setup();
    db.sqlite.exec("CREATE TRIGGER fail_rules_acceptance BEFORE INSERT ON activity_rule_acceptances BEGIN SELECT RAISE(ABORT, 'acceptance unavailable'); END");
    const response = await request("/sign-up/email", credentials);
    expect(response.ok).toBe(false);
    expect(db.sqlite.prepare('SELECT COUNT(*) AS count FROM "user"').get()?.count).toBe(0);
    expect(db.sqlite.prepare("SELECT COUNT(*) AS count FROM account").get()?.count).toBe(0);
    expect(db.sqlite.prepare("SELECT COUNT(*) AS count FROM session").get()?.count).toBe(0);
  });
});
