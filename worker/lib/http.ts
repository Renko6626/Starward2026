import { HTTPException } from "hono/http-exception";
import type { AppContext, RuntimeKind } from "./types";

export function jsonError(
  c: AppContext,
  status: number,
  code: string,
  message: string,
  details?: unknown,
) {
  return c.json(
    {
      error: {
        code,
        message,
        details,
      },
    },
    status as never,
  );
}

/**
 * Resolves the runtime marker for the current context, defaulting to the
 * Cloudflare Worker runtime so existing requests keep their behaviour.
 */
export function getRuntimeKind(c: AppContext): RuntimeKind {
  return c.env.RUNTIME ?? "cloudflare";
}

export function getRequiredDb(c: AppContext) {
  if (!c.env.DB) {
    throw new HTTPException(503, {
      message: "Database binding `DB` is not configured yet.",
    });
  }

  return c.env.DB;
}
