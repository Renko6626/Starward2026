import {
  closeSync,
  copyFileSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readdirSync,
  readSync,
  renameSync,
  rmSync,
  statSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { DEFAULT_SQLITE_PATH } from "../../server/env.ts";

/**
 * SQLite-safe operational helpers shared by the VPS backup/restore CLIs.
 *
 * Backups use `VACUUM INTO`, which SQLite documents as a safe online backup:
 * it reads a consistent snapshot through the WAL and writes a fresh database
 * file without locking or mutating the source. Restores validate the source,
 * require an explicit `--force` before replacing an existing database, snapshot
 * the current database first, and replace the file atomically.
 */

const SQLITE_HEADER = Buffer.from("SQLite format 3\u0000", "latin1");
const BACKUP_PREFIX = "starward-";
const BACKUP_SUFFIX = ".sqlite";
const DEFAULT_BACKUP_DIR = "./backups";
export const DEFAULT_BACKUP_KEEP = 14;

export class VpsOpsError extends Error {
  constructor(message) {
    super(message);
    this.name = "VpsOpsError";
  }
}

/** Resolve the configured SQLite database path (absolute). */
export function resolveSqlitePath(env = process.env) {
  return resolve(env.SQLITE_PATH?.trim() || DEFAULT_SQLITE_PATH);
}

/** Resolve the configured backup directory (absolute). */
export function resolveBackupDir(env = process.env) {
  return resolve(env.BACKUP_DIR?.trim() || DEFAULT_BACKUP_DIR);
}

function utcStamp(date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

/** Sortable, filesystem-safe backup file name, e.g. `starward-20260929T023705Z.sqlite`. */
export function defaultBackupFileName(date = new Date()) {
  return `${BACKUP_PREFIX}${utcStamp(date)}${BACKUP_SUFFIX}`;
}

function hasSqliteHeader(path) {
  let fd;

  try {
    fd = openSync(path, "r");
    const header = Buffer.alloc(SQLITE_HEADER.length);
    const bytesRead = readSync(fd, header, 0, header.length, 0);
    return bytesRead === header.length && header.equals(SQLITE_HEADER);
  } catch {
    return false;
  } finally {
    if (fd !== undefined) {
      closeSync(fd);
    }
  }
}

function escapeSqlString(value) {
  return value.replace(/'/g, "''");
}

function fsyncFile(path) {
  const fd = openSync(path, "r+");

  try {
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}

/** Refuse to operate on a missing or non-SQLite source database. */
export function assertSourceDatabase(sqlitePath) {
  const resolved = resolve(sqlitePath);

  if (!existsSync(resolved)) {
    throw new VpsOpsError(`SQLite source does not exist: ${resolved}`);
  }

  if (!statSync(resolved).isFile()) {
    throw new VpsOpsError(`SQLite source is not a file: ${resolved}`);
  }

  if (!hasSqliteHeader(resolved)) {
    throw new VpsOpsError(`Not a valid SQLite database: ${resolved}`);
  }

  return resolved;
}

/** Refuse a missing, non-file, malformed, or corrupt SQLite backup. */
export function assertValidSqliteBackup(backupPath) {
  const resolved = resolve(backupPath);

  if (!existsSync(resolved)) {
    throw new VpsOpsError(`Backup file does not exist: ${resolved}`);
  }

  if (!statSync(resolved).isFile()) {
    throw new VpsOpsError(`Backup path is not a file: ${resolved}`);
  }

  if (!hasSqliteHeader(resolved)) {
    throw new VpsOpsError(`Not a valid SQLite database: ${resolved}`);
  }

  let db;

  try {
    db = new DatabaseSync(resolved, { readOnly: true });
    const row = db.prepare("PRAGMA integrity_check").get();
    const result = row?.integrity_check;

    if (result !== "ok") {
      throw new VpsOpsError(`SQLite integrity check failed for ${resolved}: ${result}`);
    }
  } catch (error) {
    if (error instanceof VpsOpsError) {
      throw error;
    }

    throw new VpsOpsError(
      `Not a valid SQLite database: ${resolved} (${
        error instanceof Error ? error.message : String(error)
      })`,
    );
  } finally {
    if (db !== undefined) {
      try {
        db.close();
      } catch {
        // already closed
      }
    }
  }

  return resolved;
}

/**
 * Write a consistent online backup of `sqlitePath` to `outPath`.
 *
 * Refuses a missing/invalid source and never overwrites an existing backup.
 */
export async function backupSqlite({ sqlitePath, outPath }) {
  const source = assertSourceDatabase(sqlitePath);
  const destination = resolve(outPath);

  if (source === destination) {
    throw new VpsOpsError(`Backup destination is the same file as the source: ${destination}`);
  }

  if (existsSync(destination)) {
    throw new VpsOpsError(`Refusing to overwrite existing backup: ${destination}`);
  }

  mkdirSync(dirname(destination), { recursive: true });

  let db;

  try {
    db = new DatabaseSync(source);
    db.exec(`VACUUM INTO '${escapeSqlString(destination)}'`);
  } catch (error) {
    rmSync(destination, { force: true });
    throw new VpsOpsError(
      `Failed to back up ${source}: ${error instanceof Error ? error.message : String(error)}`,
    );
  } finally {
    if (db !== undefined) {
      try {
        db.close();
      } catch {
        // already closed
      }
    }
  }

  assertValidSqliteBackup(destination);

  return { backupPath: destination, bytes: statSync(destination).size };
}

/**
 * Restore `backupPath` over `sqlitePath`.
 *
 * Refuses a missing/invalid backup, refuses to replace an existing database
 * unless `force` is set, snapshots the current database before replacing it
 * (unless `safetyBackup` is false), then replaces the file atomically. Stale
 * `-wal`/`-shm` members from the replaced database are removed so SQLite cannot
 * replay an old log over the new file.
 */
export async function restoreSqlite({
  backupPath,
  sqlitePath,
  force = false,
  safetyBackup = true,
}) {
  const source = assertValidSqliteBackup(backupPath);
  const target = resolve(sqlitePath);

  if (source === target) {
    throw new VpsOpsError(`Backup and restore target are the same file: ${target}`);
  }

  const targetExists = existsSync(target);

  if (targetExists && !statSync(target).isFile()) {
    throw new VpsOpsError(`Restore target is not a file: ${target}`);
  }

  if (targetExists && !force) {
    throw new VpsOpsError(
      `Refusing to overwrite existing database at ${target}; re-run with --force to restore.`,
    );
  }

  let safetyBackupPath = null;

  if (targetExists && safetyBackup) {
    safetyBackupPath = `${target}.pre-restore-${utcStamp(new Date())}.sqlite`;

    // Fails closed: if the current database cannot be snapshotted, do not
    // proceed with the destructive restore.
    await backupSqlite({ sqlitePath: target, outPath: safetyBackupPath });
  }

  mkdirSync(dirname(target), { recursive: true });

  const tempPath = `${target}.restore-${process.pid}.tmp`;
  rmSync(tempPath, { force: true });
  copyFileSync(source, tempPath);
  fsyncFile(tempPath);

  rmSync(`${target}-wal`, { force: true });
  rmSync(`${target}-shm`, { force: true });
  renameSync(tempPath, target);

  // Verify the restored file before declaring success.
  assertValidSqliteBackup(target);

  return { sqlitePath: target, safetyBackupPath };
}

/** Delete all but the newest `keep` backups in `dir`. Returns deleted names. */
export function pruneBackups({ dir, keep, prefix = BACKUP_PREFIX }) {
  if (!Number.isInteger(keep) || keep < 0) {
    throw new VpsOpsError("Backup retention count must be a non-negative integer.");
  }

  const resolvedDir = resolve(dir);

  if (!existsSync(resolvedDir)) {
    return [];
  }

  const files = readdirSync(resolvedDir, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isFile() && entry.name.startsWith(prefix) && entry.name.endsWith(BACKUP_SUFFIX),
    )
    .map((entry) => entry.name)
    .sort();

  const excess = files.length - keep;

  if (excess <= 0) {
    return [];
  }

  const doomed = files.slice(0, excess);

  for (const name of doomed) {
    rmSync(join(resolvedDir, name), { force: true });
  }

  return doomed;
}
