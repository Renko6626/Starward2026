import { describe, expect, it } from 'vitest';
import { getRequestLanguage, localizeSegmentName, resolveLanguage } from './i18n';

describe('site language', () => {
  it('uses an explicit preference before weighted browser languages', () => {
    expect(resolveLanguage('en', 'zh-CN,en;q=0.5')).toBe('en');
    expect(resolveLanguage(undefined, 'fr,en;q=0.8,zh-CN;q=0.9')).toBe('zh-CN');
    expect(resolveLanguage(undefined, 'en;q=0,zh-CN;q=0.8')).toBe('zh-CN');
    expect(resolveLanguage('invalid', 'en-US')).toBe('en');
    expect(resolveLanguage(undefined, 'ja')).toBe('zh-CN');
  });

  it('keeps administration Chinese without changing the public preference', () => {
    const headers = new Headers({ Cookie: 'starward-language=en', 'Accept-Language': 'en-US' });
    expect(getRequestLanguage(headers, '/api/portal/history')).toBe('en');
    expect(getRequestLanguage(headers, '/api/admin/participants')).toBe('zh-CN');
    expect(getRequestLanguage(headers, '/portal/admin/schedule')).toBe('zh-CN');
    expect(getRequestLanguage(headers, '/api/portal/history')).toBe('en');
  });

  it('localizes generated slot names while preserving custom names', () => {
    expect(localizeSegmentName('02', '第 2 段', 'en')).toBe('Slot 2');
    expect(localizeSegmentName('02', '夜间接力', 'en')).toBe('夜间接力');
    expect(localizeSegmentName('02', '第 2 段', 'zh-CN')).toBe('第 2 段');
  });
});
