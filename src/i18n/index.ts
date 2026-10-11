import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';
import { isChineseAdminSurface, LANGUAGE_COOKIE, readLanguageCookie, resolveLanguage, type SiteLanguage } from '../shared/i18n';
import { resources } from './resources';

export function getBrowserLanguage(): SiteLanguage {
  if (typeof document === 'undefined') return 'zh-CN';
  if (isChineseAdminSurface(window.location.pathname)) return 'zh-CN';
  return getPreferredBrowserLanguage();
}

function getPreferredBrowserLanguage(): SiteLanguage {
  if (typeof document === 'undefined') return 'zh-CN';
  return resolveLanguage(readLanguageCookie(document.cookie), navigator.languages?.join(',') || navigator.language);
}

function makeInstance(language: SiteLanguage) {
  const instance = createInstance();
  void instance.use(initReactI18next).init({
    lng: language, fallbackLng: 'zh-CN', supportedLngs: ['zh-CN', 'en'], resources,
    keySeparator: false, nsSeparator: false, initAsync: false,
    interpolation: { escapeValue: false }, react: { useSuspense: false },
  });
  return instance;
}

function initializeLanguagePreference() {
  if (typeof document !== 'undefined') {
    const requested = new URLSearchParams(location.search).get('lang');
    if (requested === 'en' || requested === 'zh-CN') {
      saveLanguagePreference(requested);
      const url = new URL(location.href);
      url.searchParams.delete('lang');
      history.replaceState(history.state, '', url.pathname + url.search + url.hash);
    }
  }
  return getPreferredBrowserLanguage();
}

function saveLanguagePreference(language: SiteLanguage) {
  document.cookie = `${LANGUAGE_COOKIE}=${language}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
}

export const siteI18n = makeInstance(initializeLanguagePreference());
export const adminI18n = makeInstance('zh-CN');

export async function changeSiteLanguage(language: SiteLanguage) {
  const previous = getPreferredBrowserLanguage();
  saveLanguagePreference(language);
  try { await siteI18n.changeLanguage(language); }
  catch (error) { saveLanguagePreference(previous); throw error; }
}
