# syntax=docker/dockerfile:1
#
# Starward2026 VPS image.
#
# Stage `runtime` runs the bundled Node entry (`dist-vps/node.mjs`) as the
# non-root `node` user with SQLite on a persistent volume. Stage `caddy` bakes
# the built SPA into the official Caddy image so the Compose stack is
# self-contained. The Cloudflare Worker build is untouched; it is produced by
# the normal `npm run build` and deployed with Wrangler.

# --- Dependencies ---------------------------------------------------------
FROM node:22.18-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# --- Build ----------------------------------------------------------------
FROM deps AS builder
WORKDIR /app
COPY . .
# SPA + Worker build (tsc project references + vite) and the bundled Node entry.
RUN npm run build && npm run build:vps
# Keep only production modules for the runtime stage.
RUN npm prune --omit=dev

# --- Runtime --------------------------------------------------------------
FROM node:22.18-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

# Create the persistent mount points before dropping privileges. Docker seeds a
# new named volume from this directory, so `starward_data` / `starward_backups`
# inherit uid/gid 1000 (the `node` user) instead of root.
RUN mkdir -p /app/data /app/backups && chown -R node:node /app

COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist-vps ./dist-vps
COPY --from=builder --chown=node:node /app/migrations ./migrations
COPY --from=builder --chown=node:node /app/scripts/sqlite-migrate.mjs /app/scripts/backup-sqlite.mjs /app/scripts/restore-sqlite.mjs ./scripts/
COPY --from=builder --chown=node:node /app/scripts/lib/vps-ops.mjs ./scripts/lib/
COPY --from=builder --chown=node:node /app/server/env.ts ./server/env.ts
COPY --from=builder --chown=node:node /app/server/sqlite-d1.ts ./server/sqlite-d1.ts
COPY --from=builder --chown=node:node /app/package.json ./package.json

USER node
EXPOSE 3000

# SQLite lives on the `starward_data` volume; backups on `starward_backups`.
VOLUME ["/app/data", "/app/backups"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/api/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "dist-vps/node.mjs"]

# --- Caddy edge -----------------------------------------------------------
# The SPA is built in `builder` under `dist/client`; bake it into Caddy so the
# Compose stack only needs the root `.env` to start.
FROM caddy:2.10-alpine AS caddy
COPY --from=builder /app/dist/client /srv
COPY deploy/Caddyfile /etc/caddy/Caddyfile
