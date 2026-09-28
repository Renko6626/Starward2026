#!/usr/bin/env node
/**
 * Create a SQLite-safe backup of the configured VPS database.
 *
 * Usage:
 *   SQLITE_PATH=/app/data/starward.sqlite node scripts/backup-sqlite.mjs \
 *     [--out ./backups/starward-YYYYMMDDTHHMMSSZ.sqlite] [--keep 14]
 *
 * Defaults:
 *   - SQLITE_PATH: server/env.ts `DEFAULT_SQLITE_PATH` (`./data/starward.sqlite`)
 *   - --out:       `$BACKUP_DIR` (default `./backups`) + a UTC timestamped name
 *   - --keep:      14 most recent backups retained; older ones pruned
 *
 * Uses SQLite `VACUUM INTO`, so it is safe to run while the application is
 * live. Refuses a missing/invalid source database and never overwrites an
 * existing backup file.
 */
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import {
  DEFAULT_BACKUP_KEEP,
  backupSqlite,
  defaultBackupFileName,
  pruneBackups,
  resolveBackupDir,
  resolveSqlitePath,
  VpsOpsError,
} from "./lib/vps-ops.mjs";

const HELP = `Usage: npm run db:vps:backup -- [--out <file>] [--keep <count>]

Environment:
  SQLITE_PATH  Source SQLite database (default: ./data/starward.sqlite)
  BACKUP_DIR   Directory for default output (default: ./backups)
`;

function parseBackupArgs(argv = process.argv.slice(2)) {
  return parseArgs({
    args: argv,
    options: {
      out: { type: "string" },
      keep: { type: "string" },
      help: { type: "boolean", default: false },
    },
    allowPositionals: false,
  }).values;
}

async function main() {
  const values = parseBackupArgs();

  if (values.help) {
    process.stdout.write(HELP);
    return;
  }

  const sqlitePath = resolveSqlitePath();
  const outPath = values.out
    ? resolve(values.out)
    : join(resolveBackupDir(), defaultBackupFileName());
  const keep = values.keep === undefined ? DEFAULT_BACKUP_KEEP : Number(values.keep);

  if (!Number.isInteger(keep) || keep < 0) {
    throw new VpsOpsError("--keep must be a non-negative integer.");
  }

  const result = await backupSqlite({ sqlitePath, outPath });
  console.log(`Backup written: ${result.backupPath} (${result.bytes} bytes)`);

  const deleted = pruneBackups({ dir: dirname(result.backupPath), keep });

  for (const name of deleted) {
    console.log(`Pruned old backup: ${name}`);
  }

  console.log(`Retained the newest ${keep} backup(s) in ${dirname(result.backupPath)}.`);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

export { parseBackupArgs };
