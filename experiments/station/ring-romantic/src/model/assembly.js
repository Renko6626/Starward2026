import * as THREE from 'three';

// Each Assembly owns one group's batches. Nothing batches across rotating groups.
export class Assembly {
  constructor(resources) { this.resources = resources; this.batches = new Map(); }
  part(geometry, materialName, position, scale = [1, 1, 1], rotation = [0, 0, 0]) {
    const material = this.resources.materials[materialName];
    if (!material) throw new Error(`Unknown station material: ${materialName}`);
    if (!this.batches.has(geometry)) this.batches.set(geometry, new Map());
    const byMaterial = this.batches.get(geometry);
    if (!byMaterial.has(material)) byMaterial.set(material, []);
    const quaternion = rotation.isQuaternion ? rotation : new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation));
    byMaterial.get(material).push(new THREE.Matrix4().compose(
      new THREE.Vector3(...position), quaternion, new THREE.Vector3(...scale),
    ));
    return this;
  }
  box(material, position, size, rotation) {
    return this.part(this.resources.geometries.rounded, material, position, size, rotation);
  }
  beam(material, start, end, width = .25, depth = width) {
    const a = new THREE.Vector3(...start), b = new THREE.Vector3(...end);
    const direction = b.clone().sub(a), length = direction.length();
    if (length < .0001) return this;
    // Straight structural sections keep flat ends; stretching a rounded unit
    // box would stretch its end radius by metres on long chords. Wide passage
    // envelopes and utility covers retain their existing rounded profiles.
    const structural = Math.max(width, depth) < 1 && ['silver', 'frame', 'hull'].includes(material);
    const geometry = structural ? this.resources.geometries.box : this.resources.geometries.rounded;
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
export function arcGeometry(radius, axialWidth, radialHeight, angle, corner = 1, steps = 24) {
  const cross = [];
  const hx = axialWidth / 2, hr = radialHeight / 2;
  const c = Math.min(corner, hx, hr);
  for (let side = 0; side < 4; side++) {
    const theta = side * Math.PI / 2;
    const cx = Math.cos(theta + Math.PI / 4) > 0 ? hx - c : -hx + c;
    const cr = Math.sin(theta + Math.PI / 4) > 0 ? hr - c : -hr + c;
    for (let j = 0; j <= 5; j++) {
      const t = theta + j * Math.PI / 10;
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
  return geometry;
}

// Open rectangular truss, with corner chords, alternating diagonals and end plates.
export function radialTruss(a, angle, inner, outer, x = 0, halfDepth = 3, halfWidth = 1.3, bays = 6) {
  const at = (r, dx, side) => {
    const p = polar(x + dx, r, angle);
    p[1] -= Math.sin(angle) * side; p[2] += Math.cos(angle) * side; return p;
  };
  for (const dx of [-halfDepth, halfDepth]) for (const side of [-halfWidth, halfWidth])
    a.beam('silver', at(inner, dx, side), at(outer, dx, side), .38);
  for (let i = 0; i <= bays; i++) {
    const r = inner + (outer - inner) * i / bays;
    for (const dx of [-halfDepth, halfDepth]) a.beam('frame', at(r, dx, -halfWidth), at(r, dx, halfWidth), .06);
    for (const side of [-halfWidth, halfWidth]) a.beam('frame', at(r, -halfDepth, side), at(r, halfDepth, side), .1);
    if (i === bays) continue;
    const next = r + (outer - inner) / bays;
    for (const side of [-halfWidth, halfWidth]) a.beam('frame', at(r, -halfDepth, side), at(next, halfDepth, side), .12);
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
