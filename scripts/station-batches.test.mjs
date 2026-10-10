import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Group, Mesh, MeshBasicMaterial, PlaneGeometry, InstancedMesh, Matrix4, Vector3 } from 'three';
import { batchStaticMeshes, batchRigidMeshes } from '../src/app/components/station/static-batches.js';

const material = new MeshBasicMaterial();
const plane = () => new Mesh(new PlaneGeometry(2, 2), material);

test('static batches retain transformed positions, normals, UVs and all triangles', () => {
  const root = new Group(), left = plane(), right = plane();
  left.position.x = -3; left.rotation.y = Math.PI / 2;
  right.position.x = 4;
  const single = new InstancedMesh(new PlaneGeometry(2, 2), material, 1);
  single.position.x = 2;
  single.setMatrixAt(0, new Matrix4().makeTranslation(6, 0, 0));
  const expectedUV = [left, right, single].flatMap(mesh => [...mesh.geometry.attributes.uv.array]);
  root.add(left, right, single);
  const retired = batchStaticMeshes(root);
  assert.equal(root.children.length, 1);
  const merged = root.children[0].geometry;
  assert.equal(merged.index.count / 3, 6);
  assert.deepEqual([...merged.attributes.uv.array], expectedUV);
  assert.deepEqual(merged.boundingBox.min.toArray(), [-3, -1, -1]);
  assert.deepEqual(merged.boundingBox.max.toArray(), [9, 1, 1]);
  assert.ok(Math.abs(merged.attributes.normal.getX(0) - 1) < 1e-6);
  assert.ok(Math.abs(merged.attributes.normal.getZ(0)) < 1e-6);
  assert.equal(merged.attributes.normal.getZ(4), 1);
  assert.deepEqual(retired, new Set([left.geometry, right.geometry, single.geometry]));
});

test('batches remain within each moving parent and preserve named anchors', () => {
  const root = new Group(), pivot = new Group(), other = new Group(), anchor = new Group();
  pivot.name = 'Antenna pivot'; pivot.rotation.y = .8;
  anchor.name = 'Docking anchor';
  pivot.add(plane(), plane(), anchor); other.add(plane(), plane()); root.add(pivot, other);
  batchStaticMeshes(root);
  assert.deepEqual(root.children, [pivot, other]);
  assert.equal(pivot.rotation.y, .8);
  assert.equal(root.getObjectByName('Docking anchor'), anchor);
  assert.equal(pivot.children.filter(child => child.isMesh).length, 1);
  assert.equal(other.children.length, 1);
});

test('repeated instances, named meshes and incompatible UV layouts retain their ownership', () => {
  const root = new Group(), repeated = new InstancedMesh(new PlaneGeometry(2, 2), material, 2);
  const named = plane(), ordinary = plane(), secondUV = plane();
  named.name = 'Addressable part';
  secondUV.geometry.setAttribute('uv1', secondUV.geometry.attributes.uv.clone());
  root.add(repeated, named, ordinary, secondUV);
  batchStaticMeshes(root);
  assert.deepEqual(root.children, [repeated, named, ordinary, secondUV]);
  assert.equal(repeated.count, 2);
});

// Compare world-space vertices, including instance transforms, before/after
// regrouping so parent rotation and scale regressions cannot hide in counts.
function worldVertices(root) {
  root.updateWorldMatrix(true, true);
  const vertices = [], transform = new Matrix4(), instance = new Matrix4(), point = new Vector3();
  root.traverse(mesh => {
    if (!mesh.isMesh) return;
    for (let i = 0; i < (mesh.isInstancedMesh ? mesh.count : 1); i++) {
      if (mesh.isInstancedMesh) { mesh.getMatrixAt(i, instance); transform.multiplyMatrices(mesh.matrixWorld, instance); }
      else transform.copy(mesh.matrixWorld);
      const positions = mesh.geometry.attributes.position;
      for (let j = 0; j < positions.count; j++) {
        point.fromBufferAttribute(positions, j).applyMatrix4(transform);
        vertices.push(point.toArray().map(value => Math.round(value * 1e4)).join(','));
      }
    }
  });
  return vertices.sort();
}

test('rigid batches preserve repeated instances through nested transforms and root motion', () => {
  const root = new Group(), a = new Group(), b = new Group();
  root.position.set(5, 2, -9); root.rotation.z = .7;
  a.position.x = 4; a.rotation.y = .4; b.position.y = -3;
  const geometry = new PlaneGeometry(2, 2);
  for (const parent of [a, b]) {
    const mesh = new InstancedMesh(geometry, material, 2);
    mesh.setMatrixAt(0, new Matrix4().makeTranslation(1, 2, 3));
    mesh.setMatrixAt(1, new Matrix4().makeScale(2, 3, 1));
    parent.add(mesh);
  }
  root.add(a, b);
  const original = root.clone(true), expected = worldVertices(root);
  batchRigidMeshes(root);
  assert.deepEqual(worldVertices(root), expected);
  const merged = root.children.find(child => child.isInstancedMesh);
  assert.equal(merged.count, 4);
  assert.equal(merged.geometry, geometry);
  assert.equal(merged.material, material);
  root.rotation.x = original.rotation.x = 1.3;
  assert.deepEqual(worldVertices(root), worldVertices(original));
});

test('rigid batching retains excluded pivots, named anchors, hidden and transparent parts', () => {
  const root = new Group(), fixed = new Group(), pivot = new Group(), hidden = new Group();
  const anchor = new Group(); anchor.name = 'Signal anchor'; anchor.position.x = 9;
  const named = plane(); named.name = 'Addressable mesh';
  const transparent = plane(); transparent.material = new MeshBasicMaterial({ transparent: true });
  fixed.add(plane(), plane(), anchor, named, transparent);
  pivot.add(plane(), plane()); hidden.visible = false; hidden.add(plane());
  root.add(fixed, pivot, hidden);
  batchRigidMeshes(root, { exclude: [pivot] });
  assert.equal(anchor.parent, fixed);
  assert.equal(named.parent, fixed);
  assert.equal(transparent.parent, fixed);
  assert.equal(hidden.children.length, 1);
  assert.equal(pivot.children.filter(child => child.isMesh).length, 1);
  assert.equal(pivot.children[0].parent, pivot);
  pivot.rotation.y = 1;
  assert.equal(root.getObjectByName('Signal anchor'), anchor);
});

test('rigid instance batches preserve shadow and layer distinctions and retain colored instances', () => {
  const root = new Group(), geometry = new PlaneGeometry(2, 2);
  for (const shadow of [false, true]) for (let i = 0; i < 2; i++) {
    const group = new Group(), mesh = new InstancedMesh(geometry, material, 2);
    mesh.castShadow = shadow; mesh.layers.set(shadow ? 1 : 0);
    group.add(mesh); root.add(group);
  }
  const colored = new InstancedMesh(geometry, material, 2);
  colored.setColorAt(0, material.color); root.add(colored);
  batchRigidMeshes(root);
  const batches = root.children.filter(child => child.isInstancedMesh && child !== colored);
  assert.equal(batches.length, 2);
  assert.deepEqual(batches.map(mesh => [mesh.count, mesh.castShadow, mesh.layers.mask]), [[4, false, 1], [4, true, 2]]);
  assert.equal(colored.parent, root);
  assert.ok(colored.instanceColor);
});
