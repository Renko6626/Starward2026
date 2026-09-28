import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";

/**
 * Captured outbound OTP emails. `worker/lib/auth.ts` sends the verification
 * code through Resend, so the provider is replaced with an in-memory capture
 * while the Better Auth flow itself runs unchanged against the SQLite facade.
 */
const outboundEmails = vi.hoisted(() => [] as Array<{ text: string }>);

vi.mock("resend", () => ({
  Resend: class {
    emails = {
      send: async (payload: { text?: string }) => {
        outboundEmails.push({ text: payload.text ?? "" });
        return { data: { id: "test-email" }, error: null };
      },
    };
  },
}));

import type { NodeRuntimeEnv } from "./env";
import { createNodeApp } from "./node";
import { applySqliteMigrations, createSqliteD1Database, type SqliteD1Database } from "./sqlite-d1";

const MIGRATIONS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..", "migrations");

const TEST_ENV: NodeRuntimeEnv = {
  BETTER_AUTH_SECRET: "node-smoke-test-secret-value-0123456789abcdef",
  BETTER_AUTH_URL: "http://localhost:3000",
  RESEND_API_KEY: "test-resend-api-key",
  RESEND_FROM_EMAIL: "no-reply@example.com",
  RESEND_FROM_NAME: "Starward2026 Test",
  SQLITE_PATH: ":memory:",
  VPS_ADMIN_MODE: "better-auth",
  PORT: 3000,
  HOST: "127.0.0.1",
  NODE_ENV: "test",
  ALLOW_LOCAL_DEV_ORIGINS: false,
  ALLOW_LOCAL_ADMIN_BYPASS: false,
  APPLICATION_SUBMIT_IP_RATE_LIMIT: 6,
  APPLICATION_SUBMIT_IP_RATE_LIMIT_WINDOW_SECONDS: 60,
  APPLICATION_SUBMIT_EMAIL_RATE_LIMIT: 2,
  APPLICATION_SUBMIT_EMAIL_RATE_LIMIT_WINDOW_SECONDS: 60,
  TRUST_PROXY_HEADERS: false,
};

function extractOtp(text: string | undefined) {
  return text?.match(/验证码：(\d+)/)?.[1] ?? "";
}

describe("node app", () => {
  let db: SqliteD1Database;

  beforeAll(async () => {
    db = createSqliteD1Database(":memory:");
    await applySqliteMigrations(db, MIGRATIONS_DIR);
  });

  afterAll(() => {
    db.close();
  });

  const client = () => createNodeApp({ env: TEST_ENV, db });

  it("serves the health endpoint", async () => {
    const response = await client().request("/api/health");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: "ok",
      service: "starward2026-worker",
    });
  });

  it("reads the intake endpoint from the injected sqlite database", async () => {
    const response = await client().request("/api/applications/intake");

    expect(response.status).toBe(200);

    const body = (await response.json()) as {
      isOpen: boolean;
      turnstileEnabled: boolean;
      window: { key: string; isOpen: boolean };
      interestFormats: unknown[];
    };

    expect(body.isOpen).toBe(false);
    expect(body.turnstileEnabled).toBe(false);
    expect(body.window).toMatchObject({ key: "application_open", isOpen: false });
    expect(body.interestFormats.length).toBeGreaterThan(0);
  });

  it("rejects anonymous portal reads without a valid session", async () => {
    const response = await client().request("/api/portal/me");

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "portal_not_authenticated" },
    });
  });

  it("authenticates with Better Auth and reads portal data from the same sqlite database", async () => {
    const app = client();
    const email = "portal-node@example.com";
    const origin = TEST_ENV.BETTER_AUTH_URL;

    const sendResponse = await app.request("/api/auth/email-otp/send-verification-otp", {
      method: "POST",
      headers: { "content-type": "application/json", origin },
      body: JSON.stringify({ email, type: "sign-in" }),
    });
    expect(sendResponse.status).toBe(200);

    const otp = extractOtp(outboundEmails.at(-1)?.text);
    expect(otp).toMatch(/^\d{6}$/);

    const signInResponse = await app.request("/api/auth/sign-in/email-otp", {
      method: "POST",
      headers: { "content-type": "application/json", origin },
      body: JSON.stringify({ email, otp }),
    });
    expect(signInResponse.status).toBe(200);

    const cookie = signInResponse.headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .join("; ");
    expect(cookie).toContain("better-auth");

    const meResponse = await app.request("/api/portal/me", { headers: { cookie } });
    expect(meResponse.status).toBe(200);

    const me = (await meResponse.json()) as {
      user: { email: string };
      participant: unknown;
      profile: unknown;
      application: unknown;
    };
    expect(me.user).toMatchObject({ email });
    expect(me.participant).not.toBeNull();
    expect(me.profile).toBeNull();
    expect(me.application).toBeNull();
  });
});
