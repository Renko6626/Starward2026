import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { createAuth } from "./lib/auth";
import { adminApi } from "./routes/admin";
import { portalApi } from "./routes/portal";
import { publicApi } from "./routes/public";
import { jsonError } from "./lib/http";
import type { AppRouteConfig } from "./lib/types";

const app = new Hono<AppRouteConfig>();

app.route("/api", publicApi);
app.route("/api/admin", adminApi);
app.route("/api/portal", portalApi);

app.all("/api/auth/*", async (c) => {
  return createAuth(c.env).handler(c.req.raw);
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
