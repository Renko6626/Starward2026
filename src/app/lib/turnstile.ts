export type TurnstileRenderOptions = {
  sitekey: string;
  callback?: (token: string) => void;
  "expired-callback"?: () => void;
  "error-callback"?: () => void;
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
    window.__starwardTurnstileLoader__ = new Promise<TurnstileApi>((resolve, reject) => {
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
    });
  }

  return window.__starwardTurnstileLoader__;
}
