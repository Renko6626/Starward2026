import { createFileRoute } from "@tanstack/react-router";
import { ApplySuccessPage } from "../../app/pages/ApplySuccessPage";

export const Route = createFileRoute("/apply/success")({
  component: ApplySuccessPage,
});
