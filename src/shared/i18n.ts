import { isAdminPath } from './admin-access';

export type SiteLanguage = 'zh-CN' | 'en';
export const LANGUAGE_COOKIE = 'starward-language';

function supportedLanguage(value: string): SiteLanguage | undefined {
  const base = value.trim().toLowerCase().replaceAll('_', '-').split('-')[0];
  return base === 'en' ? 'en' : base === 'zh' ? 'zh-CN' : undefined;
}

/** Explicit preferences win; unsupported preferences continue to browser negotiation. */
export function resolveLanguage(preference?: string | null, acceptLanguage?: string | null): SiteLanguage {
  if (preference) {
    const language = supportedLanguage(preference);
    if (language) return language;
  }
  const candidates = (acceptLanguage ?? '').split(',').map((part, index) => {
    const [tag = '', ...parameters] = part.trim().split(';');
    const qualityParameter = parameters.find(value => value.trim().startsWith('q='));
    const quality = qualityParameter ? Number(qualityParameter.trim().slice(2)) : 1;
    return { language: supportedLanguage(tag), quality, index };
  }).filter(item => item.language && Number.isFinite(item.quality) && item.quality > 0 && item.quality <= 1)
    .sort((a, b) => b.quality - a.quality || a.index - b.index);
  return candidates[0]?.language ?? 'zh-CN';
}

export function readLanguageCookie(cookie: string | null | undefined): string | undefined {
  const value = cookie?.split(';').find(item => item.trim().startsWith(`${LANGUAGE_COOKIE}=`))?.trim().slice(LANGUAGE_COOKIE.length + 1);
  try { return value ? decodeURIComponent(value) : undefined; } catch { return undefined; }
}

export function isChineseAdminSurface(pathname: string) {
  return isAdminPath(pathname) || pathname === '/portal/admin-access' || pathname.startsWith('/api/admin/');
}

export function getRequestLanguage(headers: Headers, pathname = ''): SiteLanguage {
  return isChineseAdminSurface(pathname) ? 'zh-CN'
    : resolveLanguage(readLanguageCookie(headers.get('cookie')), headers.get('accept-language'));
}

/** Only the system's original generated name is localized. Custom names remain untouched. */
export function localizeSegmentName(code: string | null | undefined, name: string | null | undefined, language: SiteLanguage) {
  if (language === 'en' && code && /^\d+$/.test(code) && name === `第 ${Number(code)} 段`) return `Slot ${Number(code)}`;
  return name ?? '';
}

export { localizeSystemLabel } from './system-labels';
