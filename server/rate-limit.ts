/**
 * Single-process rate limiter for the Node/VPS runtime.
 *
 * It implements the same `{ limit(options): Promise<{ success }> }` contract as
 * the Workers Rate Limiting binding, so `limitApplicationSubmission` and the
 * routes stay platform-neutral. The MVP is intentionally in-memory: one VPS
 * process owns the counters, and no Redis is introduced.
 *
 * The limiter uses fixed windows per key. Callers already namespace keys
 * (`apply:ip:*` / `apply:email:*`), so IP and email always get separate
 * buckets.
 */
export type NodeRateLimiterConfig = {
  /** Maximum requests per window. A non-positive value disables limiting. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
  /** Injectable clock for deterministic tests. Defaults to `Date.now`. */
  now?: () => number;
};

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

export function createNodeRateLimiter(config: NodeRateLimiterConfig): RateLimit {
  const { limit, windowMs } = config;
  const now = config.now ?? Date.now;

  // An explicitly disabled limiter (limit <= 0) still satisfies the contract
  // but never rejects, mirroring the Workers binding being absent.
  if (!Number.isFinite(limit) || limit <= 0 || !Number.isFinite(windowMs) || windowMs <= 0) {
    return {
      async limit() {
        return { success: true };
      },
    };
  }

  const buckets = new Map<string, RateLimitBucket>();

  return {
    async limit(input: { key: string }) {
      const current = now();
      const existing = buckets.get(input.key);

      if (!existing || existing.resetAt <= current) {
        buckets.set(input.key, { count: 1, resetAt: current + windowMs });
        return { success: true };
      }

      if (existing.count >= limit) {
        return { success: false };
      }

      existing.count += 1;
      return { success: true };
    },
  };
}
