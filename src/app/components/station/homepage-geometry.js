import { BufferGeometry, Float32BufferAttribute, CylinderGeometry, SphereGeometry } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { arcGeometry, arcPanelGeometry, geometryRecipes } from '../../../../experiments/station/ring-romantic/src/model/assembly.js';

// The homepage views the entire station. Preserve the detailed model for close-up
// viewers and generate cheaper shared geometry only for this distant view.
export function createHomepageGeometryOptimizer() {
  const cache = new WeakMap();
  return source => {
    if (cache.has(source)) return cache.get(source);
    const p = source.parameters, recipe = geometryRecipes.get(source);
    let geometry = source;
    if (source.type === 'RoundedBoxGeometry') {
      geometry = p.segments === 1
        ? createBeveledBoxGeometry(p.width, p.height, p.depth, p.radius)
        : new RoundedBoxGeometry(p.width, p.height, p.depth, 1, p.radius);
    } else if (source.type === 'CylinderGeometry' && p.radiusTop === 1 && p.radiusBottom === 1 && p.height === 1 && p.radialSegments === 20) {
      geometry = new CylinderGeometry(1, 1, 1, 12);
    } else if (source.type === 'SphereGeometry' && p.radius === 1 && p.widthSegments === 20 && p.heightSegments === 12) {
      geometry = new SphereGeometry(1, 12, 8);
    } else if (recipe?.type === 'arc') {
      const [radius, width, height, angle, corner, steps] = recipe.args;
      geometry = arcGeometry(radius, width, height, angle, corner, Math.max(2, Math.ceil(steps / 2)), 3);
    } else if (recipe?.type === 'panel') {
      const [radius, profile, angle, offset, thickness, steps] = recipe.args;
      // Keep every cross-section point, including corners and both sheet rims.
      geometry = arcPanelGeometry(radius, profile, angle, offset, thickness, Math.max(1, Math.ceil(steps / 2)), 1);
    }
    if (geometry !== source) geometry.userData = { ...source.userData };
    cache.set(source, geometry);
    return geometry;
  };
}

// 44 triangles: six flat faces, twelve bevel strips, eight corner triangles.
// Smooth bevel normals retain highlights without subdividing subpixel fittings.
export function createBeveledBoxGeometry(width, height, depth, radius) {
  const half = [width / 2, height / 2, depth / 2];
  const r = Math.min(radius, ...half), inner = half.map(value => value - r);
  const positions = [], normals = [], uvs = [];
  const vertex = (axis, signs) => ({
    p: inner.map((value, i) => signs[i] * (i === axis ? half[i] : value)),
    n: [0, 1, 2].map(i => i === axis ? signs[i] : 0),
  });
  const face = vertices => {
    const normal = [0, 1, 2].map(i => vertices.reduce((sum, v) => sum + v.n[i], 0));
    const axis = normal.map(Math.abs).indexOf(Math.max(...normal.map(Math.abs)));
    for (let i = 1; i < vertices.length - 1; i++) {
      const triangle = [vertices[0], vertices[i], vertices[i + 1]];
      const [a, b, c] = triangle.map(v => v.p);
      const ab = b.map((v, k) => v - a[k]), ac = c.map((v, k) => v - a[k]);
      const cross = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
      if (cross.reduce((sum, v, k) => sum + v * normal[k], 0) < 0) triangle.reverse();
      for (const { p, n } of triangle) {
        positions.push(...p); normals.push(...n);
        // Match the orientation of the box's six original UV faces.
        const q = p.map((value, k) => value / (2 * half[k]));
        const sign = Math.sign(normal[axis]);
        uvs.push(axis === 0 ? .5 - sign * q[2] : axis === 1 ? .5 + q[0] : .5 + sign * q[0],
          axis === 1 ? .5 - sign * q[2] : .5 + q[1]);
      }
    }
  };
  for (let axis = 0; axis < 3; axis++) for (const sign of [-1, 1]) {
    const other = [0, 1, 2].filter(i => i !== axis);
    face([[-1, -1], [1, -1], [1, 1], [-1, 1]].map(pair => {
      const signs = []; signs[axis] = sign; other.forEach((i, j) => { signs[i] = pair[j]; });
      return vertex(axis, signs);
    }));
  }
  for (let a = 0; a < 3; a++) for (let b = a + 1; b < 3; b++) {
    const c = 3 - a - b;
    for (const sa of [-1, 1]) for (const sb of [-1, 1]) {
      const signs = []; signs[a] = sa; signs[b] = sb; signs[c] = -1;
      const end = [...signs]; end[c] = 1;
      face([vertex(a, signs), vertex(b, signs), vertex(b, end), vertex(a, end)]);
    }
  }
  for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1])
    face([0, 1, 2].map(axis => vertex(axis, [x, y, z])));
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  return geometry;
}
