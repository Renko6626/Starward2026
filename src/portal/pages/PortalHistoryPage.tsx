import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
  const navigate = useNavigate();
  const sessionQuery = authClient.useSession();
  const [state, setState] = useState<HistoryPageState>({ status: "loading" });

  useEffect(() => {
    if (!sessionQuery.isPending && !sessionQuery.data) {
      void navigate({ to: "/portal/login" });
      return;
    }

    if (!sessionQuery.data) {
      return;
    }

    void loadHistoryPage();
  }, [navigate, sessionQuery.data, sessionQuery.isPending, revision]);

  async function loadHistoryPage() {
    setState({ status: "loading" });

    try {
      const history = await requestJson<PortalHistoryResponse>(
        "/api/portal/history",
      );
      setState({ status: "ready", history });
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        void navigate({ to: "/portal/login" });
        return;
      }

      setState({
        status: "error",
        message:
          caught instanceof Error ? caught.message : "无法读取操作记录，请稍后重试。",
      });
    }
  }

  if (sessionQuery.isPending || state.status === "loading") return <p>正在读取操作记录。</p>;
  if (state.status === "error") return <Notice tone="error">{state.message}</Notice>;

  return (
    <div className={embedded ? "space-y-4" : "page-content"}>
      {!embedded ? <PageHeading
        title={<>操作记录</>}
      >
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-surface-variant text-on-surface-variant border border-outline-variant text-sm font-mono font-medium">
          {state.history.items.length} 条记录
        </span>
      </PageHeading> : null}

      <section className="panel">
        {state.history.items.length > 0 ? (
          <div className="timeline">
            {state.history.items.map((item) => (
              <article key={item.id}>
                <time className="text-sm font-mono text-on-surface-variant block mb-0.5">
                  {formatDateTime(item.createdAt)}
                </time>
                <p className="text-base text-on-surface">{item.label}</p>
                <p className="text-sm text-on-surface-variant">
                  {item.actorLabel}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <Notice>暂无操作记录。</Notice>
        )}
      </section>

      {!embedded ? <div className="flex flex-wrap gap-3">
        <Link className="button button--secondary" to="/portal">
          返回作者页面
        </Link>
        <Link className="button button--secondary" to="/portal/project">
          前往作品资料
        </Link>
      </div> : null}
    </div>
  );
}
