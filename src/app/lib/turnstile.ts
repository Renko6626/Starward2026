export type TurnstileRenderOptions = {
  sitekey: string;
  theme?: 'dark' | 'light' | 'auto';
  size?: 'normal' | 'compact' | 'flexible';
  callback?: (token: string) => void;
  retry?: 'auto' | 'never';
  "retry-interval"?: number;
  "expired-callback"?: () => void;
  "error-callback"?: (code: string) => void;
  "unsupported-callback"?: () => void;
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

export function getTurnstileSiteKey(env: { VITE_TURNSTILE_SITE_KEY?: string | undefined }) {
  const trimmed = env.VITE_TURNSTILE_SITE_KEY?.trim();
  return trimmed ? trimmed : null;
}

export function getTurnstileClientErrorMessage(code: string) {
  let message = '人机验证未完成，请重试。若仍失败，请换个网络或浏览器。';
  if (['110100', '110110', '110200', '400020', '400021', '400070'].includes(code)) {
    message = '网站的验证设置有误，请联系主催。';
  } else if (code === '200500') {
    message = '验证服务连接失败。请换个网络，或关闭广告拦截后重试。';
  } else if (code === '200100') {
    message = '请检查设备的日期和时间，再刷新页面重试。';
  } else if (code === '110600' || code === '110620') {
    message = '验证超时，请重新验证。';
  }
  return /^\d{6}$/.test(code) ? `${message}（错误码 ${code}）` : message;
}

export async function loadTurnstileApi() {
  if (typeof window === "undefined" || typeof document === "undefined") {
    throw new Error("Turnstile can only load in the browser.");
  }

  if (window.turnstile) {
    return window.turnstile;
  }

  if (!window.__starwardTurnstileLoader__) {
    // Keep callers on the same promise while a transient load failure is retried.
    window.__starwardTurnstileLoader__ = loadTurnstileScript()
      .catch(() => loadTurnstileScript())
      .catch(error => {
        window.__starwardTurnstileLoader__ = undefined;
        throw error;
      });
  }

  return window.__starwardTurnstileLoader__;
}

function loadTurnstileScript() {
  const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${TURNSTILE_SCRIPT_SRC}"]`);
  const script = existingScript ?? document.createElement('script');
  let timeout: number | undefined;
  let handleLoad: () => void;
  let handleError: () => void;
  return new Promise<TurnstileApi>((resolve, reject) => {
    timeout = window.setTimeout(() => reject(new Error('Turnstile script loading timed out.')), 15000);
    handleLoad = () => {
      if (window.turnstile) resolve(window.turnstile);
      else reject(new Error('Turnstile loaded without exposing the global API.'));
    };
    handleError = () => reject(new Error('Failed to load the Turnstile script.'));
    script.addEventListener('load', handleLoad, { once: true });
    script.addEventListener('error', handleError, { once: true });
    if (!existingScript) {
      script.src = TURNSTILE_SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      document.head.append(script);
    }
  }).catch(error => {
    script.remove();
    throw error;
  }).finally(() => {
    if (timeout !== undefined) window.clearTimeout(timeout);
    script.removeEventListener('load', handleLoad);
    script.removeEventListener('error', handleError);
  });
}
