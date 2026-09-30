import { getPublicWork, listPublicWorks } from "../data/works";
import { getRequiredDb, jsonError } from "../lib/http";
import { Hono } from "hono";
import {
  applicationInterestFormatLabels,
  type ApplicationIntakeResponse,
} from "../../src/shared/applications";
import type { AppRouteConfig } from "../lib/types";
import { getWindowOrFallback } from "../lib/windows";
import { listEventWindows } from "../data/event-windows";

const publicApi = new Hono<AppRouteConfig>();

publicApi.get("/health", (c) => {
  return c.json({
    status: "ok",
    service: "starward2026-worker",
    timestamp: new Date().toISOString(),
  });
});

publicApi.get("/applications/intake", async (c) => {
  let window = null;

  if (c.env.DB) {
    const windows = await listEventWindows(c.env.DB);
    window = getWindowOrFallback(windows, "application_open");
  }

  const response: ApplicationIntakeResponse = {
    isOpen: window?.isOpen ?? false,
    turnstileEnabled: Boolean(c.env.TURNSTILE_SECRET_KEY ?? c.env.TURNSTILE_SECRET),
    window,
    interestFormats: Object.entries(applicationInterestFormatLabels).map(([value, label]) => ({
      value: value as keyof typeof applicationInterestFormatLabels,
      label,
    })),
  };

  return c.json(response);
});

publicApi.post("/applications", async (c) => {
  return c.json(
    {
      error: {
        code: "formal_application_moved",
        message: "正式报名已调整为参与者入口内提交。请先通过 /portal/login 建立账号并完成联系资料。",
      },
    },
    410,
  );
});

publicApi.get("/works", async (c) => {
  c.header("Cache-Control", "no-store");
  return c.json({ items: await listPublicWorks(getRequiredDb(c)) });
});

publicApi.get("/works/:workId", async (c) => {
  c.header("Cache-Control", "no-store");
  const result = await getPublicWork(getRequiredDb(c), c.req.param("workId"));
  if (!result) return jsonError(c, 404, "not_found", "这份观测尚未公开或已撤下。");
  return c.json(result);
});

export { publicApi };
