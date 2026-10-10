import { Matrix4, Mesh } from 'three';
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
