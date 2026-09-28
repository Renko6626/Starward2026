#!/usr/bin/env node
/**
 * Restore the configured VPS SQLite database from a validated backup.
 *
 * Usage:
 *   SQLITE_PATH=/app/data/starward.sqlite node scripts/restore-sqlite.mjs \
 *     <backup-file> [--force] [--no-safety-backup]
 *
 * The application must be stopped first. The command:
 *   1. validates the backup exists, has a SQLite header, and passes
 *      `PRAGMA integrity_check`;
 *   2. refuses to replace an existing database unless `--force` is passed;
 *   3. snapshots the current database to `<db>.pre-restore-<utc>.sqlite` first
 *      (disable with `--no-safety-backup`);
 *   4. replaces the database atomically and removes stale WAL/SHM members.
 */
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { resolveSqlitePath, restoreSqlite, VpsOpsError } from "./lib/vps-ops.mjs";

const HELP = `Usage: npm run db:vps:restore -- <backup-file> [--force] [--no-safety-backup]

Environment:
  SQLITE_PATH  Destination SQLite database (default: ./data/starward.sqlite)

Stop the application before restoring. Pass --force to replace a live database.
`;

function parseRestoreArgs(argv = process.argv.slice(2)) {
  return parseArgs({
    args: argv,
    options: {
      force: { type: "boolean", default: false },
      "no-safety-backup": { type: "boolean", default: false },
      help: { type: "boolean", default: false },
    },
    allowPositionals: true,
  });
}

async function main() {
  const { values, positionals } = parseRestoreArgs();

  if (values.help) {
    process.stdout.write(HELP);
    return;
  }

  const backupArg = positionals[0];

  if (!backupArg) {
    throw new VpsOpsError(
      "Missing backup file. Usage: npm run db:vps:restore -- <backup-file> [--force]",
    );
  }

  const result = await restoreSqlite({
    backupPath: backupArg,
    sqlitePath: resolveSqlitePath(),
    force: values.force,
    safetyBackup: !values["no-safety-backup"],
  });

  console.log(`Restored: ${result.sqlitePath}`);

  if (result.safetyBackupPath) {
    console.log(`Pre-restore safety backup: ${result.safetyBackupPath}`);
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

export { parseRestoreArgs };
