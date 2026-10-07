import { useState } from "react";
import { Button, Notice, StatusBadge } from "../../app/components/ui";
import { requestJson } from "../../app/lib/api";
import type { CollaborationMutationResponse, CollaborationResponse } from "../../shared/collaboration";

const labels = { pending: "等待回应", accepted: "已交换", rejected: "已拒绝", cancelled: "已取消", expired: "已失效" };
export function SwapRequests({ collaboration, onSaved }: { collaboration: CollaborationResponse; onSaved: () => Promise<void> }) {
  const [refreshWarning, setRefreshWarning] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
  async function respond(id: string, action: "accept" | "reject" | "cancel") {
    setBusy(id); setNotice(null); setRefreshWarning(null);
    try {
      const result = await requestJson<CollaborationMutationResponse>(`/api/portal/swaps/${encodeURIComponent(id)}/respond`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) });
      setNotice({ text: result.message + (result.notification === "failed" ? " 邮件暂未送达，对方可以在工作台查看请求。" : ""), error: false });
      await onSaved().catch(() => setRefreshWarning("操作已完成，但摘要暂未更新，请稍后刷新。"));
    } catch (caught) { setNotice({ text: caught instanceof Error ? caught.message : "请求处理失败。", error: true }); }
    finally { setBusy(null); }
  }
  return <div className="space-y-4">
    {!collaboration.requests.length ? <p className="workspace-empty">没有换期请求。</p> : collaboration.requests.map(request => {
      const outgoing = request.requesterId === collaboration.participantId;
      const pending = request.status === "pending";
      return <article className="swap-request" key={request.id}>
        <div><h3>{outgoing ? `向 ${request.recipientName} 发起的换期` : `${request.requesterName} 希望与你换期`}</h3><StatusBadge tone={pending ? "warning" : "muted"}>{labels[request.status]}</StatusBadge></div>
        <p>{request.requesterSegmentName} 与 {request.recipientSegmentName} 交换</p>
        {request.message ? <p>{request.message}</p> : null}
        {pending ? <><p className="field-hint">同意后双方发布时点立即交换；等待回应期间保留原发布时点。</p><div className="workspace-actions">{outgoing ? <Button variant="secondary" disabled={busy !== null} onClick={() => void respond(request.id, "cancel")}>取消请求</Button> : <><Button disabled={busy !== null || !collaboration.canSwap} onClick={() => void respond(request.id, "accept")}>同意交换</Button><Button variant="secondary" disabled={busy !== null} onClick={() => void respond(request.id, "reject")}>拒绝请求</Button></>}</div></> : null}
      </article>;
    })}
    {refreshWarning ? <Notice tone="warning">{refreshWarning}</Notice> : null}
    {notice ? <Notice tone={notice.error ? "error" : "success"}>{notice.text}</Notice> : null}
  </div>;
}
