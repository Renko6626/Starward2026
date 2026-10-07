import { describe, expect, it } from 'vitest';
import { departure, insertion, missionMetadata, missionPositionAt, parkingRadius } from './orbital-transfer';

const arrival = Date.parse('2026-11-12T00:00:00+08:00');
const launch = arrival - missionMetadata.flightDays * 86400000;

describe('mission position', () => {
  it('interpolates using elapsed orbital time rather than distance or sample index', () => {
    const position = missionPositionAt(launch + 144750000, arrival);
    expect(position.phase).toBe('transfer');
    // Reference from the validated trajectory.json at 144750 elapsed seconds.
    expect(position.x).toBeCloseTo(532.8236197531032, 6);
    expect(position.y).toBeCloseTo(369.62274152094324, 6);
  });

  it('circles the parking orbit before launch', () => {
    const a = missionPositionAt(launch - 1000000, arrival);
    const b = missionPositionAt(launch - 2000000, arrival);
    expect(a.phase).toBe('parking');
    expect(Math.hypot(a.x - 270, a.y - 460)).toBeCloseTo(parkingRadius, 8);
    expect(Math.hypot(b.x - 270, b.y - 460)).toBeCloseTo(parkingRadius, 8);
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(1);
  });

  it('joins the parking orbit to the departure point without a jump', () => {
    for (const now of [launch - 1, launch, launch + 1]) {
      const position = missionPositionAt(now, arrival);
      expect(Math.hypot(position.x - departure.x, position.y - departure.y)).toBeLessThan(.0001);
    }
    expect(missionPositionAt(launch, arrival).phase).toBe('transfer');
  });

  it('holds at L4 from the arrival instant onward', () => {
    for (const now of [arrival, arrival + 86400000]) {
      expect(missionPositionAt(now, arrival)).toEqual({ ...insertion, phase: 'arrived' });
    }
  });
});
