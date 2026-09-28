# VPS Deployment and Operations

This document covers the Node.js + SQLite VPS deployment of Starward2026:
packaging, secret provisioning, firewall/DNS/TLS, persistent storage, logs,
backup and restore, rollback, and the known limitations inherited from the
runtime adapter work. The Cloudflare Workers + D1 path is unchanged and remains
supported (see the end of this document).

## 1. Architecture

```text
Browser
  -> Caddy (TLS, SPA static files, /api/* reverse proxy)
  -> Node Hono server (dist-vps/node.mjs, non-root, port 3000)
       -> SQLite (D1-compatible facade, WAL) on the `starward_data` volume
       -> in-memory rate limiter + Better Auth admin allowlist
```

The same Hono app, routes, SQL, and business logic run on Cloudflare and on the
VPS; only the entrypoint and the platform adapters differ.

Compose services:

- `app` — the bundled Node server, based on `node:22.18-bookworm-slim`, runs as
  uid/gid `1000` (`node`), not published to the host.
- `caddy` — `caddy:2.10-alpine`, publishes `80`/`443`, terminates TLS, serves
  the built SPA from `/srv`, and reverse-proxies `/api/*` to `app:3000`.

## 2. Prerequisites

- A Linux VPS with Docker Engine 24+ and the Compose v2 plugin.
- Node.js `>=22.18.0` on the VPS **only** if you want to run the ops scripts
  outside Docker. The container includes Node 22.18 itself.
- A domain whose DNS you control.
- A Resend account (transactional email/OTP) if email login is enabled.

## 3. Secret provisioning

All runtime configuration comes from environment variables. Nothing is baked
into the image.

```bash
cp .env.example .env
chmod 600 .env
$EDITOR .env
```

Rules:

- `.env` is gitignored and excluded from the Docker build context
  (`.dockerignore`); never commit it and never paste real secrets into
  `.env.example` or the docs.
- Generate `BETTER_AUTH_SECRET` with `openssl rand -base64 48`.
- `BETTER_AUTH_URL` must be the public HTTPS URL and must match
  `SITE_ADDRESS`.
- Do **not** set the development-only flags `ALLOW_LOCAL_ADMIN_BYPASS` or
  `ALLOW_LOCAL_DEV_ORIGINS`. They are loopback development aids; the Node
  runtime force-disables them when `NODE_ENV=production` and refuses to trust
  identity headers on the VPS path.
- The app validates required variables at startup and exits with a named,
  value-free error (`Missing required environment variable: ...`,
  `Invalid BETTER_AUTH_URL: ...`) instead of serving repeated 503s. Check
  `docker compose logs app` if the container restarts immediately.
- Docker secrets can replace `env_file` if you manage secrets externally; the
  app only reads process environment variables.

Do not use `x-admin-email` or any other request header for VPS admin access:
the Node admin path only accepts a Better Auth session whose email is in
`VPS_ADMIN_EMAILS`.

## 4. First deploy

Run everything from the repository root so the root `.env` is used for both the
container environment and `${...}` interpolation:

```bash
docker compose --env-file .env -f deploy/docker-compose.yml up -d --build
docker compose --env-file .env -f deploy/docker-compose.yml ps
curl -fsS https://starward.example.com/api/health
```

`/api/health` returns `{"status":"ok",...}`. The `app` container runs pending
SQL migrations before it starts listening, so the first request always sees a
complete schema.

Common operations:

```bash
# Follow application / edge logs
docker compose --env-file .env -f deploy/docker-compose.yml logs -f app
docker compose --env-file .env -f deploy/docker-compose.yml logs -f caddy

# Restart after editing .env (recreates the app container)
docker compose --env-file .env -f deploy/docker-compose.yml up -d app

# Apply migrations explicitly (idempotent; startup also runs them)
docker compose --env-file .env -f deploy/docker-compose.yml exec -T app npm run db:vps:migrate
```

## 5. DNS

- Create an `A` record for `SITE_ADDRESS` pointing at the VPS IPv4 address.
- Create an `AAAA` record if the VPS has IPv6.
- Confirm propagation before expecting a certificate:
  `dig +short starward.example.com`.
- Do not put a proxying CDN in front of the hostname during first issuance
  unless you know how it forwards `X-Forwarded-For` and TLS-ALPN; Caddy needs
  inbound `80`/`443`.

## 6. Firewall

Only SSH, HTTP, and HTTPS should be reachable. The app port `3000` is never
published to the host (Compose uses `expose`, not `ports`), so it is reachable
only from Caddy on the compose network.

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 443/udp   # optional: HTTP/3
sudo ufw enable
```

If you use a cloud firewall/security group, mirror these rules. Do not open
`3000`.

## 7. TLS

Caddy obtains and renews certificates automatically through ACME:

- Ports `80` and `443` must be reachable from the internet.
- Certificates are stored in the `caddy_data` volume. Keep that volume; if it
  is lost Caddy simply re-issues.
- For local smoke tests with no DNS, set `SITE_ADDRESS=http://localhost`; Caddy
  serves plain HTTP and no certificate is requested.
- If ACME rate limits are a concern while testing, temporarily point Caddy at
  the Let's Encrypt staging CA (`acme_ca https://acme-staging-v02.api.letsencrypt.org/directory`)
  inside the global block of `deploy/Caddyfile` and remove it afterwards.
- The SPA fallback is `try_files {path} /index.html`; `/api/*` (including
  `/api/auth/*`) is always proxied to the app, and `/assets/*` is cached
  immutably.

## 8. Volume ownership and persistence

Two named volumes carry state:

| Volume | Mount | Contents |
|---|---|---|
| `starward_data` | `/app/data` | `starward.sqlite` and its `-wal`/`-shm` members |
| `starward_backups` | `/app/backups` | timestamped backup files |

The image pre-creates `/app/data` and `/app/backups` owned by uid/gid `1000`
before dropping privileges, and Compose runs the app as `user: "1000:1000"`.
Docker seeds a new named volume from the image directory, so both volumes are
writable by the non-root user on first use.

If you replace a named volume with a host bind mount, create the directory with
the same ownership — SQLite needs write access not only to the file but also to
the directory (for `-wal`/`-shm`):

```bash
sudo mkdir -p ./data ./backups
sudo chown -R 1000:1000 ./data ./backups
```

Verify the runtime user with
`docker compose --env-file .env -f deploy/docker-compose.yml exec app id`
(`uid=1000(node)`). Never `chmod 777` the data directory; fix ownership instead.

## 9. Logs

- Application: `docker compose --env-file .env -f deploy/docker-compose.yml logs -f app`
- Edge: `docker compose --env-file .env -f deploy/docker-compose.yml logs -f caddy`
- Startup logs include environment validation errors and applied migrations.

Add a rotated `json-file` driver to the services in `deploy/docker-compose.yml`
(or the Docker daemon) so logs do not fill the disk:

```yaml
logging:
  driver: json-file
  options:
    max-size: "10m"
    max-file: "5"
```

All `docker compose exec`/`run` invocations in this document assume the same
`--env-file .env -f deploy/docker-compose.yml` prefix.

## 10. Migrations

Migrations live in `migrations/` and are applied exactly once (tracked in
`d1_migrations`). They run automatically before the server starts; the explicit
command is idempotent and safe to re-run:

```bash
docker compose --env-file .env -f deploy/docker-compose.yml exec -T app npm run db:vps:migrate
```

To run against a database from the host (Node `>=22.18.0`):

```bash
SQLITE_PATH=./data/starward.sqlite npm run db:vps:migrate
```

Migrations are forward-only. Roll back an application release with a database
restore, not by editing applied migrations.

## 11. Backup

Backups use SQLite `VACUUM INTO`, which reads a consistent snapshot through the
WAL and writes a fresh database file without locking or modifying the live
database, so it is safe while the app is running.

```bash
# Default: BACKUP_DIR + starward-<UTC>.sqlite, keep the newest 14, prune older
docker compose --env-file .env -f deploy/docker-compose.yml \
  exec -T app npm run db:vps:backup -- --keep 14

# Explicit file, no pruning of that directory's other files
docker compose --env-file .env -f deploy/docker-compose.yml \
  exec -T app npm run db:vps:backup -- --out /app/backups/manual.sqlite
```

The command refuses a missing or invalid source database, refuses to overwrite
an existing backup file, verifies the result with `PRAGMA integrity_check`, and
prints the written path and size. Backups on the `starward_backups` volume
survive app container recreation. Copy them off the VPS regularly (they contain
participant data — protect them):

```bash
docker compose --env-file .env -f deploy/docker-compose.yml \
  cp app:/app/backups ./offsite-backups
```

Rotation: `--keep N` (default `14`) keeps the newest `N` files matching
`starward-*.sqlite` in the backup directory and deletes older ones. A typical
cron entry (daily at 03:00, log output captured):

```cron
0 3 * * * cd /opt/starward && docker compose --env-file .env -f deploy/docker-compose.yml exec -T app npm run db:vps:backup -- --keep 14 >> /var/log/starward-backup.log 2>&1
```

## 12. Restore

Stop the app first so no process holds the SQLite file, then restore inside a
one-off container that shares the volumes. `--force` is required to replace an
existing database.

```bash
# 1. Stop the app (Caddy can stay up; it will return 502 until the app returns)
docker compose --env-file .env -f deploy/docker-compose.yml stop app

# 2. Restore a validated backup
docker compose --env-file .env -f deploy/docker-compose.yml run --rm app \
  npm run db:vps:restore -- /app/backups/starward-20260929T023705Z.sqlite --force

# 3. Start the app again
docker compose --env-file .env -f deploy/docker-compose.yml up -d app
curl -fsS https://starward.example.com/api/health
```

Restore safety and refusal guarantees:

- A missing, non-file, malformed (wrong header), or corrupt (failed
  `PRAGMA integrity_check`) backup is rejected before anything is written.
- An existing database is never replaced without `--force`.
- Before replacing, the current database is snapshotted to
  `<db>.pre-restore-<UTC>.sqlite` (disable with `--no-safety-backup`). If that
  snapshot cannot be taken, the restore aborts.
- The replacement is written to a temporary file, fsynced, and atomically
  renamed over the target; stale `-wal`/`-shm` members are removed so SQLite
  cannot replay an old log over the new file. The restored file is verified
  afterwards.

Host-side restore for a non-Docker SQLite file:

```bash
SQLITE_PATH=./data/starward.sqlite npm run db:vps:restore -- ./backups/starward-20260929T023705Z.sqlite --force
```

## 13. Rollback

- **Application code**: check out the previous commit/tag, rebuild, and bring
  the stack up again: `git checkout <previous>` then
  `docker compose --env-file .env -f deploy/docker-compose.yml up -d --build`.
- **Database**: restore the most recent `.pre-restore-*.sqlite` safety backup or
  a timestamped backup using the procedure above. Never try to "un-apply" a
  migration.
- **Caddy/edge config**: `git checkout deploy/Caddyfile`, then
  `docker compose --env-file .env -f deploy/docker-compose.yml restart caddy`.
- **Image rollback**: images are tagged `starward2026-app:local` /
  `starward2026-caddy:local`, so tag the previous image before upgrading if you
  need instant rollback without rebuilding.

## 14. VPS_ADMIN_EMAILS

`VPS_ADMIN_EMAILS` is the VPS admin authorization source of truth:

- Comma- or newline-separated email addresses, normalized (trimmed,
  lowercased).
- An empty or unset list makes every `/api/admin/*` request return `403` (fail
  closed). Set at least one address before going live.
- An administrator must first sign in through the normal portal flow (Better
  Auth email OTP) so a session exists; the session's verified email must match
  the allowlist.
- `VPS_ADMIN_MODE=disabled` turns the admin surface off entirely.
- Request headers are never trusted for identity on the VPS path. The
  `x-admin-email` header only exists for the loopback-only Cloudflare/local-dev
  bypass and has no effect here.
- To change admins, edit `.env` and recreate the app container:
  `docker compose --env-file .env -f deploy/docker-compose.yml up -d app`.
  No database change is required.

## 15. Reverse proxy trust and rate limiting

`TRUST_PROXY_HEADERS` and `TRUSTED_PROXY_IPS` control how the app derives the
client IP used for the application-submission rate limiter.

- With `TRUST_PROXY_HEADERS=false` (the Node default), the app ignores
  `cf-connecting-ip` and `x-forwarded-for` completely and keys on the immediate
  socket peer. Behind Compose that peer is the Caddy container, so **every
  client shares one IP bucket** and legitimate submissions get over-limited.
  Keep trust enabled when the app is reachable only through Caddy.
- With trust enabled, forwarded headers are used only when the socket peer is
  listed in `TRUSTED_PROXY_IPS`. Only the last `x-forwarded-for` hop (the one
  Caddy appends) is used; client-supplied leading hops are ignored. A direct
  client cannot spoof the headers because it is not the trusted peer.
- **Concrete proxy peer/IP issue:** `TRUSTED_PROXY_IPS` is an exact string
  match, **not a CIDR range**. In `deploy/docker-compose.yml` Caddy is pinned to
  `172.28.0.2` on the `172.28.0.0/24` bridge network and the app environment
  defaults `TRUSTED_PROXY_IPS=172.28.0.2`. If you change the compose subnet or
  Caddy's `ipv4_address`, update `TRUSTED_PROXY_IPS` to the new exact peer, or
  the app falls back to keying on the proxy address (over-limiting).
- IPv4-mapped IPv6 peers (`::ffff:172.28.0.2`) are normalized, so an IPv4 trust
  list entry still matches.
- **Missing-XFF behavior (Task 4 finding F2):** with trust enabled and a trusted
  peer, if `x-forwarded-for` is absent or unusable the resolver returns `null`
  and the IP limiter is skipped entirely (fail open for the IP bucket; the
  email bucket still applies). Stock Caddy always sets the header; if you
  replace Caddy or add another proxy, verify it forwards `X-Forwarded-For`.
  The default (trust disabled) path stays closed.
- **Limiter bucket growth (Task 4 finding F1):** the Node limiter keeps
  per-key fixed-window counters in an in-memory `Map` that is never swept, so a
  long-running process with many distinct IPs/emails can grow the map slowly.
  It is bounded in practice by real traffic and reset by a restart; a periodic
  sweep is planned. The limiter is per-process, so the VPS must stay
  single-instance until shared storage (e.g. Redis) is introduced.
- Invalid IP strings in a trusted forward header are currently accepted as
  distinct keys (Task 4 finding F3); this only matters behind a trusted proxy
  that forwards client-controlled XFF.

## 16. Cloudflare Workers + D1 (unchanged)

VPS packaging does not modify `wrangler.jsonc` or the Worker entry; the existing
Wrangler commands continue to work:

```bash
npm run build:staging
npm run deploy:staging
npx wrangler d1 migrations apply starward2026 --remote
```

`npm run build` still emits the Worker bundle under `dist/starward2026/`.
`npm run build:vps` / `npm run start:vps` are additive and never touch the
Cloudflare path.

## 17. Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| App container restarts immediately | Missing/invalid `.env` value. Check `docker compose logs app`; the error names the variable. |
| `502` from Caddy | App not healthy yet or crashed. Check `docker compose ps` and app logs. |
| Certificate not issued | DNS not pointing at the VPS, or ports 80/443 blocked. Check `dig` and the firewall. |
| `/api/admin/*` always `403` | `VPS_ADMIN_EMAILS` empty/mismatched, or no Better Auth session. Sign in first and verify the address. |
| Backups fail with permission denied | Volume/bind-mount not owned by uid 1000. See §8. |
| Rate limiting blocks everyone | `TRUST_PROXY_HEADERS` misconfigured or `TRUSTED_PROXY_IPS` not the exact Caddy peer. See §15. |
