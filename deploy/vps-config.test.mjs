import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8");
}

function readJson(relativePath) {
  return JSON.parse(read(relativePath));
}

describe("Dockerfile", () => {
  const dockerfile = read("Dockerfile");

  it("builds and runs on Node 22", () => {
    expect(dockerfile).toMatch(/FROM node:22\.18-bookworm-slim/);
  });

  it("runs the bundled Node entrypoint as a non-root user", () => {
    expect(dockerfile).toMatch(/^USER node$/m);
    expect(dockerfile).not.toMatch(/^USER root$/m);
    expect(dockerfile).toMatch(/CMD \["node", "dist-vps\/node\.mjs"\]/);
  });

  it("declares a container health check against /api/health", () => {
    expect(dockerfile).toMatch(/HEALTHCHECK/);
    expect(dockerfile).toMatch(/\/api\/health/);
  });

  it("ships the migrations, scripts, and runtime adapters needed by the ops CLIs", () => {
    expect(dockerfile).toMatch(/COPY[^\n]*\/app\/migrations/);
    expect(dockerfile).toMatch(/COPY[^\n]*\/app\/scripts/);
    expect(dockerfile).toMatch(/COPY[^\n]*\/app\/server\/env\.ts/);
    expect(dockerfile).toMatch(/COPY[^\n]*\/app\/server\/sqlite-d1\.ts/);
  });

  it("keeps secrets out of the build context via .dockerignore", () => {
    const dockerignore = read(".dockerignore");
    expect(dockerignore).toMatch(/^\.env\*?$/m);
    expect(dockerignore).toMatch(/^node_modules$/m);
    expect(dockerignore).toMatch(/^data$/m);
  });

  it("only references build stages that are defined", () => {
    const stages = [...dockerfile.matchAll(/^FROM\s+\S+(?:\s+AS\s+(\S+))?/gim)]
      .map((match) => match[1])
      .filter(Boolean);

    expect(stages).toContain("runtime");
    expect(stages).toContain("caddy");

    for (const reference of [...dockerfile.matchAll(/COPY --from=(\S+)/g)].map(
      (match) => match[1],
    )) {
      expect(stages, `COPY --from=${reference} has no matching stage`).toContain(reference);
    }
  });
});

describe("deploy/docker-compose.yml", () => {
  const compose = read("deploy/docker-compose.yml");

  it("persists SQLite on a named volume and loads secrets from the root .env", () => {
    expect(compose).toMatch(/starward_data:/);
    expect(compose).toMatch(/\/app\/data/);
    expect(compose).toMatch(/env_file:/);
    expect(compose).toMatch(/\.\.\/\.env/);
  });

  it("keeps the app private and exposes only Caddy on 80/443", () => {
    expect(compose).toMatch(/expose:\s*\n\s*-\s*"?3000"?/);
    expect(compose).not.toMatch(/3000:3000/);
    expect(compose).toMatch(/80:80/);
    expect(compose).toMatch(/443:443/);
  });

  it("runs the app as non-root and waits for its health check", () => {
    expect(compose).toMatch(/user:\s*"?1000:1000"?/);
    expect(compose).toMatch(/\/api\/health/);
    expect(compose).toMatch(/condition:\s*service_healthy/);
  });

  it("pins the concrete Caddy proxy peer for trusted forwarded headers", () => {
    expect(compose).toMatch(/TRUST_PROXY_HEADERS/);
    expect(compose).toMatch(/TRUSTED_PROXY_IPS/);
    expect(compose).toMatch(/172\.28\.0\.2/);
    expect(compose).toMatch(/ipv4_address:\s*172\.28\.0\.2/);
  });

  it("mounts a separate persistent backup volume", () => {
    expect(compose).toMatch(/starward_backups:/);
    expect(compose).toMatch(/\/app\/backups/);
  });

  it("allows ACR image overrides while keeping the local build targets", () => {
    expect(compose).toMatch(/image:\s*\$\{STARWARD_APP_IMAGE:-starward2026-app:local\}/);
    expect(compose).toMatch(/image:\s*\$\{STARWARD_CADDY_IMAGE:-starward2026-caddy:local\}/);
    expect(compose).toMatch(/target:\s*runtime/);
    expect(compose).toMatch(/target:\s*caddy/);
  });
});

describe("deploy/Caddyfile", () => {
  const caddyfile = read("deploy/Caddyfile");

  it("serves over TLS for the configured site address", () => {
    expect(caddyfile).toMatch(/\{\$SITE_ADDRESS\}/);
    expect(caddyfile).toMatch(/email \{\$ACME_EMAIL\}/);
  });

  it("reverse-proxies API/auth requests to the app", () => {
    expect(caddyfile).toMatch(/handle \/api\/\*/);
    expect(caddyfile).toMatch(/reverse_proxy app:3000/);
  });

  it("serves the SPA with an index.html fallback", () => {
    expect(caddyfile).toMatch(/root \* \/srv/);
    expect(caddyfile).toMatch(/try_files \{path\} \/index\.html/);
    expect(caddyfile).toMatch(/file_server/);
  });

  it("has balanced braces", () => {
    const open = (caddyfile.match(/\{/g) ?? []).length;
    const close = (caddyfile.match(/\}/g) ?? []).length;

    expect(open).toBeGreaterThan(0);
    expect(open).toBe(close);
  });
});

describe(".env.example", () => {
  const example = read(".env.example");

  it("documents every required VPS variable", () => {
    for (const key of [
      "BETTER_AUTH_SECRET",
      "BETTER_AUTH_URL",
      "BETTER_AUTH_TRUSTED_ORIGINS",
      "RESEND_API_KEY",
      "RESEND_FROM_EMAIL",
      "RESEND_FROM_NAME",
      "TURNSTILE_SECRET_KEY",
      "SQLITE_PATH",
      "VPS_ADMIN_MODE",
      "VPS_ADMIN_EMAILS",
      "TRUST_PROXY_HEADERS",
      "TRUSTED_PROXY_IPS",
      "SITE_ADDRESS",
      "ACME_EMAIL",
    ]) {
      expect(example, `missing ${key}`).toMatch(new RegExp(`^${key}=`, "m"));
    }

    expect(example).toMatch(/^SQLITE_PATH=\/app\/data\/starward\.sqlite$/m);
  });

  it("contains no real secrets", () => {
    for (const key of ["BETTER_AUTH_SECRET", "RESEND_API_KEY", "TURNSTILE_SECRET_KEY"]) {
      const match = example.match(new RegExp(`^${key}=(.*)$`, "m"));
      expect(match, `missing ${key}`).not.toBeNull();
      expect(match[1].trim()).toBe("");
    }
  });

  it("never sets the loopback development flags", () => {
    expect(example).not.toMatch(/ALLOW_LOCAL_ADMIN_BYPASS/);
    expect(example).not.toMatch(/ALLOW_LOCAL_DEV_ORIGINS/);
  });

  it("documents the deploy-time image override keys", () => {
    for (const key of ["STARWARD_APP_IMAGE", "STARWARD_CADDY_IMAGE"]) {
      expect(example, `missing ${key}`).toMatch(new RegExp(`^${key}=`, "m"));
    }
  });

  it("pins the compose proxy peer and documents the exact-match semantics", () => {
    expect(example).toMatch(/^TRUSTED_PROXY_IPS=172\.28\.0\.2$/m);
    expect(example).toMatch(/exact match, not a CIDR/i);
  });
});

describe(".gitignore", () => {
  const gitignore = read(".gitignore");

  it("ignores the default SQLite data directory and WAL members", () => {
    expect(gitignore).toMatch(/^data\/$/m);
    expect(gitignore).toMatch(/^\*\.sqlite$/m);
    expect(gitignore).toMatch(/^\*\.sqlite-wal$/m);
    expect(gitignore).toMatch(/^\*\.sqlite-shm$/m);
  });

  it("ignores backups, the VPS bundle, and environment files", () => {
    expect(gitignore).toMatch(/^backups\/$/m);
    expect(gitignore).toMatch(/^dist-vps\/$/m);
    expect(gitignore).toMatch(/^\.env$/m);
  });
});

describe("package.json", () => {
  const pkg = readJson("package.json");

  it("exposes the VPS start/ops scripts", () => {
    expect(pkg.scripts["build:vps"]).toMatch(/vite build .*vite\.vps\.config\.ts/);
    expect(pkg.scripts["start:vps"]).toBe("node ./dist-vps/node.mjs");
    expect(pkg.scripts["db:vps:migrate"]).toBe("node ./scripts/sqlite-migrate.mjs");
    expect(pkg.scripts["db:vps:backup"]).toBe("node ./scripts/backup-sqlite.mjs");
    expect(pkg.scripts["db:vps:restore"]).toBe("node ./scripts/restore-sqlite.mjs");
  });

  it("leaves the Cloudflare Wrangler commands intact", () => {
    for (const script of [
      "deploy",
      "deploy:staging",
      "build:staging",
      "cf-typegen",
      "db:local:reset",
      "db:local:seed",
      "db:local:print-portals",
    ]) {
      expect(pkg.scripts[script], `missing ${script}`).toBeTruthy();
    }

    expect(pkg.scripts["deploy:staging"]).toMatch(/wrangler deploy/);
    expect(pkg.scripts["deploy:staging"]).toMatch(/CLOUDFLARE_ENV=staging/);
  });
});

describe("VPS Node entrypoint build", () => {
  it("bundles a real entry that calls startNodeServer()", () => {
    const entry = read("server/start.ts");
    expect(entry).toMatch(/startNodeServer/);
    expect(entry).toMatch(/await startNodeServer\(/);
  });

  it("externalizes node_modules and emits a single Node ESM file", () => {
    const config = read("vite.vps.config.ts");
    expect(config).toMatch(/ssr:\s*"server\/start\.ts"/);
    expect(config).toMatch(/outDir:\s*"dist-vps"/);
    expect(config).toMatch(/entryFileNames:\s*"node\.mjs"/);
  });

  it("typechecks the VPS build config", () => {
    const tsconfig = readJson("tsconfig.node.json");
    expect(tsconfig.include).toContain("vite.vps.config.ts");
  });
});

describe("VPS operations documentation", () => {
  const doc = read("docs/development/vps.md");

  it("documents the required operational topics", () => {
    for (const topic of [
      /firewall/i,
      /DNS/i,
      /TLS/i,
      /volume ownership/i,
      /logs?/i,
      /rotation/i,
      /restore/i,
      /rollback/i,
      /VPS_ADMIN_EMAILS/,
      /TRUST_PROXY_HEADERS/,
      /TRUSTED_PROXY_IPS/,
      /172\.28\.0\.2/,
    ]) {
      expect(doc, `missing ${topic}`).toMatch(topic);
    }
  });

  it("keeps the Task 4 non-blocking findings visible", () => {
    expect(doc).toMatch(/limiter map|bucket/i);
    expect(doc).toMatch(/x-forwarded-for/i);
  });
});

describe(".github/workflows/deploy.yml", () => {
  const workflow = read(".github/workflows/deploy.yml");

  it("triggers on pushes to main and on manual dispatch", () => {
    expect(workflow).toMatch(/on:\s*\n\s*push:/);
    expect(workflow).toMatch(/branches:\s*\n\s*-\s*main/);
    expect(workflow).toMatch(/workflow_dispatch:/);
  });

  it("runs the CI gate before building images", () => {
    for (const step of ["npm ci", "npm run check", "npm test", "npm run build"]) {
      expect(workflow, `missing ${step}`).toContain(step);
    }

    expect(workflow.indexOf("npm ci")).toBeLessThan(workflow.indexOf("npm run check"));
    expect(workflow.indexOf("npm run check")).toBeLessThan(workflow.indexOf("npm test"));
    expect(workflow.indexOf("npm test")).toBeLessThan(workflow.indexOf("npm run build"));
  });

  it("builds and pushes both Dockerfile targets with immutable and latest tags", () => {
    expect(workflow).toMatch(/uses:\s*docker\/build-push-action@v\d+/);
    expect(workflow).toMatch(/target:\s*runtime/);
    expect(workflow).toMatch(/target:\s*caddy/);
    expect(workflow).toMatch(/provenance:\s*false/);
    expect(workflow).toMatch(/type=gha/);
    expect(workflow).toMatch(/:\$\{\{\s*github\.sha\s*\}\}/);
    expect(workflow).toMatch(/:latest/);
  });

  it("deploys over SSH behind a concurrency gate and an owner restriction", () => {
    expect(workflow).toMatch(/concurrency:/);
    expect(workflow).toMatch(/group:\s*deploy-production/);
    expect(workflow).toMatch(/cancel-in-progress:\s*false/);
    expect(workflow).toMatch(/github\.repository_owner\s*==\s*'Renko6626'/);
    expect(workflow).toMatch(/appleboy\/ssh-action@v\d/);
    expect(workflow).toMatch(/deploy\/deploy\.sh/);
    expect(workflow).toMatch(/\$\{\{\s*github\.sha\s*\}\}/);
  });
});

describe("deploy/deploy.sh", () => {
  const script = read("deploy/deploy.sh");

  it("is a bash script with strict mode", () => {
    expect(script.startsWith("#!/usr/bin/env bash")).toBe(true);
    expect(script).toMatch(/set -Eeuo pipefail/);
  });

  it("validates .env, Docker, and the compose config", () => {
    expect(script).toMatch(/ENV_FILE=/);
    expect(script).toMatch(/\.env not found/);
    expect(script).toMatch(/command -v docker/);
    expect(script).toMatch(/docker compose version/);
    expect(script).toMatch(/compose config -q/);
  });

  it("backs up SQLite before pulling or recreating", () => {
    const backupAt = script.indexOf("db:vps:backup");
    expect(backupAt).toBeGreaterThan(-1);
    expect(script.indexOf("compose pull app caddy")).toBeGreaterThan(backupAt);
    expect(script).toMatch(/up -d --no-build/);
  });

  it("records the running images and rolls back to them on failure", () => {
    expect(script).toMatch(/service_current_ref/);
    expect(script).toMatch(/RepoDigests/);
    expect(script).toMatch(/rollback\(\)/);
    expect(script).toMatch(/PREV_APP_IMAGE/);
    expect(script).toMatch(/PREV_CADDY_IMAGE/);
  });

  it("waits for app health and /api/health", () => {
    expect(script).toMatch(/compose pull app caddy/);
    expect(script).toMatch(/wait_for_app_health/);
    expect(script).toMatch(/\/api\/health/);
    expect(script).toMatch(/State\.Health\.Status/);
  });

  it("never restores the database automatically and does not need jq", () => {
    expect(script).not.toMatch(/db:vps:restore/);
    expect(script).not.toMatch(/restore-sqlite/);
    expect(script).not.toMatch(/(?:^|[|&;]|\$\()\s*jq\b/m);
  });

  it("accepts an optional tag positional argument", () => {
    expect(script).toMatch(/tag="\$\{1:-\}"/);
    expect(script).toMatch(/with_tag/);
  });
});

describe("VPS automated deployment documentation", () => {
  const doc = read("docs/development/vps.md");

  it("documents GitHub Actions, ACR, secrets/vars, triggers, and rollback", () => {
    for (const topic of [
      /GitHub Actions/i,
      /Aliyun ACR|ACR/,
      /ACR_USERNAME/,
      /ACR_PASSWORD/,
      /ACR_REGISTRY/,
      /VPS_SSH_KEY/,
      /VPS_DEPLOY_PATH/,
      /workflow_dispatch/,
      /deploy\/deploy\.sh/,
      /forward-only/i,
      /backup/i,
      /rollback/i,
    ]) {
      expect(doc, `missing ${topic}`).toMatch(topic);
    }
  });

  it("documents the Aliyun Beijing ACME / ICP risk", () => {
    expect(doc).toMatch(/ICP filing/i);
    expect(doc).toMatch(/Beijing/i);
    expect(doc).toMatch(/ACME/);
  });

  it("states that the production .env lives only on the VPS", () => {
    expect(doc).toMatch(/only\*\* on the VPS/);
  });
});

describe("readme", () => {
  it("links the VPS deployment documentation without removing Wrangler guidance", () => {
    const readme = read("readme.md");
    expect(readme).toMatch(/docs\/development\/vps\.md/);
    expect(readme).toMatch(/deploy:staging/);
  });
});

describe("paths that must exist", () => {
  it("has all VPS packaging files", () => {
    for (const path of [
      "Dockerfile",
      ".dockerignore",
      ".env.example",
      ".github/workflows/deploy.yml",
      "deploy/deploy.sh",
      "deploy/docker-compose.yml",
      "deploy/Caddyfile",
      "scripts/backup-sqlite.mjs",
      "scripts/restore-sqlite.mjs",
      "scripts/lib/vps-ops.mjs",
      "server/start.ts",
      "vite.vps.config.ts",
      "docs/development/vps.md",
    ]) {
      expect(existsSync(resolve(root, path)), `missing ${path}`).toBe(true);
    }
  });
});
