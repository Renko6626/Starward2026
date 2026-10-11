import { useSiteTranslation } from "../../i18n/use-site-translation";
import { Link, getRouteApi } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { ApiError, requestJson } from "../lib/api";
import { ReadError } from "../components/ui";
import { WorkPresentation } from "../components/WorkPresentation";
import { localizeSegmentName } from "../../shared/i18n";
import type { PublicWorkDetailResponse } from "../../shared/works";

const route = getRouteApi("/works/$workId");
export function WorkDetailPage() {
  const { t, language } = useSiteTranslation();
  const { workId } = route.useParams();
  const [state, setState] = useState<
    { status: "loading" } | { status: "ready"; data: PublicWorkDetailResponse } | { status: "error"; message: string; missing: boolean }
  >({ status: "loading" });
  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading" });
    requestJson<PublicWorkDetailResponse>(`/api/works/${encodeURIComponent(workId)}`, { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) setState({ status: "ready", data }); })
      .catch(error => { if (!controller.signal.aborted) setState({ status: "error", message: error instanceof Error ? error.message : t("public.work.readError"), missing: error instanceof ApiError && error.status === 404 }); });
    return () => controller.abort();
  }, [workId, language]);
  useEffect(() => {
    if (state.status !== "ready") return;
    const previousTitle = document.title;
    document.title = `${state.data.work.previewTitle} | STARWARD 2026`;
    return () => { document.title = previousTitle; };
  }, [state]);
  return <div className="work-detail">
    <Link to="/works" search={{ view: "gallery", type: "all", q: "" }} className="text-link"><ArrowLeft size={16} />{t("public.work.back")}</Link>
    {state.status === "loading" ? <p className="works-empty" role="status">{t("public.work.loading")}</p> : state.status === "error" ?
      state.missing ? <section className="works-empty"><h1>{t("public.work.missing")}</h1><p>{t("public.work.missingNote")}</p></section> : <ReadError message={state.message} /> : <>
        <div className="work-detail-index"><span>OBS. {String(state.data.work.observationNumber).padStart(2, "0")}</span><span>{state.data.work.segmentName ? localizeSegmentName(state.data.work.segmentCode ?? "", state.data.work.segmentName, language) : t("public.work.free")}</span></div>
        <WorkPresentation work={state.data.work} />
        <nav className="work-neighbors" aria-label={t("public.work.neighbors")}>
          {state.data.previous ? <Link to="/works/$workId" params={{ workId: state.data.previous.id }}><span><ArrowLeft size={15} />{t("public.work.previous")}</span><strong>{state.data.previous.previewTitle}</strong></Link> : <div />}
          {state.data.next ? <Link to="/works/$workId" params={{ workId: state.data.next.id }}><span>{t("public.work.next")}<ArrowRight size={15} /></span><strong>{state.data.next.previewTitle}</strong></Link> : <Link to="/works" search={{ view: "gallery", type: "all", q: "" }}><strong>{t("public.work.back")}</strong></Link>}
        </nav>
      </>}
  </div>;
}
