import { useEffect, useState } from "react";
import { Notice } from "../../app/components/ui";
import { requestJson } from "../../app/lib/api";
import type { PortalNeighbor, PortalNeighborsResponse } from "../../shared/collaboration";

export function NeighborSlots({ revision = 0 }: { revision?: number }) {
  const [neighbors, setNeighbors] = useState<PortalNeighborsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    void requestJson<PortalNeighborsResponse>("/api/portal/neighbors").then(response => {
      if (!cancelled) { setNeighbors(response); setError(null); }
    }).catch(caught => {
      if (!cancelled) setError(caught instanceof Error ? caught.message : "相邻时段暂时无法读取。");
    });
    return () => { cancelled = true; };
  }, [revision]);
  const card = (label: string, neighbor: PortalNeighbor | null) => <div className="neighbor-card">
    <h4>{label}</h4>
    {neighbor ? <><p>{neighbor.segmentCode} {neighbor.segmentName}</p><p>{neighbor.publicName ?? "尚未认领"}</p><p className="field-hint">{neighbor.status === "confirmed" ? "已确认" : neighbor.status === "reserved" ? "待审核，尚未确认" : neighbor.status === "available" ? "空闲时段" : "暂不可用"}</p>{neighbor.bilibiliUid ? <a className="text-link" href={`https://space.bilibili.com/${neighbor.bilibiliUid}`} target="_blank" rel="noreferrer">B站 UID {neighbor.bilibiliUid}</a> : null}</> : <p className="field-hint">暂无相邻时段</p>}
  </div>;
  return <section aria-label="相邻接力作者" className="space-y-4"><h3>相邻接力作者</h3>
    {error ? <Notice tone="warning">{error}</Notice> : null}
    {neighbors?.currentSegmentId ? <div className="neighbor-grid">{card("前一棒", neighbors.previous)}{card("后一棒", neighbors.next)}</div> : <p className="field-hint">确认时段后，这里会显示前后接力作者。</p>}
  </section>;
}
