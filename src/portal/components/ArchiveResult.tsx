import { Notice } from "../../app/components/ui";

export function ArchiveResult({ message, tone = "success", compact = false }: {
  message: string;
  tone?: "success" | "warning" | "error";
  compact?: boolean;
}) {
  if (!compact) return <Notice tone={tone}>{message}</Notice>;
  return <div key={`${tone}:${message}`} className="archive-result" role={tone === "error" ? "alert" : "status"}>{message}</div>;
}
