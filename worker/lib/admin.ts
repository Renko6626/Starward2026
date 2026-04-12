import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { HTTPException } from "hono/http-exception";
import type { AppBindings, AppContext } from "./types";

const adminIdentityHeaders = [
  "cf-access-authenticated-user-email",
  "cf-access-verified-email",
] as const;

type VerifyAdminAccessTokenInput = {
  token: string;
  teamDomain: string;
  policyAud: string;
};

type VerifyAdminAccessToken = (
  input: VerifyAdminAccessTokenInput,
) => Promise<Pick<JWTPayload, "email">>;

const LOCAL_ADMIN_BYPASS_HEADER = "x-admin-email";
const ACCESS_JWT_HEADER = "cf-access-jwt-assertion";
const adminJwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

export function getAdminIdentity(c: AppContext) {
  const identity = c.get("adminIdentity");

  if (!identity) {
    throw new HTTPException(500, {
      message: "Admin identity missing from verified access context.",
    });
  }

  return identity;
}

export async function requireAdminAccess(c: AppContext) {
  const identity = await resolveAdminIdentity({
    env: c.env,
    headers: c.req.raw.headers,
    requestUrl: c.req.url,
  });

  c.set("adminIdentity", identity);
}

export async function resolveAdminIdentity(
  input: {
    env: Pick<AppBindings, "CLOUDFLARE_ACCESS_POLICY_AUD" | "CLOUDFLARE_ACCESS_TEAM_DOMAIN">;
    headers: Headers;
    requestUrl: string;
  },
  verifyAccessToken: VerifyAdminAccessToken = verifyAdminAccessToken,
) {
  const localBypassIdentity = getLocalAdminBypassIdentity(input.headers, input.requestUrl);

  if (localBypassIdentity) {
    return localBypassIdentity;
  }

  const teamDomain = normalizeAccessTeamDomain(input.env.CLOUDFLARE_ACCESS_TEAM_DOMAIN);
  const policyAud = input.env.CLOUDFLARE_ACCESS_POLICY_AUD?.trim();

  if (!teamDomain || !policyAud) {
    throw new HTTPException(503, {
      message: "Cloudflare Access admin verification is not configured yet.",
    });
  }

  const token = input.headers.get(ACCESS_JWT_HEADER)?.trim();

  if (!token) {
    throw new HTTPException(403, {
      message: "Admin access requires a valid Cloudflare Access token.",
    });
  }

  let payload: Pick<JWTPayload, "email">;

  try {
    payload = await verifyAccessToken({
      token,
      teamDomain,
      policyAud,
    });
  } catch {
    throw new HTTPException(403, {
      message: "Cloudflare Access token verification failed.",
    });
  }

  const identity =
    normalizeIdentityValue(payload.email) ??
    adminIdentityHeaders
      .map((header) => normalizeIdentityValue(input.headers.get(header)))
      .find((value) => value !== null);

  if (!identity) {
    throw new HTTPException(403, {
      message: "Cloudflare Access token did not include an admin identity.",
    });
  }

  return identity;
}

export async function verifyAdminAccessToken(input: VerifyAdminAccessTokenInput) {
  const { payload } = await jwtVerify(input.token, getAccessJwks(input.teamDomain), {
    issuer: input.teamDomain,
    audience: input.policyAud,
  });

  return {
    email: typeof payload.email === "string" ? payload.email : undefined,
  };
}

function getAccessJwks(teamDomain: string) {
  const existing = adminJwksCache.get(teamDomain);

  if (existing) {
    return existing;
  }

  const created = createRemoteJWKSet(new URL(`${teamDomain}/cdn-cgi/access/certs`));
  adminJwksCache.set(teamDomain, created);
  return created;
}

function getLocalAdminBypassIdentity(headers: Headers, requestUrl: string) {
  if (!isLocalRequest(requestUrl)) {
    return null;
  }

  return normalizeIdentityValue(headers.get(LOCAL_ADMIN_BYPASS_HEADER));
}

function isLocalRequest(requestUrl: string) {
  const hostname = new URL(requestUrl).hostname;
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

function normalizeAccessTeamDomain(value: string | undefined) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  const withProtocol = /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  return withProtocol.endsWith("/") ? withProtocol.slice(0, -1) : withProtocol;
}

function normalizeIdentityValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
