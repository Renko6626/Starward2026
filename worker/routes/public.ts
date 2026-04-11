import { Hono } from "hono";
import {
  applicationInterestFormatLabels,
  createApplicationInputSchema,
  type ApplicationIntakeResponse,
  type CreateApplicationResponse,
} from "../../src/shared/applications";
import { getRequiredDb } from "../lib/http";
import { verifyTurnstileToken } from "../lib/turnstile";
import type { AppBindings } from "../lib/types";
import { getWindowOrFallback } from "../lib/windows";
import { createApplication } from "../data/applications";
import { listEventWindows } from "../data/event-windows";

const publicApi = new Hono<{ Bindings: AppBindings }>();

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
  const db = getRequiredDb(c);
  const body = await c.req.json().catch(() => null);
  const parsed = createApplicationInputSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      {
        error: {
          code: "invalid_request",
          message: "报名表单内容不完整或格式不正确。",
          details: parsed.error.flatten(),
        },
      },
      422,
    );
  }

  const windows = await listEventWindows(db);
  const applicationWindow = getWindowOrFallback(windows, "application_open");

  if (!applicationWindow.isOpen) {
    return c.json(
      {
        error: {
          code: "application_closed",
          message: "当前报名未开放。",
        },
      },
      403,
    );
  }

  await verifyTurnstileToken(c, parsed.data.turnstileToken);
  const applicationId = await createApplication(db, parsed.data);
  const response: CreateApplicationResponse = {
    ok: true,
    applicationId,
  };

  return c.json(response, 201);
});

export { publicApi };
