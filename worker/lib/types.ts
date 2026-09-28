import type { Context } from "hono";

/**
 * Deployment runtime that constructed the current application context.
 *
 * `"cloudflare"` keeps the existing Worker/D1 semantics; `"node"` selects the
 * VPS adapters (SQLite D1 facade, platform-neutral admin auth and rate
 * limiting). It is a marker only — it must never downgrade Cloudflare types.
 */
export type RuntimeKind = "cloudflare" | "node";

/**
 * Resolver injected by the Node entrypoint for VPS admin identity.
 *
 * It receives the raw request (for the Better Auth session cookie) plus the
 * request-scoped bindings (for `DB` and the configured admin allowlist). It
 * resolves to the verified admin email, or `null` when the request is not a
 * configured administrator. It must never derive identity from request headers.
 */
export type VpsAdminIdentityResolverInput = {
  request: Request;
  env: AppBindings;
};

export type VpsAdminIdentityResolver = (
  input: VpsAdminIdentityResolverInput,
) => Promise<string | null>;

export type AppBindings = Env & {
  DB?: D1Database;
  RUNTIME?: RuntimeKind;
  NODE_ENV?: string;
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
  VPS_ADMIN_MODE?: string;
  VPS_ADMIN_EMAILS?: string;
  VPS_ADMIN_IDENTITY_RESOLVER?: VpsAdminIdentityResolver;
  TRUST_PROXY_HEADERS?: string;
  TRUSTED_PROXY_IPS?: string;
};

export type AppVariables = {
  adminIdentity?: string;
};

export type AppRouteConfig = {
  Bindings: AppBindings;
  Variables: AppVariables;
};

export type AppContext = Context<AppRouteConfig>;
