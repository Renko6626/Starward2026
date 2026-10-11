import type { SiteLanguage } from '../../shared/i18n';

export function formatDateTime(value: string | null, language: SiteLanguage = 'zh-CN') {
  if (!value) {
    return language === 'en' ? 'Not recorded' : "未记录";
  }

  return new Intl.DateTimeFormat(language, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatScheduledTime(value: string | null | undefined, language: SiteLanguage = 'zh-CN') {
  if (!value) return language === 'en' ? 'Release time to be announced' : "发布时间待定";
  return new Intl.DateTimeFormat(language, { timeZone: "Asia/Shanghai", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(value));
}
