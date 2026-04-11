import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  applicationInterestFormatLabels,
  createApplicationInputSchema,
  type ApplicationIntakeResponse,
  type CreateApplicationInput,
  type CreateApplicationResponse,
} from "../../shared/applications";
import { requestJson } from "../lib/api";
import { SectionCard } from "../components/SectionCard";
import { StatusBadge } from "../components/StatusBadge";

type IntakeState =
  | { status: "loading" }
  | { status: "ready"; payload: ApplicationIntakeResponse }
  | { status: "error"; message: string };

const initialFormState: CreateApplicationInput = {
  displayName: "",
  contactEmail: "",
  contactHandle: "",
  interestFormat: "novel",
  introText: "",
  portfolioUrl: "",
  messageToHosts: "",
  turnstileToken: undefined,
};

export function ApplyPage() {
  const navigate = useNavigate();
  const [intake, setIntake] = useState<IntakeState>({ status: "loading" });
  const [form, setForm] = useState<CreateApplicationInput>(initialFormState);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    void requestJson<ApplicationIntakeResponse>("/api/applications/intake")
      .then((payload) => setIntake({ status: "ready", payload }))
      .catch((error: Error) => {
        setIntake({
          status: "error",
          message: error.message || "无法读取当前报名状态。",
        });
      });
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    const normalized = normalizeApplicationInput(form);
    const parsed = createApplicationInputSchema.safeParse(normalized);

    if (!parsed.success) {
      setErrorMessage("请先补全必填字段，并检查邮箱或链接格式。");
      return;
    }

    setSubmitting(true);

    try {
      await requestJson<CreateApplicationResponse>("/api/applications", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(parsed.data),
      });

      await navigate({ to: "/apply/success" });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "提交失败。");
    } finally {
      setSubmitting(false);
    }
  }

  const applicationOpen = intake.status === "ready" ? intake.payload.isOpen : false;

  return (
    <div className="page-stack">
      <div className="page-heading">
        <StatusBadge
          label={
            intake.status === "ready" && intake.payload.isOpen ? "报名开放中" : "报名未开放"
          }
          tone={intake.status === "ready" && intake.payload.isOpen ? "success" : "warn"}
        />
        <h1>报名表单</h1>
        <p>这一页先按第一期最低可用形态实现，重点是低打扰提交和后台可审核，不做花哨漏斗页。</p>
      </div>

      <div className="grid-two">
        <SectionCard
          eyebrow="当前状态"
          title="报名入口按活动窗口控制"
          description="是否允许提交由 `event_windows.application_open` 决定，而不是写死在前端。"
        >
          {intake.status === "loading" ? <p>正在读取当前报名状态。</p> : null}
          {intake.status === "error" ? (
            <p className="inline-message inline-message--error">{intake.message}</p>
          ) : null}
          {intake.status === "ready" ? (
            <div className="mini-card mini-card--compact">
              <strong>{intake.payload.window?.label ?? "报名开放"}</strong>
              <p>{intake.payload.isOpen ? "当前可提交报名。" : "当前关闭，开放时会在这里恢复提交。"}</p>
              <p>
                反滥用：
                {intake.payload.turnstileEnabled
                  ? " 已配置 Turnstile 服务端校验。"
                  : " 当前未配置 Turnstile，适合本地开发。"}
              </p>
            </div>
          ) : null}
        </SectionCard>

        <SectionCard
          eyebrow="填写说明"
          title="先收能支持审核的字段"
          description="现阶段不做很重的强校验，也不要求一步填完所有作品资料。"
        >
          <ul className="plain-list">
            <li>显示名和联系邮箱是必须字段。</li>
            <li>参加形式只用于主催初步判断分工，不是最终锁定。</li>
            <li>作品预告和内容审查说明会在通过后于参与者门户补录。</li>
            <li>若当前未开放招募，表单会保留但禁止提交。</li>
          </ul>
        </SectionCard>
      </div>

      <SectionCard
        eyebrow="公开表单"
        title="提交报名"
        description="提交成功后会进入后台审核，审核通过后才会进入参与者门户登录名单。"
      >
        <form className="form-grid" onSubmit={handleSubmit}>
          <div className="field-grid">
            <label className="field">
              <span>显示名</span>
              <input
                name="displayName"
                onChange={(event) => setForm({ ...form, displayName: event.target.value })}
                placeholder="你希望主催如何称呼你"
                value={form.displayName}
              />
            </label>

            <label className="field">
              <span>联系邮箱</span>
              <input
                name="contactEmail"
                onChange={(event) => setForm({ ...form, contactEmail: event.target.value })}
                placeholder="name@example.com"
                type="email"
                value={form.contactEmail}
              />
            </label>

            <label className="field">
              <span>联系方式备注</span>
              <input
                name="contactHandle"
                onChange={(event) => setForm({ ...form, contactHandle: event.target.value })}
                placeholder="QQ / Telegram / Discord / 其他"
                value={form.contactHandle ?? ""}
              />
            </label>

            <label className="field">
              <span>参加形式</span>
              <select
                name="interestFormat"
                onChange={(event) =>
                  setForm({
                    ...form,
                    interestFormat: event.target.value as CreateApplicationInput["interestFormat"],
                  })
                }
                value={form.interestFormat}
              >
                {(intake.status === "ready"
                  ? intake.payload.interestFormats
                  : Object.entries(applicationInterestFormatLabels).map(([value, label]) => ({
                      value,
                      label,
                    }))
                ).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="field">
            <span>自我介绍 / 参加意向</span>
            <textarea
              name="introText"
              onChange={(event) => setForm({ ...form, introText: event.target.value })}
              placeholder="简单介绍一下自己、参加动机或希望的创作方向。"
              rows={5}
              value={form.introText ?? ""}
            />
          </label>

          <label className="field">
            <span>作品或主页链接</span>
            <input
              name="portfolioUrl"
              onChange={(event) => setForm({ ...form, portfolioUrl: event.target.value })}
              placeholder="https://..."
              type="url"
              value={form.portfolioUrl ?? ""}
            />
          </label>

          <label className="field">
            <span>给主催的话</span>
            <textarea
              name="messageToHosts"
              onChange={(event) => setForm({ ...form, messageToHosts: event.target.value })}
              placeholder="可以写想参与的原因、时间安排说明，或其他想先告诉主催的话。"
              rows={5}
              value={form.messageToHosts ?? ""}
            />
          </label>

          {errorMessage ? <p className="inline-message inline-message--error">{errorMessage}</p> : null}

          <div className="action-row">
            <button className="button button--primary" disabled={!applicationOpen || submitting} type="submit">
              {submitting ? "提交中" : applicationOpen ? "提交报名" : "当前未开放提交"}
            </button>
            <Link className="button button--secondary" to="/">
              返回开始页
            </Link>
          </div>
        </form>
      </SectionCard>
    </div>
  );
}

function normalizeApplicationInput(form: CreateApplicationInput): CreateApplicationInput {
  return {
    displayName: form.displayName.trim(),
    contactEmail: form.contactEmail.trim(),
    contactHandle: normalizeOptional(form.contactHandle),
    interestFormat: form.interestFormat,
    introText: normalizeOptional(form.introText),
    portfolioUrl: normalizeOptional(form.portfolioUrl),
    messageToHosts: normalizeOptional(form.messageToHosts),
    turnstileToken: undefined,
  };
}

function normalizeOptional(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}
