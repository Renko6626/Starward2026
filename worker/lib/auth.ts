import { betterAuth, APIError } from "better-auth";
import type { GenericEndpointContext } from "better-auth";
import { createAuthMiddleware } from "better-auth/api";
import { emailOTP } from "better-auth/plugins/email-otp";
import { HTTPException } from "hono/http-exception";
import { Resend } from "resend";
import type { AppContext, AppBindings } from "./types";
import {
  getParticipantByInviteEmail,
  getParticipantByUserId,
  isParticipantPortalEligible,
  linkParticipantToAuthUser,
  normalizeEmailAddress,
} from "../data/participants";

const AUTH_PLUGIN_VERSION = "0.1.0";

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
    resendApiKey: env.RESEND_API_KEY,
    resendFromEmail: env.RESEND_FROM_EMAIL,
    resendFromName: env.RESEND_FROM_NAME?.trim() || "Starward2026",
  };
}

function buildInviteOnlyParticipantPlugin(env: AppBindings) {
  const { db } = getRequiredAuthEnv(env);

  return {
    id: "participant-invite-gate",
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

                  await linkParticipantToAuthUser(db, {
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

            if (!participant) {
              throw APIError.fromStatus("FORBIDDEN", {
                message: "该邮箱尚未获得参与者门户资格，请先等待主催审核通过。",
              });
            }

            if (!isParticipantPortalEligible(participant.status)) {
              throw APIError.fromStatus("FORBIDDEN", {
                message:
                  participant.status === "withdrawn"
                    ? "该邮箱的参与资格已撤回，如需恢复请联系主催。"
                    : "该邮箱当前不可用于参与者门户登录。",
              });
            }

            const existingUser = await ctx.context.internalAdapter.findUserByEmail(email);
            if (participant.user_id && existingUser?.user.id !== participant.user_id) {
              throw APIError.fromStatus("FORBIDDEN", {
                message: "该邮箱的门户绑定状态异常，请联系主催处理。",
              });
            }

            ctx.body.email = email;
            if (ctx.path === "/sign-in/email-otp") {
              ctx.body.name = participant.display_name;
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
          "有效期：5 分钟",
          "",
          "如果这不是你本人的操作，可以直接忽略此邮件。",
        ].join("\n")
      : [
          "你正在进行 Starward2026 的邮箱验证操作。",
          "",
          `验证码：${payload.otp}`,
          "有效期：5 分钟",
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

export function createAuth(env: AppBindings) {
  const { db, secret } = getRequiredAuthEnv(env);

  return betterAuth({
    secret,
    database: db,
    basePath: "/api/auth",
    plugins: [
      buildInviteOnlyParticipantPlugin(env),
      emailOTP({
        disableSignUp: false,
        expiresIn: 60 * 5,
        allowedAttempts: 3,
        rateLimit: {
          window: 60,
          max: 3,
        },
        async sendVerificationOTP(payload) {
          await sendPortalOtpEmail(env, payload);
        },
      }),
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
    await linkParticipantToAuthUser(db, {
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
