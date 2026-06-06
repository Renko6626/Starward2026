import { HTTPException } from "hono/http-exception";
import { limitApplicationSubmission } from "./application-rate-limit";
import { verifyTurnstileToken } from "./turnstile";
import type { AppContext } from "./types";

export type ApplicationGuardResult =
  | { ok: true }
  | { ok: false; status: number; code: string; message: string };

type ApplicationGuardInput = {
  contactEmail?: string | null;
  turnstileToken?: string | null;
};

/**
 * Enforces anti-abuse guards (rate limiting + Turnstile) before an application
 * mutation. Both checks gracefully degrade to no-ops when their bindings/secrets
 * are absent, so local dev and unconfigured environments keep working.
 */
export async function enforceApplicationSubmissionGuards(
  c: AppContext,
  input: ApplicationGuardInput,
): Promise<ApplicationGuardResult> {
  const rateLimit = await limitApplicationSubmission({
    ipRateLimiter: c.env.APPLICATION_SUBMIT_IP_RATE_LIMITER,
    emailRateLimiter: c.env.APPLICATION_SUBMIT_EMAIL_RATE_LIMITER,
    ipAddress: c.req.header("cf-connecting-ip"),
    contactEmail: input.contactEmail,
  });

  if (!rateLimit.ok) {
    return {
      ok: false,
      status: 429,
      code: rateLimit.code,
      message: rateLimit.message,
    };
  }

  try {
    await verifyTurnstileToken(c, input.turnstileToken ?? undefined);
  } catch (caught) {
    if (caught instanceof HTTPException) {
      return {
        ok: false,
        status: caught.status,
        code: "turnstile_verification_failed",
        message: caught.message,
      };
    }

    throw caught;
  }

  return { ok: true };
}
