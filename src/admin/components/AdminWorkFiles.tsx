import { useEffect, useState } from "react";
import { requestJson } from "../../app/lib/api";
import { ReadError } from "../../app/components/ui";
import { formatWorkFileSize, type WorkFile } from "../../shared/work-files";

export function AdminWorkFiles({ draftId }: { draftId: string }) {
  const [files, setFiles] = useState<WorkFile[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const endpoint = `/api/admin/project-drafts/${draftId}/files`;
  useEffect(() => {
    const controller = new AbortController();
    setFiles(null); setError(null);
    void requestJson<{ files: WorkFile[] }>(endpoint, { signal: controller.signal }).then(data => setFiles(data.files))
      .catch(error => { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "无法读取作品文件。"); });
    return () => controller.abort();
  }, [endpoint]);
  return <section className="panel space-y-4" aria-label="作品文件">
    <h2>作品文件</h2>
    {error ? <ReadError message={error} /> : files === null ? <p>正在读取作品文件。</p> : files.length ?
      <ul className="space-y-3">{files.map(file => <li key={file.id}>
        <a className="text-link" href={`${endpoint}/${file.id}/download`} download={file.filename}>{file.filename}</a>
        <span className="ml-3">{formatWorkFileSize(file.size)}</span>
      </li>)}</ul> : <p>尚未上传作品文件。</p>}
  </section>;
}
