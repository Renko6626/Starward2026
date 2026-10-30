import { describe, expect, it } from 'vitest';
import { countdownAt } from './MissionCountdown';

describe('mission countdown', () => {
  it('uses midnight Beijing time and separates remaining units', () => {
    expect(countdownAt(Date.parse('2026-11-10T14:57:56Z'))).toEqual({
      started: false, values: [1, 1, 2, 4],
    });
  });
  it('keeps the final partial second visible until the start instant', () => {
    expect(countdownAt(Date.parse('2026-11-11T15:59:59.500Z'))).toEqual({
      started: false, values: [0, 0, 0, 1],
    });
  });
  it('switches state at the start and never shows negative units', () => {
    for (const now of ['2026-11-11T16:00:00Z', '2026-11-13T00:00:00Z']) {
      expect(countdownAt(Date.parse(now))).toEqual({ started: true, values: [0, 0, 0, 0] });
    }
  });
});
