import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createAntennaArray } from '../experiments/ground-observatory/antenna.js';

test('secondary support leaves both focal sight lines to the reflector clear', () => {
  const antenna = createAntennaArray();
  const reflector = antenna.getObjectByName('offset-primary-reflector');
  const secondary = antenna.getObjectByName('ellipsoidal-secondary');
  const arm = antenna.getObjectByName('curved-twin-box-girder-arm');
  const vertices = secondary.geometry.attributes.position;
  const ray = new THREE.Raycaster();

  for (const focus of [antenna.userData.optics.primaryFocus, antenna.userData.optics.receiverFocus]) {
    const origin = new THREE.Vector3(...focus).applyMatrix4(reflector.matrixWorld);
    // Sample each radial band of the actual production surface, including its rim.
    for (let i = 65; i < vertices.count; i += 4) {
      const target = new THREE.Vector3().fromBufferAttribute(vertices, i).applyMatrix4(secondary.matrixWorld);
      const direction = target.clone().sub(origin);
      ray.set(origin, direction.clone().normalize());
      ray.near = 0.001;
      ray.far = direction.length() - 0.001;
      assert.equal(ray.intersectObject(arm, true).length, 0, `Support blocks secondary surface sample ${i} from ${focus}`);
    }
  }
});
