import { describe, expect, it } from "vitest";
import workerApp, { createApp } from "./app";
import type { AppBindings } from "./lib/types";

async function readIntake(app: { fetch: (request: Request, env: AppBindings) => Response | Promise<Response> }, env: AppBindings) {
  const response = await app.fetch(
    new Request("http://localhost/api/applications/intake"),
    env,
  );

  return (await response.json()) as { turnstileEnabled: boolean; isOpen: boolean };
}

describe("createApp", () => {
  it("keeps the Worker export on request-scoped bindings", async () => {
    const body = await readIntake(workerApp, { TURNSTILE_SECRET_KEY: "worker-secret" });

    expect(body.turnstileEnabled).toBe(true);
    expect(body.isOpen).toBe(false);
  });

  it("does not invent bindings for the Worker export", async () => {
    const body = await readIntake(workerApp, {});

    expect(body.turnstileEnabled).toBe(false);
  });

  it("lets request-scoped bindings override factory defaults", async () => {
    const app = createApp({ TURNSTILE_SECRET_KEY: "default-secret" });
    const body = await readIntake(app, { TURNSTILE_SECRET_KEY: "request-secret" });

    expect(body.turnstileEnabled).toBe(true);
  });

  it("falls back to factory defaults when the request env omits a binding", async () => {
    const app = createApp({ TURNSTILE_SECRET_KEY: "default-secret" });
    const body = await readIntake(app, {});

    expect(body.turnstileEnabled).toBe(true);
  });
});
