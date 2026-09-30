import { Link, getRouteApi } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { ApiError, requestJson } from "../lib/api";
import { ReadError } from "../components/ui";
import { WorkPresentation } from "../components/WorkPresentation";
import type { PublicWorkDetailResponse } from "../../shared/works";

const route = getRouteApi("/works/$workId");
export function WorkDetailPage() {
  const { workId } = route.useParams();
  const [state, setState] = useState<
    { status: "loading" } | { status: "ready"; data: PublicWorkDetailResponse } | { status: "error"; message: string; missing: boolean }
  >({ status: "loading" });
  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading" });
    requestJson<PublicWorkDetailResponse>(`/api/works/${encodeURIComponent(workId)}`, { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) setState({ status: "ready", data }); })
      .catch(error => { if (!controller.signal.aborted) setState({ status: "error", message: error instanceof Error ? error.message : "暂时无法读取作品。", missing: error instanceof ApiError && error.status === 404 }); });
    return () => controller.abort();
  }, [workId]);
  useEffect(() => {
    if (state.status !== "ready") return;
    const previousTitle = document.title;
    document.title = `${state.data.work.previewTitle} · 秘封观测集 · STARWARD`;
    return () => { document.title = previousTitle; };
  }, [state]);
  return <div className="work-detail">
    <Link to="/works" search={{ view: "gallery", type: "all", q: "" }} className="text-link"><ArrowLeft size={16} />返回观测集</Link>
    {state.status === "loading" ? <p className="works-empty" role="status">正在读取这份观测…</p> : state.status === "error" ?
      state.missing ? <section className="works-empty"><h1>这份观测尚未公开或已撤下。</h1><p>回到观测集，看看其他创作。</p></section> : <ReadError message={state.message} /> : <>
        <div className="work-detail-index"><span>OBS. {String(state.data.work.observationNumber).padStart(2, "0")}</span><span>{state.data.work.segmentName || "自由观测"}</span></div>
        <WorkPresentation work={state.data.work} />
        <nav className="work-neighbors" aria-label="继续接力观测">
          {state.data.previous ? <Link to="/works/$workId" params={{ workId: state.data.previous.id }}><span><ArrowLeft size={15} />上一份观测</span><strong>{state.data.previous.previewTitle}</strong></Link> : <div />}
          {state.data.next ? <Link to="/works/$workId" params={{ workId: state.data.next.id }}><span>下一份观测<ArrowRight size={15} /></span><strong>{state.data.next.previewTitle}</strong></Link> : <Link to="/works" search={{ view: "gallery", type: "all", q: "" }}><span>本次观测至此</span><strong>返回观测集</strong></Link>}
        </nav>
      </>}
  </div>;
}
