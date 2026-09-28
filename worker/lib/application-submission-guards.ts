import { HTTPException } from "hono/http-exception";
import { limitApplicationSubmission } from "./application-rate-limit";
import { getRuntimeKind } from "./http";
import { verifyTurnstileToken } from "./turnstile";
import type { AppBindings, AppContext, RuntimeKind } from "./types";

export type ApplicationGuardResult =
  | { ok: true }
  | { ok: false; status: number; code: string; message: string };

type ApplicationGuardInput = {
  contactEmail?: string | null;
  turnstileToken?: string | null;
};

export type ClientIpResolutionInput = {
  runtime?: RuntimeKind;
  header: (name: string) => string | null;
  /** Immediate peer address from the Node socket, when available. */
  remoteAddress?: string | null;
  /** Explicit opt-in to trust proxy-managed forwarding headers. Default false. */
  trustProxyHeaders?: boolean;
  /** Explicit list of trusted reverse-proxy addresses. Empty means closed. */
  trustedProxyIps?: readonly string[];
};

/**
 * Resolve the client address used for rate-limit keys.
 *
 * - Cloudflare injects and overwrites `cf-connecting-ip` at the edge, so it is
 *   trustworthy on the Worker runtime.
 * - Node trusts no forwarding header by default. It uses the immediate socket
 *   peer instead, so a direct client cannot spoof `cf-connecting-ip` or
 *   `x-forwarded-for`. Forwarding headers are only consulted when the operator
 *   explicitly enables `TRUST_PROXY_HEADERS` and the peer is listed in
 *   `TRUSTED_PROXY_IPS`; the last `x-forwarded-for` hop (the address the
 *   trusted proxy appended) is used rather than a client-supplied first hop.
 */
export function resolveClientIpAddress(input: ClientIpResolutionInput): string | null {
  if (input.runtime === "node") {
    if (
      input.trustProxyHeaders &&
      isTrustedProxyAddress(input.remoteAddress, input.trustedProxyIps)
    ) {
      return readForwardedClientIp(input.header);
    }

    return normalizeIpAddress(input.remoteAddress);
  }

  return normalizeIpAddress(input.header("cf-connecting-ip"));
}

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
    ipAddress: resolveClientIpAddress({
      runtime: getRuntimeKind(c),
      header: (name) => c.req.header(name) ?? null,
      remoteAddress: readNodeRemoteAddress(c.env),
      trustProxyHeaders: isEnabledFlag(c.env.TRUST_PROXY_HEADERS),
      trustedProxyIps: parseTrustedProxyIps(c.env.TRUSTED_PROXY_IPS),
    }),
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

function isTrustedProxyAddress(
  remoteAddress: string | null | undefined,
  trustedProxyIps: readonly string[] | undefined,
) {
  const remote = normalizeIpAddress(remoteAddress);

  if (!remote || !trustedProxyIps || trustedProxyIps.length === 0) {
    return false;
  }

  return trustedProxyIps.some((entry) => normalizeIpAddress(entry) === remote);
}

function readForwardedClientIp(header: (name: string) => string | null) {
  const forwardedFor = header("x-forwarded-for");

  if (!forwardedFor) {
    return null;
  }

  const hops = forwardedFor
    .split(",")
    .map((hop) => normalizeIpAddress(hop))
    .filter((hop): hop is string => hop !== null);

  // The last hop is the address appended by the trusted proxy. Earlier hops
  // may have been supplied by the client and are ignored.
  return hops.at(-1) ?? null;
}

function readNodeRemoteAddress(env: AppBindings) {
  const incoming = (
    env as AppBindings & {
      incoming?: { socket?: { remoteAddress?: string } };
    }
  ).incoming;

  return incoming?.socket?.remoteAddress ?? null;
}

function parseTrustedProxyIps(value: string | undefined) {
  return (value ?? "")
    .split(/[,\n]/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function isEnabledFlag(value: string | undefined) {
  return value?.trim().toLowerCase() === "true";
}

function normalizeIpAddress(value: string | null | undefined) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  // Node reports IPv4 peers as IPv4-mapped IPv6 (`::ffff:127.0.0.1`) in some
  // socket configurations. Normalize so a trusted-proxy list written in IPv4
  // still matches the observed peer.
  const mappedIpv4 = trimmed.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i);

  if (mappedIpv4) {
    return mappedIpv4[1];
  }

  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}
