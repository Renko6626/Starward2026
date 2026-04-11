import type { AppContext } from "./types";

const adminIdentityHeaders = [
  "cf-access-authenticated-user-email",
  "cf-access-verified-email",
  "x-admin-email",
] as const;

export function getAdminIdentity(c: AppContext) {
  for (const header of adminIdentityHeaders) {
    const value = c.req.header(header);

    if (value) {
      return value;
    }
  }

  return "local-admin";
}
