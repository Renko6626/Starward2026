import { InstancedMesh, Matrix4, Mesh } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Batch only siblings. Named anchors and moving parent groups retain their
// original ownership; repeated parts keep their existing instanced geometry.
export function batchStaticMeshes(root) {
  const removedGeometries = new Set();
  const instance = new Matrix4(), transform = new Matrix4();
  const visit = parent => {
    const byMaterial = new Map();
    for (const mesh of [...parent.children]) {
      if (!mesh.isMesh) { visit(mesh); continue; }
      const { geometry, material } = mesh;
      if (mesh.name || mesh.children.length || !mesh.visible || Array.isArray(material) || material.transparent
        || (mesh.isInstancedMesh && (mesh.count !== 1 || mesh.instanceColor)) || mesh.isSkinnedMesh
        || geometry.drawRange.start !== 0 || geometry.drawRange.count !== Infinity
        || Object.keys(geometry.morphAttributes).length) continue;
      const attributes = Object.entries(geometry.attributes).sort(([a], [b]) => a.localeCompare(b));
      if (attributes.some(([, attribute]) => attribute.isInterleavedBufferAttribute)) continue;
      if (mesh.matrixAutoUpdate) mesh.updateMatrix();
      if (mesh.isInstancedMesh) { mesh.getMatrixAt(0, instance); transform.multiplyMatrices(mesh.matrix, instance); }
      else transform.copy(mesh.matrix);
      if (transform.determinant() <= 0) continue;
      const key = JSON.stringify([!!geometry.index, geometry.userData, mesh.castShadow, mesh.receiveShadow,
        mesh.renderOrder, mesh.layers.mask, mesh.frustumCulled,
        attributes.map(([name, attribute]) => [name, attribute.itemSize, attribute.normalized, attribute.array.constructor.name])]);
      if (!byMaterial.has(material)) byMaterial.set(material, new Map());
      const batches = byMaterial.get(material);
      if (!batches.has(key)) batches.set(key, []);
      batches.get(key).push(mesh);
    }
    for (const [material, batches] of byMaterial) for (const meshes of batches.values()) {
      if (meshes.length < 2) continue;
      const parts = meshes.map(mesh => {
        if (mesh.matrixAutoUpdate) mesh.updateMatrix();
        if (mesh.isInstancedMesh) { mesh.getMatrixAt(0, instance); transform.multiplyMatrices(mesh.matrix, instance); }
        else transform.copy(mesh.matrix);
        return mesh.geometry.clone().applyMatrix4(transform);
      });
      const geometry = mergeGeometries(parts);
      parts.forEach(part => part.dispose());
      if (!geometry) continue;
      geometry.userData = { ...meshes[0].geometry.userData };
      geometry.computeBoundingBox(); geometry.computeBoundingSphere();
      const batch = new Mesh(geometry, material), source = meshes[0];
      batch.name = 'Static sibling batch';
      batch.castShadow = source.castShadow; batch.receiveShadow = source.receiveShadow;
      batch.renderOrder = source.renderOrder; batch.layers.mask = source.layers.mask;
      batch.frustumCulled = source.frustumCulled;
      parent.add(batch);
      for (const mesh of meshes) {
        parent.remove(mesh);
        removedGeometries.add(mesh.geometry);
        if (mesh.isInstancedMesh) mesh.dispose();
      }
    }
  };
  visit(root);
  return removedGeometries;
}

// Opt-in for a subtree whose parts are rigid relative to its root. Keep moving
// pivots in separate batches; named anchors remain in the original hierarchy.
export function batchRigidMeshes(root, { exclude = [] } = {}) {
  const boundaries = new Set(exclude);
  const inverseRoot = new Matrix4(), relative = new Matrix4(), instance = new Matrix4();
  root.updateWorldMatrix(true, true);
  inverseRoot.copy(root.matrixWorld).invert();
  const candidates = [];
  const collect = object => {
    if (!object.visible || boundaries.has(object)) return;
    if (object.isMesh) {
      const { geometry, material } = object;
      if (object.name || object.children.length || Array.isArray(material) || material.transparent
        || object.isSkinnedMesh || object.isBatchedMesh
        || (object.isInstancedMesh && (object.instanceColor || object.morphTexture || !object.count))
        || Object.keys(geometry.morphAttributes).length
        || Object.values(geometry.attributes).some(attribute => attribute.isInstancedBufferAttribute)) return;
      relative.multiplyMatrices(inverseRoot, object.matrixWorld);
      if (relative.determinant() <= 0) return;
      // Instanced normals assume rotation + scale, not a sheared basis.
      const e = relative.elements;
      const dot = (a, b) => e[a] * e[b] + e[a + 1] * e[b + 1] + e[a + 2] * e[b + 2];
      if ([[0, 4], [0, 8], [4, 8]].some(([a, b]) =>
        Math.abs(dot(a, b)) > 1e-6 * Math.sqrt(dot(a, a) * dot(b, b)))) return;
      candidates.push({ mesh: object, matrix: relative.clone() });
      return;
    }
    for (const child of object.children) collect(child);
  };
  for (const child of root.children) collect(child);
  const groups = new Map();
  for (const { mesh, matrix } of candidates) {
    // Bake only the parent transform, retaining geometry, UVs and all instances.
    root.add(mesh);
    mesh.matrix.copy(matrix);
    mesh.matrixAutoUpdate = false;
    mesh.matrixWorldNeedsUpdate = true;
    const key = JSON.stringify([mesh.geometry.uuid, mesh.material.uuid,
      mesh.castShadow, mesh.receiveShadow, mesh.renderOrder, mesh.layers.mask, mesh.frustumCulled]);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(mesh);
  }
  for (const meshes of groups.values()) {
    if (meshes.length < 2) continue;
    const source = meshes[0];
    const count = meshes.reduce((total, mesh) => total + (mesh.isInstancedMesh ? mesh.count : 1), 0);
    const batch = new InstancedMesh(source.geometry, source.material, count);
    batch.name = 'Rigid instance batch';
    batch.castShadow = source.castShadow; batch.receiveShadow = source.receiveShadow;
    batch.renderOrder = source.renderOrder; batch.layers.mask = source.layers.mask;
    batch.frustumCulled = source.frustumCulled;
    batch.matrixAutoUpdate = false;
    let index = 0;
    for (const mesh of meshes) {
      for (let i = 0; i < (mesh.isInstancedMesh ? mesh.count : 1); i++) {
        if (mesh.isInstancedMesh) {
          mesh.getMatrixAt(i, instance);
          relative.multiplyMatrices(mesh.matrix, instance);
        } else relative.copy(mesh.matrix);
        batch.setMatrixAt(index++, relative);
      }
      root.remove(mesh);
      if (mesh.isInstancedMesh) mesh.dispose();
    }
    batch.computeBoundingBox(); batch.computeBoundingSphere();
    root.add(batch);
  }
  return batchStaticMeshes(root);
}
