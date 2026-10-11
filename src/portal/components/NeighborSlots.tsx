import { useEffect, useState } from "react";
import { Button, Notice } from "../../app/components/ui";
import { requestJson } from "../../app/lib/api";
import { formatScheduledTime } from "../../app/lib/format";
import type { CollaborationResponse, PortalNeighbor, PortalNeighborsResponse } from "../../shared/collaboration";
import { getBilibiliProfileUrl } from "../lib/profile-form";

export function NeighborSlots({ revision = 0, collaboration, onSaved }: { revision?: number; collaboration: CollaborationResponse; onSaved: () => Promise<void> }) {
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  async function requestSwap(segmentId: string) {
    setSending(true); setError(null); setMessage(null);
    try {
      const response = await requestJson<{ message: string }>("/api/portal/swaps", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ segmentId }) });
      setMessage(response.message);
      await onSaved();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "换期请求失败。"); }
    finally { setSending(false); }
  }
  const [neighbors, setNeighbors] = useState<PortalNeighborsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copying, setCopying] = useState<string | null>(null);
  const [copyResult, setCopyResult] = useState<{ segmentId: string; error: boolean } | null>(null);
  useEffect(() => {
    let cancelled = false;
    void requestJson<PortalNeighborsResponse>("/api/portal/neighbors").then(response => {
      if (!cancelled) { setNeighbors(response); setError(null); setCopyResult(null); }
    }).catch(caught => {
      if (!cancelled) setError(caught instanceof Error ? caught.message : "相邻发布时点暂时无法读取。");
    });
    return () => { cancelled = true; };
  }, [revision]);
  async function copyProfile(neighbor: PortalNeighbor, url: string) {
    setCopying(neighbor.segmentId); setCopyResult(null);
    try {
      await navigator.clipboard.writeText(url);
      setCopyResult({ segmentId: neighbor.segmentId, error: false });
    } catch {
      setCopyResult({ segmentId: neighbor.segmentId, error: true });
    } finally { setCopying(null); }
  }
  const card = (label: string, neighbor: PortalNeighbor | null) => {
    const url = neighbor?.bilibiliUid ? getBilibiliProfileUrl(neighbor.bilibiliUid) : undefined;
    const result = copyResult?.segmentId === neighbor?.segmentId ? copyResult : null;
    return <div className="neighbor-card">
    <h4>{label}</h4>
    {neighbor ? <><p>{neighbor.segmentCode} {neighbor.segmentName}</p><p>{formatScheduledTime(neighbor.scheduledAt)}</p><p>{neighbor.publicName ?? "尚未认领"}</p><p className="field-hint">{neighbor.status === "confirmed" ? "已确认" : neighbor.status === "reserved" ? "待审核，尚未确认" : neighbor.status === "available" ? "空闲发布时点" : "暂不可用"}</p>{url ? <><a className="text-link" href={url} target="_blank" rel="noreferrer">{url}</a><Button appearance="industrial" variant="secondary" disabled={copying !== null} aria-busy={copying === neighbor.segmentId} onClick={() => void copyProfile(neighbor, url)}>{result && !result.error ? "已复制主页链接" : "复制 B站主页链接"}</Button>{result ? <p className="field-hint" role="status">{result.error ? "暂时无法复制，请选中上方链接手动复制。" : "主页链接已复制。"}</p> : null}</> : neighbor.status === "confirmed" ? <p className="field-hint">对方尚未填写 B站主页。</p> : null}{neighbor.kind === "special" && neighbor.status === "confirmed" && neighbor.assignmentStatus === "held" && collaboration.canSwap ? <Button appearance="industrial" disabled={sending || collaboration.requests.some(r => r.status === "pending" && r.requesterId === collaboration.participantId && r.recipientSegmentId === neighbor.segmentId)} onClick={() => void requestSwap(neighbor.segmentId)}>申请与这一棒换期</Button> : null}</> : <p className="field-hint">暂无相邻发布时点</p>}
  </div>;
  };
  return <section aria-label="相邻接力作者" className="space-y-4"><h3>相邻接力作者</h3>
    {message ? <Notice tone="success">{message}</Notice> : null}
    {error ? <Notice tone="warning">{error}</Notice> : null}
    {neighbors?.currentSegmentId ? <div className="neighbor-grid">{card("前一棒", neighbors.previous)}{card("后一棒", neighbors.next)}</div> : <p className="field-hint">确认发布时点后，这里会显示前后接力作者。</p>}
  </section>;
}
