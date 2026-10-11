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
import privacyEnHtml from '../public/privacy-en.html?raw';
import tosEnHtml from '../public/tos-en.html?raw';
import { setCookie } from 'hono/cookie';
import { requireAdminAccess } from './lib/admin';
import { isAdminPath, adminReturnTo } from '../src/shared/admin-access';
import { getRequestLanguage, LANGUAGE_COOKIE } from '../src/shared/i18n';
import type { AppContext } from './lib/types';
import { localizeApiPayload } from './lib/i18n';

const app = new Hono<AppRouteConfig>();

app.use('/api/*', async (c, next) => {
  await next();
  const language = getRequestLanguage(c.req.raw.headers, c.req.path);
  const response = c.res;
  if (!response.headers.get('Content-Type')?.includes('application/json')) return;
  const headers = new Headers(response.headers);
  headers.set('Content-Language', language);
  const vary = new Set((headers.get('Vary') ?? '').split(',').map(value => value.trim()).filter(Boolean));
  vary.add('Accept-Language'); vary.add('Cookie');
  headers.set('Vary', [...vary].join(', '));
  if (language === 'zh-CN') { c.res = new Response(response.body, { status: response.status, headers }); return; }
  const payload: unknown = await response.clone().json();
  headers.delete('Content-Length');
  c.res = new Response(JSON.stringify(localizeApiPayload(payload, c.req.path, language)), { status: response.status, headers });
});

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
function policyResponse(c: AppContext, chinese: string, english: string) {
  const requested = c.req.query('lang');
  const explicit = requested === 'en' || requested === 'zh-CN' ? requested : undefined;
  const language = explicit ?? getRequestLanguage(c.req.raw.headers);
  if (explicit) setCookie(c, LANGUAGE_COOKIE, explicit, { path: '/', maxAge: 31536000, sameSite: 'Lax', secure: new URL(c.req.url).protocol === 'https:' });
  c.header('Content-Language', language);
  c.header('Vary', 'Accept-Language, Cookie');
  c.header('Cache-Control', 'private, no-cache');
  return c.html(language === 'en' ? english : chinese);
}
app.get("/privacy", (c) => policyResponse(c, privacyHtml, privacyEnHtml));
app.get("/privacy/", (c) => policyResponse(c, privacyHtml, privacyEnHtml));
app.get("/tos", (c) => policyResponse(c, tosHtml, tosEnHtml));
app.get("/tos/", (c) => policyResponse(c, tosHtml, tosEnHtml));

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
