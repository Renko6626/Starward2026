import { describe, expect, it } from "vitest";
import app from "./app";

describe("public privacy policy", () => {
  it.each(["/privacy", "/privacy/", "/privacy?review=google"])(
    "serves complete HTML without authentication or database bindings at %s",
    async (path) => {
      const response = await app.request(path);
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toMatch(/^text\/html\b/);
      const html = await response.text();
      expect(html).toMatch(/^<!doctype html>/i);
      expect(html).toContain('<h1 id="privacy-title">隐私政策</h1>');
      expect(html).toContain("Starward Pilgrimage");
      expect(html).toContain("Google API Services User Data Policy");
      expect(html).toContain('id="retention"');
      expect(html).toContain('id="choices"');
      expect(html).toContain('id="contact"');
      expect(html).not.toMatch(/<script\b|<iframe\b|<embed\b|<object\b/i);
      expect(response.headers.has("set-cookie")).toBe(false);
    },
  );

  it("supports a direct HEAD request", async () => {
    const response = await app.request("/privacy", { method: "HEAD" });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toMatch(/^text\/html\b/);
    expect(await response.text()).toBe("");
  });

  it("preserves JSON 404s for missing API endpoints", async () => {
    const response = await app.request("/api/does-not-exist");
    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toContain("application/json");
  });
});
