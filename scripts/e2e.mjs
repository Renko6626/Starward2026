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
// Capture only the outbound mail transport, retaining real OTP generation and auth.
writeFileSync(join(temp, "worker.ts"), `import worker from ${JSON.stringify(join(root, "worker/index.ts"))};
const outbox = [];
let fixtureId = crypto.randomUUID();
const rateLimitBindings = ${JSON.stringify((config.ratelimits ?? []).map(binding => binding.name))};
const originalFetch = globalThis.fetch.bind(globalThis);
globalThis.fetch = async (input, init) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (url.origin === "https://api.resend.com" && url.pathname === "/emails") {
    const request = new Request(input, init);
    outbox.push(await request.json());
    return Response.json({ id: crypto.randomUUID() });
  }
  return originalFetch(input, init);
};
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/__e2e/mailbox") {
      if (request.method === "DELETE") {
        outbox.length = 0;
        fixtureId = crypto.randomUUID();
        return new Response(null, { status: 204 });
      }
      return Response.json(outbox.filter(mail => [mail.to].flat().includes(url.searchParams.get("email"))));
    }
    if (new URL(request.url).pathname === "/__e2e/fixture-sql" && request.method === "POST") {
      const { statements } = await request.json();
      return Response.json(await env.DB.batch(statements.map(sql => env.DB.prepare(sql))));
    }
    // Preserve real limits within each case without sharing counters across cases.
    const bindings = { ...env };
    for (const name of rateLimitBindings) {
      const limiter = env[name];
      const prefix = fixtureId;
      bindings[name] = { limit: ({ key }) => limiter.limit({ key: prefix + ":" + key }) };
    }
    return worker.fetch(request, bindings, ctx);
  }
};`);
config.main = join(temp, "worker.ts");
config.r2_buckets = [{ binding: "WORK_FILES", bucket_name: "starward2026-work-files-e2e" }];
config.d1_databases = [{ binding: "DB", database_name: "starward2026-e2e", database_id: "00000000-0000-0000-0000-000000000026", migrations_dir: join(root, "migrations") }];
config.vars = { QQ_OAUTH_ENABLED: "false", BETTER_AUTH_SECRET: "e2e-local-secret-with-at-least-32-characters", BETTER_AUTH_URL: "http://127.0.0.1:21262", ALLOW_LOCAL_ADMIN_BYPASS: "true", ALLOW_LOCAL_DEV_ORIGINS: "true", RESEND_API_KEY: "re_e2e_mail_capture", RESEND_FROM_EMAIL: "e2e@example.com" };
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
