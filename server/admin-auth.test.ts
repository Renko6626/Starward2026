import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * Captured outbound OTP emails, mirroring `server/node.test.ts`. The external
 * mail provider is replaced while Better Auth itself runs against the SQLite
 * D1 facade, so a real session is created and then verified by
 * `resolveVpsAdminIdentity` through `auth.api.getSession`.
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

import { loadNodeRuntimeEnv, type NodeRuntimeEnv } from "./env";
import { createNodeApp, toAppBindings } from "./node";
import { parseAdminEmailAllowlist, resolveVpsAdminIdentity } from "./admin-auth";
import { applySqliteMigrations, createSqliteD1Database, type SqliteD1Database } from "./sqlite-d1";

const MIGRATIONS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..", "migrations");

const BASE_ENV = {
  BETTER_AUTH_SECRET: "node-admin-test-secret-value-0123456789abcdef",
  BETTER_AUTH_URL: "http://localhost:3000",
  RESEND_API_KEY: "test-resend-api-key",
  RESEND_FROM_EMAIL: "no-reply@example.com",
  SQLITE_PATH: ":memory:",
  NODE_ENV: "test",
  VPS_ADMIN_EMAILS: "admin@example.com,second-admin@example.com",
};

function testEnv(overrides: Record<string, string | undefined> = {}): NodeRuntimeEnv {
  return loadNodeRuntimeEnv({ ...BASE_ENV, ...overrides });
}

function extractOtp(text: string | undefined) {
  return text?.match(/验证码：(\d+)/)?.[1] ?? "";
}

type NodeApp = ReturnType<typeof createNodeApp>;

async function signIn(app: NodeApp, email: string) {
  const origin = BASE_ENV.BETTER_AUTH_URL;
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

  return signInResponse.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
}

describe("parseAdminEmailAllowlist", () => {
  it("normalizes, trims, and deduplicates configured admin emails", () => {
    const allowlist = parseAdminEmailAllowlist(
      " Admin@Example.com ,\nsecond-admin@example.com,admin@example.com,, ",
    );

    expect([...allowlist].sort()).toEqual(["admin@example.com", "second-admin@example.com"]);
  });

  it("is empty when no allowlist is configured", () => {
    expect(parseAdminEmailAllowlist(undefined).size).toBe(0);
    expect(parseAdminEmailAllowlist("   ").size).toBe(0);
  });
});

describe("toAppBindings vps wiring", () => {
  let db: SqliteD1Database;

  beforeAll(async () => {
    db = createSqliteD1Database(":memory:");
    await applySqliteMigrations(db, MIGRATIONS_DIR);
  });

  afterAll(() => {
    db.close();
  });

  it("forwards the vps admin mode, resolver, and node rate limiters", () => {
    const bindings = toAppBindings(testEnv(), db);

    expect(bindings.RUNTIME).toBe("node");
    expect(bindings.NODE_ENV).toBe("test");
    expect(bindings.VPS_ADMIN_MODE).toBe("better-auth");
    expect(bindings.VPS_ADMIN_EMAILS).toContain("admin@example.com");
    expect(typeof bindings.VPS_ADMIN_IDENTITY_RESOLVER).toBe("function");
    expect(bindings.APPLICATION_SUBMIT_IP_RATE_LIMITER).toBeDefined();
    expect(bindings.APPLICATION_SUBMIT_EMAIL_RATE_LIMITER).toBeDefined();
  });

  it("forces development-only flags off in production node", () => {
    const bindings = toAppBindings(
      testEnv({ NODE_ENV: "production", ALLOW_LOCAL_ADMIN_BYPASS: "true", ALLOW_LOCAL_DEV_ORIGINS: "true" }),
      db,
    );

    expect(bindings.ALLOW_LOCAL_ADMIN_BYPASS).toBe("false");
    expect(bindings.ALLOW_LOCAL_DEV_ORIGINS).toBe("false");
  });
});

describe("vps admin identity", () => {
  let db: SqliteD1Database;
  let adminCookie: string;
  let participantCookie: string;

  beforeAll(async () => {
    db = createSqliteD1Database(":memory:");
    await applySqliteMigrations(db, MIGRATIONS_DIR);

    const app = createNodeApp({ env: testEnv(), db });
    adminCookie = await signIn(app, "admin@example.com");
    participantCookie = await signIn(app, "participant@example.com");
  });

  afterAll(() => {
    db.close();
  });

  const client = (overrides: Record<string, string | undefined> = {}) =>
    createNodeApp({ env: testEnv(overrides), db });

  it("denies an unauthenticated request", async () => {
    const response = await client().request("/api/admin/applications");

    expect(response.status).toBe(403);
  });

  it("ignores a forged x-admin-email header", async () => {
    const response = await client().request("/api/admin/applications", {
      headers: { "x-admin-email": "admin@example.com" },
    });

    expect(response.status).toBe(403);
  });

  it("denies an authenticated ordinary participant", async () => {
    const response = await client().request("/api/admin/applications", {
      headers: { cookie: participantCookie },
    });

    expect(response.status).toBe(403);
  });

  it("admits a configured admin session", async () => {
    const response = await client().request("/api/admin/applications", {
      headers: { cookie: adminCookie },
    });

    expect(response.status).toBe(200);
  });

  it("denies even a valid admin session when vps admin mode is disabled", async () => {
    const response = await client({ VPS_ADMIN_MODE: "disabled" }).request(
      "/api/admin/applications",
      { headers: { cookie: adminCookie } },
    );

    expect(response.status).toBe(403);
  });

  it("denies when the admin allowlist is empty", async () => {
    const response = await client({ VPS_ADMIN_EMAILS: "" }).request("/api/admin/applications", {
      headers: { cookie: adminCookie },
    });

    expect(response.status).toBe(403);
  });

  it("ignores ALLOW_LOCAL_ADMIN_BYPASS in production node even with a loopback host", async () => {
    const response = await client({
      NODE_ENV: "production",
      ALLOW_LOCAL_ADMIN_BYPASS: "true",
    }).request("http://localhost/api/admin/applications", {
      headers: { host: "localhost", "x-admin-email": "admin@example.com" },
    });

    expect(response.status).toBe(403);
  });

  it("returns the verified admin email as the identity", async () => {
    const bindings = toAppBindings(testEnv(), db);
    const request = new Request("http://localhost/api/admin/applications", {
      headers: { cookie: adminCookie },
    });

    await expect(resolveVpsAdminIdentity(request, { env: bindings })).resolves.toBe(
      "admin@example.com",
    );
  });

  it("returns null for an ordinary participant session", async () => {
    const bindings = toAppBindings(testEnv(), db);
    const request = new Request("http://localhost/api/admin/applications", {
      headers: { cookie: participantCookie },
    });

    await expect(resolveVpsAdminIdentity(request, { env: bindings })).resolves.toBeNull();
  });
});
