export type TurnstileRenderOptions = {
  sitekey: string;
  theme?: 'dark' | 'light' | 'auto';
  size?: 'normal' | 'compact' | 'flexible';
  callback?: (token: string) => void;
  "expired-callback"?: () => void;
  "error-callback"?: () => void;
  "timeout-callback"?: () => void;
};

export type TurnstileApi = {
  render: (container: HTMLElement, options: TurnstileRenderOptions) => string;
  reset: (widgetId?: string) => void;
  remove?: (widgetId?: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
    __starwardTurnstileLoader__?: Promise<TurnstileApi>;
  }
}

const TURNSTILE_SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

export async function loadTurnstileApi() {
  if (typeof window === "undefined" || typeof document === "undefined") {
    throw new Error("Turnstile can only load in the browser.");
  }

  if (window.turnstile) {
    return window.turnstile;
  }

  if (!window.__starwardTurnstileLoader__) {
    let timeout: number | undefined;
    window.__starwardTurnstileLoader__ = new Promise<TurnstileApi>((resolve, reject) => {
      timeout = window.setTimeout(() => reject(new Error('Turnstile script loading timed out.')), 15000);
      const existingScript = document.querySelector<HTMLScriptElement>(
        `script[src="${TURNSTILE_SCRIPT_SRC}"]`,
      );

      const handleLoad = () => {
        if (window.turnstile) {
          resolve(window.turnstile);
          return;
        }

        reject(new Error("Turnstile loaded without exposing the global API."));
      };

      if (existingScript) {
        existingScript.addEventListener("load", handleLoad, { once: true });
        existingScript.addEventListener(
          "error",
          () => reject(new Error("Failed to load the Turnstile script.")),
          { once: true },
        );
        return;
      }

      const script = document.createElement("script");
      script.src = TURNSTILE_SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      script.addEventListener("load", handleLoad, { once: true });
      script.addEventListener(
        "error",
        () => reject(new Error("Failed to load the Turnstile script.")),
        { once: true },
      );
      document.head.append(script);
    }).catch(error => {
      window.__starwardTurnstileLoader__ = undefined;
      document.querySelector<HTMLScriptElement>(`script[src="${TURNSTILE_SCRIPT_SRC}"]`)?.remove();
      throw error;
    }).finally(() => { if (timeout !== undefined) window.clearTimeout(timeout); });
  }

  return window.__starwardTurnstileLoader__;
}
