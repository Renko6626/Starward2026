import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ApiError, requestJson } from "../../app/lib/api";
import { cn } from "../../app/lib/cn";
import { formatDateTime } from "../../app/lib/format";
import type { PortalHistoryResponse } from "../../shared/portal";
import { authClient } from "../lib/auth-client";

type HistoryPageState =
  | { status: "loading" }
  | { status: "ready"; history: PortalHistoryResponse }
  | { status: "error"; message: string };

export function PortalHistoryPage() {
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
  }, [navigate, sessionQuery.data, sessionQuery.isPending]);

  async function loadHistoryPage() {
    setState({ status: "loading" });

    try {
      const history = await requestJson<PortalHistoryResponse>("/api/portal/history");
      setState({ status: "ready", history });
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        void navigate({ to: "/portal/login" });
        return;
      }

      setState({
        status: "error",
        message: caught instanceof Error ? caught.message : "无法读取参与者历史记录。",
      });
    }
  }

  if (sessionQuery.isPending || state.status === "loading") {
    return (
      <div className="max-w-4xl mx-auto relative z-10 py-6 space-y-8">
        <div className="border-b border-outline-variant pb-4">
          <h1 className="text-2xl font-headline tracking-tight mb-1">审计历史</h1>
          <p className="text-sm text-on-surface-variant">正在读取参与者历史记录。</p>
        </div>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="max-w-4xl mx-auto relative z-10 py-6 space-y-8">
        <div className="border-b border-outline-variant pb-4">
          <h1 className="text-2xl font-headline tracking-tight mb-1">审计历史</h1>
          <p className="text-sm text-on-surface-variant">{state.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto relative z-10 py-6 space-y-8">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 border-b border-outline-variant pb-4">
        <div>
          <h1 className="text-2xl font-headline tracking-tight mb-1">审计历史</h1>
          <p className="text-sm text-on-surface-variant">
            {state.history.participant.displayName}，这里会把参与者可见的关键动作按时间倒序列出来，方便你确认系统记录到了什么。
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-surface-variant text-on-surface-variant border border-outline-variant text-xs font-mono font-medium">
          {state.history.items.length} 条记录
        </span>
      </div>

      <section className="p-6 border border-outline-variant bg-surface-container-low/50 rounded-xl">
        {state.history.items.length > 0 ? (
          <div className="space-y-4 relative before:absolute before:inset-y-0 before:left-2 before:w-px before:bg-outline-variant">
            {state.history.items.map((item) => (
              <div className="relative pl-6" key={item.id}>
                <div className="absolute left-[5px] top-1.5 w-1.5 h-1.5 rounded-full bg-on-surface-variant ring-4 ring-surface-container-low" />
                <time className="text-xs font-mono text-on-surface-variant block mb-0.5">{formatDateTime(item.createdAt)}</time>
                <p className="text-sm text-on-surface">{item.label}</p>
                <p className="text-xs text-on-surface-variant">{item.actorLabel}</p>
              </div>
            ))}
          </div>
        ) : (
          <Notice>当前还没有可显示的参与者历史记录。</Notice>
        )}
      </section>

      <div className="flex flex-wrap gap-3">
        <Link
          className="px-6 py-2 bg-surface-variant text-on-surface rounded-md font-medium hover:bg-outline-variant transition-colors"
          to="/portal"
        >
          返回门户总览
        </Link>
        <Link
          className="px-6 py-2 bg-surface-variant text-on-surface rounded-md font-medium hover:bg-outline-variant transition-colors"
          to="/portal/project"
        >
          前往资料补录
        </Link>
      </div>
    </div>
  );
}

function Notice({ children }: { children: ReactNode }) {
  return (
    <div className={cn("rounded-xl border border-outline-variant bg-surface-variant/30 px-4 py-3 text-sm leading-6 text-on-surface-variant")}>
      {children}
    </div>
  );
}
