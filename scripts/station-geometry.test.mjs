import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Vector3, CylinderGeometry, SphereGeometry } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { arcGeometry, arcPanelGeometry } from '../experiments/station/ring-romantic/src/model/assembly.js';
import { createHomepageGeometryOptimizer, createBeveledBoxGeometry } from '../src/app/components/station/homepage-geometry.js';

const triangles = geometry => (geometry.index?.count ?? geometry.attributes.position.count) / 3;

test('small bevels are closed, outward-facing and keep the original envelope with 44 triangles', () => {
  const geometry = createBeveledBoxGeometry(1, 2, 3, .08);
  assert.equal(triangles(geometry), 44);
  geometry.computeBoundingBox();
  assert.deepEqual(geometry.boundingBox.min.toArray(), [-.5, -1, -1.5]);
  assert.deepEqual(geometry.boundingBox.max.toArray(), [.5, 1, 1.5]);
  const p = geometry.attributes.position, n = geometry.attributes.normal;
  const edges = new Map();
  for (let i = 0; i < p.count; i += 3) {
    const vertices = [0, 1, 2].map(offset => new Vector3().fromBufferAttribute(p, i + offset));
    const normal = new Vector3();
    for (let k = 0; k < 3; k++) {
      const vertexNormal = new Vector3().fromBufferAttribute(n, i + k);
      assert.ok(Math.abs(vertexNormal.length() - 1) < 1e-6);
      normal.add(vertexNormal);
      const key = [vertices[k], vertices[(k + 1) % 3]].map(v => v.toArray().map(x => x.toFixed(6)).join(',')).sort().join('/');
      edges.set(key, (edges.get(key) ?? 0) + 1);
    }
    const cross = vertices[1].clone().sub(vertices[0]).cross(vertices[2].clone().sub(vertices[0]));
    assert.ok(cross.dot(normal) > 0, 'nondegenerate outward winding');
  }
  assert.ok([...edges.values()].every(count => count === 2), 'no open or non-manifold edges');
  assert.ok([...geometry.attributes.uv.array].every(value => value >= 0 && value <= 1));
});

test('optimization caches shared geometry and never mutates full-detail geometry', () => {
  const optimize = createHomepageGeometryOptimizer();
  for (const source of [new RoundedBoxGeometry(1, 1, 1, 1, .08), new RoundedBoxGeometry(1, 1, 1, 2, .08),
    new CylinderGeometry(1, 1, 1, 20), new SphereGeometry(1, 20, 12)]) {
    const positions = [...source.attributes.position.array], originalTriangles = triangles(source);
    source.userData.part = 'retained metadata';
    const simplified = optimize(source);
    assert.notEqual(simplified, source);
    assert.equal(optimize(source), simplified);
    assert.deepEqual([...source.attributes.position.array], positions);
    assert.equal(triangles(source), originalTriangles);
    assert.ok(triangles(simplified) < originalTriangles);
    assert.deepEqual(simplified.userData, source.userData);
  }
});

test('curved panels keep thickness, all profile points, both UV channels and smooth normals', () => {
  const profile = [[-4, 0, 0, 1], [0, .5, 0, 1], [4, 0, 0, 1]];
  const source = arcPanelGeometry(50, profile, .2, .065, .025, 8);
  const reduced = createHomepageGeometryOptimizer()(source);
  assert.ok(triangles(reduced) < triangles(source));
  for (const geometry of [source, reduced]) {
    const p = geometry.attributes.position, n = geometry.attributes.normal;
    assert.equal(geometry.attributes.uv.count, p.count);
    assert.equal(geometry.attributes.uv1.count, p.count);
    for (let i = 0; i < n.count; i++) assert.ok(Math.abs(new Vector3().fromBufferAttribute(n, i).length() - 1) < 1e-6);
    assert.ok([...p.array].every(Number.isFinite));
  }
  // Every reduced sample is also an original sample for an even step count.
  const originalPoints = new Set();
  for (let i = 0; i < source.attributes.position.count; i++)
    originalPoints.add(new Vector3().fromBufferAttribute(source.attributes.position, i).toArray().join(','));
  for (let i = 0; i < reduced.attributes.position.count; i++)
    assert.ok(originalPoints.has(new Vector3().fromBufferAttribute(reduced.attributes.position, i).toArray().join(',')));
});

test('full-detail arc defaults are retained while the homepage uses fewer sweep and corner segments', () => {
  const source = arcGeometry(50, 18, 11, .33, 2);
  const reduced = createHomepageGeometryOptimizer()(source);
  assert.equal(triangles(source), 1200);
  assert.equal(triangles(reduced), 416);
  assert.ok([...reduced.attributes.position.array].every(Number.isFinite));
});

test('unrecognized geometry is retained, including previously transformed cylinders', () => {
  const source = new CylinderGeometry(2, 3, 4, 48).rotateZ(Math.PI / 2);
  assert.equal(createHomepageGeometryOptimizer()(source), source);
});
