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
  const auth = createAuth({
    DB: db as unknown as D1Database,
    BETTER_AUTH_SECRET: "test-only-password-auth-secret-at-least-32-characters",
    BETTER_AUTH_URL: "http://localhost:20262",
  });
  async function request(path: string, body?: object, cookie?: string, origin = "http://localhost:20262") {
    // Better Auth disables origin checks in test mode; exercise production behavior.
    (await auth.$context).skipOriginCheck = false;
    return auth.handler(new Request(`http://localhost:20262/api/auth${path}`, {
      method: body ? "POST" : "GET",
      headers: { "content-type": "application/json", origin, ...(cookie ? { cookie } : {}) },
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
