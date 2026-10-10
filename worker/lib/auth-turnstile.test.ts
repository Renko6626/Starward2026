import { afterEach, describe, expect, it, vi } from "vitest";
import { createAuth } from "./auth";
import { SqliteD1Fixture } from "../test/sqlite-d1";
import { activityRulesConsentHeaders } from "../../src/shared/activity-rules";
import type { AppBindings } from "./types";
import app from "../app";

const databases: SqliteD1Fixture[] = [];
afterEach(() => { vi.unstubAllGlobals(); databases.splice(0).forEach(f => f.sqlite.close()); });
const credentials = { email: "creator@example.com", password: "creator-test-password", name: "Creator" };
function setup(enabled = true) {
  const f = new SqliteD1Fixture(); databases.push(f);
  const env: AppBindings = { DB: f.db, BETTER_AUTH_SECRET: "test-only-turnstile-secret-over-32-characters", BETTER_AUTH_URL: "http://localhost:20262", ...(enabled ? { TURNSTILE_SECRET_KEY: "test-secret" } : {}), RESEND_API_KEY: "re_test", RESEND_FROM_EMAIL: "test@example.com" };
  const auth = createAuth(env);
  const request = (path: string, body: object, token?: string) => auth.handler(new Request(`http://localhost:20262/api/auth${path}`, {
    method: "POST", headers: { "content-type": "application/json", origin: env.BETTER_AUTH_URL!, ...activityRulesConsentHeaders(true), ...(token ? { "x-captcha-response": token } : {}) }, body: JSON.stringify(body),
  }));
  return { f, env, request };
}

describe("authentication Turnstile boundaries", () => {
  it.each(["/sign-up/email", "/sign-in/email", "/email-otp/send-verification-otp"])("rejects missing and invalid tokens before handling %s", async path => {
    const { f, request } = setup();
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ success: false })); vi.stubGlobal("fetch", fetchMock);
    const body = { ...credentials, type: "sign-in" };
    const missing = await request(path, body);
    expect(missing.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
    const invalid = await request(path, body, "invalid-token");
    expect(invalid.status).toBe(403);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(f.sqlite.prepare('SELECT count(*) AS n FROM "user"').get()).toMatchObject({ n: 0 });
    expect(f.sqlite.prepare('SELECT count(*) AS n FROM verification').get()).toMatchObject({ n: 0 });
  });

  it("allows verified signup and password login, then application submission without another challenge", async () => {
    const { f, env, request } = setup();
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(Response.json({ success: true }))); vi.stubGlobal("fetch", fetchMock);
    const signup = await request("/sign-up/email", credentials, "signup-token");
    expect(signup.status).toBe(200);
    const login = await request("/sign-in/email", credentials, "login-token");
    expect(login.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const cookie = login.headers.getSetCookie().map(value => value.split(";")[0]).join("; ");
    f.sqlite.exec(`UPDATE event_windows SET is_enabled=1, opens_at=NULL, closes_at=NULL;
      INSERT INTO schedule_segments(id,schedule_version_id,code,name,status,sort_order,created_at,updated_at)
      VALUES('s1','schedule_default','A','First','open',1,'2026-01-01','2026-01-01');`);
    const response = await app.request("http://localhost:20262/api/portal/application-with-segment", {
      method: "POST", headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ segmentId: "s1", profile: { creditName: "作者", bilibiliUid: "12345", contactEmail: credentials.email, primaryContactChannel: "QQ", primaryContactHandle: "123456789", isAnonymous: false }, application: { contactEmail: credentials.email, interestFormat: "novel", introText: "准备创作" } }),
    }, env);
    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(f.sqlite.prepare('SELECT status FROM applications').get()).toMatchObject({ status: "pending" });
  });

  it("challenges OTP send and resend but accepts the OTP without a Turnstile token", async () => {
    const { f, request } = setup();
    const verification = vi.fn();
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async (url: string) => {
      if (String(url).includes("siteverify")) { verification(); return Response.json({ success: true }); }
      return Response.json({ id: "mail" });
    }));
    const send = () => request("/email-otp/send-verification-otp", { email: credentials.email, type: "sign-in" }, "send-token");
    expect((await send()).status).toBe(200);
    expect((await request("/email-otp/send-verification-otp", { email: credentials.email, type: "sign-in" })).status).toBe(400);
    expect((await send()).status).toBe(200);
    const record = f.sqlite.prepare("SELECT value FROM verification WHERE identifier=?").get(`sign-in-otp-${credentials.email}`)!;
    const response = await request("/sign-in/email-otp?next=/sign-in/email", { email: credentials.email, otp: String(record.value).split(":")[0] });
    expect(response.status).toBe(200);
    expect(verification).toHaveBeenCalledTimes(2);
  });

  it("keeps captcha off without a secret and exposes its state only in auth config", async () => {
    const { env, request } = setup(false);
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    expect((await request("/sign-up/email", credentials)).status).toBe(200);
    const config = await app.request("/api/auth/config", {}, env);
    expect(await config.json()).toEqual({ turnstileEnabled: false });
    const enabled = await app.request("/api/auth/config", {}, { ...env, TURNSTILE_SECRET_KEY: "secret" });
    expect(await enabled.json()).toEqual({ turnstileEnabled: true });
    const intake = await app.request("/api/applications/intake", {}, env);
    expect(await intake.json()).not.toHaveProperty("turnstileEnabled");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
