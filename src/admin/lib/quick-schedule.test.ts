import { describe, expect, it } from 'vitest';
import { buildQuickSchedule } from './quick-schedule';
import type { AdminSegmentItem } from '../../shared/admin';

function segment(index: number, patch: Partial<AdminSegmentItem> = {}): AdminSegmentItem {
  return { id: `s${index}`, code: String(index), name: `第 ${index} 段`, kind: 'standard', isVisible: true, scheduledAt: null,
    description: null, status: 'open', currentParticipantId: null, currentParticipantName: null,
    claimedAt: null, releasedAt: null, sortOrder: index, updatedAt: '', ...patch };
}

describe('quick schedule', () => {
  it('generates 24 hourly slots in Beijing time and crosses midnight', () => {
    const result = buildQuickSchedule(Array.from({ length: 24 }, (_, index) => segment(index + 1)), '2026-11-12T12:00', 60);
    expect(result).toHaveLength(24);
    expect(result[0]?.scheduledAt).toBe('2026-11-12T04:00:00.000Z');
    expect(result[12]?.scheduledAt).toBe('2026-11-12T16:00:00.000Z');
    expect(result[23]?.scheduledAt).toBe('2026-11-13T03:00:00.000Z');
    expect(result.every(entry => entry.needsSave)).toBe(true);
  });
  it('orders standard slots, keeps configured times in their position and excludes extras', () => {
    const configured = segment(2, { scheduledAt: '2026-11-12T07:30:00.000Z', status: 'held', currentParticipantId: 'creator' });
    const result = buildQuickSchedule([segment(3), segment(4, { kind: 'extra' }), configured, segment(1)], '2026-11-12T00:00', 60);
    expect(result.map(entry => [entry.segment.id, entry.scheduledAt, entry.needsSave])).toEqual([
      ['s1', '2026-11-11T16:00:00.000Z', true], ['s2', '2026-11-12T07:30:00.000Z', false], ['s3', '2026-11-11T18:00:00.000Z', true],
    ]);
    expect(configured.currentParticipantId).toBe('creator');
  });
  it('skips hidden slots without leaving a time gap', () => {
    const result = buildQuickSchedule([segment(1), segment(2, { isVisible: false }), segment(3)], '2026-11-12T10:00', 60);
    expect(result.map(entry => [entry.segment.id, entry.scheduledAt])).toEqual([
      ['s1', '2026-11-12T02:00:00.000Z'], ['s3', '2026-11-12T03:00:00.000Z'],
    ]);
  });
  it('rejects invalid dates and nonpositive or fractional intervals', () => {
    expect(() => buildQuickSchedule([], '2026-02-30T00:00', 60)).toThrow();
    expect(() => buildQuickSchedule([], '', 60)).toThrow();
    for (const minutes of [0, 1.5, NaN, 10081]) expect(() => buildQuickSchedule([], '2026-11-12T00:00', minutes)).toThrow();
  });
});
