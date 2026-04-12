import { betterAuth } from "better-auth";
import type { GenericEndpointContext } from "better-auth";
import { createAuthMiddleware } from "better-auth/api";
import { emailOTP } from "better-auth/plugins/email-otp";
import { HTTPException } from "hono/http-exception";
import { Resend } from "resend";
import {
  PORTAL_EMAIL_OTP_ALLOWED_ATTEMPTS,
  PORTAL_EMAIL_OTP_EXPIRES_IN_SECONDS,
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

  if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL) {
    throw new HTTPException(503, {
      message: "Resend mail sender is not configured yet.",
    });
  }

  return {
    db: env.DB,
    secret: env.BETTER_AUTH_SECRET,
    baseUrl: normalizeBaseUrl(env.BETTER_AUTH_URL),
    resendApiKey: env.RESEND_API_KEY,
    resendFromEmail: env.RESEND_FROM_EMAIL,
    resendFromName: env.RESEND_FROM_NAME?.trim() || "Starward2026",
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
                  if (context?.path !== "/sign-in/email-otp") {
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
                    displayName:
                      typeof context.body?.name === "string" ? context.body.name : null,
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
              context.path === "/sign-in/email-otp"
            );
          },
          handler: createAuthMiddleware(async (ctx) => {
            const type =
              typeof ctx.body?.type === "string"
                ? ctx.body.type
                : ctx.path === "/sign-in/email-otp"
                  ? "sign-in"
                  : null;

            if (type !== "sign-in") {
              return;
            }

            const rawEmail = typeof ctx.body?.email === "string" ? ctx.body.email : "";
            const email = normalizeEmailAddress(rawEmail);
            const participant = await getParticipantByInviteEmail(db, email);

            ctx.body.email = email;
            if (ctx.path === "/sign-in/email-otp") {
              ctx.body.name = participant?.display_name || email.split("@")[0] || "参与者";
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
  const { resendApiKey, resendFromEmail, resendFromName } = getRequiredAuthEnv(env);
  const resend = new Resend(resendApiKey);
  const subject =
    payload.type === "sign-in" ? "Starward2026 参与者登录验证码" : "Starward2026 邮件验证码";
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
    throw new Error(response.error.message || "Failed to send verification OTP email.");
  }
}

export function buildPortalEmailOtpOptions(env: AppBindings) {
  return {
    disableSignUp: false,
    expiresIn: PORTAL_EMAIL_OTP_EXPIRES_IN_SECONDS,
    allowedAttempts: PORTAL_EMAIL_OTP_ALLOWED_ATTEMPTS,
    storeOTP: PORTAL_EMAIL_OTP_STORE_MODE,
    resendStrategy: PORTAL_EMAIL_OTP_RESEND_STRATEGY,
    rateLimit: {
      window: PORTAL_EMAIL_OTP_RATE_LIMIT_WINDOW_SECONDS,
      max: PORTAL_EMAIL_OTP_RATE_LIMIT_MAX,
    },
    async sendVerificationOTP(
      payload: {
        email: string;
        otp: string;
        type: "sign-in" | "email-verification" | "forget-password" | "change-email";
      },
    ) {
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

export function createAuth(env: AppBindings) {
  const { db, secret, baseUrl } = getRequiredAuthEnv(env);

  return betterAuth({
    secret,
    database: db,
    baseURL: baseUrl,
    basePath: "/api/auth",
    session: buildPortalSessionOptions(),
    plugins: [
      buildPortalEntryPlugin(env),
      emailOTP(buildPortalEmailOtpOptions(env)),
    ],
  });
}

function applyAuthResponseHeaders(c: AppContext, headers: Headers) {
  const setCookieHeaders =
    typeof (headers as Headers & { getSetCookie?: () => string[] }).getSetCookie === "function"
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
      displayName: result.response.user.name,
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
