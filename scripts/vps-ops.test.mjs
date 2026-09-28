import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
  backupSqlite,
  defaultBackupFileName,
  pruneBackups,
  restoreSqlite,
  VpsOpsError,
} from "./lib/vps-ops.mjs";
import { applySqliteMigrations, createSqliteD1Database } from "../server/sqlite-d1.ts";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const tempDirs = [];

function makeTempDir() {
  const dir = mkdtempSync(join(tmpdir(), "starward-vps-ops-"));
  tempDirs.push(dir);
  return dir;
}

function closeQuietly(db) {
  try {
    db.close();
  } catch {
    // already closed
  }
}

function seedDatabase(path, labels = ["alpha", "beta"]) {
  const db = new DatabaseSync(path);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("CREATE TABLE items (id INTEGER PRIMARY KEY AUTOINCREMENT, label TEXT NOT NULL)");

  const insert = db.prepare("INSERT INTO items (label) VALUES (?)");

  for (const label of labels) {
    insert.run(label);
  }

  closeQuietly(db);
  return path;
}

function readLabels(path) {
  const db = new DatabaseSync(path, { readOnly: true });

  try {
    return db
      .prepare("SELECT label FROM items ORDER BY id")
      .all()
      .map((row) => row.label);
  } finally {
    closeQuietly(db);
  }
}

function countMigrations(path) {
  const db = new DatabaseSync(path);

  try {
    return Number(db.prepare("SELECT COUNT(*) AS count FROM d1_migrations").get().count);
  } finally {
    closeQuietly(db);
  }
}

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop(), { recursive: true, force: true });
  }
});

describe("defaultBackupFileName", () => {
  it("is a sortable, filesystem-safe SQLite file name", () => {
    const name = defaultBackupFileName(new Date("2026-09-29T02:37:05.123Z"));

    expect(name).toBe("starward-20260929T023705Z.sqlite");
    expect(name.endsWith(".sqlite")).toBe(true);
    expect(name).not.toMatch(/:/);
  });
});

describe("backupSqlite", () => {
  it("writes a consistent SQLite backup of a live WAL database", async () => {
    const dir = makeTempDir();
    const source = seedDatabase(join(dir, "live.sqlite"));
    const out = join(dir, "backups", "snapshot.sqlite");

    const result = await backupSqlite({ sqlitePath: source, outPath: out });

    expect(result.backupPath).toBe(resolve(out));
    expect(result.bytes).toBeGreaterThan(0);
    expect(existsSync(out)).toBe(true);
    expect(readFileSync(out).subarray(0, 16).toString("latin1")).toBe("SQLite format 3\u0000");
    expect(readLabels(out)).toEqual(["alpha", "beta"]);
    // The source is only read, never rewritten.
    expect(readLabels(source)).toEqual(["alpha", "beta"]);
  });

  it("refuses to back up a missing source instead of creating an empty database", async () => {
    const dir = makeTempDir();
    const missing = join(dir, "does-not-exist.sqlite");
    const out = join(dir, "backup.sqlite");

    await expect(backupSqlite({ sqlitePath: missing, outPath: out })).rejects.toBeInstanceOf(
      VpsOpsError,
    );
    await expect(backupSqlite({ sqlitePath: missing, outPath: out })).rejects.toThrow(
      /does not exist/i,
    );
    expect(existsSync(missing)).toBe(false);
    expect(existsSync(out)).toBe(false);
  });

  it("refuses to overwrite an existing backup file", async () => {
    const dir = makeTempDir();
    const source = seedDatabase(join(dir, "live.sqlite"));
    const out = join(dir, "backup.sqlite");
    writeFileSync(out, "already here");

    await expect(backupSqlite({ sqlitePath: source, outPath: out })).rejects.toThrow(
      /refusing to overwrite/i,
    );
    expect(readFileSync(out, "utf8")).toBe("already here");
  });

  it("refuses a source that is not a SQLite database", async () => {
    const dir = makeTempDir();
    const source = join(dir, "garbage.sqlite");
    writeFileSync(source, "definitely not sqlite");

    await expect(
      backupSqlite({ sqlitePath: source, outPath: join(dir, "backup.sqlite") }),
    ).rejects.toThrow(/valid SQLite/i);
  });
});

describe("restoreSqlite", () => {
  it("refuses a missing backup file", async () => {
    const dir = makeTempDir();
    const target = seedDatabase(join(dir, "live.sqlite"));

    await expect(
      restoreSqlite({
        backupPath: join(dir, "missing.sqlite"),
        sqlitePath: target,
        force: true,
      }),
    ).rejects.toThrow(/does not exist/i);
  });

  it("refuses a backup file that is not a valid SQLite database", async () => {
    const dir = makeTempDir();
    const target = seedDatabase(join(dir, "live.sqlite"));
    const invalid = join(dir, "invalid.sqlite");
    writeFileSync(invalid, "not a database");

    await expect(
      restoreSqlite({ backupPath: invalid, sqlitePath: target, force: true }),
    ).rejects.toThrow(/valid SQLite/i);
    // The live database is untouched.
    expect(readLabels(target)).toEqual(["alpha", "beta"]);
  });

  it("refuses to overwrite a live database without an explicit force flag", async () => {
    const dir = makeTempDir();
    const target = seedDatabase(join(dir, "live.sqlite"), ["live"]);
    const backup = join(dir, "backup.sqlite");
    await backupSqlite({
      sqlitePath: seedDatabase(join(dir, "source.sqlite"), ["restored"]),
      outPath: backup,
    });

    await expect(
      restoreSqlite({ backupPath: backup, sqlitePath: target, force: false }),
    ).rejects.toThrow(/refusing to overwrite/i);
    expect(readLabels(target)).toEqual(["live"]);
  });

  it("atomically replaces the database and keeps a pre-restore safety backup", async () => {
    const dir = makeTempDir();
    const target = seedDatabase(join(dir, "live.sqlite"), ["live"]);
    const backup = join(dir, "backup.sqlite");
    await backupSqlite({
      sqlitePath: seedDatabase(join(dir, "source.sqlite"), ["restored", "newer"]),
      outPath: backup,
    });

    const result = await restoreSqlite({ backupPath: backup, sqlitePath: target, force: true });

    expect(readLabels(target)).toEqual(["restored", "newer"]);
    expect(result.safetyBackupPath).toBeTruthy();
    expect(readLabels(result.safetyBackupPath)).toEqual(["live"]);
  });

  it("restores into a fresh path without a force flag", async () => {
    const dir = makeTempDir();
    const backup = join(dir, "backup.sqlite");
    await backupSqlite({
      sqlitePath: seedDatabase(join(dir, "source.sqlite"), ["only"]),
      outPath: backup,
    });
    const target = join(dir, "fresh", "starward.sqlite");

    const result = await restoreSqlite({ backupPath: backup, sqlitePath: target });

    expect(result.safetyBackupPath).toBeNull();
    expect(readLabels(target)).toEqual(["only"]);
  });

  it("refuses to restore a backup onto itself", async () => {
    const dir = makeTempDir();
    const backup = join(dir, "backup.sqlite");
    await backupSqlite({
      sqlitePath: seedDatabase(join(dir, "source.sqlite")),
      outPath: backup,
    });

    await expect(
      restoreSqlite({ backupPath: backup, sqlitePath: backup, force: true }),
    ).rejects.toThrow(/same file/i);
  });
});

describe("pruneBackups", () => {
  it("keeps the newest N backups and deletes only older matching files", () => {
    const dir = makeTempDir();
    const names = [
      "starward-20260101T000000Z.sqlite",
      "starward-20260102T000000Z.sqlite",
      "starward-20260103T000000Z.sqlite",
      "starward-20260104T000000Z.sqlite",
    ];

    for (const name of names) {
      writeFileSync(join(dir, name), "x");
    }

    writeFileSync(join(dir, "unrelated.txt"), "keep me");

    const deleted = pruneBackups({ dir, keep: 2 });

    expect(deleted).toEqual([
      "starward-20260101T000000Z.sqlite",
      "starward-20260102T000000Z.sqlite",
    ]);
    expect(existsSync(join(dir, "starward-20260103T000000Z.sqlite"))).toBe(true);
    expect(existsSync(join(dir, "starward-20260104T000000Z.sqlite"))).toBe(true);
    expect(existsSync(join(dir, "unrelated.txt"))).toBe(true);
  });

  it("deletes nothing when the retention count is not exceeded", () => {
    const dir = makeTempDir();
    writeFileSync(join(dir, "starward-20260101T000000Z.sqlite"), "x");

    expect(pruneBackups({ dir, keep: 5 })).toEqual([]);
  });
});

describe("migration command behavior", () => {
  it("applies migrations once and is idempotent on a second run", async () => {
    const dir = makeTempDir();
    const sqlitePath = join(dir, "migrate.sqlite");
    const migrationsDir = join(repoRoot, "migrations");
    const db = createSqliteD1Database(sqlitePath);
    try {
      const first = await applySqliteMigrations(db, migrationsDir);
      const second = await applySqliteMigrations(db, migrationsDir);
      expect(first.length).toBeGreaterThan(0);
      expect(second).toEqual([]);
      expect(countMigrations(sqlitePath)).toBe(first.length);
    } finally {
      db.close();
    }
  });
});

describe("missing migrations directory", () => {
  it("fails loudly instead of reporting success", async () => {
    const dir = makeTempDir();
    const sqlitePath = join(dir, "migrate.sqlite");
    const db = createSqliteD1Database(sqlitePath);
    try {
      await expect(applySqliteMigrations(db, join(dir, "no-such-migrations"))).rejects.toThrow(
        /no such file|ENOENT/i,
      );
    } finally {
      db.close();
    }
  });
});

describe("backup directory helper", () => {
  it("creates a parent directory for nested backup output", async () => {
    const dir = makeTempDir();
    const source = seedDatabase(join(dir, "live.sqlite"));
    const nested = join(dir, "a", "b", "c", "backup.sqlite");
    mkdirSync(join(dir, "a"), { recursive: true });

    await backupSqlite({ sqlitePath: source, outPath: nested });

    expect(existsSync(nested)).toBe(true);
  });
});
