# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Starward2026 is the registration/review/portal site for a 秘封组 (Touhou Hifuu) collaborative-creation event. It is a single Cloudflare Worker app: a React SPA + a Hono API + Better Auth, all backed by Cloudflare D1. Domain docs live under `docs/` — `docs/architecture/system.md` is the canonical architecture reference and `docs/delivery/phase-1/` defines current scope.

## Development workflow (use the superpowers skills)

Prefer the `superpowers:*` plugin skills over ad-hoc work — invoke the matching skill via the Skill tool before starting, even if a task looks small. The ones that apply most here:

- **`superpowers:brainstorming`** — before any new feature/behavior change, to pin down intent and design first.
- **`superpowers:writing-plans` / `superpowers:executing-plans`** — for multi-step work: write the plan, then execute it with review checkpoints.
- **`superpowers:test-driven-development`** — default for every feature and bugfix. This repo is TDD-first (failing test → minimal code → green); the `node:sqlite` fake-D1 harness makes data-layer TDD cheap.
- **`superpowers:systematic-debugging`** — for any bug/test failure/unexpected behavior, before proposing a fix.
- **`superpowers:dispatching-parallel-agents` / `superpowers:subagent-driven-development`** — when work splits into independent pieces (e.g. fixing several unrelated findings); dispatch subagents editing disjoint files and keep the main context clean.
- **`superpowers:requesting-code-review` / `superpowers:receiving-code-review`** — when finishing a feature or before merge; verify, don't perform agreement.
- **`superpowers:verification-before-completion`** — before claiming anything is done: run `npm run check`, `npm test`, and `npm run build` and confirm the output rather than asserting success.
- **`superpowers:using-git-worktrees` / `superpowers:finishing-a-development-branch`** — for isolated feature work and for deciding how to integrate (merge/PR/cleanup).

Active development happens on the `dev` branch (PR into `main`). `docs/cloudflare-architecture` is a historical branch — leave it untouched.

## Commands

```bash
npm run dev               # Vite dev server (Cloudflare plugin runs the Worker too) on port 20262
npm run check             # tsc -b across all three TS projects — the typecheck gate
npm test                  # vitest run (all worker/**/*.test.ts + src/**/*.test.ts)
npm run build             # tsc -b && vite build
npx vitest run <file>     # run a single test file (preferred while iterating — avoids racing tsc)
npx vitest run -t "<name>"  # run tests matching a name

npm run db:local:reset    # wipe local D1, re-run all migrations, seed sample data, print portal session cookies
npm run db:local:seed     # re-seed sample data into the existing local D1
npm run db:local:print-portals  # print signed session cookies for the seeded portal personas

npm run deploy:staging    # build + wrangler deploy --env staging
npm run cf-typegen        # regenerate worker-configuration.d.ts from wrangler.jsonc bindings
```

Remote D1 migrations: `wrangler d1 migrations apply starward2026 --remote`.

## TypeScript project layout

`tsconfig.json` is a project-references root over three independent compilers — keep code in the right one or `tsc -b` breaks:
- `tsconfig.app.json` → `src/` (React SPA, DOM libs)
- `tsconfig.worker.json` → `worker/` + `src/shared/` + `worker-configuration.d.ts` (Workers runtime)
- `tsconfig.node.json` → `vite.config.ts`

`src/shared/` is the **only** code imported by both the SPA and the Worker (Zod schemas, status enums, label maps). Worker code may import `src/shared/*`; it must never import `src/app|admin|portal/*`. The SPA imports types/schemas from `src/shared` and never from `worker/`.

## Architecture

Three route surfaces share one Worker (`worker/index.ts` → `worker/app.ts`):
- **Public** `/`, `/apply*` → `worker/routes/public.ts`
- **Participant portal** `/portal/*` → `worker/routes/portal.ts`, session-gated via Better Auth cookie
- **Admin** `/admin/*` → `worker/routes/admin.ts`, gated by Cloudflare Access (the Worker re-verifies the Access JWT fail-closed)

`/api/auth/*` is delegated wholesale to Better Auth (`worker/lib/auth.ts`, Email OTP + 30-day sliding cookie session). The SPA is served as static assets with SPA fallback (`wrangler.jsonc` `not_found_handling`).

**Identity model (read `docs/architecture/system.md` §9 before touching auth/lifecycle):** an `auth user` (Better Auth) is distinct from a `participant` (the business identity that owns all portal data). A `participant` row is created on first portal login with `status='pending'`; an admin approving the user's `application` flips it to `approved`. Portal business data (segments, project drafts, events) all hang off `participant`, gated on `status='approved'`. The status enum is `pending | approved | withdrawn | completed`. Application status is `pending | approved | rejected | withdrawn`; the two lifecycles must stay in sync — rejecting/withdrawing an approved application demotes the participant and releases held segments (see `reviewApplication` / `buildParticipantDemotionPlan` in `worker/data/applications.ts`).

**Schedule segments** (`worker/data/segments.ts`, `worker/data/admin.ts`): claim/change/release/admin-assign are server-authoritative and atomic. D1/SQLite is plain SQLite — **no Postgres data-modifying CTEs** (`WITH x AS (UPDATE ...)` throws). Multi-statement mutations use `db.batch([...])` with an optimistic-lock snapshot guard (re-checking `updated_at`/state in each statement's `WHERE EXISTS`) and check `meta.changes` to detect a lost race → return a 409. `buildParticipantSegmentReleaseStatements` is the shared helper for releasing a participant's held segment.

**Event windows** (`worker/lib/windows.ts`, `event_windows` table) gate when actions are allowed (application open, segment claim/change, preview/review submit, public release). Mutations check the relevant window server-side.

### Layering conventions
- `worker/routes/*` — Hono handlers: auth/session resolution, Zod validation of the request body, then call into `worker/data/*`. Return errors via `jsonError(c, status, code, message)` and read the DB via `getRequiredDb(c)` (both in `worker/lib/http.ts`). Errors thrown as `HTTPException` are mapped centrally in `worker/app.ts`.
- `worker/data/*` — all SQL. Functions return mapped domain objects or `{ ok: false, status, code, message }` envelopes; mutation plans are arrays of `D1PreparedStatement` run via `db.batch`.
- `worker/lib/*` — pure-ish domain logic (eligibility resolvers, state machines, rate-limit/turnstile helpers) — this is where most unit tests target.
- `src/routes/*` is **generated** by the TanStack Router Vite plugin (`autoCodeSplitting`) — edit `src/{app,admin,portal}/pages/*` and let `src/routeTree.gen.ts` regenerate; do not hand-edit generated route files.

## Testing

Tests run in the `node` vitest environment with **no Cloudflare runtime**. D1 is faked with `node:sqlite` (`DatabaseSync`): each `*.test.ts` defines a local `SqliteD1Database` class wrapping real in-memory SQLite with `.prepare/.bind/.first/.all/.run/.batch`, then seeds the subset of tables the function under test touches. See `worker/data/segments.test.ts` / `worker/data/admin.test.ts` for the canonical harness to copy. Because it is real SQLite, this catches D1/SQLite SQL-compatibility bugs at test time. Follow TDD: write the failing test first.

## Environment & local-dev flags

Bindings/secrets are declared in `wrangler.jsonc`; their types live in `worker/lib/types.ts` (`AppBindings`). Named environments (`staging`, `production`) do **not** inherit top-level bindings — each must redeclare `d1_databases` etc. Local secrets/flags go in `.dev.vars` (gitignored; copy from `.dev.vars.example`).

Two dev-only flags exist for local admin/auth ergonomics and must stay out of deployed configs:
- `ALLOW_LOCAL_ADMIN_BYPASS="true"` — lets `/api/admin/*` trust the `x-admin-email` header instead of Cloudflare Access, only on a loopback host.
- `ALLOW_LOCAL_DEV_ORIGINS="true"` — lets Better Auth dynamically trust loopback/private-network request origins. In deployed envs, list real origins via `BETTER_AUTH_TRUSTED_ORIGINS` instead.

Anti-abuse (Turnstile via `TURNSTILE_SECRET_KEY`, submission rate limiters) gracefully no-ops when unconfigured, so local dev works without it.
