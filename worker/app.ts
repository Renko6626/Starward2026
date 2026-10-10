import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { createAuth } from "./lib/auth";
import { adminApi } from "./routes/admin";
import { portalApi } from "./routes/portal";
import { publicApi } from "./routes/public";
import { jsonError } from "./lib/http";
import type { AppRouteConfig } from "./lib/types";
import privacyHtml from "../public/privacy.html?raw";
import tosHtml from "../public/tos.html?raw";
import { requireAdminAccess } from './lib/admin';
import { isAdminPath, adminReturnTo } from '../src/shared/admin-access';

const app = new Hono<AppRouteConfig>();

app.use('*', async (c, next) => {
  const url = new URL(c.req.url);
  if (!isAdminPath(new URL(c.req.url).pathname)) return next();
  try {
    await requireAdminAccess(c);
  } catch (error) {
    if (!(error instanceof HTTPException)) throw error;
    const returnTo = adminReturnTo(url.pathname + url.search) ?? '/portal/admin';
    const destination = error.status === 401 ? '/portal/login' : '/portal/admin-access';
    const search = new URLSearchParams({ returnTo });
    if (error.status !== 401) search.set('reason', error.status === 403 ? 'forbidden' : 'unavailable');
    return c.redirect(`${destination}?${search}`, 302);
  }
  if (!c.env.ASSETS) return jsonError(c, 503, 'assets_unavailable', '页面资源暂时不可用。');
  const response = await c.env.ASSETS.fetch(c.req.raw);
  return c.newResponse(response.body, response.status as 200, { ...Object.fromEntries(response.headers), 'Cache-Control': 'private, no-store' });
});

// Keep the policy readable to direct HTTP clients as well as asset navigation.
// The static asset and Worker fallback share the same complete HTML document.
app.get("/privacy", (c) => c.html(privacyHtml));
app.get("/privacy/", (c) => c.html(privacyHtml));
app.get("/tos", (c) => c.html(tosHtml));
app.get("/tos/", (c) => c.html(tosHtml));

app.route("/api", publicApi);
app.route("/api/admin", adminApi);
app.route("/api/portal", portalApi);

app.all("/api/auth/*", async (c) => {
  const response = await createAuth(c.env).handler(c.req.raw);
  if (c.req.path === "/api/auth/oauth2/callback/qq" && response.status >= 400) return c.redirect("/portal/login?error=qq_auth_failed");
  return response;
});

app.onError((error, c) => {
  if (error instanceof HTTPException) {
    return jsonError(c, error.status, "http_error", error.message);
  }

  console.error(error);
  return jsonError(c, 500, "internal_error", "服务器发生未处理错误。");
});

app.notFound((c) => {
  // The former admin URLs are removed, including encoded/case variants.
  let path = new URL(c.req.url).pathname;
  try { path = decodeURIComponent(path).toLowerCase(); } catch { /* Keep an invalid path unmatched. */ }
  if (path === '/admin' || path.startsWith('/admin/') || path === '/admin-access') return jsonError(c, 404, 'not_found', '未找到对应页面。');
  if (!c.req.path.startsWith('/api/') && c.req.path !== '/api' && c.env.ASSETS) return c.env.ASSETS.fetch(c.req.raw);
  return jsonError(c, 404, "not_found", "未找到对应接口。");
});

export type AppType = typeof app;
export default app;
