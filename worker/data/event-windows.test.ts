import { describe, expect, it } from "vitest";
import type { EventWindowRow } from "../lib/windows";
import { listEventWindows } from "./event-windows";

function buildRow(overrides: Partial<EventWindowRow> = {}): EventWindowRow {
  return {
    key: "application_open",
    label: "报名开放",
    is_enabled: 1,
    opens_at: null,
    closes_at: null,
    updated_at: "2026-04-12T00:00:00.000Z",
    ...overrides,
  };
}

function fakeDb(rows: EventWindowRow[]): D1Database {
  return {
    prepare() {
      return {
        async all<T>() {
          return {
            results: rows as unknown as T[],
            success: true,
            meta: { changes: 0, last_row_id: 0 },
          };
        },
      };
    },
  } as unknown as D1Database;
}

describe("listEventWindows", () => {
  it("skips rows whose key is outside the event window enum instead of throwing", async () => {
    const db = fakeDb([
      buildRow({ key: "application_open" }),
      buildRow({ key: "legacy_unknown_window" }),
      buildRow({ key: "public_release_open" }),
    ]);

    const windows = await listEventWindows(db);

    expect(windows.map((window) => window.key)).toEqual([
      "application_open",
      "public_release_open",
    ]);
  });
});
