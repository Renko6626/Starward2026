import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = fileURLToPath(new URL("..", import.meta.url));
const temp = mkdtempSync(join(tmpdir(), "starward2026-e2e-"));
const config = ts.parseConfigFileTextToJson("wrangler.jsonc", readFileSync(join(root, "wrangler.jsonc"), "utf8")).config;
delete config.env;
delete config.$schema;
// This wrapper exists only in the temporary E2E configuration. All business
// requests reach the original Worker unchanged; fixture SQL shares its D1 runtime.
writeFileSync(join(temp, "worker.ts"), `import worker from ${JSON.stringify(join(root, "worker/index.ts"))};
export default {
  async fetch(request, env, ctx) {
    if (new URL(request.url).pathname === "/__e2e/fixture-sql" && request.method === "POST") {
      const { statements } = await request.json();
      return Response.json(await env.DB.batch(statements.map(sql => env.DB.prepare(sql))));
    }
    return worker.fetch(request, env, ctx);
  }
};`);
config.main = join(temp, "worker.ts");
config.d1_databases = [{ binding: "DB", database_name: "starward2026-e2e", database_id: "00000000-0000-0000-0000-000000000026", migrations_dir: join(root, "migrations") }];
config.vars = { QQ_OAUTH_ENABLED: "false", BETTER_AUTH_SECRET: "e2e-local-secret-with-at-least-32-characters", BETTER_AUTH_URL: "http://127.0.0.1:21262", ALLOW_LOCAL_ADMIN_BYPASS: "true", ALLOW_LOCAL_DEV_ORIGINS: "true" };
writeFileSync(join(temp, "wrangler.json"), JSON.stringify(config));
// A separate config directory and empty vars file prevent loading daily secrets.
writeFileSync(join(temp, ".dev.vars"), "");
mkdirSync(resolve(root, "playwright-logs"), { recursive: true });
writeFileSync(resolve(root, "playwright-logs/server.log"), "");
const child = spawn(process.execPath, [join(root, "node_modules/@playwright/test/cli.js"), "test", ...process.argv.slice(2)], {
  cwd: root, stdio: "inherit", env: { ...process.env, E2E_ROOT: temp, CLOUDFLARE_ENV: "", WRANGLER_SEND_METRICS: "false" },
});
// Let Playwright stop its web server before deleting the database.
process.on("SIGINT", () => child.kill("SIGINT"));
process.on("SIGTERM", () => child.kill("SIGINT"));
child.on("exit", (code) => { rmSync(temp, { recursive: true, force: true }); process.exitCode = code ?? 1; });
