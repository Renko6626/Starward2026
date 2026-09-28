import { describe, expect, it } from "vitest";
import {
  DEFAULT_HOST,
  DEFAULT_PORT,
  DEFAULT_RESEND_FROM_NAME,
  DEFAULT_SQLITE_PATH,
  DEFAULT_VPS_ADMIN_MODE,
  NodeRuntimeEnvError,
  loadNodeRuntimeEnv,
} from "./env";

const requiredEnv = {
  BETTER_AUTH_SECRET: "better-auth-secret-value",
  BETTER_AUTH_URL: "https://starward.example.com/",
  RESEND_API_KEY: "resend-api-key-value",
  RESEND_FROM_EMAIL: "no-reply@example.com",
};

describe("loadNodeRuntimeEnv", () => {
  it("loads and normalizes a complete environment", () => {
    const env = loadNodeRuntimeEnv({
      ...requiredEnv,
      SQLITE_PATH: "/var/lib/starward/starward.sqlite",
      RESEND_FROM_NAME: "  Starward Ops  ",
      BETTER_AUTH_TRUSTED_ORIGINS: "https://starward.example.com,https://www.starward.example.com",
    });

    expect(env.BETTER_AUTH_URL).toBe("https://starward.example.com");
    expect(env.SQLITE_PATH).toBe("/var/lib/starward/starward.sqlite");
    expect(env.RESEND_FROM_NAME).toBe("Starward Ops");
    expect(env.BETTER_AUTH_TRUSTED_ORIGINS).toBe(
      "https://starward.example.com,https://www.starward.example.com",
    );
    expect(env.BETTER_AUTH_SECRET).toBe(requiredEnv.BETTER_AUTH_SECRET);
  });

  it("applies defaults for optional values", () => {
    const env = loadNodeRuntimeEnv({ ...requiredEnv });

    expect(env.SQLITE_PATH).toBe(DEFAULT_SQLITE_PATH);
    expect(env.RESEND_FROM_NAME).toBe(DEFAULT_RESEND_FROM_NAME);
    expect(env.VPS_ADMIN_MODE).toBe(DEFAULT_VPS_ADMIN_MODE);
    expect(env.PORT).toBe(DEFAULT_PORT);
    expect(env.HOST).toBe(DEFAULT_HOST);
    expect(env.NODE_ENV).toBe("production");
    expect(env.ALLOW_LOCAL_DEV_ORIGINS).toBe(false);
    expect(env.ALLOW_LOCAL_ADMIN_BYPASS).toBe(false);
    expect(env.BETTER_AUTH_TRUSTED_ORIGINS).toBeUndefined();
    expect(env.TURNSTILE_SECRET_KEY).toBeUndefined();
  });

  it.each([
    "BETTER_AUTH_SECRET",
    "BETTER_AUTH_URL",
    "RESEND_API_KEY",
    "RESEND_FROM_EMAIL",
  ] as const)("names the missing variable when %s is absent", (key) => {
    const source = { ...requiredEnv, [key]: undefined };

    expect(() => loadNodeRuntimeEnv(source)).toThrowError(NodeRuntimeEnvError);
    expect(() => loadNodeRuntimeEnv(source)).toThrowError(new RegExp(key));
  });

  it("treats whitespace-only required values as missing", () => {
    expect(() =>
      loadNodeRuntimeEnv({ ...requiredEnv, BETTER_AUTH_SECRET: "   " }),
    ).toThrowError(/BETTER_AUTH_SECRET/);
  });

  it.each(["not a url", "example.com", "ftp://starward.example.com", "/relative/path"])(
    "rejects the invalid BETTER_AUTH_URL %j",
    (value) => {
      expect(() => loadNodeRuntimeEnv({ ...requiredEnv, BETTER_AUTH_URL: value })).toThrowError(
        /BETTER_AUTH_URL/,
      );
    },
  );

  it("does not echo secret values in error messages", () => {
    const secret = "resend-secret-that-must-not-leak";
    let message = "";

    try {
      loadNodeRuntimeEnv({
        ...requiredEnv,
        RESEND_API_KEY: secret,
        BETTER_AUTH_URL: "not a url",
      });
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).toContain("BETTER_AUTH_URL");
    expect(message).not.toContain(secret);
  });

  it("parses booleans and lowercases the VPS admin mode enum", () => {
    const env = loadNodeRuntimeEnv({
      ...requiredEnv,
      VPS_ADMIN_MODE: "  DISABLED ",
      ALLOW_LOCAL_DEV_ORIGINS: "true",
      ALLOW_LOCAL_ADMIN_BYPASS: "on",
    });

    expect(env.VPS_ADMIN_MODE).toBe("disabled");
    expect(env.ALLOW_LOCAL_DEV_ORIGINS).toBe(true);
    expect(env.ALLOW_LOCAL_ADMIN_BYPASS).toBe(true);
  });

  it.each(["1", "true", "YES", "on"])("accepts %j as a truthy boolean", (value) => {
    expect(loadNodeRuntimeEnv({ ...requiredEnv, ALLOW_LOCAL_DEV_ORIGINS: value }).ALLOW_LOCAL_DEV_ORIGINS).toBe(
      true,
    );
  });

  it.each(["0", "false", "NO", "off"])("accepts %j as a falsy boolean", (value) => {
    expect(loadNodeRuntimeEnv({ ...requiredEnv, ALLOW_LOCAL_DEV_ORIGINS: value }).ALLOW_LOCAL_DEV_ORIGINS).toBe(
      false,
    );
  });

  it("rejects an unknown VPS_ADMIN_MODE value", () => {
    expect(() => loadNodeRuntimeEnv({ ...requiredEnv, VPS_ADMIN_MODE: "yolo" })).toThrowError(
      /VPS_ADMIN_MODE/,
    );
  });

  it("rejects a non-boolean flag value", () => {
    expect(() =>
      loadNodeRuntimeEnv({ ...requiredEnv, ALLOW_LOCAL_DEV_ORIGINS: "maybe" }),
    ).toThrowError(/ALLOW_LOCAL_DEV_ORIGINS/);
  });

  it("parses PORT and rejects a non-numeric value", () => {
    expect(loadNodeRuntimeEnv({ ...requiredEnv, PORT: "3001" }).PORT).toBe(3001);
    expect(() => loadNodeRuntimeEnv({ ...requiredEnv, PORT: "not-a-port" })).toThrowError(/PORT/);
    expect(() => loadNodeRuntimeEnv({ ...requiredEnv, PORT: "70000" })).toThrowError(/PORT/);
  });

  it("rejects an unknown NODE_ENV value", () => {
    expect(() => loadNodeRuntimeEnv({ ...requiredEnv, NODE_ENV: "staging-ish" })).toThrowError(
      /NODE_ENV/,
    );
  });

  it("trims optional secrets and drops empty ones", () => {
    const env = loadNodeRuntimeEnv({
      ...requiredEnv,
      TURNSTILE_SECRET_KEY: "  turnstile-secret  ",
      BETTER_AUTH_TRUSTED_ORIGINS: "   ",
    });

    expect(env.TURNSTILE_SECRET_KEY).toBe("turnstile-secret");
    expect(env.BETTER_AUTH_TRUSTED_ORIGINS).toBeUndefined();
  });
});
