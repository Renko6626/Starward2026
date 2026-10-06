#!/usr/bin/env node
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = resolve(dirname(scriptPath), "..");
const supportedModes = new Set(["help", "local", "docker", "staging"]);

export function parseMode(value) {
  const mode = value ?? "help";
  if (!supportedModes.has(mode)) {
    throw new Error(`Unknown test environment mode: ${mode}. Use local, docker, staging, or help.`);
  }
  return mode;
}

export function buildLocalServiceReport(env) {
  return [
    { name: "本地数据库", status: "ready", detail: "Wrangler D1 local" },
    {
      name: "本地管理员入口",
      status: env.ALLOW_LOCAL_ADMIN_BYPASS === "true" ? "ready" : "offline",
      detail:
        env.ALLOW_LOCAL_ADMIN_BYPASS === "true"
          ? "loopback header bypass"
          : "未开启；管理员页面需要真实 Better Auth 会话",
    },
    {
      name: "邮件 OTP（Resend）",
      status: env.RESEND_API_KEY && env.RESEND_FROM_EMAIL ? "ready" : "offline",
      detail:
        env.RESEND_API_KEY && env.RESEND_FROM_EMAIL
          ? "使用配置的邮件服务"
          : "未配置；OTP 登录会显示不可用",
    },
    {
      name: "Turnstile",
      status: env.TURNSTILE_SECRET_KEY ? "ready" : "offline",
      detail: env.TURNSTILE_SECRET_KEY ? "使用配置的验证码服务" : "未配置；验证码校验关闭",
    },
  ];
}

function readDotEnv(path) {
  if (!existsSync(path)) return {};
  return Object.fromEntries(
    readFileSync(path, "utf8")
      .split(/\r?\n/)
      .filter((line) => /^\s*[A-Z0-9_]+=/.test(line))
      .map((line) => {
        const [, key, value = ""] = line.match(/^\s*([A-Z0-9_]+)=(.*)$/) ?? [];
        return [key, value.replace(/^['"]|['"]$/g, "")];
      })
      .filter(([key]) => key),
  );
}

function ensureLocalDevVars() {
  const path = join(repoRoot, ".dev.vars");
  if (existsSync(path)) return path;
  const template = readFileSync(join(repoRoot, ".dev.vars.example"), "utf8");
  const secret = randomBytes(32).toString("base64");
  const content = template
    .replace(/replace-with-a-32-plus-character-local-secret/g, secret)
    .replace(/# ALLOW_LOCAL_ADMIN_BYPASS="true"/g, 'ALLOW_LOCAL_ADMIN_BYPASS="true"')
    .replace(/# ALLOW_LOCAL_DEV_ORIGINS="true"/g, 'ALLOW_LOCAL_DEV_ORIGINS="true"');
  writeFileSync(path, content, { mode: 0o600 });
  console.log("Created ignored .dev.vars with a generated local-only secret.");
  return path;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: "inherit",
    shell: process.platform === "win32",
    ...options,
  });
  if (result.error) throw result.error;
  if ((result.status ?? 1) !== 0) process.exit(result.status ?? 1);
}

function printReport(report) {
  for (const item of report) {
    const marker = item.status === "ready" ? "[ready]" : "[offline]";
    console.log(`${marker} ${item.name}: ${item.detail}`);
  }
}

function printHelp() {
  console.log(`Starward2026 test environment launcher\n\nUsage: npm run test:env -- <mode>\n\nModes:\n  local    Reset seeded local D1 and start the Vite + Worker app (recommended)\n  docker   Start the local Node + SQLite + Caddy stack (requires .env)\n  staging  Show Cloudflare staging checks and deploy commands; never deploys\n  help     Show this help\n\nThe local mode may create an ignored .dev.vars with a generated local secret.\nExternal services such as Resend and Turnstile are reported as offline when\nnot configured; seeded pages and local admin smoke flows still work.`);
}

if (!process.argv[1] || resolve(process.argv[1]) !== scriptPath) {
  // Imported by tests; do not launch a child process as an import side effect.
} else {
const mode = parseMode(process.argv[2]);

if (mode === "help") {
  printHelp();
} else if (mode === "local") {
  const varsPath = ensureLocalDevVars();
  const env = { ...readDotEnv(varsPath), ...process.env };
  console.log("\nLocal service report:");
  printReport(buildLocalServiceReport(env));
  console.log("\nResetting local D1 fixtures, then starting the app at http://localhost:20262 ...\n");
  run("npm", ["run", "db:local:reset"]);
  run("npm", ["run", "dev", "--", ...process.argv.slice(3)]);
} else if (mode === "docker") {
  if (!existsSync(join(repoRoot, ".env"))) {
    console.error(".env is missing. Copy .env.example to .env and fill local test values first.");
    process.exitCode = 1;
  } else {
    run("docker", ["compose", "--env-file", ".env", "-f", "deploy/docker-compose.yml", "up", "-d", "--build"]);
    console.log("\nDocker test stack started. Check it with: docker compose --env-file .env -f deploy/docker-compose.yml ps");
  }
} else if (mode === "staging") {
  console.log("Cloudflare staging is not deployed by this helper.");
  console.log("Run: npm run check && npm test && npm run build:staging");
  console.log("Then, only when the Cloudflare account and D1 binding are ready: npm run deploy:staging");
}
}
