import { useEffect, useState, type ReactNode } from "react";
import { Clock3, Sparkles } from "../../app/components/icons";
import { requestJson } from "../../app/lib/api";
import { cn } from "../../app/lib/cn";
import { formatDateTime } from "../../app/lib/format";
import type { AdminEventWindowListResponse, AdminEventWindowMutationResponse } from "../../shared/admin";
import type { EventWindowKey, EventWindowSummary } from "../../shared/windows";

type PageState =
  | { status: "loading" }
  | { status: "ready"; payload: AdminEventWindowListResponse }
  | { status: "error"; message: string };

type WindowDraft = {
  isEnabled: boolean;
  opensAt: string;
  closesAt: string;
};

type WindowFeedback = {
  tone: "success" | "error";
  message: string;
};

export function AdminEventWindowsPage() {
  const [state, setState] = useState<PageState>({ status: "loading" });
  const [drafts, setDrafts] = useState<Partial<Record<EventWindowKey, WindowDraft>>>({});
  const [savingKey, setSavingKey] = useState<EventWindowKey | null>(null);
  const [feedback, setFeedback] = useState<Partial<Record<EventWindowKey, WindowFeedback>>>({});

  useEffect(() => {
    void loadWindows();
  }, []);

  async function loadWindows() {
    setState({ status: "loading" });

    try {
      const payload = await requestJson<AdminEventWindowListResponse>("/api/admin/event-windows");
      setState({ status: "ready", payload });
      setDrafts(buildDraftMap(payload.items));
    } catch (error) {
      setState({
        status: "error",
        message: error instanceof Error ? error.message : "无法读取动作窗口。",
      });
    }
  }

  async function handleSave(key: EventWindowKey) {
    const draft = drafts[key];

    if (!draft) {
      return;
    }

    setSavingKey(key);
    setFeedback((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });

    try {
      const payload = await requestJson<AdminEventWindowMutationResponse>(`/api/admin/event-windows/${key}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          isEnabled: draft.isEnabled,
          opensAt: toIsoDateTimeOrNull(draft.opensAt),
          closesAt: toIsoDateTimeOrNull(draft.closesAt),
        }),
      });

      setState((current) => {
        if (current.status !== "ready") {
          return current;
        }

        return {
          status: "ready",
          payload: {
            items: current.payload.items.map((item) => (item.key === key ? payload.item : item)),
          },
        };
      });
      setDrafts((current) => ({
        ...current,
        [key]: buildDraft(payload.item),
      }));
      setFeedback((current) => ({
        ...current,
        [key]: {
          tone: "success",
          message: payload.message,
        },
      }));
    } catch (error) {
      setFeedback((current) => ({
        ...current,
        [key]: {
          tone: "error",
          message: error instanceof Error ? error.message : "保存动作窗口失败。",
        },
      }));
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 relative z-10 py-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-outline-variant pb-4">
        <div>
          <h1 className="text-2xl font-headline tracking-tight mb-1">事件窗口设置</h1>
          <p className="text-sm text-on-surface-variant">
            所有报名、认领、改坑和资料提交动作都应由服务端读取 `event_windows` 判定。
          </p>
        </div>
      </div>

      {state.status === "loading" ? <StateNotice message="正在读取动作窗口。" /> : null}
      {state.status === "error" ? <StateNotice message={state.message} tone="error" /> : null}

      {state.status === "ready" ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {state.payload.items.map((item) => {
            const draft = drafts[item.key] ?? buildDraft(item);
            const itemFeedback = feedback[item.key];

            return (
              <section
                key={item.key}
                className="rounded-xl border border-outline-variant bg-surface-container-low/50 p-5 space-y-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="font-medium text-on-surface">{item.label}</h2>
                    <p className="mt-1 text-xs text-on-surface-variant font-mono">{item.key}</p>
                  </div>
                  <WindowStatusBadge isEnabled={item.isEnabled} isOpen={item.isOpen} />
                </div>

                <div className="grid gap-4 md:grid-cols-2 text-sm">
                  <MetaCard icon={<Clock3 className="w-4 h-4" />} label="当前开始" value={formatDateTime(item.opensAt)} />
                  <MetaCard icon={<Clock3 className="w-4 h-4" />} label="当前结束" value={formatDateTime(item.closesAt)} />
                </div>

                <div className="space-y-4">
                  <FormField label="启用状态">
                    <select
                      className="w-full bg-surface-variant border border-outline-variant rounded-md px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                      disabled={savingKey === item.key}
                      onChange={(event) =>
                        setDrafts((current) => ({
                          ...current,
                          [item.key]: {
                            ...draft,
                            isEnabled: event.target.value === "enabled",
                          },
                        }))
                      }
                      value={draft.isEnabled ? "enabled" : "disabled"}
                    >
                      <option value="enabled">启用</option>
                      <option value="disabled">关闭</option>
                    </select>
                  </FormField>

                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField label="开始时间">
                      <input
                        className="w-full bg-surface-variant border border-outline-variant rounded-md px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                        disabled={savingKey === item.key}
                        onChange={(event) =>
                          setDrafts((current) => ({
                            ...current,
                            [item.key]: {
                              ...draft,
                              opensAt: event.target.value,
                            },
                          }))
                        }
                        type="datetime-local"
                        value={draft.opensAt}
                      />
                    </FormField>
                    <FormField label="结束时间">
                      <input
                        className="w-full bg-surface-variant border border-outline-variant rounded-md px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                        disabled={savingKey === item.key}
                        onChange={(event) =>
                          setDrafts((current) => ({
                            ...current,
                            [item.key]: {
                              ...draft,
                              closesAt: event.target.value,
                            },
                          }))
                        }
                        type="datetime-local"
                        value={draft.closesAt}
                      />
                    </FormField>
                  </div>
                </div>

                <div className="pt-4 border-t border-outline-variant space-y-3">
                  <StateNotice message="时间按当前浏览器时区填写，保存后统一转成 ISO 时间由服务端计算是否开放。" />
                  {itemFeedback ? <StateNotice message={itemFeedback.message} tone={itemFeedback.tone} /> : null}
                  <button
                    className="inline-flex min-h-10 items-center justify-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-md hover:bg-primary/90 transition-colors font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                    disabled={savingKey === item.key}
                    onClick={() => void handleSave(item.key)}
                    type="button"
                  >
                    <Sparkles className="w-4 h-4" />
                    {savingKey === item.key ? "保存中..." : "保存窗口设置"}
                  </button>
                </div>
              </section>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function buildDraftMap(items: EventWindowSummary[]) {
  return Object.fromEntries(items.map((item) => [item.key, buildDraft(item)])) as Partial<
    Record<EventWindowKey, WindowDraft>
  >;
}

function buildDraft(item: EventWindowSummary): WindowDraft {
  return {
    isEnabled: item.isEnabled,
    opensAt: toDateTimeLocalValue(item.opensAt),
    closesAt: toDateTimeLocalValue(item.closesAt),
  };
}

function toDateTimeLocalValue(value: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function toIsoDateTimeOrNull(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  return new Date(trimmed).toISOString();
}

function FormField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-xs font-medium text-on-surface-variant">{label}</span>
      {children}
    </label>
  );
}

function MetaCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-outline-variant bg-surface-variant/30 p-4">
      <div className="flex items-center gap-2 text-on-surface-variant">
        {icon}
        <p className="text-xs uppercase tracking-[0.24em]">{label}</p>
      </div>
      <p className="mt-2 text-sm text-on-surface break-words">{value}</p>
    </div>
  );
}

function WindowStatusBadge({
  isEnabled,
  isOpen,
}: {
  isEnabled: boolean;
  isOpen: boolean;
}) {
  const tone = isOpen ? "success" : isEnabled ? "info" : "warn";
  const label = isOpen ? "当前开放" : isEnabled ? "等待时间到达" : "已关闭";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs font-medium",
        tone === "success" && "bg-tertiary/10 text-tertiary border-tertiary/20",
        tone === "warn" && "bg-error/10 text-error border-error/20",
        tone === "info" && "bg-primary/10 text-primary border-primary/20",
      )}
    >
      <Clock3 className="w-3.5 h-3.5" /> {label}
    </span>
  );
}

function StateNotice({
  message,
  tone = "info",
}: {
  message: string;
  tone?: "info" | "error" | "success";
}) {
  return (
    <div
      className={cn(
        "rounded-xl border px-4 py-3 text-sm",
        tone === "error" && "border-error/40 bg-error/8 text-error",
        tone === "success" && "border-tertiary/25 bg-tertiary/10 text-tertiary",
        tone === "info" && "border-outline-variant bg-surface-container-low/80 text-on-surface-variant",
      )}
    >
      {message}
    </div>
  );
}
