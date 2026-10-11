import { describe, expect, it } from "vitest";
import { buildLocalServiceReport, parseMode } from "./test-env.mjs";

describe("test environment launcher", () => {
  it("accepts the supported modes and rejects unknown modes", () => {
    expect(parseMode(undefined)).toBe("help");
    expect(parseMode("local")).toBe("local");
    expect(parseMode("docker")).toBe("docker");
    expect(parseMode("staging")).toBe("staging");
    expect(() => parseMode("production")).toThrow(/Unknown test environment mode/);
  });

  it("reports local external services without exposing secret values", () => {
    const report = buildLocalServiceReport({
      BETTER_AUTH_SECRET: "local-secret",
      RESEND_API_KEY: "",
      TURNSTILE_SECRET_KEY: "",
    });

    expect(report).toEqual([
      { name: "QQ 登录", status: "offline", detail: "未启用或配置不完整；邮箱入口仍可使用" },
      { name: "本地数据库", status: "ready", detail: "Wrangler D1 local" },
      { name: "本地管理员入口", status: "ready", detail: "网站账号登录；需在数据库中授予管理权限" },
      { name: "邮件 OTP（Resend）", status: "offline", detail: "未配置；OTP 登录会显示不可用" },
      { name: "Turnstile", status: "offline", detail: "未配置；验证码校验关闭" },
    ]);
    expect(JSON.stringify(report)).not.toContain("local-secret");
  });
});
