import { limitApplicationSubmission } from "./application-rate-limit";
import type { AppContext } from "./types";

export type ApplicationGuardResult =
  | { ok: true }
  | { ok: false; status: number; code: string; message: string };

type ApplicationGuardInput = {
  contactEmail?: string | null;
  userId?: string;
};

// Authenticated application mutations retain IP and account rate limits.
export async function enforceApplicationSubmissionGuards(
  c: AppContext,
  input: ApplicationGuardInput,
): Promise<ApplicationGuardResult> {
  const rateLimit = await limitApplicationSubmission({
    ipRateLimiter: c.env.APPLICATION_SUBMIT_IP_RATE_LIMITER,
    emailRateLimiter: c.env.APPLICATION_SUBMIT_EMAIL_RATE_LIMITER,
    ipAddress: c.req.header("cf-connecting-ip"),
    contactEmail: input.contactEmail,
    userId: input.userId,
  });

  if (!rateLimit.ok) {
    return {
      ok: false,
      status: 429,
      code: rateLimit.code,
      message: rateLimit.message,
    };
  }

  return { ok: true };
}
