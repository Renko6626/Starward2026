import { mountArray } from '../../../../experiments/ground-observatory/scene.js';
import { mountMissionOrbit } from './mission-orbit-scene';

export function mountObservatoryScene(root) {
  const orbit = root.querySelector('.schedule-orbit');
  const canvas = root.querySelector('.schedule-antenna');
  const disposeOrbit = orbit ? mountMissionOrbit(orbit) : () => {};
  let disposeArray = () => {};
  try {
    if (canvas) disposeArray = mountArray(canvas, { animate: true });
  } catch (error) {
    console.warn('Observatory antenna unavailable', error);
  }
  return () => { disposeOrbit(); disposeArray(); };
}
