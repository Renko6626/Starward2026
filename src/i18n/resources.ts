import { commonMessages } from './locales/common';
import { publicMessages } from './locales/public';
import { authMessages } from './locales/portal-auth';
import { portalMessages } from './locales/portal';

export const messages = { ...commonMessages, ...publicMessages, ...authMessages, ...portalMessages };
export const resources = {
  'zh-CN': { translation: Object.fromEntries(Object.entries(messages).map(([key, value]) => [key, value.zh])) },
  en: { translation: Object.fromEntries(Object.entries(messages).map(([key, value]) => [key, value.en])) },
};
