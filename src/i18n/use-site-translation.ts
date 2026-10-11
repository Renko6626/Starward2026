import { useTranslation } from 'react-i18next';
import { useCallback } from 'react';
import { localizeSystemLabel, type SiteLanguage } from '../shared/i18n';
import { createMessageTranslator } from '../shared/translation-messages';
import { messages } from './resources';
import { localizeServerMessage } from '../shared/server-message';

const translateKnownMessage = createMessageTranslator(messages);

export function useSiteTranslation() {
  const { t: translate, i18n } = useTranslation();
  const language: SiteLanguage = i18n.resolvedLanguage === 'en' ? 'en' : 'zh-CN';
  const t = useCallback((key: string, values?: Record<string, unknown>): string => String(translate(key, values)), [translate]);
  const label = useCallback((text: string) => translateKnownMessage(localizeServerMessage(localizeSystemLabel(text, language), language), language), [language]);
  return {
    t,
    language,
    label,
  };
}
