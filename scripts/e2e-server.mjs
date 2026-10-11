import { appendFileSync, mkdirSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const temp = process.env.E2E_ROOT;
if (!temp) throw new Error("Run E2E using npm run test:e2e");
const config = join(temp, "wrangler.json");
const state = join(temp, "state");
// Kept outside Playwright's output directory, which is cleared when tests start.
const logs = join(root, "playwright-logs");
mkdirSync(logs, { recursive: true });
const log = join(logs, "server.log");
const migrated = spawnSync(process.execPath, [join(root, "node_modules/wrangler/bin/wrangler.js"), "d1", "migrations", "apply", "starward2026-e2e", "--local", "--config", config, "--persist-to", state], { cwd: root, encoding: "utf8" });
appendFileSync(log, migrated.stdout + migrated.stderr);
if (migrated.status !== 0) { process.stderr.write(migrated.stdout + migrated.stderr); process.exit(migrated.status ?? 1); }
const child = spawn(process.execPath, [join(root, "node_modules/vite/bin/vite.js"), "--host", "127.0.0.1"], {
  cwd: root, env: { ...process.env, E2E_MODE: "true", E2E_PORT: "21262", E2E_STATE_PATH: state, E2E_CONFIG_PATH: config }, stdio: ["ignore", "pipe", "pipe"],
});
child.stdout.on("data", data => { appendFileSync(log, data); process.stdout.write(data); });
child.stderr.on("data", data => { appendFileSync(log, data); process.stderr.write(data); });
process.on("SIGINT", () => child.kill("SIGINT"));
process.on("SIGTERM", () => child.kill("SIGTERM"));
child.on("exit", code => { process.exitCode = code ?? 0; });
