import {
  Children,
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type ButtonHTMLAttributes,
  type PropsWithChildren,
} from "react";
import { cn } from "../../lib/cn";
import { animate, press } from 'motion';
import { motion, useAnimationControls, useReducedMotion } from 'motion/react';
import { Power } from 'lucide-react';
import './buttons.css';

type Tone = "muted" | "info" | "warning" | "warn" | "success" | "error";
const toneClass = (tone: Tone) =>
  tone === "warn" ? "warning" : tone === "info" ? "muted" : tone;

/** Collapsing a section keeps its form mounted, preserving unsaved input. */
export function WorkspaceSection({ id, title, summary, defaultOpen = false, children }: PropsWithChildren<{
  id: string;
  title: string;
  summary?: ReactNode;
  defaultOpen?: boolean;
}>) {
  const [open, setOpen] = useState(defaultOpen);
  useEffect(() => {
    setOpen(defaultOpen);
  }, [defaultOpen]);
  useEffect(() => {
    function reveal() {
      setOpen(true);
      requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: "start" }));
    }
    function revealTarget() {
      if (window.location.hash === `#${id}`) {
        reveal();
      }
    }
    function revealClickedTarget(event: MouseEvent) {
      const anchor = event.target instanceof Element ? event.target.closest("a") : null;
      if (anchor?.getAttribute("href") === `#${id}`) reveal();
    }
    revealTarget();
    window.addEventListener("hashchange", revealTarget);
    window.addEventListener("click", revealClickedTarget);
    return () => {
      window.removeEventListener("hashchange", revealTarget);
      window.removeEventListener("click", revealClickedTarget);
    };
  }, [id]);
  return <details id={id} className="workspace-section" open={open} onToggle={event => setOpen(event.currentTarget.open)}>
    <summary><span className="workspace-section-title">{title}</span>{summary ? <span className="workspace-section-summary">{summary}</span> : null}</summary>
    <div className="workspace-section-body">{children}</div>
  </details>;
}

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
  error,
  children,
}: PropsWithChildren<{ label: string; hint?: string; error?: string }>) {
  const errorId = useId();
  return (
    <label className="form-field">
      <span className="field-label">{label}</span>
      {error ? Children.map(children, child => {
        if (!isValidElement<{ "aria-describedby"?: string; "aria-invalid"?: boolean }>(child)
          || !["input", "select", "textarea"].includes(String(child.type))) return child;
        return cloneElement(child, {
          "aria-invalid": true,
          "aria-describedby": [child.props["aria-describedby"], errorId].filter(Boolean).join(" "),
        });
      }) : children}
      {hint ? <span className="field-hint">{hint}</span> : null}
      {error ? <span id={errorId} className="field-error" role="alert">{error}</span> : null}
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
  appearance = "default",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger";
  appearance?: "default" | "industrial" | "framed";
}) {
  const root = useRef<HTMLButtonElement>(null);
  const reduced = useReducedMotion();
  const busy = props['aria-busy'] === true || props['aria-busy'] === 'true';
  const feedback = useAnimationControls();
  const previousBusy = useRef(busy);
  const [idleWidth, setIdleWidth] = useState<number>();
  useEffect(() => {
    if (previousBusy.current === busy) return;
    previousBusy.current = busy;
    feedback.stop();
    feedback.set({ opacity: reduced ? 1 : .6 });
    void feedback.start({ opacity: 1, transition: { duration: reduced ? 0 : .12 } });
  }, [busy, reduced, feedback]);
  useEffect(() => {
    if (props['aria-busy'] === undefined || busy || !root.current) return;
    const element = root.current;
    const observer = new ResizeObserver(() => setIdleWidth(element.getBoundingClientRect().width));
    observer.observe(element);
    return () => observer.disconnect();
  }, [busy, props['aria-busy']]);
  useEffect(() => {
    if (!root.current || reduced || props.disabled || appearance !== "default") return;
    const element = root.current;
    let animation: ReturnType<typeof animate> | undefined;
    const unbind = press(element, () => {
      animation?.stop();
      animation = animate(element, { scale: .98 }, { duration: .08 });
      return () => {
        animation?.stop();
        animation = animate(element, { scale: 1 }, { duration: .12 });
      };
    });
    return () => { unbind(); animation?.stop(); element.style.removeProperty('transform'); };
  }, [reduced, props.disabled, appearance]);
  return (
    <button
      ref={root}
      type="button"
      className={cn("button", `button--${variant}`, appearance !== "default" && "button--industrial", appearance === "framed" && "button--framed", className)}
      {...props}
      style={{ ...props.style, ...(busy && idleWidth ? { width: idleWidth } : {}) }}
    >
      <motion.span className="button-feedback" initial={false} animate={feedback}>
        {busy && <span className="button-busy-indicator" aria-hidden="true" />}{children}
        {appearance === "framed" && <span className="button-switch-bay" aria-hidden="true"><Power size={14} strokeWidth={2} /></span>}
      </motion.span>
    </button>
  );
}
