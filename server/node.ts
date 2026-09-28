import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { serve } from "@hono/node-server";
import type { ServerType } from "@hono/node-server";
import { createApp } from "../worker/app.ts";
import type { AppBindings } from "../worker/lib/types.ts";
import { loadNodeRuntimeEnv, type NodeRuntimeEnv } from "./env.ts";
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
 */
export function toAppBindings(env: NodeRuntimeEnv, db: D1Database): AppBindings {
  return {
    RUNTIME: "node",
    DB: db,
    BETTER_AUTH_SECRET: env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: env.BETTER_AUTH_URL,
    BETTER_AUTH_TRUSTED_ORIGINS: env.BETTER_AUTH_TRUSTED_ORIGINS,
    RESEND_API_KEY: env.RESEND_API_KEY,
    RESEND_FROM_EMAIL: env.RESEND_FROM_EMAIL,
    RESEND_FROM_NAME: env.RESEND_FROM_NAME,
    TURNSTILE_SECRET_KEY: env.TURNSTILE_SECRET_KEY,
    ALLOW_LOCAL_DEV_ORIGINS: env.ALLOW_LOCAL_DEV_ORIGINS ? "true" : "false",
    ALLOW_LOCAL_ADMIN_BYPASS: env.ALLOW_LOCAL_ADMIN_BYPASS ? "true" : "false",
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
