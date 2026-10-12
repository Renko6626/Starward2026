import type { WorkFile } from "../../src/shared/work-files";

export type WorkFileRow = {
  id: string;
  draft_id: string;
  object_key: string;
  upload_id: string;
  filename: string;
  size: number;
  content_type: string;
  created_at: string;
  completed_at: string | null;
};

export async function listWorkFiles(db: D1Database, draftId: string): Promise<WorkFile[]> {
  const { results } = await db.prepare(`SELECT id, filename, size, content_type AS contentType, created_at AS createdAt
    FROM work_files WHERE draft_id = ? AND completed_at IS NOT NULL ORDER BY created_at, id`)
    .bind(draftId).all<WorkFile>();
  return results;
}

export async function getWorkFile(db: D1Database, id: string, draftId: string) {
  return db.prepare("SELECT * FROM work_files WHERE id = ? AND draft_id = ?")
    .bind(id, draftId).first<WorkFileRow>();
}

export async function downloadWorkFile(bucket: R2Bucket, file: WorkFileRow) {
  const object = await bucket.get(file.object_key);
  if (!object) return null;
  return new Response(object.body, { headers: {
    "Content-Type": file.content_type || "application/octet-stream",
    "Content-Length": String(object.size),
    "Content-Disposition": `attachment; filename="download"; filename*=UTF-8''${encodeURIComponent(file.filename).replace(/['()*]/g, character => `%${character.charCodeAt(0).toString(16)}`)}`,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  } });
}
