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

const app = new Hono<AppRouteConfig>();

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
  return jsonError(c, 404, "not_found", "未找到对应接口。");
});

export type AppType = typeof app;
export default app;
