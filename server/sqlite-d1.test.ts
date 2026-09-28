import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
  applySqliteMigrations,
  createSqliteD1Database,
  type SqliteD1Database,
} from "./sqlite-d1";

const REPO_MIGRATIONS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..", "migrations");
const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "starward-sqlite-test-"));
  tempDirs.push(dir);
  return dir;
}

function createMemoryDb(): SqliteD1Database {
  return createSqliteD1Database(":memory:");
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();

    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("createSqliteD1Database", () => {
  it("binds positional parameters and returns D1-shaped first/all/run results", async () => {
    const db = createMemoryDb();

    await db.exec(`
      CREATE TABLE items (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        qty INTEGER NOT NULL,
        created_at TEXT NOT NULL
      );
    `);

    const inserted = await db
      .prepare(`INSERT INTO items (id, name, qty, created_at) VALUES (?, ?, ?, ?)`)
      .bind("a", "Alpha", 1, "2026-01-01T00:00:00.000Z")
      .run();

    expect(inserted.success).toBe(true);
    expect(inserted.meta.changes).toBe(1);
    expect(inserted.results).toEqual([]);

    const row = await db
      .prepare(`SELECT id, name, qty FROM items WHERE id = ?`)
      .bind("a")
      .first<{ id: string; name: string; qty: number }>();

    expect(row).toEqual({ id: "a", name: "Alpha", qty: 1 });

    const missing = await db.prepare(`SELECT id FROM items WHERE id = ?`).bind("nope").first();
    expect(missing).toBeNull();

    const all = await db
      .prepare(`SELECT id, name FROM items ORDER BY id`)
      .all<{ id: string; name: string }>();

    expect(all.success).toBe(true);
    expect(all.results).toEqual([{ id: "a", name: "Alpha" }]);
    expect(all.meta.changes).toBe(0);
    expect(all.meta.last_row_id).toBe(0);
  });

  it("supports numbered ?N placeholders with skipped indices like the data layer uses", async () => {
    const db = createMemoryDb();

    await db.exec(`CREATE TABLE segments (id TEXT PRIMARY KEY, a TEXT, b TEXT, note TEXT);`);

    await db
      .prepare(`INSERT INTO segments (id, a, b, note) VALUES (?1, ?2, ?3, ?6)`)
      .bind("s1", "alpha", "beta", "unused-4", "unused-5", "noted")
      .run();

    const row = await db
      .prepare(`SELECT a, b, note FROM segments WHERE id = ?1`)
      .bind("s1")
      .first<{ a: string; b: string; note: string }>();

    expect(row).toEqual({ a: "alpha", b: "beta", note: "noted" });
  });

  it("supports named parameter binding objects", async () => {
    const db = createMemoryDb();

    await db.exec(`CREATE TABLE items (id TEXT PRIMARY KEY, name TEXT NOT NULL);`);

    await db
      .prepare(`INSERT INTO items (id, name) VALUES (:id, :name)`)
      .bind({ id: "n1", name: "Colon" })
      .run();
    await db
      .prepare(`INSERT INTO items (id, name) VALUES (@id, @name)`)
      .bind({ id: "n2", name: "At" })
      .run();

    const row = await db
      .prepare(`SELECT name FROM items WHERE id = :id`)
      .bind({ id: "n1" })
      .first<{ name: string }>();

    expect(row).toEqual({ name: "Colon" });

    const rows = await db.prepare(`SELECT id FROM items ORDER BY id`).all<{ id: string }>();
    expect(rows.results).toEqual([{ id: "n1" }, { id: "n2" }]);
  });

  it("normalizes boolean and binary bind values like D1", async () => {
    const db = createMemoryDb();

    await db.exec(`CREATE TABLE flags (id TEXT PRIMARY KEY, enabled INTEGER NOT NULL, payload BLOB);`);

    await db
      .prepare(`INSERT INTO flags (id, enabled, payload) VALUES (?, ?, ?)`)
      .bind("f1", true, new Uint8Array([1, 2, 3]).buffer)
      .run();

    const row = await db
      .prepare(`SELECT enabled, payload FROM flags WHERE id = ?`)
      .bind("f1")
      .first<{ enabled: number; payload: Uint8Array }>();

    expect(row?.enabled).toBe(1);
    expect(Array.from(row?.payload ?? [])).toEqual([1, 2, 3]);
  });

  it("reports the inserted row id from run() metadata", async () => {
    const db = createMemoryDb();

    await db.exec(`CREATE TABLE auto (id INTEGER PRIMARY KEY AUTOINCREMENT, value TEXT NOT NULL);`);

    const first = await db.prepare(`INSERT INTO auto (value) VALUES (?)`).bind("one").run();
    const second = await db.prepare(`INSERT INTO auto (value) VALUES (?)`).bind("two").run();

    expect(Number(first.meta.last_row_id)).toBe(1);
    expect(Number(second.meta.last_row_id)).toBe(2);
  });

  it("enforces foreign keys", async () => {
    const db = createMemoryDb();

    await db.exec(`
      CREATE TABLE parent (id TEXT PRIMARY KEY);
      CREATE TABLE child (
        id TEXT PRIMARY KEY,
        parent_id TEXT NOT NULL REFERENCES parent(id)
      );
    `);

    await expect(
      db.prepare(`INSERT INTO child (id, parent_id) VALUES (?, ?)`).bind("child-1", "missing").run(),
    ).rejects.toThrow();
  });

  it("enables WAL for file-backed databases", async () => {
    const dir = makeTempDir();
    const db = createSqliteD1Database(join(dir, "starward.sqlite"));

    const mode = await db.prepare(`PRAGMA journal_mode`).first<{ journal_mode: string }>();

    expect(String(mode?.journal_mode).toLowerCase()).toBe("wal");
    db.close();
  });
});

describe("batch", () => {
  it("runs every statement in order and returns each result", async () => {
    const db = createMemoryDb();

    await db.exec(`CREATE TABLE counter (id INTEGER PRIMARY KEY AUTOINCREMENT, value TEXT NOT NULL);`);

    const results = await db.batch([
      db.prepare(`INSERT INTO counter (value) VALUES (?)`).bind("one"),
      db.prepare(`INSERT INTO counter (value) VALUES (?)`).bind("two"),
      db.prepare(`UPDATE counter SET value = ? WHERE value = ?`).bind("uno", "one"),
    ]);

    expect(results).toHaveLength(3);
    expect(Number(results[0]?.meta.last_row_id)).toBe(1);
    expect(Number(results[1]?.meta.last_row_id)).toBe(2);
    expect(Number(results[2]?.meta.changes)).toBe(1);

    const rows = await db.prepare(`SELECT value FROM counter ORDER BY id`).all<{ value: string }>();
    expect(rows.results).toEqual([{ value: "uno" }, { value: "two" }]);
  });

  it("rolls back every statement when any statement fails", async () => {
    const db = createMemoryDb();

    await db.exec(`CREATE TABLE unique_items (id TEXT PRIMARY KEY, value TEXT NOT NULL);`);
    await db
      .prepare(`INSERT INTO unique_items (id, value) VALUES (?, ?)`)
      .bind("existing", "keep")
      .run();

    await expect(
      db.batch([
        db.prepare(`INSERT INTO unique_items (id, value) VALUES (?, ?)`).bind("new", "rolled-back"),
        db.prepare(`INSERT INTO unique_items (id, value) VALUES (?, ?)`).bind("existing", "duplicate"),
      ]),
    ).rejects.toThrow();

    const rows = await db.prepare(`SELECT id FROM unique_items ORDER BY id`).all<{ id: string }>();
    expect(rows.results).toEqual([{ id: "existing" }]);
  });

  it("leaves the connection usable after a rolled-back batch", async () => {
    const db = createMemoryDb();

    await db.exec(`CREATE TABLE unique_items (id TEXT PRIMARY KEY, value TEXT NOT NULL);`);

    await expect(
      db.batch([
        db.prepare(`INSERT INTO unique_items (id, value) VALUES (?, ?)`).bind("a", "a"),
        db.prepare(`INSERT INTO unique_items (id, value) VALUES (?, ?)`).bind("a", "duplicate"),
      ]),
    ).rejects.toThrow();

    await db.prepare(`INSERT INTO unique_items (id, value) VALUES (?, ?)`).bind("b", "b").run();

    const rows = await db.prepare(`SELECT id FROM unique_items ORDER BY id`).all<{ id: string }>();
    expect(rows.results).toEqual([{ id: "b" }]);
  });
});

describe("applySqliteMigrations", () => {
  it("applies numbered migrations exactly once and records them", async () => {
    const dir = makeTempDir();
    writeFileSync(join(dir, "0001_create.sql"), `CREATE TABLE widgets (id TEXT PRIMARY KEY, name TEXT NOT NULL);`);
    writeFileSync(join(dir, "0002_seed.sql"), `INSERT INTO widgets (id, name) VALUES ('w1', 'Widget');`);

    const db = createMemoryDb();

    expect(await applySqliteMigrations(db, dir)).toEqual(["0001_create.sql", "0002_seed.sql"]);
    expect(await applySqliteMigrations(db, dir)).toEqual([]);

    const rows = await db.prepare(`SELECT id, name FROM widgets`).all<{ id: string; name: string }>();
    expect(rows.results).toEqual([{ id: "w1", name: "Widget" }]);

    const applied = await db
      .prepare(`SELECT name FROM d1_migrations ORDER BY name`)
      .all<{ name: string }>();
    expect(applied.results).toEqual([{ name: "0001_create.sql" }, { name: "0002_seed.sql" }]);
  });

  it("ignores non-numbered files", async () => {
    const dir = makeTempDir();
    writeFileSync(join(dir, "README.md"), "not a migration");
    writeFileSync(join(dir, "0001_create.sql"), `CREATE TABLE widgets (id TEXT PRIMARY KEY);`);

    const db = createMemoryDb();

    expect(await applySqliteMigrations(db, dir)).toEqual(["0001_create.sql"]);
  });

  it("recognizes migration rows created by Wrangler's local D1 runner", async () => {
    const dir = makeTempDir();
    writeFileSync(join(dir, "0001_create.sql"), `CREATE TABLE widgets (id TEXT PRIMARY KEY);`);
    writeFileSync(join(dir, "0002_seed.sql"), `INSERT INTO widgets (id) VALUES ('w1');`);

    const db = createMemoryDb();
    await db.exec(`CREATE TABLE widgets (id TEXT PRIMARY KEY);`);
    // Wrangler's exact DDL and insert shape: only `name` is provided.
    await db.exec(`
      CREATE TABLE d1_migrations(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
    `);
    await db.prepare(`INSERT INTO d1_migrations (name) VALUES (?)`).bind("0001_create.sql").run();

    expect(await applySqliteMigrations(db, dir)).toEqual(["0002_seed.sql"]);

    const widgets = await db.prepare(`SELECT id FROM widgets`).all<{ id: string }>();
    expect(widgets.results).toEqual([{ id: "w1" }]);
  });

  it("rolls back a failing migration without recording it", async () => {
    const dir = makeTempDir();
    writeFileSync(join(dir, "0001_create.sql"), `CREATE TABLE widgets (id TEXT PRIMARY KEY);`);
    writeFileSync(
      join(dir, "0002_bad.sql"),
      `CREATE TABLE half_applied (id TEXT PRIMARY KEY);\nINSERT INTO missing_table (id) VALUES ('x');`,
    );

    const db = createMemoryDb();

    await expect(applySqliteMigrations(db, dir)).rejects.toThrow();

    const applied = await db
      .prepare(`SELECT name FROM d1_migrations ORDER BY name`)
      .all<{ name: string }>();
    expect(applied.results).toEqual([{ name: "0001_create.sql" }]);

    const orphan = await db
      .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'half_applied'`)
      .all();
    expect(orphan.results).toEqual([]);
  });

  it("applies the repository migrations to SQLite and is idempotent", async () => {
    const db = createMemoryDb();

    const applied = await applySqliteMigrations(db, REPO_MIGRATIONS_DIR);

    expect(applied.length).toBeGreaterThanOrEqual(11);

    const tables = await db
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'table'
           AND name IN ('d1_migrations', 'participants', 'project_drafts', 'schedule_segments')
         ORDER BY name`,
      )
      .all<{ name: string }>();

    expect(tables.results.map((row) => row.name)).toEqual([
      "d1_migrations",
      "participants",
      "project_drafts",
      "schedule_segments",
    ]);

    const foreignKeys = await db.prepare(`PRAGMA foreign_keys`).first<{ foreign_keys: number }>();
    expect(Number(foreignKeys?.foreign_keys)).toBe(1);

    expect(await applySqliteMigrations(db, REPO_MIGRATIONS_DIR)).toEqual([]);
  });
});
