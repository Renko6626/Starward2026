import { createFileRoute } from "@tanstack/react-router";
import { RulesPage } from "../app/pages/RulesPage";

export const Route = createFileRoute("/rules")({ component: RulesPage });
