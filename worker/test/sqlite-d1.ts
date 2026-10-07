import { URL } from "node:url";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";

class Statement {
  constructor(
    private db: DatabaseSync,
    private sql: string,
    private values: SQLInputValue[] = [],
  ) {}
  bind(...values: SQLInputValue[]) {
    return new Statement(this.db, this.sql, values);
  }
  async first<T>() {
    return (
      (this.db.prepare(this.sql).get(...this.values) as T | undefined) ?? null
    );
  }
  async all<T>() {
    return {
      results: this.db.prepare(this.sql).all(...this.values) as T[],
      success: true,
    };
  }
  async run() {
    const result = this.db.prepare(this.sql).run(...this.values);
    return {
      success: true,
      meta: {
        changes: Number(result.changes),
        last_row_id: Number(result.lastInsertRowid),
      },
    };
  }
}

/** Executes production SQL with real migrations and D1's atomic batch semantics. */
export class SqliteD1Fixture {
  sqlite = new DatabaseSync(":memory:");
  beforeBatch?: () => void;
  constructor() {
    const directory = new URL("../../migrations/", import.meta.url);
    for (const file of readdirSync(directory)
      .filter((f) => f.endsWith(".sql"))
      .sort()) {
      this.sqlite.exec(readFileSync(new URL(file, directory), "utf8"));
    }
    this.sqlite.exec("PRAGMA foreign_keys = ON");
  }
  prepare(sql: string) {
    return new Statement(this.sqlite, sql);
  }
  async batch(statements: Statement[]) {
    this.beforeBatch?.();
    this.beforeBatch = undefined;
    this.sqlite.exec("BEGIN");
    try {
      const results = [];
      for (const statement of statements) results.push(await statement.run());
      this.sqlite.exec("COMMIT");
      return results;
    } catch (error) {
      this.sqlite.exec("ROLLBACK");
      throw error;
    }
  }
  get db() {
    return this as unknown as D1Database;
  }
}
