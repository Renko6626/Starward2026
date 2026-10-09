import { useEffect, useState } from "react";
import { Clock3, Sparkles } from "../../app/components/icons";
import {
  ReadError,
  Field as FormField,
  SummaryCard as MetaCard,
  PageHeading,
  StateNotice,
} from "../../app/components/ui";
import { requestJson } from "../../app/lib/api";
import { cn } from "../../app/lib/cn";
import { formatDateTime } from "../../app/lib/format";
import type {
  AdminEventWindowListResponse,
  AdminEventWindowMutationResponse,
} from "../../shared/admin";
import type { EventWindowKey, EventWindowSummary } from "../../shared/windows";
import { eventWindowStateLabels } from "../../shared/windows";

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
  const [drafts, setDrafts] = useState<
    Partial<Record<EventWindowKey, WindowDraft>>
  >({});
  const [savingKey, setSavingKey] = useState<EventWindowKey | null>(null);
  const [feedback, setFeedback] = useState<
    Partial<Record<EventWindowKey, WindowFeedback>>
  >({});

  useEffect(() => {
    void loadWindows();
  }, []);

  async function loadWindows() {
    setState({ status: "loading" });

    try {
      const payload = await requestJson<AdminEventWindowListResponse>(
        "/api/admin/event-windows",
      );
      setState({ status: "ready", payload });
      setDrafts(buildDraftMap(payload.items));
    } catch (error) {
      setState({
        status: "error",
        message: error instanceof Error ? error.message : "无法读取开放窗口。",
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
      const payload = await requestJson<AdminEventWindowMutationResponse>(
        `/api/admin/event-windows/${key}`,
        {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            isEnabled: draft.isEnabled,
            opensAt: toIsoDateTimeOrNull(draft.opensAt),
            closesAt: toIsoDateTimeOrNull(draft.closesAt),
          }),
        },
      );

      setState((current) => {
        if (current.status !== "ready") {
          return current;
        }

        return {
          status: "ready",
          payload: {
            items: current.payload.items.map((item) =>
              item.key === key ? payload.item : item,
            ),
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
          message:
            error instanceof Error ? error.message : "保存开放窗口失败。",
        },
      }));
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <div className="page-content">
      <PageHeading
        title="活动设置" description="设置报名、改期、作品提交与公开发布的开放时间。"
      ></PageHeading>

      {state.status === "loading" ? (
        <StateNotice message="正在读取开放窗口。" />
      ) : null}
      {state.status === "error" ? (
        <ReadError message={state.message} />
      ) : null}

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
                    <h2 className="font-medium text-on-surface">
                      {item.label}
                    </h2>
                    <p className="mt-1 text-sm text-on-surface-variant font-mono">
                      {item.key}
                    </p>
                  </div>
                  <WindowStatusBadge state={item.state} />
                </div>

                <div className="grid gap-4 md:grid-cols-2 text-base">
                  <MetaCard
                    icon={<Clock3 className="w-4 h-4" />}
                    label="当前开始"
                    value={formatDateTime(item.opensAt)}
                  />
                  <MetaCard
                    icon={<Clock3 className="w-4 h-4" />}
                    label="当前结束"
                    value={formatDateTime(item.closesAt)}
                  />
                </div>

                <div className="space-y-4">
                  <FormField label="启用状态">
                    <select
                      className="field-input"
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
                        className="field-input"
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
                        className="field-input"
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
                  <StateNotice message="请按当前浏览器时区填写开始和结束时间。" />
                  {itemFeedback ? (
                    <StateNotice
                      message={itemFeedback.message}
                      tone={itemFeedback.tone}
                    />
                  ) : null}
                  <button
                    className="inline-flex min-h-10 items-center justify-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-md hover:bg-primary/90 transition-colors font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                    disabled={savingKey === item.key}
                    aria-busy={savingKey === item.key}
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
  return Object.fromEntries(
    items.map((item) => [item.key, buildDraft(item)]),
  ) as Partial<Record<EventWindowKey, WindowDraft>>;
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

function WindowStatusBadge({ state }: { state: EventWindowSummary["state"] }) {
  const tone = state === "open" ? "success" : state === "scheduled" ? "info" : "warn";
  const label = eventWindowStateLabels[state];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-sm font-medium",
        tone === "success" && "bg-tertiary/10 text-tertiary border-tertiary/20",
        tone === "warn" && "bg-error/10 text-error border-error/20",
        tone === "info" && "bg-primary/10 text-primary border-primary/20",
      )}
    >
      <Clock3 className="w-3.5 h-3.5" /> {label}
    </span>
  );
}
