#!/usr/bin/env bash
#
# Starward2026 VPS deploy: pull prebuilt ACR images and roll forward/back.
#
# Usage:
#   deploy/deploy.sh [<tag>]
#
# The script locates the repository from its own path, so it works both from the
# repository root and from the production checkout at /opt/starward. The
# optional <tag> is an immutable image tag (normally a git SHA). The image
# repositories are read from STARWARD_APP_IMAGE / STARWARD_CADDY_IMAGE in the
# root `.env`; <tag> replaces their tag. Without a tag the values are used as-is.
#
# What it does, in order:
#   1. validates `.env`, Docker/Compose, and `docker compose config`;
#   2. runs the existing `db:vps:backup` against the live database (skipped on a
#      first deploy, or with SKIP_BACKUP=1);
#   3. records the exact app/caddy image digests (or tags) currently running;
#   4. `pull` + `up -d --no-build`;
#   5. waits for the app container to become healthy and for `/api/health`;
#   6. on any failure after the recreate starts, brings the previously recorded
#      images back up and re-checks health. It never restores the database.
#
# It does not log in to a registry, needs no jq, and prints no secret values.
set -Eeuo pipefail

readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
readonly COMPOSE_FILE="${REPO_ROOT}/deploy/docker-compose.yml"
readonly ENV_FILE="${REPO_ROOT}/.env"

readonly DEFAULT_APP_IMAGE="starward2026-app:local"
readonly DEFAULT_CADDY_IMAGE="starward2026-caddy:local"

BACKUP_KEEP="${BACKUP_KEEP:-14}"
HEALTH_TIMEOUT_SECONDS="${HEALTH_TIMEOUT_SECONDS:-180}"
HEALTH_INTERVAL_SECONDS="${HEALTH_INTERVAL_SECONDS:-3}"
SKIP_BACKUP="${SKIP_BACKUP:-0}"

TARGET_APP_IMAGE=""
TARGET_CADDY_IMAGE=""
PREV_APP_IMAGE=""
PREV_CADDY_IMAGE=""
ROLLBACK_ON_ERROR=0

log() { printf '[deploy] %s\n' "$*"; }
warn() { printf '[deploy] WARNING: %s\n' "$*" >&2; }
die() {
  printf '[deploy] ERROR: %s\n' "$*" >&2
  exit 1
}

# Compose invocation shared by every step. `--env-file` is explicit so the
# script behaves identically from any working directory.
compose() { docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" "$@"; }

usage() {
  cat <<'EOF'
Usage: deploy/deploy.sh [<tag>]

Environment (optional):
  BACKUP_KEEP              Backups retained by db:vps:backup (default 14)
  SKIP_BACKUP=1            Skip the pre-deploy SQLite backup (bootstrap only)
  HEALTH_TIMEOUT_SECONDS   Max seconds to wait for app health (default 180)
  HEALTH_INTERVAL_SECONDS  Poll interval in seconds (default 3)

The image repositories come from STARWARD_APP_IMAGE / STARWARD_CADDY_IMAGE in
the root `.env`. <tag> replaces their tag with an immutable tag (e.g. a git SHA).
EOF
}

# Read a single KEY=value from `.env` without sourcing it. Returns 1 if absent.
env_value() {
  local key="$1" raw value
  raw="$(grep -E "^[[:space:]]*${key}=" "${ENV_FILE}" | tail -n 1 || true)"
  [ -n "${raw}" ] || return 1
  value="${raw#*=}"
  value="${value%$'\r'}"
  value="${value%\"}"
  value="${value#\"}"
  value="${value%\'}"
  value="${value#\'}"
  printf '%s' "${value}"
}

# Drop a digest (`@sha256:...`) and a trailing tag while preserving a registry
# host:port prefix, so `registry:5000/ns/app:tag` -> `registry:5000/ns/app`.
strip_image_tag() {
  local ref="$1"
  ref="${ref%%@*}"
  if [[ "${ref##*/}" == *:* ]]; then
    ref="${ref%:*}"
  fi
  printf '%s' "${ref}"
}

with_tag() {
  printf '%s:%s' "$(strip_image_tag "$1")" "$2"
}

# Print an image reference that pins the currently running container: prefer a
# RepoDigest for the configured repository, fall back to the image tag.
service_current_ref() {
  local service="$1" cid image_id config_image repo digest
  cid="$(compose ps -q "${service}" 2>/dev/null | head -n 1 || true)"
  [ -n "${cid}" ] || return 1

  image_id="$(docker inspect -f '{{.Image}}' "${cid}" 2>/dev/null || true)"
  config_image="$(docker inspect -f '{{.Config.Image}}' "${cid}" 2>/dev/null || true)"
  [ -n "${image_id}" ] || return 1

  if [ -n "${config_image}" ]; then
    repo="$(strip_image_tag "${config_image}")"
    digest="$(docker inspect -f '{{range .RepoDigests}}{{println .}}{{end}}' "${image_id}" 2>/dev/null \
      | grep -F "${repo}@" | head -n 1 || true)"
    if [ -n "${digest}" ]; then
      printf '%s' "${digest}"
      return 0
    fi
  fi

  [ -n "${config_image}" ] || return 1
  printf '%s' "${config_image}"
}

wait_for_app_health() {
  local deadline=$((SECONDS + HEALTH_TIMEOUT_SECONDS))
  local cid status
  while [ "${SECONDS}" -lt "${deadline}" ]; do
    cid="$(compose ps -q app 2>/dev/null | head -n 1 || true)"
    if [ -n "${cid}" ]; then
      status="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "${cid}" 2>/dev/null || true)"
      case "${status}" in
        healthy)
          log "app container reports healthy"
          return 0
          ;;
        unhealthy | exited | dead)
          warn "app container is ${status}"
          return 1
          ;;
      esac
    fi
    sleep "${HEALTH_INTERVAL_SECONDS}"
  done
  warn "Timed out after ${HEALTH_TIMEOUT_SECONDS}s waiting for the app health check."
  return 1
}

verify_http_health() {
  log "Checking /api/health from inside the app container"
  compose exec -T app node -e \
    "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/api/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
}

rollback() {
  if [ -z "${PREV_APP_IMAGE}" ] && [ -z "${PREV_CADDY_IMAGE}" ]; then
    warn "No previously running app/caddy image was recorded; cannot roll back automatically."
    return 1
  fi

  export STARWARD_APP_IMAGE="${PREV_APP_IMAGE:-${TARGET_APP_IMAGE}}"
  export STARWARD_CADDY_IMAGE="${PREV_CADDY_IMAGE:-${TARGET_CADDY_IMAGE}}"

  log "Rolling back to app=${STARWARD_APP_IMAGE} caddy=${STARWARD_CADDY_IMAGE}"
  compose up -d --no-build || {
    warn "Rollback 'up' failed."
    return 1
  }
  wait_for_app_health || {
    warn "Rolled-back app did not become healthy."
    return 1
  }
  verify_http_health || {
    warn "Rolled-back app failed the /api/health check."
    return 1
  }

  log "Rollback containers are healthy."
}

on_error() {
  local code=$?
  trap - ERR
  set +e
  if [ "${ROLLBACK_ON_ERROR}" -eq 1 ]; then
    warn "Deployment failed (exit ${code}); attempting rollback."
    if rollback; then
      warn "Rolled back to the previous images; the new release is NOT live."
    else
      warn "Rollback FAILED; the stack may be unhealthy. Inspect logs and recover manually."
    fi
  fi
  exit "${code}"
}
trap on_error ERR

main() {
  local tag="${1:-}"

  case "${tag}" in
    -h | --help)
      usage
      return 0
      ;;
  esac

  [ -f "${ENV_FILE}" ] || die ".env not found at ${ENV_FILE}; copy .env.example and fill it in."
  [ -r "${ENV_FILE}" ] || die ".env is not readable: ${ENV_FILE}"

  command -v docker >/dev/null 2>&1 || die "docker is not installed or not on PATH."
  if ! docker compose version >/dev/null 2>&1; then
    die "Docker Compose v2 ('docker compose') is required."
  fi

  local env_mode
  env_mode="$(stat -c '%a' "${ENV_FILE}" 2>/dev/null || true)"
  case "${env_mode}" in
    "" | 600 | 400 | 640 | 440) ;;
    *) warn ".env permissions are ${env_mode}; chmod 600 ${ENV_FILE} is recommended." ;;
  esac

  if ! compose config -q; then
    die "docker compose config validation failed; fix .env or deploy/docker-compose.yml."
  fi

  local app_base caddy_base
  app_base="$(env_value STARWARD_APP_IMAGE || printf '%s' "${DEFAULT_APP_IMAGE}")"
  caddy_base="$(env_value STARWARD_CADDY_IMAGE || printf '%s' "${DEFAULT_CADDY_IMAGE}")"

  if [ -n "${tag}" ]; then
    TARGET_APP_IMAGE="$(with_tag "${app_base}" "${tag}")"
    TARGET_CADDY_IMAGE="$(with_tag "${caddy_base}" "${tag}")"
  else
    TARGET_APP_IMAGE="${app_base}"
    TARGET_CADDY_IMAGE="${caddy_base}"
  fi

  export STARWARD_APP_IMAGE="${TARGET_APP_IMAGE}"
  export STARWARD_CADDY_IMAGE="${TARGET_CADDY_IMAGE}"

  log "Repository root:    ${REPO_ROOT}"
  log "Target app image:   ${TARGET_APP_IMAGE}"
  log "Target caddy image: ${TARGET_CADDY_IMAGE}"

  local app_cid
  app_cid="$(compose ps -q app 2>/dev/null | head -n 1 || true)"
  if [ -n "${app_cid}" ]; then
    if [ "${SKIP_BACKUP}" = "1" ]; then
      warn "SKIP_BACKUP=1; skipping the pre-deploy SQLite backup."
    else
      log "Backing up SQLite before deploy (keep ${BACKUP_KEEP})."
      compose exec -T app npm run db:vps:backup -- --keep "${BACKUP_KEEP}"
    fi
  else
    log "No running app container; skipping pre-deploy backup (first deploy / no database yet)."
  fi

  PREV_APP_IMAGE="$(service_current_ref app || true)"
  PREV_CADDY_IMAGE="$(service_current_ref caddy || true)"
  log "Recorded previous app image:   ${PREV_APP_IMAGE:-<none>}"
  log "Recorded previous caddy image: ${PREV_CADDY_IMAGE:-<none>}"

  log "Pulling images..."
  compose pull app caddy

  ROLLBACK_ON_ERROR=1
  log "Recreating the stack without building..."
  compose up -d --no-build

  wait_for_app_health
  verify_http_health

  ROLLBACK_ON_ERROR=0
  log "Deployment succeeded."
  log "  app:   ${TARGET_APP_IMAGE}"
  log "  caddy: ${TARGET_CADDY_IMAGE}"
  log "Database rollback stays manual: a pre-deploy backup was taken, but this script never restores it."
}

main "$@"
