import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createKyselyAdapter } from "@better-auth/kysely-adapter";
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

  it("reports real changes and row id when mutations run through all()", async () => {
    const db = createMemoryDb();

    await db.exec(`CREATE TABLE autos (id INTEGER PRIMARY KEY AUTOINCREMENT, value TEXT NOT NULL);`);

    const inserted = await db.prepare(`INSERT INTO autos (value) VALUES (?)`).bind("one").all();
    expect(inserted.success).toBe(true);
    expect(inserted.results).toEqual([]);
    expect(inserted.meta.changes).toBe(1);
    expect(Number(inserted.meta.last_row_id)).toBe(1);

    const updated = await db
      .prepare(`UPDATE autos SET value = ? WHERE value = ?`)
      .bind("uno", "one")
      .all();
    expect(updated.results).toEqual([]);
    expect(updated.meta.changes).toBe(1);

    const deleted = await db.prepare(`DELETE FROM autos WHERE value = ?`).bind("uno").all();
    expect(deleted.results).toEqual([]);
    expect(deleted.meta.changes).toBe(1);

    const deletedNothing = await db.prepare(`DELETE FROM autos WHERE value = ?`).bind("nope").all();
    expect(deletedNothing.meta.changes).toBe(0);

    const remaining = await db.prepare(`SELECT COUNT(*) AS count FROM autos`).first<{ count: number }>();
    expect(Number(remaining?.count)).toBe(0);
  });

  it("reports real changes and row id for RETURNING mutations run through all()", async () => {
    const db = createMemoryDb();

    await db.exec(`CREATE TABLE autos (id INTEGER PRIMARY KEY AUTOINCREMENT, value TEXT NOT NULL);`);

    const inserted = await db
      .prepare(`INSERT INTO autos (value) VALUES (?) RETURNING id, value`)
      .bind("one")
      .all<{ id: number; value: string }>();
    expect(inserted.results).toEqual([{ id: 1, value: "one" }]);
    expect(inserted.meta.changes).toBe(1);
    expect(Number(inserted.meta.last_row_id)).toBe(1);

    const updated = await db
      .prepare(`UPDATE autos SET value = ? WHERE id = ? RETURNING value`)
      .bind("uno", 1)
      .all<{ value: string }>();
    expect(updated.results).toEqual([{ value: "uno" }]);
    expect(updated.meta.changes).toBe(1);

    const deleted = await db
      .prepare(`DELETE FROM autos WHERE id = ? RETURNING id`)
      .bind(1)
      .all<{ id: number }>();
    expect(deleted.results).toEqual([{ id: 1 }]);
    expect(deleted.meta.changes).toBe(1);
  });

  it("keeps read-only statements reporting zero changes through all()", async () => {
    const db = createMemoryDb();

    await db.exec(`CREATE TABLE items (id TEXT PRIMARY KEY, value TEXT NOT NULL);`);
    await db.prepare(`INSERT INTO items (id, value) VALUES (?, ?)`).bind("a", "one").run();

    const rows = await db.prepare(`SELECT id, value FROM items`).all<{ id: string; value: string }>();
    expect(rows.results).toEqual([{ id: "a", value: "one" }]);
    expect(rows.meta.changes).toBe(0);
    expect(rows.meta.last_row_id).toBe(0);
  });

  it("exposes affected-row metadata to the Better Auth D1 Kysely dialect", async () => {
    const db = createMemoryDb();

    await db.exec(`CREATE TABLE autos (id INTEGER PRIMARY KEY AUTOINCREMENT, value TEXT NOT NULL);`);

    const { kysely, databaseType } = await createKyselyAdapter({ database: db });
    expect(databaseType).toBe("sqlite");
    expect(kysely).not.toBeNull();

    if (!kysely) {
      return;
    }

    const inserted = await kysely.insertInto("autos").values({ value: "one" }).executeTakeFirst();
    expect(Number(inserted.insertId)).toBe(1);

    const updated = await kysely
      .updateTable("autos")
      .set({ value: "uno" })
      .where("id", "=", 1)
      .executeTakeFirst();
    expect(Number(updated.numUpdatedRows)).toBe(1);

    const selected = await kysely.selectFrom("autos").selectAll().execute();
    expect(selected).toEqual([{ id: 1, value: "uno" }]);

    const deleted = await kysely.deleteFrom("autos").where("id", "=", 1).executeTakeFirst();
    expect(Number(deleted.numDeletedRows)).toBe(1);
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

  it("preserves rows and metadata for result-returning statements in a batch", async () => {
    const db = createMemoryDb();

    await db.exec(`CREATE TABLE items (id TEXT PRIMARY KEY, qty INTEGER NOT NULL);`);
    await db.prepare(`INSERT INTO items (id, qty) VALUES (?, ?)`).bind("a", 1).run();
    await db.prepare(`INSERT INTO items (id, qty) VALUES (?, ?)`).bind("b", 2).run();

    const results = await db.batch([
      db.prepare(`INSERT INTO items (id, qty) VALUES (?, ?)`).bind("c", 3),
      db.prepare(`SELECT id, qty FROM items ORDER BY id`),
      db.prepare(`UPDATE items SET qty = ? WHERE id = ?`).bind(9, "a"),
    ]);

    expect(results).toHaveLength(3);
    expect(results[0]?.results).toEqual([]);
    expect(results[0]?.meta.changes).toBe(1);

    expect(results[1]?.results).toEqual([
      { id: "a", qty: 1 },
      { id: "b", qty: 2 },
      { id: "c", qty: 3 },
    ]);
    expect(results[1]?.meta.changes).toBe(0);

    expect(results[2]?.results).toEqual([]);
    expect(results[2]?.meta.changes).toBe(1);
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
