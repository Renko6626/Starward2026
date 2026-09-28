import { describe, expect, it } from "vitest";
import { getRuntimeKind } from "./http";
import type { AppBindings, AppContext } from "./types";

function context(env: AppBindings): AppContext {
  return { env } as unknown as AppContext;
}

describe("getRuntimeKind", () => {
  it("defaults to the cloudflare runtime when no marker is set", () => {
    expect(getRuntimeKind(context({}))).toBe("cloudflare");
  });

  it("returns the node runtime marker when set", () => {
    expect(getRuntimeKind(context({ RUNTIME: "node" }))).toBe("node");
  });
});
