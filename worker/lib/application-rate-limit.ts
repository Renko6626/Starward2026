import { normalizeEmailAddress } from "../data/participants";

const APPLICATION_RATE_LIMIT_RETRY_AFTER_SECONDS = 60;

type ApplicationRateLimitBindings = {
  ipRateLimiter?: RateLimit;
  emailRateLimiter?: RateLimit;
};

type ApplicationRateLimitInput = ApplicationRateLimitBindings & {
  ipAddress?: string | null;
  contactEmail?: string | null;
};

type ApplicationRateLimitResult =
  | { ok: true }
  | {
      ok: false;
      code: "application_submit_rate_limited";
      message: string;
      retryAfterSeconds: number;
    };

export async function limitApplicationSubmission(
  input: ApplicationRateLimitInput,
): Promise<ApplicationRateLimitResult> {
  const ipAddress = input.ipAddress?.trim();

  if (input.ipRateLimiter && ipAddress) {
    const outcome = await input.ipRateLimiter.limit({
      key: `apply:ip:${ipAddress}`,
    });

    if (!outcome.success) {
      return {
        ok: false,
        code: "application_submit_rate_limited",
        message: "报名提交过于频繁，请稍后再试。",
        retryAfterSeconds: APPLICATION_RATE_LIMIT_RETRY_AFTER_SECONDS,
      };
    }
  }

  const contactEmail = input.contactEmail?.trim();

  if (input.emailRateLimiter && contactEmail) {
    const outcome = await input.emailRateLimiter.limit({
      key: `apply:email:${normalizeEmailAddress(contactEmail)}`,
    });

    if (!outcome.success) {
      return {
        ok: false,
        code: "application_submit_rate_limited",
        message: "该邮箱短时间内提交过于频繁，请稍后再试。",
        retryAfterSeconds: APPLICATION_RATE_LIMIT_RETRY_AFTER_SECONDS,
      };
    }
  }

  return { ok: true };
}
