import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// All dimensions are metres. Sections describe OUTER envelopes, not solid steel.
// This is a visual engineering proposal, not a wind/deflection/strength calculation.
export const antennaDimensions = Object.freeze({
  aperture: 40, apertureWidth: 40, apertureHeight: 30, parentFocalLength: 18, apertureOffset: 24,
  elevationDegrees: 82, elevationAxisHeight: 27, reflectorAxisOffset: 6,
  foundationDiameter: 24, azimuthTrackDiameter: 20,
  backingDepthCentre: 4, backingDepthRim: 2,
  panelPitch: 2.25, panelGap: 0.008, panelAssemblyDepth: 0.045,
  secondaryDiameter: 6.6, equipmentRoom: Object.freeze([6, 3, 4]),
  sections: Object.freeze({
    pedestalChord: 0.60, pedestalChordDepth: 0.40, pedestalBrace: 0.18,
    backingChord: 0.24, backingBrace: 0.10, panelRail: 0.065,
    armRootWidth: 4.5, armRootDepth: 3.0, armTipWidth: 1.8, armTipDepth: 1.2,
    armWallRoot: 0.020, armWallTip: 0.012,
    handrailDiameter: 0.042, handrailHeight: 1.10, ladderWidth: 0.65,
  }),
});
const D = antennaDimensions;
const v = p => new THREE.Vector3(...p);
const tau = Math.PI * 2;

export function createAntennaArray() {
  const antenna = new THREE.Group();
  antenna.name = 'forty-metre-offset-observatory';
  antenna.userData.dimensions = D;
  const materials = {
    concrete: new THREE.MeshStandardMaterial({ color: 0x353b44, roughness: 0.96 }),
    steel: new THREE.MeshStandardMaterial({ color: 0x778899, metalness: 0.12, roughness: 0.43 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x293442, metalness: 0.08, roughness: 0.62 }),
    light: new THREE.MeshStandardMaterial({ color: 0x9caab9, metalness: 0.72, roughness: 0.32 }),
    hardware: new THREE.MeshStandardMaterial({ color: 0xb5c2d0, metalness: 0.92, roughness: 0.24 }),
    cable: new THREE.MeshStandardMaterial({ color: 0x131923, roughness: 0.93 }),
    receiver: new THREE.MeshStandardMaterial({ color: 0xa39b87, metalness: 0.72, roughness: 0.32 }),
    backing: new THREE.MeshStandardMaterial({ color: 0x637487, metalness: 0.10, roughness: 0.56 }),
  };
  const panelMaterials = [0x99a9bc, 0x96a6b9, 0x9cacc0, 0x98a8bb].map(color =>
    new THREE.MeshStandardMaterial({ color, metalness: 0.82, roughness: 0.38 }));
  const cube = new THREE.BoxGeometry(1, 1, 1);
  const tube = new THREE.CylinderGeometry(1, 1, 1, 10);
  const bolt = new THREE.CylinderGeometry(1, 1, 1, 6);
  const batches = [];
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const size = new THREE.Vector3();
  function group(name, parent = antenna) {
    const result = new THREE.Group(); result.name = name; parent.add(result); return result;
  }
  function instance(parent, geometry, material, position, scale, rotation = new THREE.Quaternion()) {
    let batch = batches.find(b => b.parent === parent && b.geometry === geometry && b.material === material);
    if (!batch) { batch = { parent, geometry, material, matrices: [] }; batches.push(batch); }
    matrix.compose(v(position), rotation, v(scale)); batch.matrices.push(matrix.clone());
  }
  function box(parent, position, dimensions, material = materials.steel) {
    instance(parent, cube, material, position, dimensions);
  }
  function beam(parent, a, b, width, material = materials.steel, depth = width) {
    const start = v(a), end = v(b), direction = end.clone().sub(start);
    const length = direction.length(); if (length < 1e-6) return;
    quaternion.setFromUnitVectors(up, direction.divideScalar(length));
    size.set(width, length, depth);
    instance(parent, cube, material, start.add(end).multiplyScalar(0.5).toArray(), size.toArray(), quaternion);
  }
  function pipe(parent, a, b, diameter, material = materials.hardware) {
    const start = v(a), end = v(b), direction = end.clone().sub(start);
    const length = direction.length(); if (length < 1e-6) return;
    quaternion.setFromUnitVectors(up, direction.divideScalar(length));
    instance(parent, tube, material, start.add(end).multiplyScalar(0.5).toArray(), [diameter / 2, length, diameter / 2], quaternion);
  }
  function mesh(parent, geometry, material, name) {
    const result = new THREE.Mesh(geometry, material); result.name = name;
    parent.add(result); return result;
  }
  function cylinder(parent, position, radius, height, material = materials.steel, horizontal = false) {
    const object = mesh(parent, new THREE.CylinderGeometry(radius, radius, height, 48), material, 'housing');
    object.position.set(...position); if (horizontal) object.rotation.z = Math.PI / 2;
    return object;
  }
  function ring(parent, centre, radius, diameter, material, inXY = false, count = 96) {
    for (let i = 0; i < count; i++) {
      const a = i / count * tau, b = (i + 1) / count * tau;
      const p = angle => inXY ? [centre[0] + radius * Math.cos(angle), centre[1] + radius * Math.sin(angle), centre[2]]
        : [centre[0] + radius * Math.cos(angle), centre[1], centre[2] + radius * Math.sin(angle)];
      pipe(parent, p(a), p(b), diameter, material);
    }
  }
  function platform(parent, centre, width, depth, railSides = ['front', 'back', 'left', 'right']) {
    box(parent, centre, [width, 0.12, depth], materials.dark);
    const [x, y, z] = centre, floor = y + 0.06, top = floor + D.sections.handrailHeight;
    const lines = {
      front: [[x - width / 2, floor, z + depth / 2], [x + width / 2, floor, z + depth / 2]],
      back: [[x - width / 2, floor, z - depth / 2], [x + width / 2, floor, z - depth / 2]],
      left: [[x - width / 2, floor, z - depth / 2], [x - width / 2, floor, z + depth / 2]],
      right: [[x + width / 2, floor, z - depth / 2], [x + width / 2, floor, z + depth / 2]],
    };
    for (const side of railSides) {
      const [a, b] = lines[side], length = v(a).distanceTo(v(b));
      for (let i = 0, n = Math.ceil(length / 1.5); i <= n; i++) {
        const p = v(a).lerp(v(b), i / n).toArray(); pipe(parent, p, [p[0], top, p[2]], 0.042);
      }
      for (const h of [0.55, D.sections.handrailHeight]) pipe(parent, [a[0], floor + h, a[2]], [b[0], floor + h, b[2]], 0.042);
      beam(parent, [a[0], floor + 0.075, a[2]], [b[0], floor + 0.075, b[2]], 0.012, materials.steel, 0.15);
    }
  }
  function ladder(parent, x, y0, y1, z) {
    for (const side of [-1, 1]) beam(parent, [x + side * 0.325, y0, z], [x + side * 0.325, y1, z], 0.055, materials.hardware, 0.025);
    for (let y = y0 + 0.25; y < y1; y += 0.30) pipe(parent, [x - 0.325, y, z], [x + 0.325, y, z], 0.025);
    for (let y = y0 + 0.5; y < y1; y += 1.5) for (const side of [-1, 1]) beam(parent, [x + side * 0.325, y, z], [x + side * 0.325, y, z - 0.3], 0.04);
  }
  function node(parent, position, normalAxis = 'z') {
    box(parent, position, normalAxis === 'z' ? [0.48, 0.48, 0.018] : [0.018, 0.48, 0.48], materials.dark);
    for (const a of [-0.16, 0.16]) for (const b of [-0.16, 0.16]) {
      const p = normalAxis === 'z' ? [position[0] + a, position[1] + b, position[2] + 0.018] : [position[0] + 0.018, position[1] + a, position[2] + b];
      const rotation = new THREE.Quaternion().setFromAxisAngle(v(normalAxis === 'z' ? [1, 0, 0] : [0, 0, 1]), Math.PI / 2);
      instance(parent, bolt, materials.hardware, p, [0.025, 0.018, 0.025], rotation);
    }
  }

  function fastener(parent, position, radius = 0.022, axis = 'z') {
    const rotation = new THREE.Quaternion().setFromAxisAngle(v(axis === 'x' ? [0, 0, 1] : [1, 0, 0]), Math.PI / 2);
    instance(parent, bolt, materials.hardware, position, [radius, 0.024, radius], rotation);
  }
  function flange(parent, position, radius, count = 16, axis = 'x') {
    for (let i = 0; i < count; i++) {
      const a = i / count * tau;
      fastener(parent, axis === 'x' ? [position[0], position[1] + radius * Math.sin(a), position[2] + radius * Math.cos(a)]
        : [position[0] + radius * Math.cos(a), position[1] + radius * Math.sin(a), position[2]], 0.028, axis);
    }
  }
  function cableRun(parent, points, diameter = 0.065) {
    for (let i = 1; i < points.length; i++) pipe(parent, points[i - 1], points[i], diameter, materials.cable);
  }

  // Fixed concrete footing and rail. The complete alidade rotates above it.
  const foundation = group('foundation-and-azimuth-track');
  cylinder(foundation, [0, 0.45, 0], 12, 0.9, materials.concrete);
  cylinder(foundation, [0, 1.0, 0], 10.6, 0.2, materials.dark);
  ring(foundation, [0, 1.17, 0], 10, 0.18, materials.hardware);
  for (let i = 0; i < 32; i++) {
    const a = i / 32 * tau;
    box(foundation, [10.65 * Math.cos(a), 1.11, 10.65 * Math.sin(a)], [0.22, 0.12, 0.22], materials.hardware);
  }
  const azimuth = group('azimuth-alidade');
  antenna.userData.azimuth = azimuth;
  const pedestal = group('twin-elevation-towers', azimuth);
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * tau, x = 10 * Math.cos(a), z = 10 * Math.sin(a);
    const bogie = group('rail-bogie', azimuth); bogie.position.set(x, 1.65, z); bogie.rotation.y = -a;
    box(bogie, [0, 0.05, 0], [1.5, 0.55, 1.25], materials.dark);
    for (const wheel of [-1, 1]) {
      cylinder(bogie, [0, -0.01, wheel * 0.39], 0.38, 0.32, materials.hardware, true);
      for (const side of [-1, 1]) {
        cylinder(bogie, [side * 0.23, -0.01, wheel * 0.39], 0.43, 0.08, materials.dark, true);
        cylinder(bogie, [side * 0.47, -0.01, wheel * 0.39], 0.18, 0.22, materials.hardware, true);
        flange(bogie, [side * 0.59, -0.01, wheel * 0.39], 0.12, 6);
      }
    }
    box(bogie, [0.9, 0.30, 0], [0.65, 0.60, 0.65], materials.steel);
    cylinder(bogie, [1.4, 0.30, 0], 0.23, 0.65, materials.dark, true);
    cylinder(bogie, [1.75, 0.30, 0], 0.25, 0.06, materials.hardware, true);
    cableRun(bogie, [[1.45, 0.60, 0], [1.1, 0.72, 0], [0.5, 0.72, 0]], 0.04);
    beam(azimuth, [x, 1.95, z], [x * 0.72, 3.5, z * 0.72], 0.38);
    beam(azimuth, [x * 0.72, 3.5, z * 0.72], [0, 3.5, 0], 0.45, materials.dark);
  }
  platform(azimuth, [0, 3.8, 0], 17.5, 11);
  cylinder(azimuth, [0, 2.0, 0], 2.3, 2.0, materials.dark);
  const levels = [4, 9.5, 15, 21, 27];
  for (const side of [-1, 1]) {
    const frames = levels.map(y => {
      const x = side * (7.1 + (y - 4) / 23 * 3.9), halfZ = THREE.MathUtils.lerp(2.7, 0.85, (y - 4) / 23);
      return [[x - 0.7, y, -halfZ], [x + 0.7, y, -halfZ], [x + 0.7, y, halfZ], [x - 0.7, y, halfZ]];
    });
    for (let j = 0; j < frames.length; j++) {
      const frame = frames[j];
      for (let k = 0; k < 4; k++) {
        beam(pedestal, frame[k], frame[(k + 1) % 4], 0.28);
        if (j) {
          const joint = v(frames[j - 1][k]).lerp(v(frame[k]), 0.12).toArray();
          box(pedestal, [joint[0], joint[1], joint[2] - 0.225], [0.72, 0.65, 0.026], materials.light);
          for (const x of [-0.24, 0.24]) for (const y of [-0.20, 0, 0.20]) fastener(pedestal, [joint[0] + x, joint[1] + y, joint[2] - 0.247]);
          beam(pedestal, frames[j - 1][k], frame[k], D.sections.pedestalChord, materials.steel, D.sections.pedestalChordDepth);
          beam(pedestal, frames[j - 1][k], frame[(k + 1) % 4], D.sections.pedestalBrace, materials.dark);
        }
      }
      node(pedestal, [side * (7.1 + (levels[j] - 4) / 23 * 3.9), levels[j], frame[0][2] - 0.025]);
    }
    box(pedestal, [side * 11, 27, 0], [2.5, 3.2, 3.2], materials.steel);
    cylinder(pedestal, [side * 10.7, 27, 0], 1.35, 1.5, materials.dark, true);
    cylinder(pedestal, [side * 12.40, 27, 0], 1.48, 0.16, materials.light, true);
    cylinder(pedestal, [side * 12.52, 27, 0], 0.82, 0.16, materials.hardware, true);
    flange(pedestal, [side * 12.50, 27, 0], 1.23, 20);
    for (const z of [-1.2, 1.2]) beam(pedestal, [side * 11, 25.4, z], [side * 10, 22, z], 0.20, materials.dark);
    const drive = group('elevation-drive-package', pedestal);
    box(drive, [side * 11.3, 21.9, 0], [1.1, 1.3, 1.5], materials.light);
    pipe(drive, [side * 9.97, 21.93, 0], [side * 10.75, 21.93, 0], 0.16);
    pipe(drive, [side * 11.85, 21.9, 0], [side * 12.10, 21.9, 0], 0.16);
    cylinder(drive, [side * 9.7, 21.93, 0], 0.37, 0.55, materials.hardware, true);
    cylinder(drive, [side * 12.5, 21.9, 0], 0.38, 1.2, materials.dark, true);
    cylinder(drive, [side * 13.13, 21.9, 0], 0.41, 0.10, materials.hardware, true);
    for (let j = 0; j < 9; j++) cylinder(drive, [side * (12 + j * 0.12), 21.9, 0], 0.405, 0.028, materials.steel, true);
    platform(drive, [side * 12, 20.5, -0.65], 3.2, 3.2, ['back', side < 0 ? 'left' : 'right']);
    beam(drive, [side * 10, 21, -1.4], [side * 12.3, 20.44, -1.4], 0.16);
    cableRun(drive, [[side * 12.5, 22.3, 0], [side * 11.7, 22.6, -0.8], [side * 10.7, 22, -1.4], [side * 8.1, 9.5, -2.5]], 0.06);
    box(pedestal, [side * 11, 25.2, -1.4], [1.2, 1.0, 1.8], materials.dark);
    platform(pedestal, [side * 11.7, 24.25, -2.4], 2.0, 3.0, ['back', side < 0 ? 'left' : 'right']);
    // Staged ladders follow the sloping tower; short landings avoid a 20 m free ladder.
    for (let j = 0; j < 4; j++) {
      const x = side * (7.9 + j * 0.92), y = levels[j];
      ladder(pedestal, x, y + 0.15, j === 3 ? 24.3 : levels[j + 1] + 0.1, -3.1);
      if (j) platform(pedestal, [x, y, -3.1], 1.3, 1.5, ['back', side < 0 ? 'left' : 'right']);
    }
  }
  for (const z of [-2.5, 2.5]) {
    beam(pedestal, [-7.1, 4, z], [7.1, 4, z], 0.7);
    beam(pedestal, [-8.03, 9.5, z], [8.03, 9.5, z], 0.55);
    beam(pedestal, [-7.1, 4, z], [0, 9.5, z], 0.3, materials.dark);
    beam(pedestal, [7.1, 4, z], [0, 9.5, z], 0.3, materials.dark);
  }
  const services = group('alidade-equipment-room', azimuth);
  services.position.z = 1.8;
  box(services, [0, 5.4, -1.8], D.equipmentRoom, materials.light);
  box(services, [0, 6.98, -1.8], [6.18, 0.16, 4.18], materials.dark);
  box(services, [0, 3.93, -1.8], [6.14, 0.14, 4.14], materials.steel);
  // Door and weather seals on the visible rear wall: human scale anchors the structure.
  box(services, [-1.65, 5.07, -3.823], [0.95, 2.15, 0.032], materials.dark);
  box(services, [-1.65, 5.07, -3.851], [0.83, 2.03, 0.018], materials.steel);
  pipe(services, [-1.31, 4.98, -3.91], [-1.31, 5.22, -3.91], 0.032);
  for (const x of [0.0, 1.65]) {
    box(services, [x, 5.8, -3.833], [1.25, 1.4, 0.05], materials.dark);
    for (let j = 0; j < 11; j++) box(services, [x, 5.22 + j * 0.115, -3.875], [1.12, 0.055, 0.045], materials.hardware);
  }
  for (const x of [-2.15, 0, 2.15]) {
    box(services, [x, 5.4, -3.858], [0.016, 2.74, 0.012], materials.steel);
    for (const y of [4.15, 6.65]) fastener(services, [x, y, -3.88], 0.016);
  }
  // External closed cooling packages, pipe manifolds and isolating feet.
  for (const z of [-2.65, -0.65]) {
    box(services, [-4.05, 4.05, z], [1.45, 0.30, 1.65], materials.dark);
    box(services, [-4.05, 4.85, z], [1.20, 1.35, 1.45], materials.steel);
    box(services, [-4.67, 4.87, z], [0.035, 1.04, 1.16], materials.dark);
    for (let j = 0; j < 10; j++) box(services, [-4.71, 4.43 + j * 0.094, z], [0.025, 0.036, 1.06], materials.hardware);
    pipe(services, [-3.6, 4.55, z], [-3.06, 4.55, z], 0.09, materials.hardware);
    pipe(services, [-3.6, 5.08, z], [-3.06, 5.08, z], 0.09, materials.hardware);
  }
  for (const x of [3.55, 4.5]) {
    box(services, [x, 4.96, -2.6], [0.78, 1.98, 0.70], materials.steel);
    box(services, [x, 4.96, -2.964], [0.67, 1.85, 0.028], materials.dark);
    pipe(services, [x + 0.23, 4.8, -3.005], [x + 0.23, 5.05, -3.005], 0.022);
  }
  for (const z of [-4.3, -4.65]) beam(services, [-4.3, 4.5, z], [4.6, 4.5, z], 0.07);
  for (let x = -4.3; x < 4.6; x += 0.5) beam(services, [x, 4.5, -4.3], [x, 4.5, -4.65], 0.04);
  cableRun(services, [[3.55, 4.12, -2.6], [3.55, 4.5, -3.3], [3.55, 4.5, -4.4], [0.5, 4.5, -4.4], [0.5, 4.12, -3.9]], 0.065);
  // Cable-wrap basket bridges the fixed centre and moving alidade, below the deck.
  ring(azimuth, [0, 2.0, 0], 2.65, 0.065, materials.hardware, false, 48);
  ring(azimuth, [0, 3.15, 0], 2.65, 0.065, materials.hardware, false, 48);
  for (let i = 0; i < 16; i++) {
    const a = i / 16 * tau, x = 2.65 * Math.cos(a), z = 2.65 * Math.sin(a);
    beam(azimuth, [x, 2, z], [x, 3.15, z], 0.05);
  }
  for (let i = 0; i < 28; i++) {
    const a = i / 28 * Math.PI * 1.5;
    const x = 2.45 * Math.cos(a), z = 2.45 * Math.sin(a);
    pipe(azimuth, [x, 2.1, z], [x, 3.02, z], 0.10, materials.cable);
  }

  const elevation = group('elevation-reflector-assembly', azimuth);
  elevation.position.y = D.elevationAxisHeight;
  elevation.rotation.x = -THREE.MathUtils.degToRad(D.elevationDegrees);
  antenna.userData.elevation = elevation;
  const gears = group('elevation-sector-gears', elevation);
  const startAngle = THREE.MathUtils.degToRad(-195), endAngle = THREE.MathUtils.degToRad(-40);
  const outline = new THREE.Shape();
  outline.absarc(0, 0, 4.6, startAngle, endAngle, false);
  outline.absarc(0, 0, 4.35, endAngle, startAngle, true); outline.closePath();
  const gearGeometry = new THREE.ExtrudeGeometry(outline, {depth: 0.28, bevelEnabled: false, curveSegments: 64});
  gearGeometry.rotateY(-Math.PI / 2); gearGeometry.translate(0.14, 0, 0);
  for (const side of [-1, 1]) {
    mesh(gears, gearGeometry, materials.hardware, 'elevation-gear-rim').position.x = side * 9.7;
    for (let j = 0; j < 96; j++) {
      const a = THREE.MathUtils.lerp(startAngle, endAngle, j / 95);
      const rotation = new THREE.Quaternion().setFromAxisAngle(v([1, 0, 0]), -a);
      instance(gears, cube, materials.dark, [side * 9.7, 4.665 * Math.sin(a), 4.665 * Math.cos(a)], [0.30, 0.085, 0.13], rotation);
    }
    for (let j = 0; j < 7; j++) {
      const a = THREE.MathUtils.lerp(startAngle, endAngle, j / 6);
      const inner = [side * 9.7, 0.9 * Math.sin(a), 0.9 * Math.cos(a)];
      const outer = [side * 9.7, 4.37 * Math.sin(a), 4.37 * Math.cos(a)];
      beam(gears, inner, outer, 0.20, materials.steel, 0.25);
      fastener(gears, [side * 9.86, outer[1], outer[2]], 0.035, 'x');
    }
  }
  const reflector = group('offset-primary-reflector', elevation);
  reflector.position.z = D.reflectorAxisOffset;
  const radius = D.aperture / 2;
  const centreSag = D.apertureOffset ** 2 / (4 * D.parentFocalLength);
  const sag = (x, y) => (x * x + (y + D.apertureOffset) ** 2) / (4 * D.parentFocalLength) - centreSag;
  // A broad, low elliptical aperture. Curvature supplies the depth.
  // Reshape the clipping boundary, keeping the parent paraboloid and its focus intact.
  const aperturePoint = (r, angle) => {
    return [r * Math.cos(angle) * D.apertureWidth / D.aperture, r * Math.sin(angle) * D.apertureHeight / D.aperture];
  };
  const point = (r, angle, behind = 0) => {
    const [x, y] = aperturePoint(r, angle); return [x, y, sag(x, y) - behind];
  };
  const backDepth = r => THREE.MathUtils.lerp(D.backingDepthCentre, D.backingDepthRim, (r / radius) ** 1.2);

  // Staggered rectangular panels clipped to the elliptical aperture.
  // Curvature uses the PARENT paraboloid, rather than moving the feed on a centred bowl.
  const disk = Array.from({ length: 160 }, (_, i) => aperturePoint(radius, i / 160 * tau));
  function clip(polygon, axis, limit, greater) {
    const result = [];
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i], b = polygon[(i + 1) % polygon.length];
      const insideA = greater ? a[axis] >= limit : a[axis] <= limit;
      const insideB = greater ? b[axis] >= limit : b[axis] <= limit;
      if (insideA) result.push(a);
      if (insideA !== insideB) { const t = (limit - a[axis]) / (b[axis] - a[axis]); result.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
    }
    return result;
  }
  function curvedPolygon(polygon, behind = 0, skirt = false) {
    const boundary = [];
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i], b = polygon[(i + 1) % polygon.length];
      const steps = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.55));
      for (let j = 0; j < steps; j++) boundary.push([THREE.MathUtils.lerp(a[0], b[0], j / steps), THREE.MathUtils.lerp(a[1], b[1], j / steps)]);
    }
    const positions = [], normals = [];
    const cx = polygon.reduce((sum, p) => sum + p[0], 0) / polygon.length;
    const cy = polygon.reduce((sum, p) => sum + p[1], 0) / polygon.length;
    function vertex(x, y, offset) {
      positions.push(x, y, sag(x, y) - offset);
      normals.push(...new THREE.Vector3(-x / (2 * D.parentFocalLength), -(y + D.apertureOffset) / (2 * D.parentFocalLength), 1).normalize().toArray());
    }
    for (let i = 0; i < boundary.length; i++) {
      const a = boundary[i], b = boundary[(i + 1) % boundary.length];
      vertex(cx, cy, behind); vertex(...a, behind); vertex(...b, behind);
      if (skirt) {
        vertex(...a, behind); vertex(...a, behind + D.panelAssemblyDepth); vertex(...b, behind);
        vertex(...b, behind); vertex(...a, behind + D.panelAssemblyDepth); vertex(...b, behind + D.panelAssemblyDepth);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    return geometry;
  }
  // A tessellated rear skin gives the panels physical depth, not a double-sided white sheet.
  const panels = [[], [], [], []], rearPanels = [];
  let panelCount = 0;
  for (let row = -9; row <= 9; row++) for (let column = -10; column <= 10; column++) {
    const x0 = column * D.panelPitch + (Math.abs(row) % 2) * D.panelPitch / 2;
    const y0 = row * D.panelPitch;
    let polygon = disk;
    for (const [axis, limit, greater] of [[0, x0 + D.panelGap / 2, true], [0, x0 + D.panelPitch - D.panelGap / 2, false], [1, y0 + D.panelGap / 2, true], [1, y0 + D.panelPitch - D.panelGap / 2, false]]) polygon = clip(polygon, axis, limit, greater);
    if (polygon.length < 3) continue;
    const area = Math.abs(polygon.reduce((sum, a, i) => { const b = polygon[(i + 1) % polygon.length]; return sum + a[0] * b[1] - b[0] * a[1]; }, 0)) / 2;
    if (area < 0.025) continue;
    panels[((row * 7 + column * 3) % 4 + 4) % 4].push(curvedPolygon(polygon, 0, true));
    const rear = curvedPolygon(polygon, D.panelAssemblyDepth); const normal = rear.attributes.normal;
    for (let i = 0; i < normal.count; i++) normal.setXYZ(i, -normal.getX(i), -normal.getY(i), -normal.getZ(i));
    const pos = rear.attributes.position;
    for (let i = 0; i < pos.count; i += 3) for (let axis = 0; axis < 3; axis++) { const a = pos.array[(i + 1) * 3 + axis]; pos.array[(i + 1) * 3 + axis] = pos.array[(i + 2) * 3 + axis]; pos.array[(i + 2) * 3 + axis] = a; }
    // All vertices on one panel share analytical rear normals after winding reversal.
    rear.computeVertexNormals(); rearPanels.push(rear); panelCount++;
  }
  panels.forEach((geometries, i) => { const merged = mergeGeometries(geometries); mesh(reflector, merged, panelMaterials[i], `reflector-panels-${i}`); geometries.forEach(g => g.dispose()); });
  mesh(reflector, mergeGeometries(rearPanels), materials.backing, 'rear-panel-skins'); rearPanels.forEach(g => g.dispose());
  antenna.userData.panelCount = panelCount;

  const backing = group('deep-reflector-space-frame', reflector);
  const spokes = 20, radii = [3, 7, 11.5, 16, 20];
  for (let j = 0; j < radii.length; j++) for (let i = 0; i < spokes; i++) {
    const r = radii[j], a = i / spokes * tau, b = (i + 1) / spokes * tau;
    const upper = point(r, a, 0.30), lower = point(r, a, backDepth(r));
    beam(backing, upper, point(r, b, 0.30), j === 4 ? 0.16 : 0.18, materials.steel);
    beam(backing, lower, point(r, b, backDepth(r)), D.sections.backingChord, materials.dark);
    beam(backing, upper, lower, 0.10);
    beam(backing, upper, point(r, b, backDepth(r)), D.sections.backingBrace, materials.dark);
    if (j) {
      const previous = radii[j - 1];
      beam(backing, point(previous, a, 0.30), upper, 0.20);
      beam(backing, point(previous, a, backDepth(previous)), lower, 0.24);
      beam(backing, point(previous, a, 0.30), lower, 0.12, materials.dark);
      beam(backing, point(previous, a, backDepth(previous)), point(r, b, backDepth(r)), 0.10, materials.dark);
    }
    if (j === 1 || j === 3) node(backing, lower);
  }
  // Panel carrier rails form a separate, much finer layer behind the surface.
  for (let y = -D.apertureHeight / 2 + 1.5; y <= D.apertureHeight / 2 - 1.5; y += D.panelPitch) {
    const half = D.apertureWidth / 2 * Math.sqrt(1 - (y / (D.apertureHeight / 2)) ** 2);
    for (let x = -half; x < half - 0.05; x += 1.25) {
      const end = Math.min(x + 1.25, half);
      beam(backing, [x, y, sag(x, y) - 0.12], [end, y, sag(end, y) - 0.12], D.sections.panelRail, materials.backing, 0.045);
    }
    for (let x = -half + 0.5; x < half; x += D.panelPitch) {
      const z = sag(x, y);
      box(backing, [x, y, z - 0.055], [0.10, 0.10, 0.020], materials.dark);
      pipe(backing, [x, y, z - 0.06], [x, y, z - 0.30], 0.030);
      pipe(backing, [x, y, z - 0.12], [x, y, z - 0.18], 0.052, materials.hardware);
    }
  }
  for (let i = 0; i < 160; i++) pipe(backing, point(radius, i / 160 * tau, 0.05), point(radius, (i + 1) / 160 * tau, 0.05), 0.09, materials.light);
  box(backing, [0, 0, -4.2], [6.5, 5.2, 0.4], materials.dark);
  box(backing, [0, 0, -4.45], [5.85, 4.55, 0.08], materials.steel);
  box(backing, [0, 0, -4.51], [3.4, 2.85, 0.04], materials.dark);
  for (const x of [-2.8, 2.8]) for (let y = -1.9; y <= 1.9; y += 0.48) fastener(backing, [x, y, -4.52], 0.030);
  for (const y of [-2.1, 2.1]) for (let x = -2.3; x <= 2.3; x += 0.48) fastener(backing, [x, y, -4.52], 0.030);
  for (const side of [-1, 1]) {
    for (const verticalSide of [-1, 1]) {
      const angle = Math.atan2(verticalSide * Math.sin(tau / 10), side * Math.cos(tau / 10));
      const mount = point(11.5, angle, backDepth(11.5));
      beam(backing, [side * 10.5, 0, -6], mount, 0.42);
      beam(backing, [side * 3, 0, -4.2], mount, 0.30);
    }
    pipe(elevation, [side * 10, 0, 0], [side * 11.2, 0, 0], 1.35);
    beam(elevation, [side * 10, 0, 0], [side * 5, -7, -9], 0.45, materials.dark);
    beam(elevation, [side * 3, -1, 1.8], [side * 5, -7, -9], 0.30);
    box(elevation, [side * 5, -7, -9], [3.4, 2.0, 2.4], materials.dark);
    for (let j = 0; j < 3; j++) box(elevation, [side * 5, -7.65 + j * 0.65, -10.215], [3.1, 0.035, 0.022], materials.hardware);
  }

  // Gregorian optical working geometry: F1 is the parent-paraboloid focus.
  // The secondary is an ellipsoidal cap with F1 and the receiver phase centre as foci.
  const f1 = new THREE.Vector3(0, -D.apertureOffset, D.parentFocalLength - centreSag);
  const receiver = new THREE.Vector3(0, -22, -7);
  const secondaryCentre = f1.clone().multiplyScalar(1.14);
  const ellipseCentre = f1.clone().add(receiver).multiplyScalar(0.5);
  const majorAxis = f1.clone().sub(receiver).normalize();
  const majorRadius = (secondaryCentre.distanceTo(f1) + secondaryCentre.distanceTo(receiver)) / 2;
  const focusDistance = f1.distanceTo(receiver) / 2;
  const minorRadius = Math.sqrt(majorRadius ** 2 - focusDistance ** 2);
  const normal = secondaryCentre.clone().sub(f1).normalize().add(secondaryCentre.clone().sub(receiver).normalize()).normalize();
  const tangentX = new THREE.Vector3(1, 0, 0), tangentY = normal.clone().cross(tangentX).normalize();
  const quad = (a, b) => a.dot(b) / minorRadius ** 2 + a.dot(majorAxis) * b.dot(majorAxis) * (1 / majorRadius ** 2 - 1 / minorRadius ** 2);
  function secondaryPoint(u, w, behind = 0) {
    const p = secondaryCentre.clone().addScaledVector(tangentX, u).addScaledVector(tangentY, w);
    const rel = p.clone().sub(ellipseCentre), qa = quad(normal, normal), qb = 2 * quad(rel, normal), qc = quad(rel, rel) - 1;
    const discriminant = qb * qb - 4 * qa * qc;
    if (discriminant < 0) throw new Error('Secondary patch exceeds ellipsoid');
    const t = (-qb + Math.sqrt(discriminant)) / (2 * qa);
    return p.addScaledVector(normal, t + behind);
  }
  const optics = group('offset-secondary-and-receivers', reflector);
  const positions = [], indices = [], sr = D.secondaryDiameter / 2;
  for (let j = 0; j <= 12; j++) for (let i = 0; i <= 64; i++) positions.push(...secondaryPoint(sr * j / 12 * Math.cos(i / 64 * tau), sr * j / 12 * Math.sin(i / 64 * tau)).toArray());
  for (let j = 0; j < 12; j++) for (let i = 0; i < 64; i++) { const a = j * 65 + i, b = a + 65; indices.push(a, a + 1, b, a + 1, b + 1, b); }
  const secondaryGeometry = new THREE.BufferGeometry(); secondaryGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); secondaryGeometry.setIndex(indices); secondaryGeometry.computeVertexNormals();
  const secondaryMaterial = materials.light.clone(); secondaryMaterial.side = THREE.DoubleSide;
  mesh(optics, secondaryGeometry, secondaryMaterial, 'ellipsoidal-secondary');
  for (let i = 0; i < 64; i++) {
    const a = i / 64 * tau, b = (i + 1) / 64 * tau;
    pipe(optics, secondaryPoint(sr * Math.cos(a), sr * Math.sin(a), 0.08).toArray(), secondaryPoint(sr * Math.cos(b), sr * Math.sin(b), 0.08).toArray(), 0.09);
  }
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * tau;
    beam(optics, secondaryPoint(0, 0, 0.4).toArray(), secondaryPoint(sr * 0.95 * Math.cos(a), sr * 0.95 * Math.sin(a), 0.10).toArray(), 0.10, materials.dark);
  }
  antenna.userData.optics = { primaryFocus: f1.toArray(), receiverFocus: receiver.toArray(), secondaryCentre: secondaryCentre.toArray(), ellipsoidCentre: ellipseCentre.toArray(), majorRadius, minorRadius };

  const arm = group('curved-twin-box-girder-arm', reflector);
  const tip = secondaryCentre.clone().addScaledVector(normal, 0.8);
  const armCurve = new THREE.CubicBezierCurve3(v([0, -15.5, -10]), v([0, -25, -12]), v([0, -29, 4]), tip);
  function armSection(t, side = 0) {
    const centre = armCurve.getPoint(t), tangent = armCurve.getTangent(t).normalize();
    const across = v([1, 0, 0]), depthAxis = across.clone().cross(tangent).normalize();
    const width = THREE.MathUtils.lerp(D.sections.armRootWidth, D.sections.armTipWidth, t);
    const girderWidth = THREE.MathUtils.lerp(0.65, 0.35, t);
    const depth = THREE.MathUtils.lerp(D.sections.armRootDepth, D.sections.armTipDepth, t);
    centre.x = side * (width - girderWidth) / 2;
    return {centre, tangent, across, depthAxis, girderWidth, depth};
  }
  function sweepGirder(side) {
    const positions = [], indices = [], segments = 64;
    for (let j = 0; j <= segments; j++) {
      const t = j / segments, frame = armSection(t, side), wall = THREE.MathUtils.lerp(D.sections.armWallRoot, D.sections.armWallTip, t);
      for (const inset of [0, wall]) for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]])
        positions.push(...frame.centre.clone().addScaledVector(frame.across, x * (frame.girderWidth / 2 - inset)).addScaledVector(frame.depthAxis, z * (frame.depth / 2 - inset)).toArray());
    }
    for (let j = 0; j < segments; j++) for (const inside of [0, 4]) for (let k = 0; k < 4; k++) {
      const a = j * 8 + inside + k, b = j * 8 + inside + (k + 1) % 4, c = a + 8, d = b + 8;
      if (!inside) indices.push(a, c, b, b, c, d); else indices.push(a, b, c, b, d, c);
    }
    for (const j of [0, segments]) for (let k = 0; k < 4; k++) {
      const a = j * 8 + k, b = j * 8 + (k + 1) % 4;
      if (j) indices.push(a, a + 4, b, b, a + 4, b + 4); else indices.push(a, b, a + 4, b, b + 4, a + 4);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setIndex(indices);
    const flat = geometry.toNonIndexed(); geometry.dispose(); flat.computeVertexNormals();
    mesh(arm, flat, materials.steel, side < 0 ? 'port-box-girder' : 'starboard-box-girder');
  }
  sweepGirder(-1); sweepGirder(1);
  // Only a few crossheads tie the two beams; the silhouette is carried by continuous girders.
  for (const t of [0, 0.22, 0.48, 0.74, 1]) {
    const left = armSection(t, -1), right = armSection(t, 1);
    beam(arm, left.centre.toArray(), right.centre.toArray(), t === 0 ? 0.28 : 0.14, materials.dark, t === 0 ? 0.36 : 0.22);
  }
  for (const side of [-1, 1]) for (const t of [0.18, 0.42, 0.67, 0.86]) {
    const f = armSection(t, side), corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, z]) =>
      f.centre.clone().addScaledVector(f.across, x * (f.girderWidth / 2 + 0.008)).addScaledVector(f.depthAxis, z * (f.depth / 2 + 0.008)));
    for (let i = 0; i < 4; i++) pipe(arm, corners[i].toArray(), corners[(i + 1) % 4].toArray(), 0.016, materials.dark);
    const rotation = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(f.across, f.tangent, f.depthAxis));
    const cover = f.centre.clone().addScaledVector(f.across, side * (f.girderWidth / 2 + 0.016));
    instance(arm, cube, materials.dark, cover.toArray(), [0.024, 0.78, Math.min(f.depth * 0.55, 0.8)], rotation);
    for (const along of [-0.30, 0.30]) for (const across of [-0.28, 0.28]) {
      const p = cover.clone().addScaledVector(f.tangent, along).addScaledVector(f.depthAxis, across);
      fastener(arm, p.toArray(), 0.016, 'x');
    }
  }
  // The root feet terminate at actual radial/hoop nodes, keeping the thin panels unloaded.
  for (const side of [-1, 1]) for (const r of [11.5, 16]) {
    const angle = (side < 0 ? 14 : 16) / spokes * tau, mount = point(r, angle, backDepth(r));
    const f = armSection(0, side), foot = f.centre.clone().addScaledVector(f.depthAxis, r === 16 ? -0.7 : 0.7);
    beam(arm, foot.toArray(), mount, 0.32, materials.dark, 0.45); node(arm, mount);
  }
  // Cable tray is a separate external run, with clamps following the same smooth path.
  for (let j = 0; j < 48; j++) {
    const a = armSection(j / 48, -1), b = armSection((j + 1) / 48, -1);
    const p = f => f.centre.clone().addScaledVector(f.across, -f.girderWidth / 2 - 0.13).addScaledVector(f.depthAxis, -f.depth * 0.20);
    pipe(arm, p(a).toArray(), p(b).toArray(), 0.07, materials.cable);
    if (j % 4 === 0) beam(arm, p(a).toArray(), p(a).addScaledVector(a.across, 0.16).toArray(), 0.045, materials.hardware, 0.025);
  }
  const rootLeft = armSection(0, -1).centre, rootRight = armSection(0, 1).centre;
  // Six short actuators form the secondary positioning mount behind the reflective cap.
  const top = armSection(1), baseCentre = top.centre.clone().addScaledVector(normal, 0.05);
  const backOfSecondary = secondaryPoint(0, 0, 0.42);
  const mountingPlate = mesh(arm, new THREE.CylinderGeometry(1.18, 1.18, 0.035, 48), materials.dark, 'secondary-actuator-base-plate');
  mountingPlate.position.copy(baseCentre).addScaledVector(normal, -0.0175);
  mountingPlate.quaternion.setFromUnitVectors(up, normal);
  for (const side of [-1, 1]) for (const along of [-1, 1]) {
    const anchor = baseCentre.clone().addScaledVector(tangentX, side * 0.70).addScaledVector(tangentY, along * 0.45).addScaledVector(normal, -0.035);
    const foot = armSection(0.99, side).centre;
    beam(arm, foot.toArray(), anchor.toArray(), 0.14, materials.steel, 0.18);
  }
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * tau, b = a + (i % 2 ? -0.24 : 0.24);
    const lower = baseCentre.clone().addScaledVector(tangentX, 0.90 * Math.cos(a)).addScaledVector(tangentY, 0.90 * Math.sin(a));
    const upper = backOfSecondary.clone().addScaledVector(tangentX, 1.05 * Math.cos(b)).addScaledVector(tangentY, 1.05 * Math.sin(b));
    const socket = mesh(arm, new THREE.CylinderGeometry(0.17, 0.17, 0.07, 12), materials.hardware, 'actuator-base-socket');
    socket.position.copy(lower).addScaledVector(normal, 0.035); socket.quaternion.setFromUnitVectors(up, normal);
    pipe(arm, lower.toArray(), upper.toArray(), 0.13, materials.hardware);
    pipe(arm, lower.toArray(), lower.clone().lerp(upper, 0.55).toArray(), 0.22, materials.dark);
    mesh(arm, new THREE.SphereGeometry(0.14, 8, 6), materials.hardware, 'actuator-joint').position.copy(upper);
  }
  const receiverDeck = group('receiver-maintenance-deck', optics);
  receiverDeck.position.set(0, -23.4, -7.3);
  // Horizontal at the documented maintenance/display pose.
  receiverDeck.rotation.x = THREE.MathUtils.degToRad(D.elevationDegrees);
  platform(receiverDeck, [0, 0, 0], 5.6, 3.0, ['back', 'left', 'right']);
  for (const x of [-2.4, 2.4]) beam(optics, [x, -23.4, -7.3], (x < 0 ? rootLeft : rootRight).toArray(), 0.16, materials.dark);
  // Receiver horn looks along the actual secondary ray, not along the primary axis.
  const receiverGroup = group('receiver-feed-package', optics); receiverGroup.position.copy(receiver);
  const receiverDirection = secondaryCentre.clone().sub(receiver).normalize(); receiverGroup.quaternion.setFromUnitVectors(up, receiverDirection);
  cylinder(receiverGroup, [0, -1.35, 0], 0.48, 1.3, materials.light);
  mesh(receiverGroup, new THREE.CylinderGeometry(0.44, 0.16, 0.7, 24, 1, true), materials.receiver, 'feed-horn').position.y = -0.35;
  for (const x of [-1.75, 1.75]) { box(receiverDeck, [x, 0.86, -0.6], [0.85, 1.6, 0.85], materials.light); box(receiverDeck, [x, 0.86, -0.165], [0.57, 1.15, 0.018], materials.dark); }
  for (const x of [-0.6, 0.6]) beam(optics, [x, -23.4, -7.3], [x, -22.5, -7.3], 0.075, materials.dark);
  pipe(optics, [-1.75, -23.3, -7.5], [-1.75, -17.5, -7.5], 0.08, materials.cable);

  // Draw repeated sections with instancing; preserve groups for later azimuth/elevation motion.
  for (const batch of batches) {
    const object = new THREE.InstancedMesh(batch.geometry, batch.material, batch.matrices.length);
    object.name = 'structural-instances';
    batch.matrices.forEach((m, i) => object.setMatrixAt(i, m));
    object.instanceMatrix.needsUpdate = true; object.computeBoundingSphere(); batch.parent.add(object);
  }
  antenna.updateMatrixWorld(true);
  return antenna;
}
