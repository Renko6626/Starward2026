import { describe, expect, it, vi } from "vitest";
import { resolveAdminIdentity } from "./admin";

describe("resolveAdminIdentity", () => {
  it("allows localhost development bypass through x-admin-email", async () => {
    await expect(
      resolveAdminIdentity({
        env: {},
        headers: new Headers({
          "x-admin-email": "local-admin@example.com",
        }),
        requestUrl: "http://localhost:5173/api/admin/applications",
      }),
    ).resolves.toBe("local-admin@example.com");
  });

  it("rejects non-local requests when access verification is not configured", async () => {
    await expect(
      resolveAdminIdentity({
        env: {},
        headers: new Headers({
          "x-admin-email": "staging-bypass@example.com",
        }),
        requestUrl: "https://hifuu-staging.ayafeed.com/api/admin/applications",
      }),
    ).rejects.toMatchObject({
      status: 503,
    });
  });

  it("rejects requests without cf-access-jwt-assertion once access verification is enabled", async () => {
    await expect(
      resolveAdminIdentity({
        env: {
          CLOUDFLARE_ACCESS_TEAM_DOMAIN: "https://example.cloudflareaccess.com",
          CLOUDFLARE_ACCESS_POLICY_AUD: "policy-aud",
        },
        headers: new Headers(),
        requestUrl: "https://hifuu-staging.ayafeed.com/api/admin/applications",
      }),
    ).rejects.toMatchObject({
      status: 403,
    });
  });

  it("rejects requests when the access token verifier fails", async () => {
    const verifyToken = vi.fn().mockRejectedValue(new Error("invalid token"));

    await expect(
      resolveAdminIdentity(
        {
          env: {
            CLOUDFLARE_ACCESS_TEAM_DOMAIN: "https://example.cloudflareaccess.com",
            CLOUDFLARE_ACCESS_POLICY_AUD: "policy-aud",
          },
          headers: new Headers({
            "cf-access-jwt-assertion": "jwt-token",
          }),
          requestUrl: "https://hifuu-staging.ayafeed.com/api/admin/applications",
        },
        verifyToken,
      ),
    ).rejects.toMatchObject({
      status: 403,
    });
  });

  it("accepts a verified access token and returns the payload email", async () => {
    const verifyToken = vi.fn().mockResolvedValue({
      email: "admin@example.com",
    });

    await expect(
      resolveAdminIdentity(
        {
          env: {
            CLOUDFLARE_ACCESS_TEAM_DOMAIN: "https://example.cloudflareaccess.com",
            CLOUDFLARE_ACCESS_POLICY_AUD: "policy-aud",
          },
          headers: new Headers({
            "cf-access-jwt-assertion": "jwt-token",
          }),
          requestUrl: "https://hifuu-staging.ayafeed.com/api/admin/applications",
        },
        verifyToken,
      ),
    ).resolves.toBe("admin@example.com");
  });

  it("normalizes a bare access team domain before verifying the token", async () => {
    const verifyToken = vi.fn().mockResolvedValue({
      email: "admin@example.com",
    });

    await expect(
      resolveAdminIdentity(
        {
          env: {
            CLOUDFLARE_ACCESS_TEAM_DOMAIN: "example.cloudflareaccess.com",
            CLOUDFLARE_ACCESS_POLICY_AUD: "policy-aud",
          },
          headers: new Headers({
            "cf-access-jwt-assertion": "jwt-token",
          }),
          requestUrl: "https://hifuu-staging.ayafeed.com/api/admin/applications",
        },
        verifyToken,
      ),
    ).resolves.toBe("admin@example.com");

    expect(verifyToken).toHaveBeenCalledWith({
      token: "jwt-token",
      teamDomain: "https://example.cloudflareaccess.com",
      policyAud: "policy-aud",
    });
  });

  it("falls back to access identity headers after successful token verification", async () => {
    const verifyToken = vi.fn().mockResolvedValue({});

    await expect(
      resolveAdminIdentity(
        {
          env: {
            CLOUDFLARE_ACCESS_TEAM_DOMAIN: "https://example.cloudflareaccess.com",
            CLOUDFLARE_ACCESS_POLICY_AUD: "policy-aud",
          },
          headers: new Headers({
            "cf-access-jwt-assertion": "jwt-token",
            "cf-access-authenticated-user-email": "header-admin@example.com",
          }),
          requestUrl: "https://hifuu-staging.ayafeed.com/api/admin/applications",
        },
        verifyToken,
      ),
    ).resolves.toBe("header-admin@example.com");
  });
});
