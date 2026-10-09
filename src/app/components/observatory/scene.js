import { mountArray } from '../../../../experiments/ground-observatory/scene.js';
import { renderOrbit } from '../../../../experiments/ground-observatory/orbit.js';

export function mountObservatoryScene(root) {
  const orbit = root.querySelector('.schedule-orbit');
  const canvas = root.querySelector('.schedule-antenna');
  if (orbit) renderOrbit(orbit, 'maneuvers');
  if (!canvas) return () => {};
  return mountArray(canvas);
}
