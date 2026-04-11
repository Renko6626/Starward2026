type StatusBadgeProps = {
  label: string;
  tone?: "info" | "warn" | "success";
};

export function StatusBadge({ label, tone = "info" }: StatusBadgeProps) {
  return <span className={`status-badge status-badge--${tone}`}>{label}</span>;
}
