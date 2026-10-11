import { useSiteTranslation } from "../../i18n/use-site-translation";
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
  const { t, language } = useSiteTranslation();
  const siteKey = getTurnstileSiteKey(import.meta.env);
  const container = useRef<HTMLDivElement>(null);
  const [generation, setGeneration] = useState(0);
  const [verified, setVerified] = useState<{ value: string; context: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const verificationContext = `${active}:${context}:${generation}:${language}`;
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
        sitekey: siteKey, language: language === 'en' ? 'en' : 'zh-cn', theme: 'dark', size: 'flexible', retry: 'auto', 'retry-interval': 3000,
        callback: value => { if (!cancelled) { setVerified({ value, context: verificationContext }); setError(null); } },
        'expired-callback': () => { if (!cancelled) { setVerified(null); setError(t("auth.verification.expired")); } },
        'error-callback': code => { if (!cancelled) { setVerified(null); setError(getTurnstileClientErrorMessage(code, language)); } },
        'unsupported-callback': () => { if (!cancelled) { setVerified(null); setError(t("auth.verification.unsupported")); } },
        'timeout-callback': () => { if (!cancelled) { setVerified(null); setError(t("auth.verification.timeout")); } },
      });
    }).catch(() => { if (!cancelled) { setVerified(null); setError(t("auth.verification.loadFailed")); } });
    return () => { cancelled = true; if (widget !== undefined) window.turnstile?.remove?.(widget); };
  }, [required, active, siteKey, verificationContext, language, t]);

  const ready = !active || required === false || (required === true && Boolean(siteKey && token) && !error);
  return {
    ready, token, headers: token ? { [AUTH_CAPTCHA_HEADER]: token } : {}, reset,
    node: !active || required === false ? null : <div className="space-y-2 my-4" aria-label={t("auth.verification.label")}>
      {required === undefined ? <p className="field-hint" role="status">{t("auth.verification.loading")}</p>
        : !siteKey ? <p className="field-hint" role="alert">{t("auth.verification.unavailable")}</p>
          : <div ref={container} />}
      {error ? <><p className="field-hint" role="alert">{error}</p><button type="button" className="text-link" onClick={reset}>{t("auth.verification.retry")}</button></> : null}
    </div>,
  };
}
