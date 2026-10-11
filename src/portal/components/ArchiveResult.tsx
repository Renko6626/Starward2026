import { Notice } from "../../app/components/ui";
import { useSiteTranslation } from "../../i18n/use-site-translation";

export function ArchiveResult({ message, tone = "success", compact = false }: {
  message: string;
  tone?: "success" | "warning" | "error";
  compact?: boolean;
}) {
  const { label } = useSiteTranslation();
  if (!compact) return <Notice tone={tone}>{label(message)}</Notice>;
  return <div key={`${tone}:${message}`} className="archive-result" role={tone === "error" ? "alert" : "status"}>{label(message)}</div>;
}
