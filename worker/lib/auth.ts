import { genericOAuth } from "better-auth/plugins/generic-oauth";
import { buildQqProvider } from "./qq-oauth";
import { getRealAuthEmail, isReservedAuthEmail } from "../../src/shared/auth-identity";
import { betterAuth } from "better-auth";
import type { GenericEndpointContext } from "better-auth";
import {
  APIError,
  createAuthEndpoint,
  createAuthMiddleware,
  setPassword,
  getSessionFromCtx,
  getOAuthState,
} from "better-auth/api";
import { emailOTP } from "better-auth/plugins/email-otp";
import { captcha } from "better-auth/plugins";
import { getTurnstileSecret } from './turnstile';
import { TURNSTILE_AUTH_ENDPOINTS } from '../../src/shared/turnstile';
import { HTTPException } from "hono/http-exception";
import { Resend } from "resend";
import { z } from "zod";
import { limitAuthOtpSend } from "./auth-rate-limit";
import { buildPortalOtpEmail } from "./auth-email";
import {
  PORTAL_EMAIL_OTP_ALLOWED_ATTEMPTS,
  PORTAL_EMAIL_OTP_EXPIRES_IN_SECONDS,
  PORTAL_EMAIL_OTP_LENGTH,
  PORTAL_EMAIL_OTP_RATE_LIMIT_MAX,
  PORTAL_EMAIL_OTP_RATE_LIMIT_WINDOW_SECONDS,
  PORTAL_EMAIL_OTP_RESEND_STRATEGY,
  PORTAL_EMAIL_OTP_STORE_MODE,
  PORTAL_PASSWORD_SETUP_HEADER,
} from "../../src/shared/email-otp";
import type { AppContext, AppBindings } from "./types";
import { saveActivityRuleAcceptance } from "../data/activity-rule-acceptances";
import { requireActivityRulesConsent, requireAccountCreationConsent } from "./activity-rule-consent";
import { NEW_ACCOUNT_RESPONSE_HEADER } from "../../src/shared/activity-rules";
import {
  ensureParticipantForAuthUser,
  getParticipantByInviteEmail,
  getParticipantByUserId,
  normalizeEmailAddress,
} from "../data/participants";

const AUTH_PLUGIN_VERSION = "0.1.0";
const PORTAL_SESSION_EXPIRES_IN_SECONDS = 60 * 60 * 24 * 30;
const PORTAL_SESSION_UPDATE_AGE_SECONDS = 60 * 60 * 24;
const LOCALHOST_HOSTNAME = "localhost";
const IPV6_LOOPBACK_HOSTNAME = "[::1]";

function getRequiredAuthEnv(env: AppBindings) {
  if (!env.DB) {
    throw new HTTPException(503, {
      message: "D1 binding `DB` is not configured yet.",
    });
  }

  if (!env.BETTER_AUTH_SECRET) {
    throw new HTTPException(503, {
      message: "Better Auth secret is not configured yet.",
    });
  }

  return {
    db: env.DB,
    secret: env.BETTER_AUTH_SECRET,
    baseUrl: normalizeBaseUrl(env.BETTER_AUTH_URL),
  };
}

function normalizeBaseUrl(value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }

  return trimmed.replace(/\/+$/, "");
}

async function rollbackNewQqAccount(db: D1Database, userId: string) {
  await db.batch([
    db.prepare("DELETE FROM participants WHERE user_id = ?").bind(userId),
    db.prepare('DELETE FROM "user" WHERE id = ?').bind(userId),
  ]);
}

function buildPortalEntryPlugin(env: AppBindings, pendingQqSignups: WeakMap<Request, string>) {
  const { db } = getRequiredAuthEnv(env);
  // Better Auth defers session after-hooks beyond the request-state scope.
  // Capture only our server-created signup ID in its immediate before-hook.
  const sessionSignupIds = new WeakMap<GenericEndpointContext, string>();
  const linkingSessions = new WeakMap<GenericEndpointContext, { userId: string; sessionId: string }>();

  return {
    id: "portal-entry",
    version: AUTH_PLUGIN_VERSION,
    endpoints: {
      setPassword: createAuthEndpoint(
        "/set-password",
        setPassword.options,
        setPassword,
      ),
    },
    init() {
      return {
        options: {
          databaseHooks: {
            account: {
              create: {
                async before(_account: Record<string, unknown>, context: GenericEndpointContext | null) {
                  if (!context?.path?.startsWith('/oauth2/callback')) return;
                  const state = await getOAuthState();
                  if (!state?.link) return;
                  const session = await getSessionFromCtx(context, { disableCookieCache: true });
                  if (!session || session.user.id !== state.link.userId || (getRealAuthEmail(session.user.email) && !session.user.emailVerified)) {
                    throw new APIError('FORBIDDEN', { code: 'QQ_LINK_SESSION_CHANGED', message: '请先验证登录邮箱，再重新绑定 QQ。' });
                  }
                  linkingSessions.set(context, { userId: session.user.id, sessionId: session.session.id });
                },
                async after(account: { id: string } & Record<string, unknown>, context: GenericEndpointContext | null) {
                  const link = context && linkingSessions.get(context);
                  if (!link) return;
                  // Check after insertion so revocation overlapping the provider request
                  // either deletes this new link, or is observed here and rolls it back.
                  const current = await db.prepare('SELECT u.email, u.emailVerified FROM session s JOIN "user" u ON u.id = s.userId WHERE s.id = ? AND s.userId = ?')
                    .bind(link.sessionId, link.userId).first<{ email: string; emailVerified: number }>();
                  if (!current || (getRealAuthEmail(current.email) && !current.emailVerified)) {
                    await db.prepare('DELETE FROM account WHERE id = ?').bind(account.id).run();
                    throw new APIError('FORBIDDEN', { code: 'QQ_LINK_SESSION_CHANGED', message: '绑定期间登录状态已变化，请重新登录后绑定。' });
                  }
                },
              },
            },
            user: {
              update: {
                async before(data: Record<string, unknown>, context: GenericEndpointContext | null) {
                  if (context?.path !== '/sign-in/email-otp' || data.emailVerified !== true) return;
                  // Better Auth reaches this hook only after consuming a valid OTP.
                  // An unverified signup's old password/session never proves mailbox ownership.
                  const user = await db.prepare('SELECT id FROM "user" WHERE email = ? AND emailVerified = 0')
                    .bind(String(context.body.email)).first<{ id: string }>();
                  if (user) await db.batch([
                    db.prepare('DELETE FROM account WHERE userId = ?').bind(user.id),
                    db.prepare('DELETE FROM session WHERE userId = ?').bind(user.id),
                  ]);
                },
              },
              create: {
                async before(_user: Record<string, unknown>, context: GenericEndpointContext | null) {
                  await requireAccountCreationConsent(context);
                },
                async after(user: { id: string } & Record<string, unknown>, context: GenericEndpointContext | null) {
                  const version = await requireAccountCreationConsent(context);
                  const oauthState = context?.path?.startsWith("/oauth2/callback") ? await getOAuthState() : null;
                  if (oauthState && !oauthState.link) {
                    oauthState.starwardCreatedUserId = user.id;
                    if (context?.request) pendingQqSignups.set(context.request, user.id);
                  }
                  try {
                    await saveActivityRuleAcceptance(db, user.id, version);
                  } catch {
                    // Roll back only this newly created account if consent could not be recorded.
                    await db.prepare('DELETE FROM "user" WHERE id = ?').bind(user.id).run();
                    throw new APIError("SERVICE_UNAVAILABLE", {
                      code: "ACTIVITY_RULES_SAVE_FAILED",
                      message: context?.path?.startsWith("/oauth2/callback") ? "ACTIVITY_RULES_SAVE_FAILED" : "暂时无法保存规则确认，账号尚未建立，请稍后重试。",
                    });
                  }
                },
              },
            },
            session: {
              create: {
                async before(_session: Record<string, unknown>, context: GenericEndpointContext | null) {
                  if (!context?.path?.startsWith("/oauth2/callback")) return;
                  const state = await getOAuthState();
                  if (typeof state?.starwardCreatedUserId === "string") sessionSignupIds.set(context, state.starwardCreatedUserId);
                },
                async after(
                  session: { userId: string } & Record<string, unknown>,
                  context: GenericEndpointContext | null,
                ) {
                  if (!context?.path || !["/sign-in/email-otp", "/sign-in/email", "/sign-up/email", "/oauth2/callback/:providerId", "/oauth2/callback/qq"].includes(context.path)) return;
                  const user = await db.prepare('SELECT email, emailVerified FROM "user" WHERE id = ?').bind(session.userId).first<{email:string;emailVerified:number}>();
                  if (!user) return;
                  const createdUserId = sessionSignupIds.get(context);
                  try {
                    await ensureParticipantForAuthUser(db, { email:getRealAuthEmail(user.email), emailVerified:Boolean(user.emailVerified), userId:session.userId });

                  } catch {
                    await db.prepare("DELETE FROM session WHERE id = ?").bind(String(session.id)).run();
                    if (createdUserId === session.userId) await rollbackNewQqAccount(db, session.userId);
                    throw new APIError("SERVICE_UNAVAILABLE", { code:"WORKSPACE_SETUP_FAILED", message:context.path.startsWith("/oauth2/callback") ? "WORKSPACE_SETUP_FAILED" : "暂时无法建立作者页面，请稍后重新登录。" });
                  }
                },
              },
            },
          },
        },
      };
    },
    hooks: {
      after: [{
        matcher: (context: { path?: string }) => Boolean(context.path?.startsWith("/oauth2/callback")),
        handler: createAuthMiddleware(async ctx => {
          const state = await getOAuthState();
          if (typeof state?.starwardCreatedUserId === "string" && (ctx.context.responseHeaders?.get("location")?.includes("error=") || (ctx.context.returned instanceof APIError && ctx.context.returned.statusCode >= 400))) await rollbackNewQqAccount(db, state.starwardCreatedUserId);
        }),
      }, {
        matcher: (context: { path?: string }) => context.path === "/sign-in/email-otp",
        handler: createAuthMiddleware(async ctx => {
          const returned = ctx.context.returned as { user?: { id?: string; emailVerified?: boolean } } | undefined;
          if (ctx.body.__starwardNewAccount === true && returned?.user?.id) {
            ctx.setHeader(NEW_ACCOUNT_RESPONSE_HEADER, "true");
          }
          if (returned?.user?.id && !(ctx.context.returned instanceof APIError)) {
            returned.user.emailVerified = true;
            const credential = await db.prepare("SELECT id FROM account WHERE userId = ? AND providerId = 'credential' AND password IS NOT NULL")
              .bind(returned.user.id).first();
            if (!credential) ctx.setHeader(PORTAL_PASSWORD_SETUP_HEADER, 'true');
          }
        }),
      }],
      before: [
        {
          matcher: () => true,
          handler: createAuthMiddleware(async ctx => {
            if (["/forget-password/email-otp", "/email-otp/change-email", "/email-otp/request-email-change", "/email-otp/verify-email"].includes(ctx.path ?? "")) throw new APIError("FORBIDDEN", { code:"email_purpose_disabled", message:"邮件仅用于登录验证码。" });
            if (ctx.path === "/sign-in/oauth2" && ctx.body?.providerId === "qq") {
              ctx.body.additionalData = ctx.body.requestSignUp === true ? { starwardRulesVersion:requireActivityRulesConsent(ctx) } : {};
            }
            const email = typeof ctx.body?.email === "string" ? ctx.body.email : typeof ctx.body?.newEmail === "string" ? ctx.body.newEmail : null;
            if (email && isReservedAuthEmail(email)) throw new APIError("FORBIDDEN", { code:"RESERVED_AUTH_EMAIL", message:"此地址不能用于邮箱登录或联系资料。" });
            if (["/set-password", "/change-password", "/change-email", "/oauth2/link", "/link-social"].includes(ctx.path ?? "")) {
              const session = await getSessionFromCtx(ctx);
              if (session && isReservedAuthEmail(session.user.email) && ["/set-password", "/change-password", "/change-email"].includes(ctx.path)) throw new APIError("FORBIDDEN", { code:"QQ_ONLY_ACCOUNT", message:"此账号使用 QQ 登录。填写联系邮箱不会开通邮箱密码登录。" });
              if (session && getRealAuthEmail(session.user.email) && !session.user.emailVerified) throw new APIError('FORBIDDEN', { code: 'EMAIL_NOT_VERIFIED', message: '请先通过邮箱验证码验证登录邮箱。' });
            }
          }),
        },
        {
          matcher(context: { path?: string }) {
            return (
              context.path === "/email-otp/send-verification-otp" ||
              context.path === "/sign-in/email-otp" ||
              context.path === "/sign-in/email" ||
              context.path === "/sign-up/email" ||
              context.path === "/email-otp/request-password-reset" ||
              context.path === "/email-otp/reset-password"
            );
          },
          handler: createAuthMiddleware(async (ctx) => {
            if (
              ctx.path === "/sign-in/email" ||
              ctx.path === "/sign-up/email"
            ) {
              const email = normalizeEmailAddress(
                typeof ctx.body?.email === "string" ? ctx.body.email : "",
              );
              ctx.body.email = email;
              if (ctx.path === "/sign-up/email") {
                throw new APIError('FORBIDDEN', { code: 'OTP_REGISTRATION_REQUIRED', message: '请先通过邮箱验证码注册，再设置登录密码。' });
              }
              return;
            }

            const resetting = ctx.path === '/email-otp/request-password-reset' || ctx.path === '/email-otp/reset-password';
            const type = resetting ? 'forget-password' : ctx.path === '/sign-in/email-otp'
              ? 'sign-in' : typeof ctx.body?.type === 'string' ? ctx.body.type : null;
            if (type !== 'sign-in' && type !== 'forget-password') {
              throw new APIError('FORBIDDEN', { code: 'email_purpose_disabled', message: '邮件仅用于注册、登录和密码重置验证码。' });
            }
            const email = normalizeEmailAddress(typeof ctx.body?.email === 'string' ? ctx.body.email : '');
            if (!z.string().email().max(320).safeParse(email).success) throw new APIError('BAD_REQUEST', { code: 'INVALID_EMAIL', message: '请填写有效的登录邮箱。' });
            ctx.body.email = email;
            if (ctx.path === '/email-otp/reset-password') {
              // Validate before Better Auth consumes the reset code.
              const password = typeof ctx.body.password === 'string' ? ctx.body.password : '';
              if (password.length < 8 || password.length > 128) throw new APIError('BAD_REQUEST', { code: 'INVALID_PASSWORD_LENGTH', message: '请设置 8–128 位密码。' });
              return;
            }
            if (type === 'sign-in') {
              const existingUser = await db.prepare('SELECT id FROM "user" WHERE email = ? LIMIT 1').bind(email).first();
              if (ctx.path === '/sign-in/email-otp') ctx.body.__starwardNewAccount = !existingUser;
              if (!existingUser) requireActivityRulesConsent(ctx);
              if (ctx.path === '/sign-in/email-otp') {
                const participant = await getParticipantByInviteEmail(db, email);
                ctx.body.name = participant?.display_name || email.split('@')[0] || '参与者';
              }
            }
            if (ctx.path === '/email-otp/send-verification-otp' || ctx.path === '/email-otp/request-password-reset') {
              if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL) throw new APIError('SERVICE_UNAVAILABLE', { code: 'OTP_SEND_UNAVAILABLE', message: '验证码服务暂时不可用，请稍后再试。' });
              await limitAuthOtpSend(env, ctx, email);
            }
          }),
        },
      ],
    },
  };
}

async function sendPortalOtpEmail(
  env: AppBindings,
  payload: {
    email: string;
    otp: string;
    type: "sign-in" | "email-verification" | "forget-password" | "change-email";
  },
  siteUrl: string,
) {
  if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL) {
    throw new HTTPException(503, {
      message: "Resend mail sender is not configured yet.",
    });
  }
  const resend = new Resend(env.RESEND_API_KEY);
  const resendFromEmail = env.RESEND_FROM_EMAIL;
  const resendFromName = env.RESEND_FROM_NAME?.trim() || "Starward2026";
  if (payload.type !== "sign-in" && payload.type !== "forget-password") {
    throw new APIError("FORBIDDEN", { code: "email_purpose_disabled", message: "邮件仅用于注册、登录和密码重置验证码。" });
  }
  const content = buildPortalOtpEmail({ otp: payload.otp, type: payload.type, siteUrl });

  const response = await resend.emails.send({
    from: `${resendFromName} <${resendFromEmail}>`,
    to: payload.email,
    ...content,
  });

  if (response.error) {
    throw new Error(
      response.error.message || "Failed to send verification OTP email.",
    );
  }
}

export function buildPortalEmailOtpOptions(env: AppBindings, failedMailRequests?: WeakMap<Request, true>) {
  return {
    disableSignUp: false,
    expiresIn: PORTAL_EMAIL_OTP_EXPIRES_IN_SECONDS,
    otpLength: PORTAL_EMAIL_OTP_LENGTH,
    allowedAttempts: PORTAL_EMAIL_OTP_ALLOWED_ATTEMPTS,
    storeOTP: PORTAL_EMAIL_OTP_STORE_MODE,
    resendStrategy: PORTAL_EMAIL_OTP_RESEND_STRATEGY,
    rateLimit: {
      window: PORTAL_EMAIL_OTP_RATE_LIMIT_WINDOW_SECONDS,
      max: PORTAL_EMAIL_OTP_RATE_LIMIT_MAX,
    },
    async sendVerificationOTP(payload: {
      email: string;
      otp: string;
      type:
        | "sign-in"
        | "email-verification"
        | "forget-password"
        | "change-email";
    }, context?: GenericEndpointContext) {
      try {
        const siteUrl = normalizeBaseUrl(env.BETTER_AUTH_URL) ?? (context?.request && new URL(context.request.url).origin);
        if (!siteUrl) throw new Error("The email website URL is not configured.");
        await sendPortalOtpEmail(env, payload, siteUrl);
      } catch (error) {
        // 1.6.2 swallows mail errors as background failures; preserve the request result.
        if (context?.request && failedMailRequests) failedMailRequests.set(context.request, true);
        else throw error;
      }
    },
  };
}

export function buildPortalSessionOptions() {
  return {
    expiresIn: PORTAL_SESSION_EXPIRES_IN_SECONDS,
    updateAge: PORTAL_SESSION_UPDATE_AGE_SECONDS,
  };
}

function buildPortalCaptchaPlugin(secretKey: string) {
  const plugin = captcha({ provider: 'cloudflare-turnstile', secretKey, endpoints: TURNSTILE_AUTH_ENDPOINTS });
  return {
    ...plugin,
    onRequest: async (...args: Parameters<typeof plugin.onRequest>) => {
      // 1.6 matches substrings: /sign-in/email also catches /sign-in/email-otp.
      // Keep the native verifier, but only run it on our exact protected paths.
      const path = new URL(args[0].url).pathname.replace(/\/+$/, '');
      if (!TURNSTILE_AUTH_ENDPOINTS.some(endpoint => path === `/api/auth${endpoint}`)) return;
      return plugin.onRequest(...args);
    },
  };
}

export function buildPortalTrustedOrigins(
  env: Pick<
    AppBindings,
    | "BETTER_AUTH_TRUSTED_ORIGINS"
    | "BETTER_AUTH_URL"
    | "ALLOW_LOCAL_DEV_ORIGINS"
  >,
) {
  const configuredOrigins = new Set<string>();
  const baseUrl = normalizeBaseUrl(env.BETTER_AUTH_URL);

  if (baseUrl) {
    configuredOrigins.add(baseUrl);
  }

  for (const origin of parseConfiguredTrustedOrigins(
    env.BETTER_AUTH_TRUSTED_ORIGINS,
  )) {
    configuredOrigins.add(origin);
  }

  // Dynamically trusting loopback/private-network request origins is a
  // development-only convenience. It must stay opt-in: enabling it in a
  // deployed environment would let any page served from the victim's LAN pass
  // Better Auth's origin/CSRF check. Production should instead list its origins
  // via BETTER_AUTH_TRUSTED_ORIGINS.
  const allowLocalDevOrigins = isLocalDevOriginsEnabled(
    env.ALLOW_LOCAL_DEV_ORIGINS,
  );

  return async (request?: Request) => {
    const trustedOrigins = new Set(configuredOrigins);

    if (!request || !allowLocalDevOrigins) {
      return [...trustedOrigins];
    }

    for (const candidate of [
      new URL(request.url).origin,
      request.headers.get("origin"),
      request.headers.get("referer"),
    ]) {
      const normalizedOrigin = normalizeOriginCandidate(candidate);

      if (normalizedOrigin && isLocalDevelopmentOrigin(normalizedOrigin)) {
        trustedOrigins.add(normalizedOrigin);
      }
    }

    return [...trustedOrigins];
  };
}

function isLocalDevOriginsEnabled(value: string | undefined) {
  return value?.trim().toLowerCase() === "true";
}

export function createAuth(env: AppBindings) {
  const { db, secret, baseUrl } = getRequiredAuthEnv(env);

  const qq = buildQqProvider(env);
  const pendingQqSignups = new WeakMap<Request, string>();
  const failedMailRequests = new WeakMap<Request, true>();
  const auth = betterAuth({
    secret,
    database: db,
    baseURL: baseUrl,
    basePath: "/api/auth",
    trustedOrigins: buildPortalTrustedOrigins(env),
    advanced: { ipAddress: { ipAddressHeaders: ['cf-connecting-ip'] } },
    rateLimit: { enabled: !isLocalDevOriginsEnabled(env.ALLOW_LOCAL_DEV_ORIGINS), customRules: {
      '/email-otp/send-verification-otp': { window: 60, max: 10 },
      '/email-otp/request-password-reset': { window: 60, max: 10 },
    } },
    onAPIError: { errorURL: baseUrl ? `${baseUrl}/portal/login` : "/portal/login" },
    session: buildPortalSessionOptions(),
    account: { accountLinking: { enabled:true, disableImplicitLinking:true, allowDifferentEmails:true } },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      disableSignUp: true,
      revokeSessionsOnPasswordReset: true,
      async onPasswordReset({ user }) {
        if (!user.emailVerified) {
          // The native handler has already validated the OTP and saved the new password.
          await db.batch([
            db.prepare("DELETE FROM account WHERE userId = ? AND providerId != 'credential'").bind(user.id),
            db.prepare('DELETE FROM session WHERE userId = ?').bind(user.id),
          ]);
        }
      },
      minPasswordLength: 8,
      maxPasswordLength: 128,
    },
    plugins: [
      ...(getTurnstileSecret(env) ? [buildPortalCaptchaPlugin(getTurnstileSecret(env)!)] : []),
      buildPortalEntryPlugin(env, pendingQqSignups),
      emailOTP(buildPortalEmailOtpOptions(env, failedMailRequests)),
      ...(qq ? [genericOAuth({config:[qq]})] : []),
    ],
  });
  return { ...auth, handler: async (request: Request) => {
    const isQqCallback = new URL(request.url).pathname === "/api/auth/oauth2/callback/qq";
    const cleanup = async () => {
      const userId = pendingQqSignups.get(request);
      if (userId) await rollbackNewQqAccount(db, userId);
    };
    try {
      const response = await auth.handler(request);
      if (failedMailRequests.has(request)) return Response.json({ code: 'OTP_SEND_FAILED', message: '验证码发送失败，请稍后重试。' }, { status: 503 });
      if (isQqCallback && (response.status >= 400 || response.headers.get("location")?.includes("error="))) {
        await cleanup();
        if (response.status >= 400) return Response.redirect(new URL("/portal/login?error=qq_auth_failed", baseUrl || request.url).toString(), 302);
      }
      return response;
    } catch (error) {
      if (isQqCallback) {
        await cleanup();
        return Response.redirect(new URL("/portal/login?error=qq_auth_failed", baseUrl || request.url).toString(), 302);
      }
      if (error instanceof APIError) {
        const headers = new Headers(error.headers);
        headers.set('Content-Type', 'application/json');
        return new Response(JSON.stringify(error.body), { status: error.statusCode, headers });
      }
      throw error;
    } finally { pendingQqSignups.delete(request); failedMailRequests.delete(request); }
  } };

}

function applyAuthResponseHeaders(c: AppContext, headers: Headers) {
  const setCookieHeaders =
    typeof (headers as Headers & { getSetCookie?: () => string[] })
      .getSetCookie === "function"
      ? (headers as Headers & { getSetCookie: () => string[] }).getSetCookie()
      : [];

  for (const value of setCookieHeaders) {
    c.header("Set-Cookie", value, { append: true });
  }

  headers.forEach((value, key) => {
    if (key.toLowerCase() === "set-cookie") {
      return;
    }

    c.header(key, value);
  });
}

export async function requireParticipantSession(c: AppContext) {
  const auth = createAuth(c.env);
  const db = getRequiredAuthEnv(c.env).db;
  const result = await auth.api.getSession({
    headers: c.req.raw.headers,
    returnHeaders: true,
  });

  applyAuthResponseHeaders(c, result.headers);

  if (!result.response) {
    return null;
  }
  if (getRealAuthEmail(result.response.user.email) && !result.response.user.emailVerified) return null;

  let participant = await getParticipantByUserId(db, result.response.user.id);

  if (!participant) {
    await ensureParticipantForAuthUser(db, {
      email: getRealAuthEmail(result.response.user.email),
      emailVerified: result.response.user.emailVerified,
      userId: result.response.user.id,
    });
    participant = await getParticipantByUserId(db, result.response.user.id);
  }

  if (!participant) {
    return {
      session: result.response,
      participant: null,
    };
  }

  return {
    session: result.response,
    participant,
  };
}

function parseConfiguredTrustedOrigins(value: string | undefined) {
  return (value ?? "")
    .split(/[,\n]/)
    .map((item) => normalizeOriginCandidate(item))
    .filter((item): item is string => Boolean(item));
}

function normalizeOriginCandidate(value: string | null | undefined) {
  const trimmed = value?.trim();

  if (!trimmed || trimmed === "null") {
    return null;
  }

  try {
    const url = new URL(trimmed);
    return url.origin.replace(/\/+$/, "");
  } catch {
    return null;
  }
}

function isLocalDevelopmentOrigin(origin: string) {
  try {
    const hostname = new URL(origin).hostname.toLowerCase();

    if (
      hostname === LOCALHOST_HOSTNAME ||
      hostname === IPV6_LOOPBACK_HOSTNAME ||
      hostname.endsWith(".localhost")
    ) {
      return true;
    }

    return isLoopbackOrPrivateIpv4(hostname);
  } catch {
    return false;
  }
}

function isLoopbackOrPrivateIpv4(hostname: string) {
  const parts = hostname.split(".").map((segment) => Number(segment));

  if (
    parts.length !== 4 ||
    parts.some(
      (segment) => Number.isNaN(segment) || segment < 0 || segment > 255,
    )
  ) {
    return false;
  }

  if (parts[0] === 127 || parts[0] === 10) {
    return true;
  }

  if (parts[0] === 192 && parts[1] === 168) {
    return true;
  }

  return parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31;
}
