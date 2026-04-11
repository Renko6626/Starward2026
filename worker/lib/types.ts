import type { Context } from "hono";

export type AppBindings = Env & {
  DB?: D1Database;
  BETTER_AUTH_SECRET?: string;
  BETTER_AUTH_URL?: string;
  RESEND_API_KEY?: string;
  RESEND_FROM_EMAIL?: string;
  RESEND_FROM_NAME?: string;
  TURNSTILE_SECRET_KEY?: string;
  TURNSTILE_SECRET?: string;
};

export type AppContext = Context<{ Bindings: AppBindings }>;
