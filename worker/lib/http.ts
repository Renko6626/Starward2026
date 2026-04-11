import { HTTPException } from "hono/http-exception";
import type { AppContext } from "./types";

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

export function getRequiredDb(c: AppContext) {
  if (!c.env.DB) {
    throw new HTTPException(503, {
      message: "D1 binding `DB` is not configured yet.",
    });
  }

  return c.env.DB;
}
