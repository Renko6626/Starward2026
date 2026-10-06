import * as THREE from 'three';
import { Assembly, anchor, pipe } from './assembly.js';

function dockingPort(a, position, forward, radius) {
  const p = new THREE.Vector3(...position), direction = new THREE.Vector3(...forward);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
  const at = n => p.clone().addScaledVector(direction, n).toArray();
  a.cylinder('hull', at(-1.2), radius + .4, 2.6, q);
  a.cylinder('dark', at(.12), radius, .6, q);
  a.cylinder('silver', at(.5), radius + .2, .38, q);
  a.cylinder('dark', at(.76), radius - .18, .14, q);
  a.cylinder('hullShade', at(.88), radius - .45, .12, q);
  const tangent = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
  const binormal = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
  for (let i = 0; i < 8; i++) {
    const t = i * Math.PI / 4;
    const loc = p.clone().addScaledVector(direction, .55)
      .addScaledVector(tangent, Math.cos(t) * (radius + .08)).addScaledVector(binormal, Math.sin(t) * (radius + .08));
    a.part(a.resources.geometries.rounded, i % 2 ? 'silver' : 'red', loc.toArray(), [.38, .55, .42], q);
  }
  for (const sign of [-1, 1]) {
    const loc = p.clone().addScaledVector(tangent, sign * (radius + .7));
    a.box('dark', loc.toArray(), [.45, .5, .6]);
    a.part(a.resources.geometries.sphere, 'glass', loc.clone().addScaledVector(direction, .3).toArray(), [.21, .21, .21]);
  }
}

function fitArmPose(points, length) {
  const base = new THREE.Vector3(...points[0]);
  const centreline = points.slice(1).reduce((sum, p, i) =>
    sum + new THREE.Vector3(...p).distanceTo(new THREE.Vector3(...points[i])), 0);
  return points.map(p => new THREE.Vector3(...p).sub(base).multiplyScalar(length / centreline).add(base).toArray());
}

function arm(a, points, dimensions) {
  const jointRadius = dimensions.armJointDiameter / 2, boom = dimensions.armBoomWidth;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    a.part(a.resources.geometries.sphere, 'dark', p, [jointRadius * .86, jointRadius * .86, jointRadius * .86]);
    a.cylinder('silver', p, jointRadius, .32, [Math.PI / 2, 0, 0]);
    if (i === 0) continue;
    const prev = new THREE.Vector3(...points[i - 1]), next = new THREE.Vector3(...p);
    const dir = next.clone().sub(prev).normalize();
    const from = prev.clone().addScaledVector(dir, jointRadius), to = next.clone().addScaledVector(dir, -jointRadius);
    const rotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    const cableOffset = new THREE.Vector3(boom / 2 + .03, 0, 0).applyQuaternion(rotation);
    a.beam('hull', from.toArray(), to.toArray(), boom, boom);
    a.beam('dark', from.clone().add(cableOffset).toArray(), to.clone().add(cableOffset).toArray(), .06);
    const mid = from.add(to).multiplyScalar(.5);
    a.box('red', mid.toArray(), [.42, .15, .42], rotation);
  }
  // Both ends have locking / grapple interfaces for a transfer-base concept.
  for (const p of [points[0], points.at(-1)]) {
    a.cylinder('dark', p, .36, .45);
    for (const dz of [-.24, .24]) a.box('silver', [p[0], p[1] - .29, p[2] + dz], [.16, .4, .12]);
    a.box('service', [p[0] + .4, p[1], p[2]], [.23, .28, .28]);
    a.part(a.resources.geometries.sphere, 'glass', [p[0] + .45, p[1] + .17, p[2]], [.08, .08, .08]);
  }
}

export function createOperations({ layout, resources }) {
  const a = new Assembly(resources), w = layout.working;
  const frontOffset = w.coreFront + 42;
  const crew = [w.coreFront - frontOffset, 0, 0], cargo = [-26, 0, 9.6];
  dockingPort(a, crew, [-1, 0, 0], 2.2);
  a.cylinder('hullShade', [-26, 0, 6.5], 2.7, 5.5, [Math.PI / 2, 0, 0]);
  dockingPort(a, cargo, [0, 0, 1], 2.5);
  a.box('service', [-24, -3.5, 7], [3.2, 1.4, 4]);
  // Fixed-group rails: one cargo carriage and one inspection carriage.
  for (const z of [-6.3, 6.3]) {
    for (const offset of [-.55, .55]) a.beam('silver', [-35, -6.7, z + offset], [20, -6.7, z + offset], .2);
    for (let x = -35; x <= 20; x += 5.5) {
      a.beam('frame', [x, -3.8, Math.sign(z) * 3], [x, -6.7, z], .32);
      a.box('silver', [x, -6.8, z], [1.2, .25, 1.6]);
    }
    pipe(a, 'silver', [[-35, -7.2, z], [-10, -7.2, z], [20, -7.2, z]], .09);
    // Empty transfer bases remain visibly separate from occupied carriages.
    for (const x of [-33, 15]) {
      a.box('dark', [x, -7, z], [1.55, .4, 1.5]);
      a.cylinder('red', [x, -7.35, z], .45, .3);
      a.box('service', [x + .9, -7.15, z], [.3, .35, .5]);
    }
  }
  const assemblyPose = fitArmPose(w.assemblyArmPose, w.assemblyArmLength);
  const inspectionPose = fitArmPose(w.inspectionArmPose, w.inspectionArmLength);
  const assemblyBase = assemblyPose[0], inspectionBase = inspectionPose[0];
  for (const p of [assemblyBase, inspectionBase]) {
    a.box('silver', p, [1.8, .65, 1.55]);
    // Bridge the compact carriage to the existing cross-rail mounting plate.
    a.box('silver', [p[0], p[1] + .45, p[2]], [1.4, .3, 1.3]);
    a.box('service', [p[0], p[1] - .4, p[2]], [1, .3, 1]);
  }
  arm(a, assemblyPose, w);
  arm(a, inspectionPose, w);
  // Stowage trays, capture fittings and spares tied into the fixed rail supports.
  for (const x of [-30, -17]) {
    a.box('frame', [x, -4.7, 10.3], [4.5, .35, 3.3]);
    a.beam('silver', [x, -6.7, 6.3], [x, -4.7, 10.3], .35);
    a.box('foil', [x, -4, 10.3], [2.6, 1.1, 2.3]);
    for (const dx of [-1.8, 1.8]) a.box('silver', [x + dx, -4.2, 10.3], [.35, .4, .8]);
  }
  // Raised pedestal and separately orientable dish assembly.
  const dishPosition = [-28.5, 15, -2];
  a.beam('silver', [-28.5, 4.6, -2], dishPosition, .8);
  a.beam('frame', [-32.5, 4, -2], [-28.5, 12, -2], .4);
  a.cylinder('dark', [-28.5, 14, -2], 1.2, 1.3);
  a.box('service', [-29.2, 11, -3], [1.4, 2.1, 1.4]);
  const object = a.build('Fixed docking, mobile work systems and communications');
  object.position.x = frontOffset;
  const pivot = new THREE.Group(); pivot.name = 'Pointable main dish / +Z boresight';
  pivot.position.set(...dishPosition); object.add(pivot);
  const dish = new Assembly(resources), r = w.antennaDiameter / 2;
  const profile = [];
  for (let i = 0; i <= 20; i++) { const x = r * i / 20; profile.push(new THREE.Vector2(x, x * x / 15.6)); }
  for (let i = 20; i >= 0; i--) { const x = r * i / 20; profile.push(new THREE.Vector2(x, x * x / 15.6 - .12)); }
  const shape = new THREE.LatheGeometry(profile, 64);
  dish.part(shape, 'dish', [0, 0, 0], [1, 1, 1], [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 12; i++) {
    const t = i * Math.PI / 6;
    dish.beam('silver', [0, 0, -.24], [r * Math.cos(t), r * Math.sin(t), r * r / 15.6 - .18], .12);
    if (i % 4 === 0) dish.beam('frame', [r * .9 * Math.cos(t), r * .9 * Math.sin(t), 1.05], [0, 0, 3.8], .095);
  }
  dish.cylinder('dark', [0, 0, -.55], 1.05, .9, [Math.PI / 2, 0, 0]);
  dish.cylinder('silver', [0, 0, 3.8], .33, .6, [Math.PI / 2, 0, 0]);
  pivot.add(dish.build('Main dish with feed and back ribs'));
  const aux = new Assembly(resources);
  for (const x of [-34, 13]) {
    aux.beam('silver', [x, 4.5, 0], [x, 8, 0], .13);
    aux.box('dark', [x, 7.8, 0], [.9, .45, 1.3]);
    aux.beam('silver', [x - 1.2, 8, 0], [x + 1.2, 8, 0], .07);
    aux.box('glass', [x - 1, 5.2, 1], [.65, .6, .65]);
  }
  object.add(aux.build('Fixed auxiliary antenna and navigation sensors'));
  return { object, anchors: {
    crewDock: anchor(object, 'Crew docking', crew), cargoDock: anchor(object, 'Cargo and quarantine', cargo),
    assemblyArm: anchor(object, 'Cargo / assembly arm on fixed carriage', assemblyPose.at(-1)),
    inspectionArm: anchor(object, 'Inspection arm / fixed-side rotary equipment', inspectionPose[2]),
    comms: anchor(object, 'Main communications dish', dishPosition),
  }, aimAntennaAt(worldTarget) {
    object.updateWorldMatrix(true, true);
    pivot.lookAt(worldTarget);
  } };
}
