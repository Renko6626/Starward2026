#!/usr/bin/env node
/**
 * Apply the numbered SQL migrations to the VPS SQLite database.
 *
 * Usage:
 *   SQLITE_PATH=./data/starward.sqlite node scripts/sqlite-migrate.mjs
 *
 * `SQLITE_PATH` defaults to `DEFAULT_SQLITE_PATH` from `server/env.ts`. Set
 * `MIGRATIONS_DIR` to override the migrations directory (defaults to the
 * repository `migrations/` folder). The command is idempotent: already applied
 * migrations are skipped, and the parent directory must exist beforehand.
 */
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_SQLITE_PATH } from "../server/env.ts";
import { applySqliteMigrations, createSqliteD1Database } from "../server/sqlite-d1.ts";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sqlitePath = process.env.SQLITE_PATH?.trim() || DEFAULT_SQLITE_PATH;
const migrationsDir = process.env.MIGRATIONS_DIR?.trim() || resolve(repoRoot, "migrations");

const db = createSqliteD1Database(sqlitePath);

try {
  const applied = await applySqliteMigrations(db, migrationsDir);

  if (applied.length === 0) {
    console.log(`No pending migrations for ${sqlitePath}.`);
  } else {
    console.log(`Applied ${applied.length} migration(s) to ${sqlitePath}:`);

    for (const name of applied) {
      console.log(`  - ${name}`);
    }
  }
} catch (error) {
  console.error(`Failed to apply migrations to ${sqlitePath}:`);
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  db.close();
}
