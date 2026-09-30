import { createFileRoute } from "@tanstack/react-router";
import { WorkDetailPage } from "../../app/pages/WorkDetailPage";

export const Route = createFileRoute("/works/$workId")({ component: WorkDetailPage });
