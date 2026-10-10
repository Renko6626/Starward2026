import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Group, Mesh, MeshBasicMaterial, PlaneGeometry, InstancedMesh, Matrix4 } from 'three';
import { batchStaticMeshes } from '../src/app/components/station/static-batches.js';

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
