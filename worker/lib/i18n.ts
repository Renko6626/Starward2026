import { isChineseAdminSurface, localizeSegmentName, localizeSystemLabel, type SiteLanguage } from '../../src/shared/i18n';
import { localizeServerMessage } from '../../src/shared/server-message';

const translateMessage = localizeServerMessage;
type JsonObject = Record<string, unknown>;
const object = (value: unknown): value is JsonObject => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

function localizeEvent(value: unknown, language: SiteLanguage) {
  if (!object(value)) return value;
  return { ...value,
    ...(typeof value.label === 'string' ? { label: translateMessage(value.label, language) } : {}),
    ...(typeof value.actorLabel === 'string' ? { actorLabel: translateMessage(value.actorLabel, language) } : {}),
  };
}

function localizeSegment(value: unknown, language: SiteLanguage) {
  if (!object(value)) return value;
  return { ...value, ...(typeof value.code === 'string' && typeof value.name === 'string'
    ? { name: localizeSegmentName(value.code, value.name, language) } : {}) };
}

function localizeWindow(value: unknown, language: SiteLanguage) {
  if (!object(value) || typeof value.label !== 'string') return value;
  return { ...value, label: localizeSystemLabel(value.label, language) };
}

function localizeValidationDetails(value: unknown, language: SiteLanguage) {
  if (!object(value)) return value;
  const strings = (items: unknown) => Array.isArray(items) ? items.map(item => typeof item === 'string' ? translateMessage(item, language) : item) : items;
  return { ...value,
    ...(object(value.fieldErrors) ? { fieldErrors: Object.fromEntries(Object.entries(value.fieldErrors).map(([key, errors]) => [key, strings(errors)])) } : {}),
    ...(Array.isArray(value.formErrors) ? { formErrors: strings(value.formErrors) } : {}),
  };
}

/** Project only documented system-display fields. In particular, swap messages and work/profile fields are opaque. */
export function localizeApiPayload(payload: unknown, pathname: string, language: SiteLanguage): unknown {
  if (language === 'zh-CN' || isChineseAdminSurface(pathname) || !object(payload)) return payload;
  const result = { ...payload };
  if (typeof result.message === 'string') result.message = translateMessage(result.message, language);
  if (object(result.error)) result.error = { ...result.error,
    ...(typeof result.error.message === 'string' ? { message: translateMessage(result.error.message, language) } : {}),
    ...(result.error.details ? { details: localizeValidationDetails(result.error.details, language) } : {}),
  };
  if (object(result.actions)) result.actions = Object.fromEntries(Object.entries(result.actions).map(([key, value]) => [key,
    ['claimHint', 'changeHint', 'releaseHint'].includes(key) && typeof value === 'string' ? translateMessage(value, language) : value]));
  if (Array.isArray(result.recentEvents)) result.recentEvents = result.recentEvents.map(event => localizeEvent(event, language));
  if (pathname === '/api/portal/history' && Array.isArray(result.items)) result.items = result.items.map(event => localizeEvent(event, language));
  if (Array.isArray(result.windows)) result.windows = result.windows.map(window => localizeWindow(window, language));
  if (object(result.window)) result.window = localizeWindow(result.window, language);
  for (const key of ['currentSegment', 'segment']) if (object(result[key])) result[key] = localizeSegment(result[key], language);
  if (Array.isArray(result.segments)) result.segments = result.segments.map(segment => localizeSegment(segment, language));
  if (pathname === '/api/portal/segments/available' && Array.isArray(result.items)) result.items = result.items.map(segment => localizeSegment(segment, language));
  if (Array.isArray(result.interestFormats)) result.interestFormats = result.interestFormats.map(item => object(item) && typeof item.label === 'string' ? { ...item, label: localizeSystemLabel(item.label, language) } : item);
  if (object(result.profile) && result.profile.isAnonymous === true) {
    for (const key of ['draft', 'projectDraft']) if (object(result[key])) result[key] = { ...result[key], publicAuthorName: 'Anonymous' };
  }
  // User names and all work/profile/neighbor notes remain exactly as authored.
  return result;
}
