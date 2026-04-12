import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  LOCAL_D1_DATABASE_NAME,
  LOCAL_D1_STATE_PATH,
  buildLocalPortalSessionSummaries,
  buildLocalSeedSql,
  localDevSeedFixtures,
  readBetterAuthSecret,
} from "./lib/local-dev-bootstrap.mjs";

const VALID_MODES = new Set(["bootstrap", "seed", "wipe", "print"]);
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const mode = process.argv[2] ?? "bootstrap";

if (!VALID_MODES.has(mode)) {
  console.error(`Unknown local dev bootstrap mode: ${mode}`);
  console.error("Use one of: bootstrap, seed, wipe, print");
  process.exit(1);
}

if (mode === "wipe" || mode === "bootstrap") {
  wipeLocalD1State();
}

if (mode === "bootstrap") {
  runWrangler(["d1", "migrations", "apply", LOCAL_D1_DATABASE_NAME, "--local"]);
  executeLocalSeedSql();
  await printPortalSummaries();
  process.exit(0);
}

if (mode === "seed") {
  executeLocalSeedSql();
  await printPortalSummaries();
  process.exit(0);
}

if (mode === "print") {
  await printPortalSummaries();
}

function wipeLocalD1State() {
  const localStatePath = join(repoRoot, LOCAL_D1_STATE_PATH);
  rmSync(localStatePath, { recursive: true, force: true });
  console.log(`Removed local D1 state at ${LOCAL_D1_STATE_PATH}.`);
}

function executeLocalSeedSql() {
  const tempDir = mkdtempSync(join(tmpdir(), "starward2026-local-seed-"));
  const tempFile = join(tempDir, "seed.sql");

  try {
    writeFileSync(tempFile, buildLocalSeedSql(), "utf8");
    runWrangler(["d1", "execute", LOCAL_D1_DATABASE_NAME, "--local", "--file", tempFile]);
    console.log("Seeded local D1 fixtures for admin and portal smoke.");
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

function runWrangler(args) {
  const result = spawnSync("npx", ["wrangler", ...args], {
    cwd: repoRoot,
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

async function printPortalSummaries() {
  console.log("");
  console.log("Seed personas:");
  console.log(`- portal pending review: ${localDevSeedFixtures.portalSessions[0].userEmail}`);
  console.log(`- portal approved participant: ${localDevSeedFixtures.portalSessions[1].userEmail}`);

  const secret = readBetterAuthSecret(repoRoot);

  if (!secret) {
    console.log("");
    console.log("BETTER_AUTH_SECRET was not found in process env or .dev.vars.");
    console.log("Local D1 data is ready, but signed portal session cookies cannot be printed.");
    return;
  }

  const portalSummaries = await buildLocalPortalSessionSummaries({ secret });

  console.log("");
  console.log("Portal session cookies:");

  for (const summary of portalSummaries) {
    console.log(`- ${summary.slug} (${summary.label})`);
    console.log(`  email: ${summary.userEmail}`);
    console.log(`  cookie: ${summary.cookieHeader}`);
    console.log(`  browser: ${summary.browserSnippet}`);
  }
}
