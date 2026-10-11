import { useState } from 'react';
import { changeSiteLanguage } from './index';
import { useSiteTranslation } from './use-site-translation';
import './language-switcher.css';

export function LanguageSwitcher() {
  const { language, t } = useSiteTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  async function change() {
    setBusy(true);
    setError(false);
    try { await changeSiteLanguage(language === 'en' ? 'zh-CN' : 'en'); }
    catch { setError(true); }
    finally { setBusy(false); }
  }
  return <span className="language-switcher">
    <button type="button" aria-label={t(language === 'en' ? 'common.switchToChinese' : 'common.switchToEnglish')} disabled={busy} onClick={() => void change()}>
      <span lang={language === 'en' ? 'zh-CN' : 'en'}>{language === 'en' ? '中文' : 'English'}</span>
    </button>
    {error ? <span role="alert">{t('common.languageError')}</span> : null}
  </span>;
}
