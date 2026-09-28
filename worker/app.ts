import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { createAuth } from "./lib/auth";
import { adminApi } from "./routes/admin";
import { portalApi } from "./routes/portal";
import { publicApi } from "./routes/public";
import { jsonError } from "./lib/http";
import type { AppBindings, AppRouteConfig } from "./lib/types";

/**
 * Build the shared Hono application with the repository's route order.
 *
 * `bindings` are the default environment for the returned app. Cloudflare
 * passes its request-scoped bindings to `app.fetch(request, env, ctx)` and
 * those always win over the defaults, so `createApp()` keeps the existing
 * Worker behaviour. The Node entrypoint pre-binds `NodeRuntimeEnv` plus the
 * SQLite D1 facade so it can hand `app.fetch` straight to `@hono/node-server`.
 */
export function createApp(bindings: AppBindings = {}): Hono<AppRouteConfig> {
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

  const dispatch = app.fetch.bind(app);
  const hasDefaults = Object.keys(bindings).length > 0;

  app.fetch = (request, env, executionCtx) => {
    if (!hasDefaults) {
      return dispatch(request, env, executionCtx);
    }

    return dispatch(request, { ...bindings, ...(env as AppBindings | undefined) }, executionCtx);
  };

  return app;
}

const app = createApp();

export type AppType = typeof app;
export default app;
