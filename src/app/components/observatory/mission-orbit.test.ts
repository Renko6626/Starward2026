import { describe, expect, it } from 'vitest';
import { flightSeconds, missionFrameAt, orbitalTimeUnit, toEarthInertial } from './mission-orbit';
import trajectory from '../orbital-transfer.json';

describe('works mission playback', () => {
  it('holds at departure before flight and joins flight continuously', () => {
    const prepared = missionFrameAt(4);
    expect(prepared.phase).toBe('准备出发');
    expect(missionFrameAt(8).phase).toBe('向月球巡航');
    expect(missionFrameAt(8).position).toEqual(prepared.position);
    const next = missionFrameAt(8.000001).position;
    expect(Math.hypot(next.x - prepared.position.x, next.y - prepared.position.y)).toBeLessThan(.01);
  });

  it('uses trajectory timestamps under a uniform playback compression', () => {
    // Independent interpolation of validated samples at 144750 mission seconds.
    const position = missionFrameAt(8 + 100 * 144750 / flightSeconds).position;
    expect(position.x).toBeCloseTo(688.3084703753532, 7);
    expect(position.y).toBeCloseTo(309.8590156654345, 7);
  });

  it('holds at the target, fades out, then restarts at departure', () => {
    const arrived = missionFrameAt(108);
    expect(arrived.phase).toBe('抵达鸟船目标区域');
    expect(arrived.position.x).toBeCloseTo(475.52393666449154, 6);
    expect(arrived.position.y).toBeCloseTo(724.4199572382387, 6);
    expect(arrived.position.x).toBeCloseTo(arrived.target.x, 8);
    expect(arrived.position.y).toBeCloseTo(arrived.target.y, 8);
    expect(missionFrameAt(115).position).toEqual(arrived.position);
    expect(missionFrameAt(118).opacity).toBe(.5);
    expect(missionFrameAt(120).opacity).toBe(0);
    expect(missionFrameAt(120).position).toEqual(missionFrameAt(0).position);
    expect(missionFrameAt(122)).toEqual(missionFrameAt(2));
  });

  it('keeps Earth at the origin and advances the Moon counterclockwise in inertial axes', () => {
    expect(toEarthInertial(trajectory.bodies.earth, 144750)).toEqual([0, 0]);
    const moon = toEarthInertial(trajectory.bodies.moon, Math.PI / 2 * orbitalTimeUnit);
    expect(moon[0]).toBeCloseTo(0, 12);
    expect(moon[1]).toBeCloseTo(1, 12);
    const a = missionFrameAt(8), b = missionFrameAt(58);
    expect(Math.hypot(a.moon.x - b.moon.x, a.moon.y - b.moon.y)).toBeGreaterThan(100);
  });

  it('preserves the independently sampled geocentric position under frame conversion', () => {
    const point = toEarthInertial([.6617561329209397, .2317365602027097], 144750);
    expect(point[0]).toBeCloseTo(.5374140826126081, 12);
    expect(point[1]).toBeCloseTo(.468015171535483, 12);
  });
});
