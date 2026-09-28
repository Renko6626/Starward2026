import { describe, expect, it, vi } from "vitest";
import { resolveAdminIdentity } from "./admin";

describe("resolveAdminIdentity", () => {
  it("allows localhost development bypass when explicitly enabled", async () => {
    await expect(
      resolveAdminIdentity({
        env: { ALLOW_LOCAL_ADMIN_BYPASS: "true" },
        headers: new Headers({
          "x-admin-email": "local-admin@example.com",
        }),
        requestUrl: "http://localhost:5173/api/admin/applications",
      }),
    ).resolves.toBe("local-admin@example.com");
  });

  it("ignores the x-admin-email bypass when ALLOW_LOCAL_ADMIN_BYPASS is not set", async () => {
    await expect(
      resolveAdminIdentity({
        env: {},
        headers: new Headers({
          "x-admin-email": "local-admin@example.com",
        }),
        requestUrl: "http://localhost:5173/api/admin/applications",
      }),
    ).rejects.toMatchObject({
      status: 503,
    });
  });

  it("ignores the x-admin-email bypass on a non-local host even when enabled", async () => {
    await expect(
      resolveAdminIdentity({
        env: { ALLOW_LOCAL_ADMIN_BYPASS: "true" },
        headers: new Headers({
          "x-admin-email": "attacker@example.com",
        }),
        requestUrl: "https://hifuu-staging.ayafeed.com/api/admin/applications",
      }),
    ).rejects.toMatchObject({
      status: 503,
    });
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

describe("resolveAdminIdentity on the node runtime", () => {
  it("delegates to the injected vps resolver and ignores identity headers", async () => {
    const resolver = vi.fn().mockResolvedValue("admin@example.com");
    const request = new Request("https://vps.example.com/api/admin/applications", {
      headers: { "x-admin-email": "attacker@example.com" },
    });

    await expect(
      resolveAdminIdentity({
        env: { RUNTIME: "node", VPS_ADMIN_IDENTITY_RESOLVER: resolver },
        headers: request.headers,
        requestUrl: request.url,
        request,
      }),
    ).resolves.toBe("admin@example.com");

    expect(resolver).toHaveBeenCalledOnce();
  });

  it("denies when the vps resolver finds no admin session", async () => {
    const request = new Request("https://vps.example.com/api/admin/applications");

    await expect(
      resolveAdminIdentity({
        env: {
          RUNTIME: "node",
          VPS_ADMIN_IDENTITY_RESOLVER: vi.fn().mockResolvedValue(null),
        },
        headers: request.headers,
        requestUrl: request.url,
        request,
      }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("fails closed when no vps resolver is wired", async () => {
    const request = new Request("https://vps.example.com/api/admin/applications");

    await expect(
      resolveAdminIdentity({
        env: { RUNTIME: "node" },
        headers: request.headers,
        requestUrl: request.url,
        request,
      }),
    ).rejects.toMatchObject({ status: 503 });
  });

  it("ignores the local admin bypass on production node even for a loopback host", async () => {
    const resolver = vi.fn().mockResolvedValue(null);
    const request = new Request("http://localhost/api/admin/applications", {
      headers: { "x-admin-email": "attacker@example.com" },
    });

    await expect(
      resolveAdminIdentity({
        env: {
          RUNTIME: "node",
          NODE_ENV: "production",
          ALLOW_LOCAL_ADMIN_BYPASS: "true",
          VPS_ADMIN_IDENTITY_RESOLVER: resolver,
        },
        headers: request.headers,
        requestUrl: request.url,
        request,
      }),
    ).rejects.toMatchObject({ status: 403 });

    expect(resolver).toHaveBeenCalledOnce();
  });

  it("still allows the loopback bypass in development node", async () => {
    const request = new Request("http://localhost/api/admin/applications", {
      headers: { "x-admin-email": "dev@example.com" },
    });

    await expect(
      resolveAdminIdentity({
        env: {
          RUNTIME: "node",
          NODE_ENV: "development",
          ALLOW_LOCAL_ADMIN_BYPASS: "true",
        },
        headers: request.headers,
        requestUrl: request.url,
        request,
      }),
    ).resolves.toBe("dev@example.com");
  });
});
