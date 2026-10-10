import * as THREE from 'three';

// Construction recipes allow a distant-view mesh without changing the full model.
// Keep these outside userData so they do not split compatible material batches.
export const geometryRecipes = new WeakMap();

// Keep the same corner radius and envelope. Small fittings and thin strips
// need fewer corner segments than large cabinets or passage bodies.
function roundedGeometry(geometries, size) {
  const [shortest, middle, longest] = size.map(Math.abs).sort((a, b) => a - b);
  const small = longest <= 2 || (shortest <= .2 && middle <= 2);
  return small ? geometries.roundedSmall : geometries.rounded;
}

// Each Assembly owns one group's batches. Nothing batches across rotating groups.
export class Assembly {
  constructor(resources) {
    this.resources = resources; this.batches = new Map();
    this.position = new THREE.Vector3(); this.scale = new THREE.Vector3();
    this.rotation = new THREE.Euler(); this.quaternion = new THREE.Quaternion();
  }
  part(geometry, materialName, position, scale = [1, 1, 1], rotation = [0, 0, 0]) {
    geometry = this.resources.geometryTransform?.(geometry) ?? geometry;
    const material = this.resources.materials[materialName];
    if (!material) throw new Error(`Unknown station material: ${materialName}`);
    if (!this.batches.has(geometry)) this.batches.set(geometry, new Map());
    const byMaterial = this.batches.get(geometry);
    if (!byMaterial.has(material)) byMaterial.set(material, []);
    const quaternion = rotation.isQuaternion ? rotation : this.quaternion.setFromEuler(
      this.rotation.set(rotation[0], rotation[1], rotation[2], rotation[3] ?? 'XYZ'));
    byMaterial.get(material).push(new THREE.Matrix4().compose(
      this.position.fromArray(position), quaternion, this.scale.fromArray(scale),
    ));
    return this;
  }
  box(material, position, size, rotation) {
    return this.part(roundedGeometry(this.resources.geometries, size), material, position, size, rotation);
  }
  beam(material, start, end, width = .25, depth = width) {
    const a = new THREE.Vector3(...start), b = new THREE.Vector3(...end);
    const direction = b.clone().sub(a), length = direction.length();
    if (length < .0001) return this;
    // Straight structural sections keep flat ends; stretching a rounded unit
    // box would stretch its end radius by metres on long chords. Wide passage
    // envelopes and utility covers retain their existing rounded profiles.
    const structural = Math.max(width, depth) < 1 && ['silver', 'frame', 'hull', 'ringSupport'].includes(material);
    const geometry = structural ? this.resources.geometries.box
      : roundedGeometry(this.resources.geometries, [width, length, depth]);
    return this.part(geometry, material, a.add(b).multiplyScalar(.5).toArray(),
      [width, length, depth], new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()));
  }
  cylinder(material, position, radius, length, rotation) {
    return this.part(this.resources.geometries.cylinder, material, position, [radius, length, radius], rotation);
  }
  build(name) {
    const group = new THREE.Group(); group.name = name;
    for (const [geometry, byMaterial] of this.batches) for (const [material, matrices] of byMaterial) {
      const mesh = new THREE.InstancedMesh(geometry, material, matrices.length);
      matrices.forEach((matrix, i) => mesh.setMatrixAt(i, matrix));
      mesh.castShadow = true; mesh.receiveShadow = true;
      group.add(mesh);
    }
    return group;
  }
}

export const polar = (x, radius, angle) => [x, radius * Math.cos(angle), radius * Math.sin(angle)];
export function anchor(group, name, position) {
  const point = new THREE.Object3D(); point.name = name; point.position.set(...position); group.add(point); return point;
}

export function pipe(a, material, points, radius = .12) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)), false, 'centripetal');
  const geometry = new THREE.TubeGeometry(curve, Math.max(8, points.length * 5), radius, 6, false);
  a.part(geometry, material, [0, 0, 0]);
}

// Sweep a rounded rectangular pressure-shell envelope around X, in the YZ plane.
// Cross-section is broad axially. Rounded edges consume exterior envelope only.
export function arcGeometry(radius, axialWidth, radialHeight, angle, corner = 1, steps = 24, cornerSegments = 5) {
  const cross = [];
  const hx = axialWidth / 2, hr = radialHeight / 2;
  const c = Math.min(corner, hx, hr);
  for (let side = 0; side < 4; side++) {
    const theta = side * Math.PI / 2;
    const cx = Math.cos(theta + Math.PI / 4) > 0 ? hx - c : -hx + c;
    const cr = Math.sin(theta + Math.PI / 4) > 0 ? hr - c : -hr + c;
    for (let j = 0; j <= cornerSegments; j++) {
      const t = theta + j * Math.PI / (2 * cornerSegments);
      cross.push([cx + c * Math.cos(t), cr + c * Math.sin(t)]);
    }
  }
  const vertices = [], uv = [], indices = []; const n = cross.length;
  for (let i = 0; i <= steps; i++) {
    const t = angle * (i / steps - .5);
    for (let k = 0; k < n; k++) {
      const [x, r] = cross[k]; vertices.push(x, (radius + r) * Math.cos(t), (radius + r) * Math.sin(t));
      uv.push(i / steps, k / n);
    }
  }
  for (let i = 0; i < steps; i++) for (let k = 0; k < n; k++) {
    const a = i * n + k, b = i * n + (k + 1) % n;
    indices.push(a, b, a + n, b, b + n, a + n);
  }
  // Separate end vertices preserve a hard normal at the assembly seam.
  for (const end of [0, steps]) {
    const base = vertices.length / 3; const t = angle * (end / steps - .5);
    vertices.push(0, radius * Math.cos(t), radius * Math.sin(t)); uv.push(.5, .5);
    for (const [x, r] of cross) {
      vertices.push(x, (radius + r) * Math.cos(t), (radius + r) * Math.sin(t)); uv.push(.5 + x / axialWidth, .5 + r / radialHeight);
    }
    for (let k = 0; k < n; k++) {
      const a = base + 1 + k, b = base + 1 + (k + 1) % n;
      indices.push(...(end === 0 ? [base, b, a] : [base, a, b]));
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  geometryRecipes.set(geometry, { type: 'arc', args: [radius, axialWidth, radialHeight, angle, corner, steps, cornerSegments] });
  return geometry;
}

// A thin formed shield swept around X. Profile points carry [x, radial offset,
// outward x normal, outward radial normal]. UV0 measures metres / 2 for finish
// grain; UV1 maps each complete face for panel edges and captive fasteners.
// Separate rim vertices keep folded sheet edges sharp without faceting corners.
export function arcPanelGeometry(radius, profile, angle, offset = .065, thickness = .025, steps = 12, minSteps = 2) {
  // Use the requested subdivision count as a ceiling. Narrow tiles need fewer
  // angular samples; retain at least two spans and every cross-section point.
  steps = Math.min(steps, Math.max(minSteps, Math.ceil(Math.abs(angle) / (Math.PI / 120))));
  const positions = [], normals = [], uv = [], uv1 = [], indices = [];
  const distances = [0];
  for (let k = 1; k < profile.length; k++) distances.push(distances[k - 1]
    + Math.hypot(profile[k][0] - profile[k - 1][0], profile[k][1] - profile[k - 1][1]));
  const length = distances.at(-1), count = profile.length, layer = (steps + 1) * count;
  const vertex = (p, n, tex, panelTex) => {
    const index = positions.length / 3;
    positions.push(...p); normals.push(...n); uv.push(...tex); uv1.push(...panelTex); return index;
  };
  const quad = (a, b, c, d, outward) => {
    const aa = a * 3, bb = b * 3, cc = c * 3;
    const bx = positions[bb] - positions[aa], by = positions[bb + 1] - positions[aa + 1], bz = positions[bb + 2] - positions[aa + 2];
    const cx = positions[cc] - positions[aa], cy = positions[cc + 1] - positions[aa + 1], cz = positions[cc + 2] - positions[aa + 2];
    const nx = by * cz - bz * cy, ny = bz * cx - bx * cz, nz = bx * cy - by * cx;
    if (nx * outward[0] + ny * outward[1] + nz * outward[2] >= 0) indices.push(a, b, c, a, c, d);
    else indices.push(a, c, b, a, d, c);
  };
  for (let face = 0; face < 2; face++) for (let i = 0; i <= steps; i++) {
    const t = angle * (i / steps - .5), sign = face === 0 ? 1 : -1;
    for (let k = 0; k < count; k++) {
      const [x, dr, nx, nr] = profile[k], lift = offset + (face === 0 ? thickness : 0);
      const r = radius + dr + nr * lift;
      vertex([x + nx * lift, r * Math.cos(t), r * Math.sin(t)],
        [sign * nx, sign * nr * Math.cos(t), sign * nr * Math.sin(t)],
        [i / steps * angle * radius / 2, distances[k] / 2], [i / steps, distances[k] / length]);
    }
  }
  for (let face = 0; face < 2; face++) for (let i = 0; i < steps; i++) for (let k = 0; k < count - 1; k++) {
    const a = face * layer + i * count + k;
    quad(a, a + 1, a + count + 1, a + count, normals.slice(a * 3, a * 3 + 3));
  }
  const rim = (a, b, outward) => {
    const source = [a, b, b + layer, a + layer];
    const copied = source.map(i => vertex(positions.slice(i * 3, i * 3 + 3), outward,
      uv.slice(i * 2, i * 2 + 2), uv1.slice(i * 2, i * 2 + 2)));
    quad(...copied, outward);
  };
  for (const end of [0, steps]) {
    const t = angle * (end / steps - .5), sign = end === 0 ? -1 : 1;
    for (let k = 0; k < count - 1; k++) rim(end * count + k, end * count + k + 1,
      [0, -sign * Math.sin(t), sign * Math.cos(t)]);
  }
  for (const k of [0, count - 1]) {
    const neighbour = k === 0 ? 1 : k - 1;
    const dx = profile[k][0] - profile[neighbour][0], dr = profile[k][1] - profile[neighbour][1];
    const magnitude = Math.hypot(dx, dr);
    for (let i = 0; i < steps; i++) {
      const t = angle * ((i + .5) / steps - .5);
      rim(i * count + k, (i + 1) * count + k,
        [dx / magnitude, dr / magnitude * Math.cos(t), dr / magnitude * Math.sin(t)]);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setAttribute('uv1', new THREE.Float32BufferAttribute(uv1, 2));
  geometry.setIndex(indices);
  geometryRecipes.set(geometry, { type: 'panel', args: [radius, profile, angle, offset, thickness, steps] });
  return geometry;
}

// Open rectangular truss, with corner chords, alternating diagonals and end plates.
export function radialTruss(a, angle, inner, outer, x = 0, halfDepth = 3, halfWidth = 1.3, bays = 6,
  { chord = .28, axialDiagonal = .16 } = {}) {
  const at = (r, dx, side) => {
    const p = polar(x + dx, r, angle);
    p[1] -= Math.sin(angle) * side; p[2] += Math.cos(angle) * side; return p;
  };
  for (let i = 0; i <= bays; i++) {
    const r = inner + (outer - inner) * i / bays;
    for (const dx of [-halfDepth, halfDepth]) for (const side of [-halfWidth, halfWidth])
      a.beam('silver', at(r - .12, dx, side), at(r + .12, dx, side), chord + .06);
    for (const dx of [-halfDepth, halfDepth]) a.beam('frame', at(r, dx, -halfWidth), at(r, dx, halfWidth), .06);
    for (const side of [-halfWidth, halfWidth]) a.beam('frame', at(r, -halfDepth, side), at(r, halfDepth, side), .1);
    if (i === bays) continue;
    const next = r + (outer - inner) / bays;
    // Bay-length chord pieces meet at braced nodes, not decorative splices.
    for (const dx of [-halfDepth, halfDepth]) for (const side of [-halfWidth, halfWidth])
      a.beam('silver', at(r, dx, side), at(next, dx, side), chord);
    for (const side of [-halfWidth, halfWidth]) a.beam('frame', at(r, -halfDepth, side), at(next, halfDepth, side), axialDiagonal);
    for (const dx of [-halfDepth, halfDepth]) a.beam('frame', at(r, dx, i % 2 ? halfWidth : -halfWidth), at(next, dx, i % 2 ? -halfWidth : halfWidth), .08);
  }
}

// Shared exterior lift geometry for either rotor. The car is pressure-tight;
// the continuous guide housing is vented. No transport animation is implied.
export function crewLift(a, angle, { x, inner, outer, carRadius, trussDepth, trussWidth }) {
  const at = (axial, r, tangent = 0) => {
    const p = polar(axial, r, angle);
    p[1] -= Math.sin(angle) * tangent; p[2] += Math.cos(angle) * tangent;
    return p;
  };
  // Two guide rails, continuous vented covers and truss saddles leave
  // the surrounding load-bearing truss open. The shaft is not pressurized.
  for (const side of [-1, 1]) {
    a.beam('silver', at(x - 1.15, inner, side * 1.15), at(x - 1.15, outer, side * 1.15), .06);
    a.beam('frame', at(x + 1.15, inner, side * 1.15), at(x + 1.15, outer, side * 1.15), .06);
  }
  const coverCount = Math.ceil((outer - inner) / 4), coverPitch = (outer - inner) / coverCount;
  for (let i = 0; i < coverCount; i++) {
    const r = inner + (i + .5) * coverPitch;
    for (const side of [-1, 1]) {
      a.box('hullShade', at(x, r, side * 1.22), [2.4, coverPitch - .025, .12], [angle, 0, 0]);
      a.beam('silver', at(-trussDepth, r, side * trussWidth), at(x - 1.15, r, side * 1.15), .04);
      a.beam('silver', at(x + 1.15, r, side * 1.15), at(trussDepth, r, side * trussWidth), .04);
    }
    a.box('service', at(x + 1.22, r), [.12, coverPitch - .025, 2.4], [angle, 0, 0]);
  }
  // The forward covers meet the car's inspection opening. Panel joints are
  // narrow seams; small grille strips distinguish the non-pressure housing.
  for (const [start, end] of [[inner, carRadius - 1.5], [carRadius + 1.5, outer]]) {
    const count = Math.ceil((end - start) / 4), pitch = (end - start) / count;
    for (let i = 0; i < count; i++) {
      const r = start + (i + .5) * pitch;
      a.box('hullShade', at(x - 1.22, r), [.12, pitch - .025, 2.4], [angle, 0, 0]);
      for (const dr of [-.22, 0, .22])
        a.box('dark', at(x - 1.29, r + dr), [.025, .06, 1.15], [angle, 0, 0]);
    }
  }
  a.box('hull', at(x, carRadius), [2.4, 2.9, 2.2], [angle, 0, 0]);
  for (const dr of [-1.42, 1.42]) {
    a.box('silver', at(x, carRadius + dr), [2.55, .16, 2.45], [angle, 0, 0]);
    for (const side of [-1, 1]) a.box('dark', at(x - 1.15, carRadius + dr, side * 1.15), [.3, .4, .35], [angle, 0, 0]);
  }
  a.box('dark', at(x - 1.23, carRadius), [.12, 1.7, 1.35], [angle, 0, 0]);
  a.box('glass', at(x - 1.31, carRadius + .5), [.08, .45, .75], [angle, 0, 0]);
  a.box('crewLabel', at(x - 1.32, carRadius - .45), [.06, .45, 1.15], [angle, 0, 0]);
  return at(x - 1.3, carRadius);
}
