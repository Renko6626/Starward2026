import { describe, expect, it } from 'vitest';
import { localizeApiPayload } from './i18n';

describe('localized API presentation', () => {
  it('translates system prompts and validation while preserving codes and user content', () => {
    const payload = {
      message: '已更新联系资料与公开署名设置。',
      profile: { creditName: '已更新联系资料与公开署名设置。', primaryContactChannel: '微信' },
      error: { code: 'invalid_request', message: '资料参数不正确。', details: { fieldErrors: { creditName: ['请填写署名。'] } } },
      requests: [{ message: '已更新联系资料与公开署名设置。', requesterName: '主催' }],
    };
    const translated = localizeApiPayload(payload, '/api/portal/profile', 'en') as typeof payload;
    expect(translated.message).toBe('Your contact details and public credit settings have been updated.');
    expect(translated.error.code).toBe('invalid_request');
    expect(translated.error.details.fieldErrors.creditName).toEqual(['Enter your display name.']);
    expect(translated.profile).toEqual(payload.profile);
    expect(translated.requests).toEqual(payload.requests);
    expect(payload.message).toBe('已更新联系资料与公开署名设置。');
  });

  it('translates generated history and defaults without altering work text or custom slots', () => {
    const payload = {
      recentEvents: [{ label: '已提交报名并预留时段，等待审核。', actorLabel: '你', eventType: 'application_segment_reserved' }],
      currentSegment: { code: '02', name: '第 2 段' },
      projectDraft: { previewTitle: '已提交报名并预留时段，等待审核。', publicAuthorName: '你' },
      segments: [{ code: '03', name: '夜间接力' }],
    };
    const translated = localizeApiPayload(payload, '/api/portal/dashboard', 'en') as typeof payload;
    expect(translated.recentEvents[0]?.actorLabel).toBe('You');
    expect(translated.recentEvents[0]?.label).toBe('Registration submitted and a slot reserved. Awaiting review.');
    expect(translated.currentSegment.name).toBe('Slot 2');
    expect(translated.projectDraft).toEqual(payload.projectDraft);
    expect(translated.segments).toEqual(payload.segments);
  });

  it('keeps administrative and Chinese responses unchanged', () => {
    const payload = { message: '已更新联系资料与公开署名设置。' };
    expect(localizeApiPayload(payload, '/api/admin/participants', 'en')).toBe(payload);
    expect(localizeApiPayload(payload, '/api/portal/profile', 'zh-CN')).toBe(payload);
  });
});
