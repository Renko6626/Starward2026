import {
  type ReactNode,
  type ButtonHTMLAttributes,
  type PropsWithChildren,
} from "react";
import { cn } from "../../lib/cn";

type Tone = "muted" | "info" | "warning" | "warn" | "success" | "error";
const toneClass = (tone: Tone) =>
  tone === "warn" ? "warning" : tone === "info" ? "muted" : tone;

export function PageHeading({
  title,
  description,
  eyebrow,
  children,
}: PropsWithChildren<{
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: string;
}>) {
  return (
    <header className="page-heading">
      <div>
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h1>{title}</h1>
        {description ? (
          <div className="page-description">{description}</div>
        ) : null}
      </div>
      {children ? <div className="page-heading-actions">{children}</div> : null}
    </header>
  );
}

export function Field({
  label,
  hint,
  children,
}: PropsWithChildren<{ label: string; hint?: string }>) {
  return (
    <label className="form-field">
      <span className="field-label">{label}</span>
      {children}
      {hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  );
}

export function Notice({
  children,
  tone = "muted",
}: PropsWithChildren<{ tone?: Tone }>) {
  return (
    <div
      className={`notice notice--${toneClass(tone)}`}
      role={tone === "error" ? "alert" : "status"}
    >
      {children}
    </div>
  );
}

export function StateNotice({
  message,
  tone = "info",
}: {
  message: string;
  tone?: Tone;
}) {
  return <Notice tone={tone}>{message}</Notice>;
}

export function ReadError({ message }: { message: string }) {
  return (
    <div className="space-y-4">
      <Notice tone="error">{message}</Notice>
      <button className="button button--secondary" type="button" onClick={() => window.location.reload()}>
        重新加载
      </button>
    </div>
  );
}

export function StatusBadge({
  children,
  tone = "muted",
}: PropsWithChildren<{ tone?: Tone }>) {
  return (
    <span className={`status-badge status-badge--${toneClass(tone)}`}>
      <span aria-hidden="true" />
      {children}
    </span>
  );
}

export function SummaryCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="summary-card">
      <p>
        {icon}
        {label}
      </p>
      <div>{value}</div>
    </div>
  );
}

export function MetricCard({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="metric-card">
      <p>{label}</p>
      <div>{value}</div>
    </div>
  );
}

export function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="detail-item">
      <p>{label}</p>
      <div>{value}</div>
    </div>
  );
}

export function DetailBlock({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="detail-block">
      <h3>{title}</h3>
      <p>{value}</p>
    </div>
  );
}

export function Button({
  children,
  className,
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger";
}) {
  return (
    <button
      type="button"
      className={cn("button", `button--${variant}`, className)}
      {...props}
    >
      {children}
    </button>
  );
}
