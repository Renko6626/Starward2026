import { useSiteTranslation } from "../../i18n/use-site-translation";
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Notice, PageHeading } from "../../app/components/ui";
import { ApiError, requestJson } from "../../app/lib/api";
import { formatDateTime } from "../../app/lib/format";
import type { PortalHistoryResponse } from "../../shared/portal";
import { authClient } from "../lib/auth-client";

type HistoryPageState =
  | { status: "loading" }
  | { status: "ready"; history: PortalHistoryResponse }
  | { status: "error"; message: string };

export function PortalHistoryPage({ embedded = false, revision = 0 }: { embedded?: boolean; revision?: number } = {}) {
  const { t, language, label: systemLabel } = useSiteTranslation();
  const navigate = useNavigate();
  const sessionQuery = authClient.useSession();
  const [state, setState] = useState<HistoryPageState>({ status: "loading" });
  const loadSequence = useRef(0);

  useEffect(() => {
    if (!sessionQuery.isPending && !sessionQuery.data) {
      void navigate({ to: "/portal/login" });
      return;
    }

    if (!sessionQuery.data) {
      return;
    }

    const sequence = ++loadSequence.current;
    void loadHistoryPage(sequence);
    return () => { if (loadSequence.current === sequence) loadSequence.current += 1; };
  }, [navigate, sessionQuery.data, sessionQuery.isPending, revision, language]);

  async function loadHistoryPage(sequence: number) {
    setState({ status: "loading" });

    try {
      const history = await requestJson<PortalHistoryResponse>(
        "/api/portal/history",
      );
      if (sequence !== loadSequence.current) return;
      setState({ status: "ready", history });
    } catch (caught) {
      if (sequence !== loadSequence.current) return;
      if (caught instanceof ApiError && caught.status === 401) {
        void navigate({ to: "/portal/login" });
        return;
      }

      setState({
        status: "error",
        message:
          caught instanceof Error ? caught.message : t("portal.history.loadError"),
      });
    }
  }

  if (sessionQuery.isPending || state.status === "loading") return <p>{t("portal.history.loading")}</p>;
  if (state.status === "error") return <Notice tone="error">{systemLabel(state.message)}</Notice>;

  return (
    <div className={embedded ? "space-y-4" : "page-content"}>
      {!embedded ? <PageHeading
        title={<>{t("portal.history.title")}</>}
      >
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-surface-variant text-on-surface-variant border border-outline-variant text-sm font-mono font-medium">
          {t("portal.history.records", { count: state.history.items.length })}</span>
      </PageHeading> : null}

      <section className="panel">
        {state.history.items.length > 0 ? (
          <div className="timeline">
            {state.history.items.map((item) => (
              <article key={item.id}>
                <time className="text-sm font-mono text-on-surface-variant block mb-0.5">
                  {formatDateTime(item.createdAt, language)}
                </time>
                <p className="text-base text-on-surface">{item.label}</p>
                <p className="text-sm text-on-surface-variant">
                  {item.actorLabel}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <Notice>{t("portal.history.empty")}</Notice>
        )}
      </section>

      {!embedded ? <div className="flex flex-wrap gap-3">
        <Link className="button button--secondary" to="/portal">
          {t("portal.workspace.return")}</Link>
      </div> : null}
    </div>
  );
}
