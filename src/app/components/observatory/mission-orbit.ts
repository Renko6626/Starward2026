import trajectory from '../orbital-transfer.json';
import config from '../../../../scripts/orbit-transfer/config.json';

export type OrbitPoint = { x: number; y: number; depth: number; scale: number };
export const missionDuration = 120;
export const flightSeconds = trajectory.arcTimesSeconds.at(-1)!.at(-1)!;
const model = config.model;
export const earthIconRadius = 27;
export const moonIconRadius = earthIconRadius * model.moon_radius_km / model.earth_radius_km;
export const orbitalTimeUnit = Math.sqrt(model.distance_km ** 3 / (model.earth_gm + model.moon_gm));
const tilt = 40 * Math.PI / 180, heading = 15 * Math.PI / 180;

// Model-relative geocentric inertial axes, aligned with the rotating axes at departure.
// This is a frame conversion of the planar CR3BP solution, not an equatorial J2000 ephemeris.
export function toEarthInertial(point: readonly number[], seconds: number): [number, number] {
  const x = point[0]! - trajectory.bodies.earth[0]!, y = point[1]!;
  const angle = seconds / orbitalTimeUnit;
  return [x * Math.cos(angle) - y * Math.sin(angle), x * Math.sin(angle) + y * Math.cos(angle)];
}

export function projectInertial(point: readonly number[]): OrbitPoint {
  const x = point[0]! * Math.cos(heading) - point[1]! * Math.sin(heading);
  const y = point[0]! * Math.sin(heading) + point[1]! * Math.cos(heading);
  const depth = y * Math.sin(tilt), scale = 4 / (4 - depth);
  return { x: 530 + 360 * x * scale, y: 490 - 360 * y * Math.cos(tilt) * scale, depth, scale };
}
export function projectMissionPoint(point: readonly number[], seconds: number): OrbitPoint {
  return projectInertial(toEarthInertial(point, seconds));
}
export function orbitPath(points: OrbitPoint[]) {
  return points.map((point, index) => `${index ? 'L' : 'M'}${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' ');
}
export const missionArcs = trajectory.arcs.map((arc, index) => ({
  points: arc.map((point, sample) => projectMissionPoint(point, trajectory.arcTimesSeconds[index]![sample]!)),
  times: trajectory.arcTimesSeconds[index]!,
}));
export const earthPosition = projectInertial([0, 0]);
export const lunarOrbit = Array.from({ length: 181 }, (_, i) => projectInertial([Math.cos(i * Math.PI / 90), Math.sin(i * Math.PI / 90)]));
const conicPoint = (x: number, y: number, angle: number) => projectInertial([
  x * Math.cos(angle) - y * Math.sin(angle), x * Math.sin(angle) + y * Math.cos(angle),
]);
// Frozen departure osculating ellipse plus two decorative conics. These guides
// have no flight time or inferred maneuver solution, and never drive playback.
export const predictionTracks = [
  trajectory.referenceOrbit.points.map(point => projectMissionPoint(point, 0)),
  Array.from({ length: 181 }, (_, i) => {
    const anomaly = i * Math.PI / 90, a = .78, e = .58;
    return conicPoint(a * (Math.cos(anomaly) - e), a * Math.sqrt(1 - e * e) * Math.sin(anomaly), -32 * Math.PI / 180);
  }),
  Array.from({ length: 121 }, (_, i) => {
    const anomaly = -.95 + i / 120 * 2.1, a = .62, e = 1.5;
    return conicPoint(a * (e - Math.cosh(anomaly)), a * Math.sqrt(e * e - 1) * Math.sinh(anomaly), -70 * Math.PI / 180);
  }),
];
const burnTimes = [0, missionArcs[0]!.times.at(-1)!, flightSeconds];
export const missionBurns = trajectory.burns.map((burn, index) => {
  const seconds = burnTimes[index]!;
  const position = projectMissionPoint(burn.position, seconds);
  // Delta-v rotates as a vector; no omega-cross-r term is added to an instantaneous impulse.
  const tip = projectMissionPoint(burn.position.map((value, axis) => value + burn.deltaV[axis]!), seconds);
  const length = Math.hypot(tip.x - position.x, tip.y - position.y);
  return { position, tip: { ...position, x: position.x + 32 * (tip.x - position.x) / length,
    y: position.y + 32 * (tip.y - position.y) / length }, playback: 8 + 100 * seconds / flightSeconds };
});

// Four layers identify which spheres occlude each segment. Split at depth crossings
// so an entire curved arc never disappears just because one endpoint is behind a body.
export function orbitLayers(points: OrbitPoint[], moonDepth: number): string[] {
  const paths = ['', '', '', ''];
  const ends = ['', '', '', ''];
  const coordinate = (p: OrbitPoint) => `${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!, b = points[i]!;
    const cuts = [0, 1];
    if (a.depth !== b.depth) for (const depth of [0, moonDepth]) {
      const fraction = (depth - a.depth) / (b.depth - a.depth);
      if (fraction > 0 && fraction < 1) cuts.push(fraction);
    }
    cuts.sort((a, b) => a - b);
    const at = (t: number): OrbitPoint => ({ x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y), depth: a.depth + t * (b.depth - a.depth), scale: 1 });
    for (let j = 1; j < cuts.length; j++) {
      const start = at(cuts[j - 1]!), end = at(cuts[j]!);
      const depth = (start.depth + end.depth) / 2;
      const layer = (depth < 0 ? 1 : 0) + (depth < moonDepth ? 2 : 0);
      const startCoordinate = coordinate(start), endCoordinate = coordinate(end);
      paths[layer] += `${ends[layer] === startCoordinate ? '' : `M${startCoordinate}`}L${endCoordinate}`;
      ends[layer] = endCoordinate;
    }
  }
  return paths;
}

export function missionFrameAt(playbackSeconds: number) {
  const time = ((playbackSeconds % missionDuration) + missionDuration) % missionDuration;
  const seconds = Math.max(0, Math.min(1, (time - 8) / 100)) * flightSeconds;
  const arcIndex = seconds < burnTimes[1]! ? 0 : 1;
  const { times } = missionArcs[arcIndex]!;
  let left = 0, right = times.length - 1;
  while (right - left > 1) {
    const middle = Math.floor((left + right) / 2);
    if (times[middle]! <= seconds) left = middle;
    else right = middle;
  }
  const fraction = Math.max(0, Math.min(1, (seconds - times[left]!) / (times[right]! - times[left]!)));
  // Interpolate in the source frame, then rotate at the requested timestamp.
  const a = trajectory.arcs[arcIndex]![left]!, b = trajectory.arcs[arcIndex]![right]!;
  const source = a.map((value, axis) => value + (b[axis]! - value) * fraction);
  const position = projectMissionPoint(source, seconds);
  const dt = Math.min(1, times[right]! - seconds);
  let tangent;
  if (dt > 0) {
    const nextFraction = fraction + dt / (times[right]! - times[left]!);
    tangent = projectMissionPoint(a.map((value, axis) => value + (b[axis]! - value) * nextFraction), seconds + dt);
  } else tangent = position;
  const before = missionArcs[arcIndex]!.points[left]!;
  const heading = dt > 0 ? Math.atan2(tangent.y - position.y, tangent.x - position.x) : Math.atan2(position.y - before.y, position.x - before.x);
  const phase = time < 8 ? '准备出发' : time >= 108 ? '抵达鸟船目标区域' : arcIndex === 0 ? '向月球巡航' : '向 L₄ 巡航';
  const opacity = time >= 116 ? 1 - (time - 116) / 4 : Math.min(1, time / 2);
  return { position, phase, opacity, arcIndex, sampleIndex: left, fraction, seconds,
    moon: projectMissionPoint(trajectory.bodies.moon, seconds),
    target: projectMissionPoint(trajectory.bodies.l4, seconds),
    heading: heading * 180 / Math.PI,
    burnOpacity: missionBurns.map(burn => Math.max(0, 1 - Math.abs(time - burn.playback) / 2)) };
}
