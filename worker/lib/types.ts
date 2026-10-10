import type { Context } from "hono";

export type AppBindings = Env & {
  DB?: D1Database;
  APPLICATION_SUBMIT_IP_RATE_LIMITER?: RateLimit;
  APPLICATION_SUBMIT_EMAIL_RATE_LIMITER?: RateLimit;
  QQ_OAUTH_ENABLED?: string;
  QQ_APP_ID?: string;
  QQ_APP_KEY?: string;
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
