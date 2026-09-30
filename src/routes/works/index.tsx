import { createFileRoute } from "@tanstack/react-router";
import { WorksPage } from "../../app/pages/WorksPage";
import { workTypeSchema } from "../../shared/works";

export const Route = createFileRoute("/works/")({
  validateSearch: (search: Record<string, unknown>) => ({
    view: search.view === "orbit" ? "orbit" as const : "gallery" as const,
    type: workTypeSchema.safeParse(search.type).success ? String(search.type) : "all",
    q: typeof search.q === "string" ? search.q : "",
  }),
  component: WorksPage,
});
