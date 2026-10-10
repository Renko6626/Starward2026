import { afterEach, describe, expect, it, vi } from "vitest";
import { createAuth } from "./auth";
import { SqliteD1Fixture } from "../test/sqlite-d1";
import { ACTIVITY_RULES_VERSION } from "../../src/shared/activity-rules";
import { getPasswordAuthErrorMessage } from "../../src/portal/lib/password-auth-error";
import type { AppBindings } from "./types";
import app from "../app";

const fixtures: SqliteD1Fixture[] = [];
afterEach(() => { vi.unstubAllGlobals(); fixtures.splice(0).forEach(f => f.sqlite.close()); });
const credentials = { email: "creator@example.com", password: "a-test-password-123" };
function limiter(max: number) {
  const counters = new Map<string, number>();
  return { limit: async ({ key }: { key: string }) => {
    const count = (counters.get(key) ?? 0) + 1;
    counters.set(key, count);
    return { success: count <= max };
  } } as RateLimit;
}
function setup(overrides: Partial<AppBindings> = {}) {
  const db = new SqliteD1Fixture(); fixtures.push(db);
  const env: AppBindings = {
    DB: db.db, BETTER_AUTH_SECRET: "test-only-password-auth-secret-at-least-32-characters",
    BETTER_AUTH_URL: "http://localhost:20262", ALLOW_LOCAL_DEV_ORIGINS: "true",
    RESEND_API_KEY: "re_test", RESEND_FROM_EMAIL: "test@example.com",
    AUTH_OTP_IP_RATE_LIMITER: limiter(10), AUTH_OTP_EMAIL_RATE_LIMITER: limiter(1),
    ...overrides,
  };
  const sent = vi.fn().mockImplementation(async () => Response.json({ id: "mail" })); vi.stubGlobal("fetch", sent);
  const auth = createAuth(env);
  async function request(path: string, body?: object, cookie = "", consent: string | null = null, origin = env.BETTER_AUTH_URL!) {
    (await auth.$context).skipOriginCheck = false;
    return auth.handler(new Request(`${env.BETTER_AUTH_URL}/api/auth${path}`, {
      method: body ? "POST" : "GET", headers: { "content-type": "application/json", origin, cookie,
        "cf-connecting-ip": "203.0.113.10", ...(consent ? { "x-starward-rules-version": consent } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    }));
  }
  async function issueOtp(email = credentials.email, expired = false) {
    await (await auth.$context).internalAdapter.createVerificationValue({
      identifier: `sign-in-otp-${email}`, value: "123456:0", expiresAt: new Date(Date.now() + (expired ? -1000 : 600000)),
    });
  }
  async function register() {
    await issueOtp();
    const response = await request("/sign-in/email-otp", { email: credentials.email, otp: "123456" }, "", ACTIVITY_RULES_VERSION);
    expect(response.status).toBe(200);
    return response;
  }
  async function withPassword() {
    const response = await register();
    expect((await request("/set-password", { newPassword: credentials.password }, cookies(response))).status).toBe(200);
    return response;
  }
  return { db, env, auth, request, issueOtp, register, withPassword, sent };
}
function cookies(response: Response) { return response.headers.getSetCookie().map(value => value.split(";")[0]).join("; "); }

describe("verified email registration", () => {
  it("blocks direct password registration without creating any account or workspace", async () => {
    const t = setup();
    const response = await t.request("/sign-up/email", { ...credentials, name: "Creator" }, "", ACTIVITY_RULES_VERSION);
    expect(response.ok).toBe(false);
    for (const table of ['user', 'account', 'session', 'participants']) {
      expect(t.db.sqlite.prepare(`SELECT COUNT(*) AS n FROM "${table}"`).get()?.n).toBe(0);
    }
  });
  it("only creates a verified account after a valid OTP, then sets a hashed password on that same user", async () => {
    const t = setup(); await t.issueOtp();
    expect((await t.request("/sign-in/email-otp", { email: credentials.email, otp: "000000" }, "", ACTIVITY_RULES_VERSION)).ok).toBe(false);
    expect(t.db.sqlite.prepare('SELECT COUNT(*) AS n FROM "user"').get()?.n).toBe(0);
    const response = await t.request("/sign-in/email-otp", { email: " Creator@Example.com ", otp: "123456" }, "", ACTIVITY_RULES_VERSION);
    expect(response.status).toBe(200);
    expect(response.headers.get("x-starward-account-created")).toBe("true");
    expect(response.headers.get("x-starward-password-setup-required")).toBe("true");
    const payload = await response.json() as { user: { id: string; email: string; emailVerified: boolean } };
    expect(payload.user).toMatchObject({ email: credentials.email, emailVerified: true });
    expect(t.db.sqlite.prepare('SELECT COUNT(*) AS n FROM account').get()?.n).toBe(0);
    expect((await t.request("/set-password", { newPassword: credentials.password }, cookies(response))).status).toBe(200);
    const account = t.db.sqlite.prepare('SELECT password,providerId FROM account').get();
    expect(account?.providerId).toBe("credential"); expect(account?.password).toBeTruthy(); expect(account?.password).not.toBe(credentials.password);
    expect(t.db.sqlite.prepare('SELECT COUNT(*) AS n FROM "user"').get()?.n).toBe(1);
    expect(t.db.sqlite.prepare('SELECT user_id,status FROM participants').get()).toMatchObject({ user_id: payload.user.id, status: "pending" });
    expect((await t.request("/sign-in/email", credentials)).status).toBe(200);
    expect((await t.request("/sign-in/email-otp", { email: credentials.email, otp: "123456" })).ok).toBe(false);
  });
  it("rejects expired codes and exhausts a code after three wrong attempts without creating a user", async () => {
    const t = setup(); await t.issueOtp(credentials.email, true);
    const verify = (otp: string) => t.request("/sign-in/email-otp", { email: credentials.email, otp }, "", ACTIVITY_RULES_VERSION);
    expect((await verify("123456")).ok).toBe(false);
    await t.issueOtp();
    for (let i = 0; i < 3; i++) expect((await verify("000000")).ok).toBe(false);
    expect((await verify("123456")).ok).toBe(false);
    expect(t.db.sqlite.prepare('SELECT COUNT(*) AS n FROM "user"').get()?.n).toBe(0);
  });
  it("requires valid rule consent before sending or consuming a new account OTP", async () => {
    const t = setup(); await t.issueOtp();
    const body = { email: credentials.email, otp: "123456" };
    expect((await t.request("/sign-in/email-otp", body)).status).toBe(403);
    expect((await t.request("/sign-in/email-otp", body, "", "old-version")).status).toBe(409);
    expect((await t.request("/email-otp/send-verification-otp", { email: credentials.email, type: "sign-in" })).status).toBe(403);
    const response = await t.request("/sign-in/email-otp", body, "", ACTIVITY_RULES_VERSION);
    expect(response.status).toBe(200);
    const acceptance = t.db.sqlite.prepare('SELECT rules_version,accepted_at FROM activity_rule_acceptances').get();
    expect(acceptance?.rules_version).toBe(ACTIVITY_RULES_VERSION); expect(Date.parse(String(acceptance?.accepted_at))).not.toBeNaN();
    await t.issueOtp(); expect((await t.request("/sign-in/email-otp", body)).status).toBe(200);
    expect(t.db.sqlite.prepare('SELECT rules_version,accepted_at FROM activity_rule_acceptances').get()).toEqual(acceptance);
  });
  it("cleans up a new user if consent storage fails", async () => {
    const t = setup(); await t.issueOtp();
    t.db.sqlite.exec("CREATE TRIGGER fail_rules BEFORE INSERT ON activity_rule_acceptances BEGIN SELECT RAISE(ABORT,'unavailable'); END");
    expect((await t.request("/sign-in/email-otp", { email: credentials.email, otp: "123456" }, "", ACTIVITY_RULES_VERSION)).ok).toBe(false);
    for (const table of ['user', 'account', 'session', 'participants']) expect(t.db.sqlite.prepare(`SELECT COUNT(*) AS n FROM "${table}"`).get()?.n).toBe(0);
  });
  it("links a pre-existing invitation only after proof of email ownership", async () => {
    const t = setup(); await t.withPassword();
    const part = t.db.sqlite.prepare('SELECT id FROM participants').get()!;
    t.db.sqlite.exec('UPDATE participants SET user_id=NULL; DELETE FROM "user";');
    await t.issueOtp();
    expect((await t.request("/sign-in/email-otp", { email: credentials.email, otp: "000000" }, "", ACTIVITY_RULES_VERSION)).ok).toBe(false);
    expect(t.db.sqlite.prepare('SELECT user_id FROM participants').get()?.user_id).toBeNull();
    const response = await t.request("/sign-in/email-otp", { email: credentials.email, otp: "123456" }, "", ACTIVITY_RULES_VERSION);
    expect(response.status).toBe(200);
    expect(t.db.sqlite.prepare('SELECT id FROM participants').all()).toEqual([part]);
    expect(t.db.sqlite.prepare('SELECT user_id FROM participants').get()?.user_id).toBeTruthy();
  });
});

describe("password and legacy email accounts", () => {
  it("requires a verified session, enforces password length and prevents overwriting an existing credential", async () => {
    const t = setup(); const response = await t.register(); const cookie = cookies(response);
    expect((await t.request("/set-password", { newPassword: credentials.password })).status).toBe(401);
    expect((await t.request("/set-password", { newPassword: "short" }, cookie)).status).toBe(400);
    expect((await t.request("/set-password", { newPassword: credentials.password }, cookie, null, "https://evil.example.com")).status).toBe(403);
    expect((await t.request("/set-password", { newPassword: credentials.password }, cookie)).status).toBe(200);
    expect((await t.request("/set-password", { newPassword: "overwrite-password" }, cookie)).ok).toBe(false);
    const wrong = await t.request("/sign-in/email", { ...credentials, password: "wrong-password" });
    expect(wrong.status).toBe(401); expect(cookies(wrong)).toBe("");
    expect(getPasswordAuthErrorMessage(await wrong.json())).toContain("邮箱或密码不正确");
  });
  it("requires the current password to change it and revokes other sessions", async () => {
    const t = setup(); const first = await t.withPassword(); const second = await t.request("/sign-in/email", credentials);
    expect((await t.request("/change-password", { currentPassword: "wrong", newPassword: "changed-password-123" }, cookies(first))).ok).toBe(false);
    expect((await t.request("/change-password", { currentPassword: credentials.password, newPassword: "changed-password-123", revokeOtherSessions: true }, cookies(first))).status).toBe(200);
    expect(await (await t.request("/get-session", undefined, cookies(second))).json()).toBeNull();
    expect((await t.request("/sign-in/email", credentials)).status).toBe(401);
    expect((await t.request("/sign-in/email", { ...credentials, password: "changed-password-123" })).status).toBe(200);
  });
  it("blocks an unverified legacy password/session, then replaces credentials only after a valid OTP while preserving the workspace", async () => {
    const t = setup({ QQ_OAUTH_ENABLED: 'true', QQ_APP_ID: '123456', QQ_APP_KEY: 'test-qq-key' }); const old = await t.withPassword(); const cookie = cookies(old);
    const participant = t.db.sqlite.prepare('SELECT id,user_id FROM participants').get();
    const account = t.db.sqlite.prepare('SELECT password FROM account').get();
    t.db.sqlite.exec(`INSERT INTO account(id,accountId,providerId,userId,createdAt,updatedAt)
      SELECT 'unverified-link','old-qq-id','qq',id,'2026-01-01','2026-01-01' FROM "user"`);
    t.db.sqlite.exec('UPDATE "user" SET emailVerified=0');
    expect((await t.request("/sign-in/email", credentials)).status).toBe(403);
    expect((await t.request("/set-password", { newPassword: "another-password-123" }, cookie)).status).toBe(403);
    expect((await t.request('/oauth2/link', { providerId: 'qq', callbackURL: '/portal' }, cookie)).status).toBe(403);
    expect((await app.request("/api/portal/me", { headers: { cookie } }, t.env)).status).toBe(401);
    await t.issueOtp();
    expect((await t.request("/sign-in/email-otp", { email: credentials.email, otp: "000000" })).ok).toBe(false);
    expect(t.db.sqlite.prepare("SELECT password FROM account WHERE providerId='credential'").get()).toEqual(account);
    expect(t.db.sqlite.prepare('SELECT COUNT(*) AS n FROM account').get()?.n).toBe(2);
    expect((await t.request("/get-session", undefined, cookie)).status).toBe(200);
    const verified = await t.request("/sign-in/email-otp", { email: credentials.email, otp: "123456" });
    expect(verified.status).toBe(200); expect(verified.headers.get("x-starward-password-setup-required")).toBe("true");
    expect(t.db.sqlite.prepare('SELECT COUNT(*) AS n FROM account').get()?.n).toBe(0);
    expect(await (await t.request("/get-session", undefined, cookie)).json()).toBeNull();
    expect(t.db.sqlite.prepare('SELECT id,user_id FROM participants').get()).toEqual(participant);
    expect((await t.request("/set-password", { newPassword: "owner-password-123" }, cookies(verified))).status).toBe(200);
    expect((await t.request("/sign-in/email", credentials)).status).toBe(401);
  });
  it("keeps verified accounts' passwords and historical consent unchanged on OTP login", async () => {
    const t = setup(); await t.withPassword();
    const account = t.db.sqlite.prepare('SELECT password FROM account').get();
    t.db.sqlite.exec('DELETE FROM activity_rule_acceptances'); await t.issueOtp();
    const response = await t.request("/sign-in/email-otp", { email: credentials.email, otp: "123456", __starwardNewAccount: true });
    expect(response.status).toBe(200); expect(response.headers.get("x-starward-account-created")).toBeNull();
    expect(response.headers.get("x-starward-password-setup-required")).toBeNull();
    expect(t.db.sqlite.prepare('SELECT password FROM account').get()).toEqual(account);
    expect(t.db.sqlite.prepare('SELECT COUNT(*) AS n FROM activity_rule_acceptances').get()?.n).toBe(0);
  });
});

describe("OTP sending limits", () => {
  it("does not report success when the mail provider fails, or when send limits are missing", async () => {
    const t = setup();
    t.sent.mockImplementation(async () => Response.json({ message: 'sender unavailable' }, { status: 500 }));
    const body = { email: credentials.email, type: 'sign-in' };
    expect((await t.request('/email-otp/send-verification-otp', body, '', ACTIVITY_RULES_VERSION)).status).toBe(503);
    const missing = createAuth({ ...t.env, AUTH_OTP_EMAIL_RATE_LIMITER: undefined });
    expect((await missing.handler(new Request(`${t.env.BETTER_AUTH_URL}/api/auth/email-otp/send-verification-otp`, {
      method: 'POST', headers: { 'content-type': 'application/json', origin: t.env.BETTER_AUTH_URL!, 'x-starward-rules-version': ACTIVITY_RULES_VERSION },
      body: JSON.stringify({ ...body, email: 'other@example.com' }),
    }))).status).toBe(503);
    expect(t.sent).toHaveBeenCalledOnce();
  });
  it("shares a normalized email limit across registration and login, before sending or changing a code", async () => {
    const t = setup(); const body = { email: credentials.email, type: "sign-in" };
    expect((await t.request("/email-otp/send-verification-otp", body, "", ACTIVITY_RULES_VERSION)).status).toBe(200);
    const code = t.db.sqlite.prepare('SELECT value FROM verification').get();
    const mail = JSON.parse(t.sent.mock.calls[0][1].body);
    expect(mail.html).toContain(String(code?.value).split(':')[0]);
    expect(mail.html).toContain('http://localhost:20262/brand/moon-phase.png');
    expect(mail.html).toContain('href="http://localhost:20262/portal/login"');
    expect(mail.text).toContain('逐星巡礼');
    const blocked = await t.request("/email-otp/send-verification-otp", { ...body, email: " Creator@Example.com " }, "", ACTIVITY_RULES_VERSION);
    expect(blocked.status).toBe(429); expect(blocked.headers.get("retry-after")).toBe("60");
    expect(t.sent).toHaveBeenCalledOnce(); expect(t.db.sqlite.prepare('SELECT value FROM verification').get()).toEqual(code);
  });
  it("limits the IP even when the sender rotates email addresses", async () => {
    const t = setup();
    for (let i = 0; i < 10; i++) expect((await t.request("/email-otp/send-verification-otp", { email: `creator${i}@example.com`, type: "sign-in" }, "", ACTIVITY_RULES_VERSION)).status).toBe(200);
    expect((await t.request("/email-otp/send-verification-otp", { email: "eleventh@example.com", type: "sign-in" }, "", ACTIVITY_RULES_VERSION)).status).toBe(429);
    expect(t.sent).toHaveBeenCalledTimes(10);
  });
  it("rejects invalid emails and disabled OTP purposes without sending mail", async () => {
    const t = setup();
    expect((await t.request("/email-otp/send-verification-otp", { email: "not-an-email", type: "sign-in" }, "", ACTIVITY_RULES_VERSION)).status).toBe(400);
    for (const type of ["email-verification", "change-email"]) expect((await t.request("/email-otp/send-verification-otp", { email: credentials.email, type }, "", ACTIVITY_RULES_VERSION)).status).toBe(403);
    expect(t.sent).not.toHaveBeenCalled(); expect(t.db.sqlite.prepare('SELECT COUNT(*) AS n FROM verification').get()?.n).toBe(0);
  });
});


describe("email password reset", () => {
  const newPassword = "reset-password-456";
  async function seedResetOtp(t: ReturnType<typeof setup>, expired = false) {
    await (await t.auth.$context).internalAdapter.createVerificationValue({
      identifier: `forget-password-otp-${credentials.email}`, value: "654321:0",
      expiresAt: new Date(Date.now() + (expired ? -1000 : 600000)),
    });
  }
  it("resets with a mailed code without the old password, preserves the workspace and revokes all previous sessions", async () => {
    const t=setup(); const first=await t.withPassword(); const second=await t.request('/sign-in/email',credentials);
    const participant=t.db.sqlite.prepare('SELECT id,user_id FROM participants').get();
    expect((await t.request('/email-otp/request-password-reset',{email:' Creator@Example.com '})).status).toBe(200);
    expect(t.sent).toHaveBeenCalledOnce();
    const otp=String(t.db.sqlite.prepare("SELECT value FROM verification WHERE identifier=?").get(`forget-password-otp-${credentials.email}`)?.value).split(':')[0];
    const mail=JSON.parse(t.sent.mock.calls[0][1].body);
    expect(mail.html).toContain(otp);
    expect(mail.html).toContain('href="http://localhost:20262/portal/login?reset=password"');
    expect(mail.text).toContain(otp);
    const reset=(password:string)=>t.request('/email-otp/reset-password',{email:' Creator@Example.com ',otp,password});
    expect((await reset('short')).status).toBe(400);
    expect((await reset(newPassword)).status).toBe(200);
    expect((await reset(newPassword)).ok).toBe(false);
    expect((await t.request('/sign-in/email',credentials)).status).toBe(401);
    expect((await t.request('/sign-in/email',{...credentials,password:newPassword})).status).toBe(200);
    for(const response of [first,second]) expect(await (await t.request('/get-session',undefined,cookies(response))).json()).toBeNull();
    expect(t.db.sqlite.prepare('SELECT id,user_id FROM participants').get()).toEqual(participant);
    expect(t.db.sqlite.prepare('SELECT COUNT(*) AS n FROM "user"').get()?.n).toBe(1);
  });
  it("returns generic success for unknown mailboxes without sending or creating an account",async()=>{
    const t=setup(); const response=await t.request('/email-otp/request-password-reset',{email:'unknown@example.com'});
    expect(response.status).toBe(200); expect(await response.json()).toEqual({success:true});
    expect(t.sent).not.toHaveBeenCalled();
    expect(t.db.sqlite.prepare('SELECT COUNT(*) AS n FROM "user"').get()?.n).toBe(0);
    expect(t.db.sqlite.prepare('SELECT COUNT(*) AS n FROM verification').get()?.n).toBe(0);
  });
  it("shares send quotas with login and registration, and reports delivery failures",async()=>{
    const t=setup(); await t.withPassword();
    expect((await t.request('/email-otp/send-verification-otp',{email:credentials.email,type:'sign-in'})).status).toBe(200);
    expect((await t.request('/email-otp/request-password-reset',{email:' Creator@Example.com '})).status).toBe(429);
    expect(t.sent).toHaveBeenCalledOnce();
    const failing=setup(); await failing.withPassword();
    failing.sent.mockImplementation(async()=>Response.json({message:'mail unavailable'},{status:500}));
    expect((await failing.request('/email-otp/request-password-reset',{email:credentials.email})).status).toBe(503);
  });
  it("rejects login codes, expired reset codes and exhausted reset attempts without changing a password",async()=>{
    const t=setup(); await t.withPassword(); await t.issueOtp();
    const account=t.db.sqlite.prepare('SELECT password FROM account').get();
    const reset=(otp:string)=>t.request('/email-otp/reset-password',{email:credentials.email,otp,password:newPassword});
    expect((await reset('123456')).ok).toBe(false);
    await seedResetOtp(t,true); expect((await reset('654321')).ok).toBe(false);
    await seedResetOtp(t); for(let i=0;i<3;i++) expect((await reset('000000')).ok).toBe(false);
    expect((await reset('654321')).ok).toBe(false);
    expect(t.db.sqlite.prepare('SELECT password FROM account').get()).toEqual(account);
    expect((await t.request('/sign-in/email',credentials)).status).toBe(200);
  });
  it("recovers an unverified legacy account with the new credential while discarding old linked identities",async()=>{
    const t=setup(); const old=await t.withPassword();
    const participant=t.db.sqlite.prepare('SELECT id,user_id FROM participants').get();
    t.db.sqlite.exec(`UPDATE "user" SET emailVerified=0;
      INSERT INTO account(id,accountId,providerId,userId,createdAt,updatedAt)
      SELECT 'old-reset-link','old-provider-id','qq',id,'2026-01-01','2026-01-01' FROM "user";`);
    await seedResetOtp(t);
    expect((await t.request('/email-otp/reset-password',{email:credentials.email,otp:'654321',password:newPassword})).status).toBe(200);
    expect(t.db.sqlite.prepare('SELECT emailVerified FROM "user"').get()?.emailVerified).toBe(1);
    expect(t.db.sqlite.prepare('SELECT providerId FROM account').all()).toEqual([{providerId:'credential'}]);
    expect((await t.request('/sign-in/email',{...credentials,password:newPassword})).status).toBe(200);
    expect(await (await t.request('/get-session',undefined,cookies(old))).json()).toBeNull();
    expect(t.db.sqlite.prepare('SELECT id,user_id FROM participants').get()).toEqual(participant);
  });
});
