import { describe, expect, it } from "vitest";
import app from "./app";

describe("public privacy policy", () => {
  it('serves English policies and remembers an explicit language choice', async () => {
    const privacy = await app.request('/privacy', { headers: { 'Accept-Language': 'en-US' } });
    expect(privacy.headers.get('Content-Language')).toBe('en');
    expect(await privacy.text()).toContain('<h1 id="privacy-title">Privacy Policy</h1>');
    expect(privacy.headers.get('Vary')).toContain('Cookie');
    const terms = await app.request('/tos?lang=en', { headers: { Cookie: 'starward-language=zh-CN' } });
    expect(terms.headers.get('Set-Cookie')).toContain('starward-language=en');
    expect(await terms.text()).toContain('2026-10-12-v13');
    const chinese = await app.request('/privacy', { headers: { Cookie: 'starward-language=zh-CN', 'Accept-Language': 'en' } });
    expect(chinese.headers.get('Content-Language')).toBe('zh-CN');
  });

  it('localizes actual API errors while preserving the error code', async () => {
    const response = await app.request('/api/does-not-exist', { headers: { 'Accept-Language': 'en' } });
    expect(response.status).toBe(404);
    expect(response.headers.get('Content-Language')).toBe('en');
    expect(await response.json()).toEqual({ error: { code: 'not_found', message: 'The requested endpoint was not found.' } });
  });
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
