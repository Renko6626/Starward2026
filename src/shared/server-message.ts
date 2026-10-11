import { localizeSegmentName, localizeSystemLabel } from './i18n';
import { serverMessages } from './locales/server';
import { createMessageTranslator } from './translation-messages';

/** Interpret only parameters known to contain generated labels; all other values are opaque. */
export const localizeServerMessage = createMessageTranslator(serverMessages, (key, name, value, values, language) => {
  if (key === 'server.workDetailsMissingFields' || key === 'server.reviewNotesMissingFields') {
    return value.split('、').map(field => localizeSystemLabel(field, language)).join(language === 'en' ? ', ' : '、');
  }
  if (key === 'server.registrationWindowState') return localizeSystemLabel(value, language);
  if (['server.slotAlreadyHeldWithName', 'server.slotClaimedWithName', 'server.slotChangedWithName', 'server.slotReleasedWithName'].includes(key) && name === 'v1') {
    return localizeSegmentName(values.v0, value, language);
  }
  if (key.startsWith('server.historySlot') || key === 'server.slotAlreadyHeldLabel') {
    const match = /^(\d+) (?:· )?(第 \d+ 段)$/.exec(value);
    if (match) return `${match[1]} (${localizeSegmentName(match[1], match[2], language)})`;
  }
  return value;
});
