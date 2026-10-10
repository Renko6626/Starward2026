import { describe, expect, it } from "vitest";
import { getTurnstileSiteKey } from "./turnstile";

describe("getTurnstileSiteKey", () => {
  it("returns a trimmed site key when configured", () => {
    expect(
      getTurnstileSiteKey({
        VITE_TURNSTILE_SITE_KEY: "  0x4AAAAAAC7-OlhD79ptmOIB  ",
      }),
    ).toBe("0x4AAAAAAC7-OlhD79ptmOIB");
  });

  it("returns null when the site key is missing", () => {
    expect(getTurnstileSiteKey({})).toBeNull();
  });
});
