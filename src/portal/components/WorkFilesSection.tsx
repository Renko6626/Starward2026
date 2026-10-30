import { useEffect, useRef, useState } from "react";
import { requestJson } from "../../app/lib/api";
import { Button, Notice } from "../../app/components/ui";
import { createWorkFileSchema, formatWorkFileSize, type WorkFile, type WorkFilesResponse, type WorkFileUpload } from "../../shared/work-files";

const endpoint = "/api/portal/project/files";

export function WorkFilesSection({ data, loadError, onFilesChange, onBusyChange, onUploadErrorChange, disabled = false }: {
  onBusyChange?: (busy: boolean) => void;
  onUploadErrorChange?: (failed: boolean) => void;
  disabled?: boolean;
  data: WorkFilesResponse | null;
  loadError: string | null;
  onFilesChange: (update: (files: WorkFile[]) => WorkFile[]) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ filename: string; sent: number; total: number } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => () => controller.current?.abort(), []);

  async function upload(files: File[]) {
    if (!files.length) return;
    setError(null); setMessage(null);
    for (const file of files) {
      const parsed = createWorkFileSchema.safeParse({ filename: file.name, size: file.size, contentType: file.type });
      if (!parsed.success) { onUploadErrorChange?.(true); setError(`${file.name}：${parsed.error.issues[0]!.message}`); return; }
    }
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true); onBusyChange?.(true);
    let active: string | null = null;
    try {
      for (const file of files) {
        setProgress({ filename: file.name, sent: 0, total: file.size });
        // Keep the creation response so cancellation can always abort the server upload.
        const created = await requestJson<WorkFileUpload>(endpoint, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: file.name, size: file.size, contentType: file.type }),
        });
        active = created.id;
        for (let start = 0, part = 1; start < file.size; start += created.partSize, part++) {
          abort.signal.throwIfAborted();
          const chunk = file.slice(start, start + created.partSize);
          await uploadPart(`${endpoint}/${active}/parts/${part}`, chunk, abort.signal,
            bytes => setProgress({ filename: file.name, sent: start + bytes, total: file.size }));
        }
        abort.signal.throwIfAborted();
        const completed = await requestJson<{ files: WorkFile[] }>(`${endpoint}/${active}/complete`, { method: "POST" });
        active = null;
        onFilesChange(() => completed.files);
      }
      onUploadErrorChange?.(false);
      setMessage("文件已上传，点击下方“提交完整作品”或“提交新版本”后才算正式交稿。");
    } catch (error) {
      onUploadErrorChange?.(true);
      if (abort.signal.aborted) setMessage("已取消当前上传。");
      else setError(error instanceof Error ? error.message : "文件上传失败。");
      if (active) {
        try { await requestJson(`${endpoint}/${active}`, { method: "DELETE" }); }
        catch { /* Incomplete files never appear in the author's submitted file list. */ }
      }
    } finally {
      setBusy(false); onBusyChange?.(false); setProgress(null); controller.current = null;
      if (input.current) input.current.value = "";
    }
  }

  async function remove(file: WorkFile) {
    setBusy(true); onBusyChange?.(true); setError(null); setMessage(null);
    try {
      await requestJson(`${endpoint}/${file.id}`, { method: "DELETE" });
      onFilesChange(files => files.filter(item => item.id !== file.id));
    } catch (error) { setError(error instanceof Error ? error.message : "删除失败。"); }
    finally { setBusy(false); onBusyChange?.(false); }
  }

  return <section className="work-files" aria-label="作品文件">
    {data?.window.isOpen ? <>
      <Button className="work-file-upload" appearance="industrial" disabled={busy || disabled} aria-describedby="work-file-hint" onClick={() => input.current?.click()}>上传作品文件</Button>
      <p id="work-file-hint" className="field-hint">支持多文件，单个文件不超过 500 MB。文件仅作者本人和策划组可下载。</p>
      <input ref={input} id="work-file-input" hidden aria-label="选择作品文件" type="file" multiple disabled={busy || disabled}
        aria-describedby="work-file-hint" onChange={event => void upload(Array.from(event.target.files ?? []))} />
    </> : data ? <p>{data.window.state === "ended" ? "作品投稿暂未开放。" : "作品投稿暂未开放。"}</p> : null}
    {progress ? <div className="work-file-progress" aria-live="polite">
      <p>{progress.filename}，{formatWorkFileSize(progress.sent)} / {formatWorkFileSize(progress.total)}</p>
      <progress aria-label="文件上传进度" value={progress.sent} max={progress.total} />
      <Button appearance="industrial" variant="secondary" onClick={() => controller.current?.abort()}>取消上传</Button>
    </div> : null}
    {data?.files.length ? <ul className="work-file-list" aria-label="已上传文件">{data.files.map(file => <li key={file.id}>
      <a href={`${endpoint}/${file.id}/download`} download={file.filename}>{file.filename}</a>
      <div className="work-file-meta"><span>{formatWorkFileSize(file.size)}</span>
      {data.window.isOpen ? <Button appearance="industrial" variant="secondary" disabled={busy || disabled} aria-label={`删除 ${file.filename}`} onClick={() => void remove(file)}>删除</Button> : null}</div>
    </li>)}</ul> : null}
    {message ? <Notice tone="success">{message}</Notice> : null}
    {error || loadError ? <Notice tone="error">{error || loadError}</Notice> : null}
  </section>;
}

function uploadPart(url: string, body: Blob, signal: AbortSignal, onProgress: (sent: number) => void) {
  return new Promise<void>((resolve, reject) => {
    signal.throwIfAborted();
    const request = new XMLHttpRequest();
    const abort = () => request.abort();
    const finish = (error?: Error) => {
      signal.removeEventListener("abort", abort);
      if (error) reject(error); else resolve();
    };
    request.open("PUT", url);
    request.upload.onprogress = event => onProgress(event.loaded);
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) { onProgress(body.size); finish(); return; }
      let message = "文件上传失败。";
      try { message = JSON.parse(request.responseText).error?.message ?? message; } catch { /* Use the failed request message. */ }
      finish(new Error(message));
    };
    request.onerror = () => finish(new Error("连接中断，文件上传失败。"));
    request.onabort = () => finish(new DOMException("上传已取消", "AbortError"));
    signal.addEventListener("abort", abort, { once: true });
    request.send(body);
  });
}
