import type { Context } from "hono";

/**
 * Deployment runtime that constructed the current application context.
 *
 * `"cloudflare"` keeps the existing Worker/D1 semantics; `"node"` selects the
 * VPS adapters (SQLite D1 facade, platform-neutral admin auth and rate
 * limiting). It is a marker only — it must never downgrade Cloudflare types.
 */
export type RuntimeKind = "cloudflare" | "node";

export type AppBindings = Env & {
  DB?: D1Database;
  RUNTIME?: RuntimeKind;
  APPLICATION_SUBMIT_IP_RATE_LIMITER?: RateLimit;
  APPLICATION_SUBMIT_EMAIL_RATE_LIMITER?: RateLimit;
  BETTER_AUTH_SECRET?: string;
  BETTER_AUTH_URL?: string;
  BETTER_AUTH_TRUSTED_ORIGINS?: string;
  ALLOW_LOCAL_DEV_ORIGINS?: string;
  CLOUDFLARE_ACCESS_TEAM_DOMAIN?: string;
  CLOUDFLARE_ACCESS_POLICY_AUD?: string;
  ALLOW_LOCAL_ADMIN_BYPASS?: string;
  RESEND_API_KEY?: string;
  RESEND_FROM_EMAIL?: string;
  RESEND_FROM_NAME?: string;
  TURNSTILE_SECRET_KEY?: string;
  TURNSTILE_SECRET?: string;
};

export type AppVariables = {
  adminIdentity?: string;
};

export type AppRouteConfig = {
  Bindings: AppBindings;
  Variables: AppVariables;
};

export type AppContext = Context<AppRouteConfig>;
