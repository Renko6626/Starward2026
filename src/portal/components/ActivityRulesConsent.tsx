import { Link } from "@tanstack/react-router";
import { getActivityRulesContent } from "../../shared/activity-rules";
import { useSiteTranslation } from "../../i18n/use-site-translation";

export function ActivityRulesConsent({ accepted, onChange, disabled = false, otp = false }: {
  accepted: boolean;
  onChange: (accepted: boolean) => void;
  disabled?: boolean;
  otp?: boolean;
}) {
  const { t, language } = useSiteTranslation();
  const rules = getActivityRulesContent(language);
  const [consentBeforeTitle, consentAfterTitle] = rules.consentText.split(rules.title);
  return <div className="activity-rules-consent">
    {otp ? <p className="auth-note">{t('auth.rules.newAccountNotice')}</p> : null}
    <label className="checkbox-field"><input type="checkbox" aria-label={rules.consentText} checked={accepted} disabled={disabled}
      onChange={event => onChange(event.target.checked)} />
      <span>{consentBeforeTitle}<Link to="/rules" target="_blank" rel="noopener noreferrer">{rules.title}</Link>{consentAfterTitle}</span>
    </label>
    <p className="auth-note">{t('auth.rules.privacyPrefix')}<a href="/privacy" target="_blank" rel="noopener noreferrer">{t('auth.rules.privacyLink')}</a>{language === 'en' ? '.' : '。'}</p>
  </div>;
}
