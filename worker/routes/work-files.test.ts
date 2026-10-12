import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Hono } from "hono";
import { SqliteD1Fixture } from "../test/sqlite-d1";
import { buildLocalSeedSql, createSignedSessionCookieValue } from "../../scripts/lib/local-dev-bootstrap.mjs";
import { WORK_FILE_MAX_SIZE, WORK_FILE_PART_SIZE } from "../../src/shared/work-files";
import { workFilesApi } from "./work-files";
import { adminApi } from "./admin";
import { adminTestSession } from "../test/admin-session";
import type { AppBindings, AppRouteConfig } from "../lib/types";

class MemoryBucket {
  objects = new Map<string, Uint8Array>();
  uploads = new Map<string, Map<number, Uint8Array>>();
  async createMultipartUpload(key: string) {
    const uploadId = crypto.randomUUID();
    this.uploads.set(uploadId, new Map());
    return this.resumeMultipartUpload(key, uploadId);
  }
  resumeMultipartUpload(key: string, uploadId: string) {
    return {
      key, uploadId,
      uploadPart: async (part: number, body: ArrayBuffer) => {
        this.uploads.get(uploadId)!.set(part, new Uint8Array(body));
        return { partNumber: part, etag: `etag-${part}` };
      },
      complete: async (parts: R2UploadedPart[]) => {
        const buffers = parts.map(part => this.uploads.get(uploadId)!.get(part.partNumber)!);
        const result = new Uint8Array(buffers.reduce((sum, bytes) => sum + bytes.length, 0));
        let offset = 0;
        for (const buffer of buffers) { result.set(buffer, offset); offset += buffer.length; }
        this.objects.set(key, result); this.uploads.delete(uploadId);
        return { size: result.length };
      },
      abort: async () => { this.uploads.delete(uploadId); },
    };
  }
  async head(key: string) { const data = this.objects.get(key); return data ? { size: data.length } : null; }
  async get(key: string) { const data = this.objects.get(key); return data ? { size: data.length, body: data } : null; }
  async delete(key: string) { this.objects.delete(key); }
}

const app = new Hono<AppRouteConfig>().route("/api/portal/project/files", workFilesApi).route("/api/admin", adminApi);
let fixture: SqliteD1Fixture;
let storage: MemoryBucket;
let env: AppBindings;
let headers: { cookie: string; origin: string };
const base = "http://localhost/api/portal/project/files";
beforeEach(async () => {
  fixture = new SqliteD1Fixture();
  fixture.sqlite.exec(buildLocalSeedSql());
  fixture.sqlite.exec("UPDATE event_windows SET is_enabled = 1, opens_at = NULL, closes_at = NULL WHERE key = 'work_upload_open'");
  storage = new MemoryBucket();
  env = { DB: fixture.db, WORK_FILES: storage as unknown as R2Bucket, BETTER_AUTH_SECRET: "test-work-files-secret-at-least-32-characters", BETTER_AUTH_URL: "http://localhost", ALLOW_LOCAL_DEV_ORIGINS: "true" };
  const value = await createSignedSessionCookieValue({ sessionToken: "starward-local-approved-session", secret: env.BETTER_AUTH_SECRET! });
  headers = { cookie: `better-auth.session_token=${value}`, origin: "http://localhost" };
});
afterEach(() => fixture.sqlite.close());
function request(path = "", init: RequestInit = {}) {
  return app.request(base + path, { ...init, headers: { ...headers, ...init.headers } }, env);
}
async function start(size = 3, filename = "作品.txt") {
  const response = await request("", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ filename, size }) });
  expect(response.status).toBe(201);
  return (await response.json() as { id: string }).id;
}
async function send(id: string, body: Uint8Array = new TextEncoder().encode("abc"), part = 1) {
  return request(`/${id}/parts/${part}`, { method: "PUT", body: body as BodyInit });
}

describe("private work uploads", () => {
  it("uploads real bytes, persists metadata, permits the author and admin to download, and deletes both stores", async () => {
    const id = await start();
    expect((await send(id)).status).toBe(200);
    expect(await (await request()).json()).toMatchObject({ files: [] });
    expect((await request(`/${id}/complete`, { method: "POST" })).status).toBe(200);
    expect(await (await request()).json()).toMatchObject({ files: [{ id, filename: "作品.txt", size: 3 }] });
    const downloaded = await request(`/${id}/download`);
    expect(await downloaded.text()).toBe("abc");
    expect(downloaded.headers.get("content-disposition")).toContain("attachment;");
    expect(downloaded.headers.get("cache-control")).toBe("private, no-store");
    expect(downloaded.headers.get("x-content-type-options")).toBe("nosniff");
    const admin = await adminTestSession(fixture.db);
    const url = "http://localhost/api/admin/project-drafts/draft_seed_active/files";
    const adminEnv = { ...env, ...admin.env };
    expect(await (await app.request(url, { headers: admin.headers }, adminEnv)).json()).toMatchObject({ files: [{ id }] });
    expect(await (await app.request(`${url}/${id}/download`, { headers: admin.headers }, adminEnv)).text()).toBe("abc");
    expect((await request(`/${id}`, { method: "DELETE" })).status).toBe(200);
    expect(storage.objects.size).toBe(0);
    expect(fixture.sqlite.prepare("SELECT * FROM work_files").all()).toEqual([]);
  });

  it("requires login and approved participation; rejects other authors and cross-origin mutations", async () => {
    expect((await app.request(base, {}, env)).status).toBe(401);
    const id = await start();
    await send(id); await request(`/${id}/complete`, { method: "POST" });
    expect((await request("", { method: "POST", headers: { origin: "https://other.example" } })).status).toBe(403);
    const value = await createSignedSessionCookieValue({ sessionToken: "starward-local-pending-session", secret: env.BETTER_AUTH_SECRET! });
    headers.cookie = `better-auth.session_token=${value}`;
    expect((await request()).status).toBe(403);
    fixture.sqlite.exec("UPDATE participants SET status = 'approved' WHERE id = 'part_seed_pending'");
    expect((await request(`/${id}/download`)).status).toBe(404);
    expect((await request(`/${id}`, { method: "DELETE" })).status).toBe(404);
    expect((await request(`/${id}/parts/1`, { method: "PUT", body: "abc" })).status).toBe(404);
    expect((await request(`/${id}/complete`, { method: "POST" })).status).toBe(404);
    expect((await app.request("http://localhost/api/admin/project-drafts/draft_seed_active/files", { headers }, env)).status).toBe(403);
  });

  it("checks the window for each mutation but keeps existing downloads and cancellation available", async () => {
    const ready = await start(); await send(ready); await request(`/${ready}/complete`, { method: "POST" });
    const pending = await start();
    fixture.sqlite.exec("UPDATE event_windows SET is_enabled = 0 WHERE key = 'work_upload_open'");
    expect((await request("", { method: "POST" })).status).toBe(403);
    expect((await send(pending)).status).toBe(403);
    expect((await request(`/${pending}/complete`, { method: "POST" })).status).toBe(403);
    expect((await request(`/${ready}`, { method: "DELETE" })).status).toBe(403);
    expect((await request(`/${ready}/download`)).status).toBe(200);
    expect((await request(`/${pending}`, { method: "DELETE" })).status).toBe(200);
    expect(storage.uploads.size).toBe(0);
  });

  it("rejects empty or oversized files and malformed filenames before allocating storage", async () => {
    for (const input of [{ filename: "a.txt", size: 0 }, { filename: "a.mp4", size: WORK_FILE_MAX_SIZE + 1 }, { filename: "../a.txt", size: 1 }]) {
      expect((await request("", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) })).status).toBe(422);
    }
    expect(storage.uploads.size).toBe(0);
  });

  it("requires complete, correctly sized parts and never exposes an unfinished object", async () => {
    const id = await start(WORK_FILE_PART_SIZE + 3, "movie.mp4");
    expect((await send(id, new Uint8Array(2))).status).toBe(422);
    expect((await send(id, new Uint8Array(WORK_FILE_PART_SIZE + 1))).status).toBe(413);
    expect((await send(id, new Uint8Array(WORK_FILE_PART_SIZE))).status).toBe(200);
    expect((await request(`/${id}/complete`, { method: "POST" })).status).toBe(409);
    expect((await request(`/${id}/download`)).status).toBe(404);
    expect((await send(id, new TextEncoder().encode("abc"), 2)).status).toBe(200);
    expect((await request(`/${id}/complete`, { method: "POST" })).status).toBe(200);
    expect((await request(`/${id}/complete`, { method: "POST" })).status).toBe(200);
    expect((await send(id)).status).toBe(409);
    expect((await (await request(`/${id}/download`)).arrayBuffer()).byteLength).toBe(WORK_FILE_PART_SIZE + 3);
  });

  it("recovers completion when R2 succeeded but the database write failed", async () => {
    const id = await start(); await send(id);
    fixture.beforeBatch = () => { throw new Error("temporary database failure"); };
    expect((await request(`/${id}/complete`, { method: "POST" })).status).toBe(500);
    expect(storage.objects.size).toBe(1);
    fixture.beforeBatch = undefined;
    expect((await request(`/${id}/complete`, { method: "POST" })).status).toBe(200);
    expect(await (await request(`/${id}/download`)).text()).toBe("abc");
  });
});
