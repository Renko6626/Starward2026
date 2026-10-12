import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { bodyLimit } from "hono/body-limit";
import { createWorkFileSchema, WORK_FILE_PART_SIZE } from "../../src/shared/work-files";
import { listEventWindows } from "../data/event-windows";
import { downloadWorkFile, getWorkFile, listWorkFiles } from "../data/work-files";
import { requireParticipantSession } from "../lib/auth";
import { getRequiredDb, jsonError } from "../lib/http";
import { resolveProjectWorkspaceEligibility } from "../lib/portal-access";
import type { AppContext, AppRouteConfig } from "../lib/types";
import { getWindowOrFallback } from "../lib/windows";

export const workFilesApi = new Hono<AppRouteConfig>();

async function access(c: AppContext, editing = false) {
  const session = await requireParticipantSession(c);
  if (!session?.session) throw new HTTPException(401, { message: "请先登录。" });
  const eligibility = resolveProjectWorkspaceEligibility(session.participant);
  if (!eligibility.ok || !session.participant) throw new HTTPException(403, { message: eligibility.ok ? "未找到参与记录。" : eligibility.message });
  const db = getRequiredDb(c);
  const draft = await db.prepare("SELECT id FROM project_drafts WHERE participant_id = ?")
    .bind(session.participant.id).first<{ id: string }>();
  if (!draft) throw new HTTPException(404, { message: "未找到作品记录。" });
  const window = getWindowOrFallback(await listEventWindows(db), "work_upload_open");
  if (editing && !window.isOpen) throw new HTTPException(403, { message: "作品文件上传暂未开放。" });
  return { db, draftId: draft.id, window };
}

function bucket(c: AppContext) {
  if (!c.env.WORK_FILES) throw new HTTPException(503, { message: "文件存储暂时不可用。" });
  return c.env.WORK_FILES;
}

workFilesApi.use("*", async (c, next) => {
  c.header("Cache-Control", "private, no-store");
  if (!["GET", "HEAD"].includes(c.req.method)) {
    const origin = c.req.header("Origin");
    if (origin && origin !== new URL(c.req.url).origin) return jsonError(c, 403, "invalid_origin", "请求来源不正确。");
  }
  await next();
});

workFilesApi.get("/", async c => {
  const { db, draftId, window } = await access(c);
  return c.json({ files: await listWorkFiles(db, draftId), window });
});

workFilesApi.post("/", async c => {
  const { db, draftId } = await access(c, true);
  const parsed = createWorkFileSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return jsonError(c, 422, "invalid_file", parsed.error.issues[0].message);
  const storage = bucket(c);
  const id = crypto.randomUUID();
  const key = `works/${draftId}/${id}`;
  const contentType = parsed.data.contentType || "application/octet-stream";
  const upload = await storage.createMultipartUpload(key, { httpMetadata: { contentType } });
  try {
    await db.prepare(`INSERT INTO work_files (id, draft_id, object_key, upload_id, filename, size, content_type, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(id, draftId, key, upload.uploadId, parsed.data.filename, parsed.data.size, contentType, new Date().toISOString()).run();
  } catch (error) {
    await upload.abort();
    throw error;
  }
  return c.json({ id, partSize: WORK_FILE_PART_SIZE }, 201);
});

workFilesApi.put("/:id/parts/:part", bodyLimit({ maxSize: WORK_FILE_PART_SIZE,
  onError: c => jsonError(c, 413, "part_too_large", "上传分片过大。"),
}), async c => {
  const { db, draftId } = await access(c, true);
  const file = await getWorkFile(db, c.req.param("id"), draftId);
  if (!file) return jsonError(c, 404, "file_missing", "未找到文件。");
  if (file.completed_at) return jsonError(c, 409, "upload_completed", "文件已上传完成。");
  const number = Number(c.req.param("part"));
  const count = Math.ceil(file.size / WORK_FILE_PART_SIZE);
  if (!Number.isInteger(number) || number < 1 || number > count) return jsonError(c, 422, "invalid_part", "上传分片编号不正确。");
  const body = await c.req.arrayBuffer();
  const expected = Math.min(WORK_FILE_PART_SIZE, file.size - (number - 1) * WORK_FILE_PART_SIZE);
  if (body.byteLength !== expected) return jsonError(c, 422, "invalid_part_size", "上传分片大小不正确。");
  const receipt = await bucket(c).resumeMultipartUpload(file.object_key, file.upload_id).uploadPart(number, body);
  await db.prepare(`INSERT INTO work_file_parts (file_id, part_number, etag) VALUES (?, ?, ?)
    ON CONFLICT(file_id, part_number) DO UPDATE SET etag = excluded.etag`)
    .bind(file.id, number, receipt.etag).run();
  return c.json({ ok: true });
});

workFilesApi.post("/:id/complete", async c => {
  const { db, draftId } = await access(c, true);
  const file = await getWorkFile(db, c.req.param("id"), draftId);
  if (!file) return jsonError(c, 404, "file_missing", "未找到文件。");
  const storage = bucket(c);
  if (!file.completed_at) {
    // A completed object may already exist when the database write or response failed.
    let object = await storage.head(file.object_key);
    if (!object) {
      const { results: parts } = await db.prepare("SELECT part_number AS partNumber, etag FROM work_file_parts WHERE file_id = ? ORDER BY part_number")
        .bind(file.id).all<R2UploadedPart>();
      if (parts.length !== Math.ceil(file.size / WORK_FILE_PART_SIZE)) return jsonError(c, 409, "upload_incomplete", "文件尚未上传完整。");
      object = await storage.resumeMultipartUpload(file.object_key, file.upload_id).complete(parts);
    }
    if (object.size !== file.size) return jsonError(c, 409, "invalid_file_size", "文件大小与上传声明不一致。");
    await db.batch([
      db.prepare("UPDATE work_files SET completed_at = ? WHERE id = ? AND completed_at IS NULL").bind(new Date().toISOString(), file.id),
      db.prepare("DELETE FROM work_file_parts WHERE file_id = ?").bind(file.id),
    ]);
  }
  return c.json({ ok: true, files: await listWorkFiles(db, draftId) });
});

workFilesApi.get("/:id/download", async c => {
  const { db, draftId } = await access(c);
  const file = await getWorkFile(db, c.req.param("id"), draftId);
  if (!file?.completed_at) return jsonError(c, 404, "file_missing", "未找到文件。");
  return await downloadWorkFile(bucket(c), file) ?? jsonError(c, 404, "file_missing", "未找到文件。");
});

workFilesApi.delete("/:id", async c => {
  const { db, draftId, window } = await access(c);
  const file = await getWorkFile(db, c.req.param("id"), draftId);
  if (!file) return jsonError(c, 404, "file_missing", "未找到文件。");
  // Incomplete uploads can still be cancelled after the window closes.
  if (file.completed_at && !window.isOpen) return jsonError(c, 403, "upload_closed", "作品文件上传暂未开放。");
  const storage = bucket(c);
  if (!file.completed_at) await storage.resumeMultipartUpload(file.object_key, file.upload_id).abort();
  await storage.delete(file.object_key);
  await db.prepare("DELETE FROM work_files WHERE id = ?").bind(file.id).run();
  return c.json({ ok: true });
});
