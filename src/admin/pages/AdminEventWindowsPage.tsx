import { useEffect, useState } from "react";
import type { AdminEventWindowListResponse, AdminEventWindowMutationResponse } from "../../shared/admin";
import type { EventWindowKey, EventWindowSummary } from "../../shared/windows";
import { SectionCard } from "../../app/components/SectionCard";
import { requestJson } from "../../app/lib/api";
import { formatDateTime } from "../../app/lib/format";
import { StatusBadge } from "../../app/components/StatusBadge";

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
    <div className="page-stack">
      <SectionCard
        eyebrow="后台 / 动作窗口"
        title="开放窗口管理"
        description="所有报名、认领、改坑和资料提交动作都应由服务端读取 `event_windows` 判定。前端只展示状态，不单独决定开放逻辑。"
      >
        {state.status === "loading" ? <p>正在读取动作窗口。</p> : null}
        {state.status === "error" ? (
          <p className="inline-message inline-message--error">{state.message}</p>
        ) : null}
        {state.status === "ready" ? (
          <div className="route-grid">
            {state.payload.items.map((item) => {
              const draft = drafts[item.key] ?? buildDraft(item);
              const itemFeedback = feedback[item.key];

              return (
                <div key={item.key} className="mini-card">
                  <StatusBadge
                    label={item.isOpen ? "当前开放" : item.isEnabled ? "等待时间到达" : "已关闭"}
                    tone={item.isOpen ? "success" : item.isEnabled ? "info" : "warn"}
                  />
                  <strong>{item.label}</strong>
                  <p>窗口键：{item.key}</p>
                  <p>当前开始：{formatDateTime(item.opensAt)}</p>
                  <p>当前结束：{formatDateTime(item.closesAt)}</p>
                  <p>最近更新：{formatDateTime(item.updatedAt)}</p>

                  <div className="form-grid">
                    <label className="field">
                      <span>启用状态</span>
                      <select
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
                    </label>

                    <label className="field">
                      <span>开始时间</span>
                      <input
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
                    </label>

                    <label className="field">
                      <span>结束时间</span>
                      <input
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
                    </label>
                  </div>

                  <p className="inline-message">
                    时间按你当前浏览器时区填写，保存后统一转成 ISO 时间由服务端计算是否开放。
                  </p>
                  {itemFeedback ? (
                    <p
                      className={
                        itemFeedback.tone === "error"
                          ? "inline-message inline-message--error"
                          : "inline-message inline-message--success"
                      }
                    >
                      {itemFeedback.message}
                    </p>
                  ) : null}

                  <div className="action-row">
                    <button
                      className="button button--primary"
                      disabled={savingKey === item.key}
                      onClick={() => void handleSave(item.key)}
                      type="button"
                    >
                      {savingKey === item.key ? "保存中" : "保存窗口设置"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </SectionCard>
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
