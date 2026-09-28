import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

/**
 * Values that `node:sqlite` can bind to a statement. D1 accepts booleans and
 * binary payloads as well, so the adapter normalizes those before binding.
 */
type SqliteBindValue = null | number | bigint | string | Uint8Array;

/**
 * SQLite D1 facade returned by {@link createSqliteD1Database}.
 *
 * The repository only consumes the D1 subset (`prepare`/`bind`/`first`/`all`/
 * `run`/`batch`); `close` is added so Node callers can release the file handle.
 */
export type SqliteD1Database = D1Database & {
  close(): void;
};

/**
 * Migration bookkeeping table. The DDL matches Wrangler's local D1 schema so a
 * local `.sqlite` file can move between both migration runners: Wrangler also
 * inserts only `name` and relies on the `applied_at` default.
 */
const MIGRATIONS_TABLE = "d1_migrations";

/**
 * Open a `node:sqlite` database and expose it through the D1 database
 * interface used by `worker/data/*`.
 *
 * Foreign keys are enforced and WAL journaling is requested for file-backed
 * databases (`:memory:` ignores WAL, which SQLite reports as `memory`).
 */
export function createSqliteD1Database(path: string): SqliteD1Database {
  const database = new DatabaseSync(path);

  database.exec("PRAGMA foreign_keys = ON");
  database.exec("PRAGMA journal_mode = WAL");

  return new SqliteD1DatabaseFacade(database) as unknown as SqliteD1Database;
}

/**
 * Apply every numbered `*.sql` migration in `migrationsDir` exactly once.
 *
 * Each pending file runs inside its own transaction together with its
 * `d1_migrations` record, so a failing migration leaves neither partial schema
 * nor a bookkeeping row. Foreign keys are disabled for the duration because the
 * repository migrations rebuild tables that are referenced by other tables.
 *
 * @returns the file names that were applied by this call (empty when current).
 */
export async function applySqliteMigrations(
  db: D1Database,
  migrationsDir: string,
): Promise<string[]> {
  await db.exec(
    `CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       name TEXT UNIQUE,
       applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
     )`,
  );

  const appliedRows = await db.prepare(`SELECT name FROM ${MIGRATIONS_TABLE}`).all<{ name: string }>();
  const appliedNames = new Set(appliedRows.results.map((row) => row.name));

  const pending = readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /^\d+.*\.sql$/i.test(entry.name))
    .map((entry) => entry.name)
    .sort()
    .filter((file) => !appliedNames.has(file));

  if (pending.length === 0) {
    return [];
  }

  await db.exec("PRAGMA foreign_keys = OFF");

  try {
    for (const file of pending) {
      const sql = readFileSync(join(migrationsDir, file), "utf8");

      await db.exec("BEGIN IMMEDIATE");

      try {
        await db.exec(sql);
        await db
          .prepare(`INSERT INTO ${MIGRATIONS_TABLE} (name) VALUES (?)`)
          .bind(file)
          .run();
        await db.exec("COMMIT");
      } catch (error) {
        await db.exec("ROLLBACK");
        throw error;
      }
    }
  } finally {
    await db.exec("PRAGMA foreign_keys = ON");
  }

  return pending;
}

class SqliteD1DatabaseFacade {
  private readonly database: DatabaseSync;

  constructor(database: DatabaseSync) {
    this.database = database;
  }

  prepare(query: string): SqlitePreparedStatement {
    return new SqlitePreparedStatement(this.database, query);
  }

  async batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
    this.database.exec("BEGIN IMMEDIATE");

    try {
      const results = statements.map((statement) =>
        (statement as unknown as SqlitePreparedStatement).runSync<T>(),
      );

      this.database.exec("COMMIT");
      return results;
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }

  async exec(query: string): Promise<D1ExecResult> {
    const startedAt = performance.now();

    this.database.exec(query);

    return {
      count: countStatements(query),
      duration: performance.now() - startedAt,
    };
  }

  close(): void {
    this.database.close();
  }
}

class SqlitePreparedStatement {
  private readonly database: DatabaseSync;
  private readonly sql: string;
  private readonly params: unknown[];

  constructor(database: DatabaseSync, sql: string, params: unknown[] = []) {
    this.database = database;
    this.sql = sql;
    this.params = params;
  }

  bind(...values: unknown[]): SqlitePreparedStatement {
    return new SqlitePreparedStatement(this.database, this.sql, values);
  }

  async first<T = Record<string, unknown>>(colName?: string): Promise<T | null> {
    const prepared = this.database.prepare(this.sql);
    const row = prepared.get(...this.boundArguments()) as Record<string, unknown> | undefined;

    if (row === undefined) {
      return null;
    }

    if (colName !== undefined) {
      return (row[colName] as T | undefined) ?? null;
    }

    return toPlainRow<T>(row);
  }

  async all<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    const resolved = this.resolveSync<T>();

    return {
      success: true,
      results: resolved.results,
      meta: buildMeta(resolved),
    };
  }

  async run<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    const resolved = this.resolveSync<T>();

    return {
      success: true,
      results: [],
      meta: buildMeta(resolved),
    };
  }

  /** Synchronous form used by {@link SqliteD1DatabaseFacade.batch}. */
  runSync<T = Record<string, unknown>>(): D1Result<T> {
    const resolved = this.resolveSync<T>();

    return {
      success: true,
      results: resolved.results,
      meta: buildMeta(resolved),
    };
  }

  /**
   * Single routing point shared by `all()`, `run()`, and `batch()`.
   *
   * D1 routes every statement through `all()` (Better Auth's D1 Kysely dialect
   * relies on that), so result-returning writes such as `... RETURNING` must
   * report the same affected-row metadata `run()` reports for plain writes.
   * `StatementSync.columns()` is empty exactly when a statement returns no
   * rows, which splits non-RETURNING writes from reads and `RETURNING` writes.
   */
  private resolveSync<T>(): {
    results: T[];
    changes: number;
    lastRowId: number;
    rowsRead: number;
    durationMs: number;
  } {
    const startedAt = performance.now();
    const prepared = this.database.prepare(this.sql);
    const args = this.boundArguments();
    const columns = prepared.columns();

    if (columns.length === 0) {
      const result = prepared.run(...args);
      const changes = Number(result.changes ?? 0);

      return {
        results: [],
        changes,
        lastRowId: Number(result.lastInsertRowid ?? 0),
        rowsRead: 0,
        durationMs: performance.now() - startedAt,
      };
    }

    const rows = prepared.all(...args) as Record<string, unknown>[];
    const results = rows.map((row) => toPlainRow<T>(row));
    const durationMs = performance.now() - startedAt;

    if (!isWriteStatement(this.sql)) {
      return { results, changes: 0, lastRowId: 0, rowsRead: rows.length, durationMs };
    }

    // A RETURNING mutation returns rows, but SQLite's per-statement change
    // counters remain the source of truth for D1's `meta` fields.
    const counters = this.database
      .prepare(`SELECT changes() AS changes, last_insert_rowid() AS last_row_id`)
      .get() as { changes: number; last_row_id: number };

    return {
      results,
      changes: Number(counters.changes ?? 0),
      lastRowId: Number(counters.last_row_id ?? 0),
      rowsRead: rows.length,
      durationMs,
    };
  }

  private boundArguments(): any[] {
    if (this.params.length === 1 && isNamedBinding(this.params[0])) {
      return [normalizeNamedBindings(this.params[0])];
    }

    return this.params.map(normalizeBindValue);
  }
}

/**
 * True when the SQL is a top-level DML statement (`INSERT`/`UPDATE`/`DELETE`/
 * `REPLACE`). Only result-returning statements reach this check, so it exists
 * to let `RETURNING` mutations surface SQLite's change counters while plain
 * reads keep reporting zero. The repository and Better Auth compile top-level
 * DML directly, so a leading-keyword check is sufficient.
 */
function isWriteStatement(sql: string): boolean {
  let statement = sql;

  for (;;) {
    const leadingComment = /^\s*(?:--[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/)/.exec(statement);

    if (!leadingComment) {
      break;
    }

    statement = statement.slice(leadingComment[0].length);
  }

  return /^\s*(insert|update|delete|replace)\b/i.test(statement);
}

function isNamedBinding(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    !ArrayBuffer.isView(value) &&
    !(value instanceof ArrayBuffer) &&
    !(value instanceof Date)
  );
}

function normalizeNamedBindings(values: Record<string, unknown>): Record<string, SqliteBindValue> {
  const normalized: Record<string, SqliteBindValue> = {};

  for (const [key, value] of Object.entries(values)) {
    normalized[key] = normalizeBindValue(value);
  }

  return normalized;
}

function normalizeBindValue(value: unknown): SqliteBindValue {
  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }

  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value);
  }

  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }

  return value as SqliteBindValue;
}

function toPlainRow<T>(row: Record<string, unknown>): T {
  // node:sqlite returns null-prototype objects; D1 returns plain objects.
  return { ...row } as T;
}

function buildMeta(input: {
  changes: number;
  lastRowId: number;
  rowsRead: number;
  durationMs: number;
}): D1Result["meta"] {
  return {
    duration: input.durationMs,
    size_after: 0,
    rows_read: input.rowsRead,
    rows_written: input.changes,
    last_row_id: input.lastRowId,
    changed_db: input.changes > 0,
    changes: input.changes,
  };
}

/**
 * Best-effort statement count for the D1 `exec` result. It is informational
 * only and is not used by the repository's data layer.
 */
function countStatements(sql: string): number {
  let count = 0;

  for (const statement of sql.split(";")) {
    if (statement.trim() !== "") {
      count += 1;
    }
  }

  return count;
}
