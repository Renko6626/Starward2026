# VPS Portable Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Starward2026 runnable on a Node.js + SQLite VPS while preserving the existing Workers + D1 deployment path.

**Architecture:** Keep the Hono app, API routes, domain logic, SQL, and React SPA shared. Add a Node entrypoint and platform adapters for database, configuration, admin identity, and rate limiting; select the adapter at startup without duplicating routes.

**Tech Stack:** React 19, Hono, Better Auth, Node.js 22 LTS (`node:sqlite`), `@hono/node-server`, SQLite WAL, Docker Compose, Caddy, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-29-vps-portable-runtime-design.md`

## Global Constraints

- Business SQL must remain SQLite/D1 compatible; do not introduce PostgreSQL-only syntax.
- Do not duplicate Hono routes or business state machines for VPS.
- `src/shared/*` remains the only code shared directly by SPA and Worker/domain code.
- Production secrets stay in environment variables or Docker secrets, never in Git.
- `ALLOW_LOCAL_ADMIN_BYPASS` is loopback-only development support, never VPS production auth.
- The Cloudflare Wrangler/D1 path must continue to build independently.
- First VPS database is SQLite with WAL and documented backup/restore; do not add ORM, Redis, or PostgreSQL in this phase.

## Review Focus

- A missing VPS secret must fail at startup with a named error rather than produce repeated 503 responses — cover in `server/env.test.ts`.
- A SQLite batch containing a failed statement must not partially commit — cover in `server/sqlite-d1.test.ts`.
- Better Auth and domain queries must see the same database facade in Node and Workers — cover in the Node health/auth smoke test.
- VPS admin requests must not become admin through `x-admin-email` or other arbitrary headers — cover in `worker/lib/admin.test.ts` and VPS adapter tests.
- Existing Worker builds and D1 tests must remain green after `AppBindings` and adapter changes — run the full verification matrix in the final task.

### Task 1: Establish platform-neutral runtime types and configuration

**Files:**
- Create: `server/env.ts`
- Create: `server/env.test.ts`
- Modify: `worker/lib/types.ts`
- Modify: `worker/lib/http.ts`
- Modify: `package.json`, `package-lock.json`

**Interfaces:**
- `loadNodeRuntimeEnv(source?: NodeJS.ProcessEnv): NodeRuntimeEnv` validates `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `SQLITE_PATH`, and `VPS_ADMIN_MODE`.
- `NodeRuntimeEnv` contains normalized URL, SQLite path, and the existing Better Auth/Resend values; it must not expose raw secrets in error messages.
- `AppBindings.DB` remains compatible with current data functions; add an explicit runtime marker or adapter fields without weakening Cloudflare types.

- [ ] Write tests for missing required values, invalid URL, default SQLite path, and boolean/enum parsing.
- [ ] Run `npx vitest run server/env.test.ts` and verify failures before implementation.
- [ ] Implement the parser and narrow type changes; add `@hono/node-server` and Node 22 engine documentation.
- [ ] Run the focused test and `npm run check`.
- [ ] Commit: `refactor: define portable runtime configuration`

### Task 2: Add a Node SQLite D1-compatible adapter

**Files:**
- Create: `server/sqlite-d1.ts`
- Create: `server/sqlite-d1.test.ts`
- Modify: `worker/lib/types.ts`
- Modify: `scripts/local-dev-bootstrap.mjs` or add `scripts/sqlite-migrate.mjs`

**Interfaces:**
- `createSqliteD1Database(path: string): D1Database` opens `node:sqlite`, enables foreign keys and WAL, and exposes the subset used by the repository: `prepare`, `bind`, `first`, `all`, `run`, and `batch`.
- `applySqliteMigrations(db, migrationsDir)` applies numbered SQL migrations exactly once using a local migration table.
- Result shapes must match the Cloudflare D1 shapes consumed by existing code (`results`, `success`, `meta.changes`, `meta.last_row_id`).

The adapter should wrap `DatabaseSync` statements rather than rewrite each query. `batch()` must run in one SQLite transaction and roll back on any thrown statement:

```ts
db.exec("BEGIN IMMEDIATE");
try {
  const results = statements.map((statement) => statement.runSync());
  db.exec("COMMIT");
  return results;
} catch (error) {
  db.exec("ROLLBACK");
  throw error;
}
```

- [ ] Write adapter tests for named/positional binds, `first`, `all`, `run` metadata, migration idempotence, and transaction rollback.
- [ ] Run `npx vitest run server/sqlite-d1.test.ts` and verify the rollback test fails before implementation.
- [ ] Implement the facade and migration runner using only SQLite-compatible APIs.
- [ ] Run the focused tests plus representative data tests (`worker/data/participants.test.ts`, `worker/data/segments.test.ts`).
- [ ] Commit: `feat: add sqlite runtime database adapter`

### Task 3: Add the Node Hono entrypoint and runtime wiring

**Files:**
- Create: `server/node.ts`
- Create: `server/node.test.ts`
- Modify: `worker/index.ts` only if shared app export needs extraction
- Modify: `worker/app.ts`, `worker/lib/auth.ts`, `worker/lib/http.ts`
- Modify: `package.json`, `vite.config.ts` if build scripts require a Node entry

**Interfaces:**
- `createNodeApp(options?: { env?: NodeRuntimeEnv; db?: D1Database })` returns the same Hono app type used by the Worker entry.
- `startNodeServer()` loads validated env, opens SQLite, applies migrations, and calls `serve({ fetch: app.fetch, port, hostname })`.
- `worker/index.ts` continues to export the Worker-compatible app and must not import Node-only modules.

Runtime construction should be explicit:

```ts
const db = createSqliteD1Database(env.SQLITE_PATH);
const app = createApp({ ...toAppBindings(env), DB: db });
serve({ fetch: app.fetch, port: env.PORT, hostname: env.HOST });
```

- [ ] Write a Node smoke test using an in-memory SQLite database for `/api/health`, `/api/applications/intake`, and one authenticated data read.
- [ ] Run the focused smoke test and confirm it fails because no Node entry exists.
- [ ] Extract only the minimal shared app factory needed by both Worker and Node; preserve route registration order.
- [ ] Run `npm run check`, `npm test`, and `npm run build`.
- [ ] Commit: `feat: run hono application on node`

### Task 4: Implement VPS admin identity and local rate-limit adapters

**Files:**
- Create: `server/admin-auth.ts`
- Create: `server/rate-limit.ts`
- Create: `server/admin-auth.test.ts`
- Modify: `worker/lib/admin.ts`
- Modify: `worker/lib/application-submission-guards.ts`, `worker/lib/application-rate-limit.ts`, `worker/lib/types.ts`

**Interfaces:**
- `resolveVpsAdminIdentity(request, config): Promise<string | null>` accepts only a Better Auth admin session/role or configured secure mechanism; it never trusts arbitrary identity headers.
- `createNodeRateLimiter(config)` implements the existing `{ limit(input): Promise<{ success: boolean }> }` contract for a single process, keyed by IP and normalized email.

- [ ] Test that unauthenticated, ordinary participant, forged-header, and valid-admin-session requests resolve respectively to denied, denied, denied, and an email identity.
- [ ] Test limiter window/count behavior and no-op behavior when limits are disabled.
- [ ] Run focused tests before implementation, then implement the adapters and runtime selection.
- [ ] Run all auth, admin, and rate-limit tests.
- [ ] Commit: `feat: add VPS admin auth and rate limiting`

### Task 5: Add deployable VPS packaging and operational scripts

**Files:**
- Create: `Dockerfile`
- Create: `deploy/docker-compose.yml`
- Create: `deploy/Caddyfile`
- Create: `.env.example` (no real secrets)
- Create: `scripts/backup-sqlite.mjs`
- Create: `scripts/restore-sqlite.mjs`
- Modify: `package.json`, `readme.md`, `.gitignore`

**Interfaces:**
- `npm run start:vps` starts the validated Node entry.
- `npm run db:vps:migrate`, `npm run db:vps:backup`, and `npm run db:vps:restore -- <file>` operate on the configured SQLite path.
- Docker health check calls `/api/health`; the Caddy reverse proxy forwards API/auth requests and serves the built SPA with HTTPS.

- [ ] Add script-level tests for backup output, restore refusal when the source is absent, and migration idempotence.
- [ ] Build the image and run the compose stack with a temporary `.env`; verify `/api/health` and SPA fallback.
- [ ] Document firewall, DNS, TLS, volume ownership, log location, backup rotation, restore, rollback, and secret provisioning.
- [ ] Keep Wrangler staging commands documented and unchanged.
- [ ] Commit: `ops: add VPS deployment and sqlite backup tooling`

### Task 6: Full cross-runtime verification and handoff

**Files:**
- Modify: `docs/superpowers/specs/2026-09-29-vps-portable-runtime-design.md` only for verified deviations
- Modify: `readme.md` and add `docs/development/vps.md`

- [ ] Run `npm run check`, `npm test`, and `npm run build`.
- [ ] Run a local seeded Node flow covering OTP configuration, profile, application, admin review, segment claim, project draft, and history read.
- [ ] Deploy to VPS staging with HTTPS and verify email OTP, admin auth, backup/restore, and SPA routing.
- [ ] Run the existing Wrangler build/deploy check separately; confirm no Node-only import enters Worker code.
- [ ] Record known limitations and rollback steps; commit: `docs: document portable runtime verification`

## Execution Order

Tasks are sequential: the Node database facade must exist before the Node app, and the runtime app must exist before auth/deployment packaging. Each task ends with its focused tests and a commit; do not begin VPS deployment until Tasks 1–4 pass locally.
