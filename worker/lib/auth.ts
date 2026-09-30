import { betterAuth } from "better-auth";
import type { GenericEndpointContext } from "better-auth";
import {
  APIError,
  createAuthEndpoint,
  createAuthMiddleware,
  setPassword,
} from "better-auth/api";
import { emailOTP } from "better-auth/plugins/email-otp";
import { HTTPException } from "hono/http-exception";
import { Resend } from "resend";
import {
  PORTAL_EMAIL_OTP_ALLOWED_ATTEMPTS,
  PORTAL_EMAIL_OTP_EXPIRES_IN_SECONDS,
  PORTAL_EMAIL_OTP_LENGTH,
  PORTAL_EMAIL_OTP_RATE_LIMIT_MAX,
  PORTAL_EMAIL_OTP_RATE_LIMIT_WINDOW_SECONDS,
  PORTAL_EMAIL_OTP_RESEND_STRATEGY,
  PORTAL_EMAIL_OTP_STORE_MODE,
  getPortalEmailOtpValidityLabel,
} from "../../src/shared/email-otp";
import type { AppContext, AppBindings } from "./types";
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

function buildPortalEntryPlugin(env: AppBindings) {
  const { db } = getRequiredAuthEnv(env);

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
            session: {
              create: {
                async after(
                  session: { userId: string } & Record<string, unknown>,
                  context: GenericEndpointContext | null,
                ) {
                  if (
                    !context?.path ||
                    ![
                      "/sign-in/email-otp",
                      "/sign-in/email",
                      "/sign-up/email",
                    ].includes(context.path)
                  ) {
                    return;
                  }

                  const email =
                    typeof context.body === "object" &&
                    context.body !== null &&
                    "email" in context.body &&
                    typeof context.body.email === "string"
                      ? context.body.email
                      : null;

                  if (!email) {
                    return;
                  }

                  await ensureParticipantForAuthUser(db, {
                    email,
                    userId: session.userId,
                  });
                },
              },
            },
          },
        },
      };
    },
    hooks: {
      before: [
        {
          matcher(context: { path?: string }) {
            return (
              context.path === "/email-otp/send-verification-otp" ||
              context.path === "/sign-in/email-otp" ||
              context.path === "/sign-in/email" ||
              context.path === "/sign-up/email"
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
                const participant = await getParticipantByInviteEmail(
                  db,
                  email,
                );
                // Password signup does not prove ownership of an existing invitation.
                if (participant && !participant.user_id) {
                  throw new APIError("CONFLICT", {
                    message:
                      "此邮箱已有参与者资料，请先通过邮箱验证码登录，再设置密码。",
                  });
                }
              }
              return;
            }

            const type =
              typeof ctx.body?.type === "string"
                ? ctx.body.type
                : ctx.path === "/sign-in/email-otp"
                  ? "sign-in"
                  : null;

            if (type !== "sign-in") {
              return;
            }

            const rawEmail =
              typeof ctx.body?.email === "string" ? ctx.body.email : "";
            const email = normalizeEmailAddress(rawEmail);
            const participant = await getParticipantByInviteEmail(db, email);

            ctx.body.email = email;
            if (ctx.path === "/sign-in/email-otp") {
              ctx.body.name =
                participant?.display_name || email.split("@")[0] || "参与者";
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
) {
  if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL) {
    throw new HTTPException(503, {
      message: "Resend mail sender is not configured yet.",
    });
  }
  const resend = new Resend(env.RESEND_API_KEY);
  const resendFromEmail = env.RESEND_FROM_EMAIL;
  const resendFromName = env.RESEND_FROM_NAME?.trim() || "Starward2026";
  const subject =
    payload.type === "sign-in"
      ? "Starward2026 参与者登录验证码"
      : "Starward2026 邮件验证码";
  const text =
    payload.type === "sign-in"
      ? [
          "你正在登录 Starward2026 参与者门户。",
          "",
          `验证码：${payload.otp}`,
          `有效期：${getPortalEmailOtpValidityLabel()}`,
          "",
          "如果这不是你本人的操作，可以直接忽略此邮件。",
        ].join("\n")
      : [
          "你正在进行 Starward2026 的邮箱验证操作。",
          "",
          `验证码：${payload.otp}`,
          `有效期：${getPortalEmailOtpValidityLabel()}`,
        ].join("\n");

  const response = await resend.emails.send({
    from: `${resendFromName} <${resendFromEmail}>`,
    to: payload.email,
    subject,
    text,
  });

  if (response.error) {
    throw new Error(
      response.error.message || "Failed to send verification OTP email.",
    );
  }
}

export function buildPortalEmailOtpOptions(env: AppBindings) {
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
    }) {
      await sendPortalOtpEmail(env, payload);
    },
  };
}

export function buildPortalSessionOptions() {
  return {
    expiresIn: PORTAL_SESSION_EXPIRES_IN_SECONDS,
    updateAge: PORTAL_SESSION_UPDATE_AGE_SECONDS,
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

  return betterAuth({
    secret,
    database: db,
    baseURL: baseUrl,
    basePath: "/api/auth",
    trustedOrigins: buildPortalTrustedOrigins(env),
    session: buildPortalSessionOptions(),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
      minPasswordLength: 8,
      maxPasswordLength: 128,
    },
    plugins: [
      buildPortalEntryPlugin(env),
      emailOTP(buildPortalEmailOtpOptions(env)),
    ],
  });
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

  let participant = await getParticipantByUserId(db, result.response.user.id);

  if (!participant) {
    await ensureParticipantForAuthUser(db, {
      email: result.response.user.email,
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
