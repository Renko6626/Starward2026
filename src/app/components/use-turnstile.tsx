import { useEffect, useRef, useState, type ReactNode } from 'react';
import { getTurnstileClientErrorMessage, getTurnstileSiteKey, loadTurnstileApi } from '../lib/turnstile';
import { AUTH_CAPTCHA_HEADER } from '../../shared/turnstile';

export type TurnstileVerificationState = {
  ready: boolean;
  token: string | undefined;
  headers: Record<string, string>;
  node: ReactNode;
  reset: () => void;
};

export function useTurnstileVerification(required: boolean | undefined, active = true, context = ''): TurnstileVerificationState {
  const siteKey = getTurnstileSiteKey(import.meta.env);
  const container = useRef<HTMLDivElement>(null);
  const [generation, setGeneration] = useState(0);
  const [verified, setVerified] = useState<{ value: string; context: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const verificationContext = `${active}:${context}:${generation}`;
  const token = verified?.context === verificationContext ? verified.value : undefined;
  function reset() { setVerified(null); setError(null); setGeneration(value => value + 1); }

  useEffect(() => {
    setError(null);
    if (!active || !required || !siteKey || !container.current) return;
    let cancelled = false;
    let widget: string | undefined;
    void loadTurnstileApi().then(api => {
      if (cancelled || !container.current) return;
      widget = api.render(container.current, {
        sitekey: siteKey, theme: 'dark', size: 'flexible', retry: 'auto', 'retry-interval': 3000,
        callback: value => { if (!cancelled) { setVerified({ value, context: verificationContext }); setError(null); } },
        'expired-callback': () => { if (!cancelled) { setVerified(null); setError('验证已过期，请重新验证。'); } },
        'error-callback': code => { if (!cancelled) { setVerified(null); setError(getTurnstileClientErrorMessage(code)); } },
        'unsupported-callback': () => { if (!cancelled) { setVerified(null); setError('当前浏览器不支持人机验证，请使用最新版 Chrome、Edge 或 Safari 打开。'); } },
        'timeout-callback': () => { if (!cancelled) { setVerified(null); setError('验证超时，请重试。'); } },
      });
    }).catch(() => { if (!cancelled) { setVerified(null); setError('无法加载验证服务。请换个网络或浏览器，再点击重新验证。'); } });
    return () => { cancelled = true; if (widget !== undefined) window.turnstile?.remove?.(widget); };
  }, [required, active, siteKey, verificationContext]);

  const ready = !active || required === false || (required === true && Boolean(siteKey && token) && !error);
  return {
    ready, token, headers: token ? { [AUTH_CAPTCHA_HEADER]: token } : {}, reset,
    node: !active || required === false ? null : <div className="space-y-2 my-4" aria-label="人机验证">
      {required === undefined ? <p className="field-hint" role="status">正在读取验证设置。</p>
        : !siteKey ? <p className="field-hint" role="alert">验证设置暂不可用，请联系主催。</p>
          : <div ref={container} />}
      {error ? <><p className="field-hint" role="alert">{error}</p><button type="button" className="text-link" onClick={reset}>重新验证</button></> : null}
    </div>,
  };
}
