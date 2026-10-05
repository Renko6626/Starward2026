import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const TAU = Math.PI * 2;
const v = (x, y, z) => new THREE.Vector3(x, y, z);
const polar = (radius, angle, z = 0) => v(Math.cos(angle) * radius, Math.sin(angle) * radius, z);

// Repeated parts share geometry and are instanced by material. A detailed ring
// therefore costs a handful of draw calls rather than one per window or bolt.
class Assembly {
  constructor(materials, geometry) {
    this.materials = materials;
    this.geometry = geometry;
    this.batches = new Map();
    this.transform = new THREE.Object3D();
  }
  part(geometry, material, position, scale = [1, 1, 1], rotation = [0, 0, 0]) {
    const key = `${geometry.uuid}/${material}`;
    if (!this.batches.has(key)) this.batches.set(key, { geometry, material: this.materials[material], matrices: [] });
    this.transform.position.copy(position);
    this.transform.scale.set(...scale);
    if (rotation.isQuaternion) this.transform.quaternion.copy(rotation);
    else this.transform.rotation.set(...rotation);
    this.transform.updateMatrix();
    this.batches.get(key).matrices.push(this.transform.matrix.clone());
  }
  box(material, position, size, rotation = [0, 0, 0], bevel = false) {
    this.part(bevel ? this.geometry.rounded : this.geometry.box, material, position, size, rotation);
  }
  beam(material, start, end, width = .08, depth = width) {
    const direction = end.clone().sub(start);
    const rotation = new THREE.Quaternion().setFromUnitVectors(v(0, 1, 0), direction.clone().normalize());
    this.box(material, start.clone().add(end).multiplyScalar(.5), [width, direction.length(), depth], rotation);
  }
  cylinder(material, position, radius, length, rotation = [Math.PI / 2, 0, 0]) {
    this.part(this.geometry.cylinder, material, position, [radius, length, radius], rotation);
  }
  torus(material, radius, tube, position, arc = TAU, rotation = [0, 0, 0]) {
    this.part(new THREE.TorusGeometry(radius, tube, 8, Math.ceil(100 * arc / TAU), arc), material, position, [1, 1, 1], rotation);
  }
  build(name) {
    const group = new THREE.Group(); group.name = name;
    for (const { geometry, material, matrices } of this.batches.values()) {
      const mesh = new THREE.InstancedMesh(geometry, material, matrices.length);
      matrices.forEach((matrix, i) => mesh.setMatrixAt(i, matrix));
      mesh.instanceMatrix.needsUpdate = true;
      mesh.castShadow = material.emissiveIntensity <= 1;
      mesh.receiveShadow = true;
      mesh.computeBoundingSphere();
      group.add(mesh);
    }
    return group;
  }
}

function ringSegment(radius, width, depth, angle) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, radius + width / 2, -angle / 2, angle / 2, false);
  shape.absarc(0, 0, radius - width / 2, angle / 2, -angle / 2, true);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth, bevelEnabled: true, bevelThickness: .045, bevelSize: .045, bevelSegments: 1, curveSegments: 3, steps: 1,
  });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

function addTruss(assembly, start, end, width = .42, steps = 8) {
  const direction = end.clone().sub(start);
  const side = new THREE.Vector3(-direction.y, direction.x, 0).normalize().multiplyScalar(width / 2);
  const a = start.clone().add(side), b = start.clone().sub(side);
  const c = end.clone().add(side), d = end.clone().sub(side);
  assembly.beam('silver', a, c, .065);
  assembly.beam('silver', b, d, .065);
  for (let i = 0; i < steps; i++) {
    const p = a.clone().lerp(c, i / steps), q = b.clone().lerp(d, (i + 1) / steps);
    assembly.beam('frame', p, q, .045);
    assembly.beam('frame', b.clone().lerp(d, i / steps), a.clone().lerp(c, (i + 1) / steps), .045);
  }
}

function createRing(materials, geometry, { radius, count, gap, depth, name, windows }) {
  const a = new Assembly(materials, geometry);
  const increment = TAU / count;
  const segment = ringSegment(radius, .86, depth, increment * .9);
  const start = .32;
  const countVisible = count - gap;
  for (let i = 0; i < countVisible; i++) {
    const angle = start + i * increment;
    a.part(segment, i % 9 === 0 ? 'red' : i % 7 === 0 ? 'silver' : 'hull', v(0, 0, 0), [1, 1, 1], [0, 0, angle]);
    for (const offset of [-.47, .47]) {
      a.box('frame', polar(radius + offset, angle), [.12, radius * increment * .96, depth + .17], [0, 0, angle], true);
    }
    // Structural rails and diagonal members sit behind the occupied modules.
    const next = angle + increment;
    if (i < countVisible - 1 || gap === 0) {
      for (const r of [radius - .57, radius + .57]) {
        a.beam('silver', polar(r, angle, -.67), polar(r, next, -.67), .075);
        a.beam('frame', polar(r, angle, -.67), polar(r, next, -.07), .05);
      }
      a.beam('frame', polar(radius - .57, angle, -.67), polar(radius + .57, next, -.67), .06);
    }
    a.box('dark', polar(radius, angle, depth / 2 + .045), [.66, radius * increment * .65, .07], [0, 0, angle]);
    if (windows) {
      for (let j = -2; j <= 2; j++) {
        const wa = angle + j * increment * .13;
        a.box((i + j) % 6 === 0 ? 'glass' : i % 11 === 0 ? 'cool' : 'warm', polar(radius, wa, depth / 2 + .093), [.24, .07, .026], [0, 0, wa]);
      }
    } else {
      a.box('silver', polar(radius, angle, depth / 2 + .095), [.3, radius * increment * .46, .08], [0, 0, angle]);
    }
    // Maintenance equipment on selected sections breaks the repeated silhouette.
    if (i % 5 === 0) {
      a.box('white', polar(radius + .8, angle, -.1), [.56, .72, .6], [0, 0, angle], true);
      a.box('gold', polar(radius + 1.07, angle, -.06), [.035, .54, .42], [0, 0, angle]);
      a.box('signal', polar(radius + 1.12, angle, .31), [.055, .12, .07], [0, 0, angle]);
      a.beam('silver', polar(radius + .8, angle, .1), polar(radius + 1.65, angle, .1), .032);
    }
  }
  // Continuous, narrow service rails define the ring without a neon outline.
  const arc = gap ? increment * (countVisible - 1) : TAU;
  a.torus('silver', radius - .43, .045, v(0, 0, depth / 2 + .12), arc, [0, 0, start]);
  a.torus('frame', radius + .45, .07, v(0, 0, -depth / 2), arc, [0, 0, start]);
  if (gap) for (const angle of [start, start + (countVisible - 1) * increment]) {
    a.box('white', polar(radius, angle), [1.3, .45, depth + .25], [0, 0, angle], true);
    a.box('cool', polar(radius, angle, depth / 2 + .15), [.65, .12, .08], [0, 0, angle]);
  }
  return a.build(name);
}

function solarWing(a, x, y, z, side) {
  const width = 3.05, length = 9.2;
  a.beam('silver', v(x, y, z), v(x + side * (width + .8), y, z), .13);
  for (let j = 0; j < 2; j++) {
    const cx = x + side * (1.05 + j * (width + .18));
    a.box('frame', v(cx, y, z), [width + .12, length + .16, .14]);
    a.box('solar', v(cx, y, z + .09), [width, length, .035]);
    a.box('solar', v(cx, y, z - .09), [width, length, .035]);
    for (let k = 0; k <= 8; k++) a.box('silver', v(cx, y - length / 2 + k * length / 8, z + .13), [width, .025, .025]);
  }
}

export function createStation(materials) {
  const geometry = {
    box: new THREE.BoxGeometry(1, 1, 1),
    rounded: new RoundedBoxGeometry(1, 1, 1, 1, .09),
    cylinder: new THREE.CylinderGeometry(1, 1, 1, 16),
  };
  const station = new THREE.Group(); station.name = 'Hifuu observatory';
  const a = new Assembly(materials, geometry);

  // Axial spine: a stack of pressure vessels, collars and exposed service bays.
  a.cylinder('frame', v(0, 0, -3), .62, 27);
  for (const z of [-12, -7.5, -3, 1.5, 6]) {
    const radius = z === -3 ? 1.3 : .99;
    a.cylinder('hull', v(0, 0, z), radius, 3.3);
    for (const offset of [-1.65, -1.32, 1.32, 1.65]) a.cylinder('silver', v(0, 0, z + offset), radius + .12, .15);
    for (let i = 0; i < 8; i++) {
      const angle = TAU * i / 8;
      a.box(i % 3 === 0 ? 'gold' : 'dark', polar(radius + .04, angle, z), [.09, .32, 1.65], [0, 0, angle]);
      a.beam('silver', polar(radius + .17, angle, z - 1.3), polar(radius + .17, angle, z + 1.3), .045);
    }
  }
  // The habitation ring turns on a fixed hub; its supports turn with it.
  const habitat = createRing(materials, geometry, { radius: 8.1, count: 52, gap: 0, depth: .98, name: 'Habitation ring', windows: true });
  const habSpokes = new Assembly(materials, geometry);
  for (let i = 0; i < 3; i++) {
    const angle = .6 + i * TAU / 3;
    addTruss(habSpokes, polar(1.2, angle, 0), polar(7.7, angle, 0), .5, 10);
    habSpokes.beam('white', polar(1.45, angle, .15), polar(7.75, angle, .15), .25, .3);
    for (let j = 0; j < 6; j++) habSpokes.box('warm', polar(2.2 + j * .8, angle, .31), [.05, .095, .025], [0, 0, angle]);
  }
  habitat.add(habSpokes.build('Habitation bridges'));
  habitat.position.z = 6.3;
  station.add(habitat);
  a.torus('gold', 1.19, .18, v(0, 0, 6.3));

  // A canted, incomplete observation ring is the main silhouette.
  const observer = new THREE.Group(); observer.name = 'Observation assembly';
  observer.position.z = -3.5; observer.rotation.set(.19, -.14, -.31);
  observer.add(createRing(materials, geometry, { radius: 13.3, count: 66, gap: 10, depth: .66, name: 'Open observation ring', windows: false }));
  const obs = new Assembly(materials, geometry);
  for (const angle of [.8, 2.95, 4.75]) {
    addTruss(obs, polar(1.45, angle, -.25), polar(12.9, angle, -.25), .75, 15);
    obs.beam('frame', polar(1.6, angle, -.9), polar(12.9, angle, -.45), .12);
    obs.box('hull', polar(9.5, angle, .1), [3.4, .48, .62], [0, 0, angle], true);
    obs.box('red', polar(10.7, angle, .43), [.4, .44, .05], [0, 0, angle]);
  }
  observer.add(obs.build('Observation support structure')); station.add(observer);

  // Scientific instruments on the ring: folded apertures and white housings.
  const instruments = new Assembly(materials, geometry);
  for (const angle of [1.45, 3.15, 4.32]) {
    const p = polar(13.35, angle, .6);
    instruments.cylinder('white', p, .64, 1.8);
    instruments.cylinder('frame', p.clone().add(v(0, 0, 1.03)), .71, .22);
    instruments.cylinder('glass', p.clone().add(v(0, 0, 1.16)), .53, .045);
    instruments.torus('gold', .56, .038, p.clone().add(v(0, 0, 1.2)));
  }
  observer.add(instruments.build('Optical instruments'));

  // A forward observation cupola and two docking arms.
  a.cylinder('silver', v(0, 0, 10), 1.3, .35);
  a.cylinder('white', v(0, 0, 10.8), 1.12, 1.3);
  a.part(new THREE.SphereGeometry(1, 12, 8, 0, TAU, 0, Math.PI / 2), 'glass', v(0, 0, 11.4), [1.13, .8, 1.13], [Math.PI / 2, 0, 0]);
  a.torus('white', 1.12, .065, v(0, 0, 11.4));
  for (let i = 0; i < 8; i++) {
    const angle = i * TAU / 8;
    a.beam('silver', polar(1.1, angle, 11.42), polar(.21, angle, 12.13), .045);
  }
  for (const side of [-1, 1]) {
    a.beam('hull', v(0, 0, 2), v(side * 3.5, 0, 2), .85, .8);
    a.cylinder('white', v(side * 3.5, 0, 2.7), .75, 2.2);
    a.torus('silver', .74, .12, v(side * 3.5, 0, 3.85));
    a.cylinder('dark', v(side * 3.5, 0, 3.9), .58, .08);
    a.box('cool', v(side * 3.5, .84, 3.5), [.26, .04, .06]);
  }

  // Rear service spine, photovoltaic arrays and radiators.
  a.box('hull', v(0, 0, -15), [2.6, 2.3, 2.8], [0, 0, 0], true);
  a.box('label', v(0, 1.165, -15), [2.32, .025, .65]);
  for (const side of [-1, 1]) {
    solarWing(a, side * 3.3, 0, -14.8, side);
    a.beam('silver', v(side * 1.1, 0, -15), v(side * 5, 0, -15), .18);
    a.box('white', v(side * 2.15, 0, -10.7), [1.75, 5.4, .17]);
    for (let i = 0; i < 18; i++) a.box('silver', v(side * 2.15, -2.5 + i * .29, -10.58), [1.6, .025, .025]);
  }
  a.beam('silver', v(0, 0, -16.4), v(0, 0, -21), .1);
  for (let i = 0; i < 6; i++) {
    const z = -17 - i * .6;
    a.beam('silver', v(-.7 + i * .07, 0, z), v(.7 - i * .07, 0, z), .035);
  }
  a.part(new THREE.SphereGeometry(1, 6, 5), 'signal', v(0, 0, -21), [.085, .085, .085]);
  // Dish antenna: a shallow lathed paraboloid, with three feed supports.
  const dishPoints = Array.from({ length: 13 }, (_, i) => new THREE.Vector2(i / 8, (i / 8) ** 2 * .22));
  const dish = new THREE.LatheGeometry(dishPoints, 32);
  a.part(dish, 'white', v(0, 2.2, -14), [1, 1, 1]);
  a.cylinder('frame', v(0, 1.65, -14), .16, 1.8, [0, 0, 0]);
  for (let i = 0; i < 3; i++) {
    const angle = i * TAU / 3;
    a.beam('silver', v(Math.cos(angle) * 1.4, 2.63, -14 + Math.sin(angle) * 1.4), v(0, 3.45, -14), .036);
  }
  station.add(a.build('Station core'));

  // A small maintenance craft supplies a human-readable scale cue.
  const craft = new Assembly(materials, geometry);
  craft.box('white', v(0, 0, 0), [.24, .15, .48], [0, 0, 0], true);
  craft.box('glass', v(0, .06, .14), [.18, .06, .12]);
  craft.box('gold', v(0, 0, -.25), [.2, .11, .035]);
  for (const side of [-1, 1]) craft.box('solar', v(side * .28, 0, -.05), [.28, .025, .28]);
  craft.box('cool', v(0, 0, -.29), [.09, .045, .07]);
  const drone = craft.build('Maintenance craft'); station.add(drone);
  station.rotation.set(.14, -.82, -.15);

  return {
    object: station,
    update(time) {
      habitat.rotation.z = time * .012;
      drone.position.set(Math.cos(time * .022 + .6) * 16.2, Math.sin(time * .022 + .6) * 16.2, 5);
      drone.rotation.z = time * .022 + .6;
      materials.signal.emissiveIntensity = 2.5 + 2.2 * Math.pow(Math.max(0, Math.sin(time * 1.8)), 14);
    },
  };
}
