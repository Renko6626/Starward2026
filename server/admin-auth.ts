import { normalizeEmailAddress } from "../worker/data/participants";
import { createAuth } from "../worker/lib/auth";
import type { AppBindings } from "../worker/lib/types";

/**
 * Configuration for the VPS admin identity adapter.
 *
 * The adapter is deliberately allowlist-based instead of trusting a role claim
 * from the client: an explicit `VPS_ADMIN_EMAILS` list is the source of truth.
 */
export type VpsAdminIdentityConfig = {
  env: AppBindings;
};

/**
 * Parse a comma/newline separated admin email allowlist into normalized
 * addresses. Blank entries are ignored, so an unconfigured or whitespace-only
 * list yields an empty set and the adapter fails closed.
 */
export function parseAdminEmailAllowlist(value: string | undefined): Set<string> {
  const allowlist = new Set<string>();

  for (const entry of (value ?? "").split(/[,\n]/)) {
    const normalized = normalizeEmailAddress(entry);

    if (normalized) {
      allowlist.add(normalized);
    }
  }

  return allowlist;
}

/**
 * Resolve an admin identity for the Node/VPS runtime from a Better Auth
 * session verified against the same D1-compatible database as the rest of the
 * application.
 *
 * Returns the verified administrator email, or `null` when the request is not
 * a configured administrator. It never reads an identity from request headers,
 * and it fails closed when the mode is disabled, the allowlist is empty, or
 * the auth configuration is missing.
 */
export async function resolveVpsAdminIdentity(
  request: Request,
  config: VpsAdminIdentityConfig,
): Promise<string | null> {
  const mode = config.env.VPS_ADMIN_MODE?.trim().toLowerCase();

  if (mode !== "better-auth") {
    return null;
  }

  const allowlist = parseAdminEmailAllowlist(config.env.VPS_ADMIN_EMAILS);

  if (allowlist.size === 0) {
    return null;
  }

  if (!config.env.DB || !config.env.BETTER_AUTH_SECRET) {
    return null;
  }

  const auth = createAuth(config.env);
  const session = await auth.api.getSession({ headers: request.headers });
  const email = normalizeEmailAddress(session?.user?.email ?? "");

  if (!email || !allowlist.has(email)) {
    return null;
  }

  return email;
}
