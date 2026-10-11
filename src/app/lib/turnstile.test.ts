import { afterEach, describe, expect, it, vi } from "vitest";
import { getTurnstileSiteKey, loadTurnstileApi, type TurnstileApi } from "./turnstile";

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

function scriptEnvironment() {
  const scripts: Script[] = [];
  class Script extends EventTarget {
    src = '';
    async = false;
    defer = false;
    remove() { scripts.splice(scripts.indexOf(this), 1); }
  }
  const browser = { setTimeout, clearTimeout, turnstile: undefined as TurnstileApi | undefined };
  vi.stubGlobal('window', browser);
  vi.stubGlobal('document', {
    querySelector: () => scripts[0] ?? null,
    createElement: () => new Script(),
    head: { append: (script: Script) => scripts.push(script) },
  });
  const api: TurnstileApi = { render: () => 'widget', reset: () => {} };
  return { scripts, browser, api };
}

describe('loadTurnstileApi', () => {
  it('recovers from a failed script load for all waiting callers', async () => {
    const { scripts, browser, api } = scriptEnvironment();
    const first = loadTurnstileApi();
    const second = loadTurnstileApi();
    const results = Promise.all([first, second]).catch(error => error);
    const failed = scripts[0]!;
    failed.dispatchEvent(new Event('error'));
    await vi.waitFor(() => { expect(scripts).toHaveLength(1); expect(scripts[0]).not.toBe(failed); });
    expect(scripts).toHaveLength(1);
    browser.turnstile = api;
    scripts[0]!.dispatchEvent(new Event('load'));
    expect(await results).toEqual([api, api]);
  });

  it('stops after repeated load failures and allows a fresh manual retry', async () => {
    const { scripts, browser, api } = scriptEnvironment();
    const result = loadTurnstileApi().catch(error => error);
    const first = scripts[0]!;
    first.dispatchEvent(new Event('error'));
    await vi.waitFor(() => { expect(scripts).toHaveLength(1); expect(scripts[0]).not.toBe(first); });
    scripts[0]!.dispatchEvent(new Event('error'));
    expect(await result).toBeInstanceOf(Error);
    expect(scripts).toHaveLength(0);
    const retry = loadTurnstileApi();
    browser.turnstile = api;
    scripts[0]!.dispatchEvent(new Event('load'));
    expect(await retry).toBe(api);
  });

  it('recovers when the first script never finishes loading', async () => {
    vi.useFakeTimers();
    const { scripts, browser, api } = scriptEnvironment();
    const result = loadTurnstileApi().catch(error => error);
    const first = scripts[0]!;
    await vi.advanceTimersByTimeAsync(15000);
    expect(scripts).toHaveLength(1);
    expect(scripts[0]).not.toBe(first);
    browser.turnstile = api;
    scripts[0]!.dispatchEvent(new Event('load'));
    expect(await result).toBe(api);
    expect(vi.getTimerCount()).toBe(0);
  });
});

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
