import { isQqEnabled } from "../lib/qq-oauth";
import { getPublicWork, listPublicWorks, listPublicSchedule } from "../data/works";
import { getRequiredDb, jsonError } from "../lib/http";
import { Hono } from "hono";
import {
  applicationInterestFormatLabels,
  type ApplicationIntakeResponse,
} from "../../src/shared/applications";
import type { AppRouteConfig } from "../lib/types";
import { getWindowOrFallback } from "../lib/windows";
import { listEventWindows } from "../data/event-windows";
import { getParticipationStatistics } from "../data/participation";
import { getTurnstileSecret } from '../lib/turnstile';

const publicApi = new Hono<AppRouteConfig>();

publicApi.get("/auth/providers", c => c.json({qq:{enabled:isQqEnabled(c.env)},turnstile:{enabled:Boolean(getTurnstileSecret(c.env))}}, 200, {"Cache-Control":"no-store"}));

publicApi.get("/health", (c) => {
  return c.json({
    status: "ok",
    service: "starward2026-worker",
    timestamp: new Date().toISOString(),
  });
});

publicApi.get("/applications/intake", async (c) => {
  c.header("Cache-Control", "no-store");
  let window = null;
  let statistics = null;

  if (c.env.DB) {
    const windows = await listEventWindows(c.env.DB);
    window = getWindowOrFallback(windows, "application_open");
    try {
      statistics = await getParticipationStatistics(c.env.DB);
    } catch (error) {
      console.error("Participation statistics unavailable", error);
    }
  }

  const response: ApplicationIntakeResponse = {
    isOpen: window?.isOpen ?? false,
    turnstileEnabled: Boolean(getTurnstileSecret(c.env)),
    window,
    statistics,
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
        message: "正式报名已调整为作者页面内提交。请先通过 /portal/login 建立账号并完成联系资料。",
      },
    },
    410,
  );
});

publicApi.get("/works", async (c) => {
  c.header("Cache-Control", "no-store");
  const db = getRequiredDb(c);
  const items = await listPublicWorks(db);
  return c.json({ items, schedule: await listPublicSchedule(db, items) });
});

publicApi.get("/works/:workId", async (c) => {
  c.header("Cache-Control", "no-store");
  const result = await getPublicWork(getRequiredDb(c), c.req.param("workId"));
  if (!result) return jsonError(c, 404, "not_found", "这份观测尚未公开或已撤下。");
  return c.json(result);
});

export { publicApi };
