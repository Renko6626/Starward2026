import { createFileRoute } from "@tanstack/react-router";
import { ApplyPage } from "../../app/pages/ApplyPage";

export const Route = createFileRoute("/apply/")({
  component: ApplyPage,
});
