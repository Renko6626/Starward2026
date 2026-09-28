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
