import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { serve } from "@hono/node-server";
import type { ServerType } from "@hono/node-server";
import { createApp } from "../worker/app.ts";
import type { AppBindings } from "../worker/lib/types.ts";
import { loadNodeRuntimeEnv, type NodeRuntimeEnv } from "./env.ts";
import { resolveVpsAdminIdentity } from "./admin-auth.ts";
import { createNodeRateLimiter } from "./rate-limit.ts";
import { applySqliteMigrations, createSqliteD1Database } from "./sqlite-d1.ts";

const MIGRATIONS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..", "migrations");

export type CreateNodeAppOptions = {
  /** Validated Node runtime configuration. Defaults to `process.env`. */
  env?: NodeRuntimeEnv;
  /** D1-compatible database. Defaults to SQLite at `env.SQLITE_PATH`. */
  db?: D1Database;
};

/**
 * Map the validated Node configuration onto the Worker binding contract.
 *
 * `RUNTIME` is pinned to `"node"` so runtime-selecting adapters (admin auth,
 * rate limiting) can branch without inspecting the platform. The injected
 * SQLite facade satisfies the unchanged `D1Database` boundary used by
 * `worker/data/*`, so no route or SQL is duplicated for Node.
 *
 * The VPS admin resolver is injected as a binding so `worker/lib/admin.ts`
 * stays free of Node-only imports while still selecting the Better Auth admin
 * adapter. The in-memory rate limiters are created once here, so their counters
 * persist for the lifetime of the single Node process.
 */
export function toAppBindings(env: NodeRuntimeEnv, db: D1Database): AppBindings {
  const isProduction = env.NODE_ENV === "production";

  return {
    RUNTIME: "node",
    DB: db,
    NODE_ENV: env.NODE_ENV,
    BETTER_AUTH_SECRET: env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: env.BETTER_AUTH_URL,
    BETTER_AUTH_TRUSTED_ORIGINS: env.BETTER_AUTH_TRUSTED_ORIGINS,
    RESEND_API_KEY: env.RESEND_API_KEY,
    RESEND_FROM_EMAIL: env.RESEND_FROM_EMAIL,
    RESEND_FROM_NAME: env.RESEND_FROM_NAME,
    TURNSTILE_SECRET_KEY: env.TURNSTILE_SECRET_KEY,
    // Development-only flags must never be reachable on a production Node
    // deployment, regardless of a rewritten Host header or a leaked env var.
    ALLOW_LOCAL_DEV_ORIGINS: !isProduction && env.ALLOW_LOCAL_DEV_ORIGINS ? "true" : "false",
    ALLOW_LOCAL_ADMIN_BYPASS: !isProduction && env.ALLOW_LOCAL_ADMIN_BYPASS ? "true" : "false",
    VPS_ADMIN_MODE: env.VPS_ADMIN_MODE,
    VPS_ADMIN_EMAILS: env.VPS_ADMIN_EMAILS,
    VPS_ADMIN_IDENTITY_RESOLVER: (input) =>
      resolveVpsAdminIdentity(input.request, { env: input.env }),
    APPLICATION_SUBMIT_IP_RATE_LIMITER: createNodeRateLimiter({
      limit: env.APPLICATION_SUBMIT_IP_RATE_LIMIT,
      windowMs: env.APPLICATION_SUBMIT_IP_RATE_LIMIT_WINDOW_SECONDS * 1000,
    }),
    APPLICATION_SUBMIT_EMAIL_RATE_LIMITER: createNodeRateLimiter({
      limit: env.APPLICATION_SUBMIT_EMAIL_RATE_LIMIT,
      windowMs: env.APPLICATION_SUBMIT_EMAIL_RATE_LIMIT_WINDOW_SECONDS * 1000,
    }),
    TRUST_PROXY_HEADERS: env.TRUST_PROXY_HEADERS ? "true" : "false",
    TRUSTED_PROXY_IPS: env.TRUSTED_PROXY_IPS,
  };
}

/**
 * Build the Node application with validated configuration and a D1-compatible
 * database. Tests inject an in-memory SQLite database; production defaults to
 * opening `env.SQLITE_PATH`.
 */
export function createNodeApp(options: CreateNodeAppOptions = {}) {
  const env = options.env ?? loadNodeRuntimeEnv();
  const db = options.db ?? createSqliteD1Database(env.SQLITE_PATH);

  return createApp(toAppBindings(env, db));
}

/**
 * Load validated env, open SQLite, apply pending migrations, then listen.
 *
 * Migrations run before `serve()` so the first request can never observe a
 * partially provisioned schema.
 */
export async function startNodeServer(): Promise<ServerType> {
  const env = loadNodeRuntimeEnv();
  const db = createSqliteD1Database(env.SQLITE_PATH);

  await applySqliteMigrations(db, MIGRATIONS_DIR);

  const app = createNodeApp({ env, db });

  return serve({
    fetch: app.fetch,
    port: env.PORT,
    hostname: env.HOST,
  });
}
