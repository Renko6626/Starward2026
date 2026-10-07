import { Assembly, anchor, pipe } from './assembly.js';

export function createPropulsion({ layout, resources }) {
  const a = new Assembly(resources), w = layout.working, axis = [0, 0, Math.PI / 2];
  // Keep the tail assembly intact when the station's axial layout changes.
  const tailOffset = w.engineExit - 44, frontOffset = w.coreFront + 42;
  const tankPositions = [], enginePositions = [], front = [], rear = [];
  const mainRadialScale = w.mainNozzleDiameter / 3.6;
  const rcsRadialScale = w.rcsNozzleDiameter / 3.6;
  // Root flange and an open hexagonal rack; clear space remains between tanks.
  a.cylinder('silver', [23.3, 0, 0], 4.2, .8, axis);
  a.cylinder('dark', [24, 0, 0], 3.2, .7, axis);
  for (let i = 0; i < layout.confirmed.mainTanks; i++) {
    const t = i * Math.PI / 3, next = (i + 1) * Math.PI / 3;
    const y = w.tankCircleRadius * Math.cos(t), z = w.tankCircleRadius * Math.sin(t);
    const outer = [Math.cos(t) * 13.4, Math.sin(t) * 13.4];
    const adjacent = [Math.cos(next) * 13.4, Math.sin(next) * 13.4];
    a.beam('silver', [24.5, ...outer], [38, ...outer], .46);
    for (const x of [24.5, 38]) {
      a.beam('silver', [x, ...outer], [x, ...adjacent], .42);
      a.beam('silver', [x, 0, 0], [x, ...outer], .4);
      a.box('silver', [x, ...outer], [.32, 1.4, 1.4], [t, 0, 0]);
    }
    a.beam('frame', [24.5, ...outer], [38, ...adjacent], .16);
    a.cylinder('tank', [31, y, z], w.tankRadius, w.tankBarrelLength, axis);
    for (const x of [26.5, 35.5]) a.part(resources.geometries.sphere, 'tank', [x, y, z], [2.5, w.tankRadius, w.tankRadius]);
    for (const x of [27.5, 34.5]) {
      a.cylinder('silver', [x, y, z], w.tankRadius + .08, .32, axis);
      a.beam('frame', [x, ...outer], [x, y, z], .75);
      a.box('silver', [x, outer[0], outer[1]], [.8, 1.4, 1.6], [t, 0, 0]);
    }
    // Alternating F / O visual circuits: assignment is a drawing convention.
    const material = i % 2 ? 'oxidizerPipe' : 'fuelPipe';
    a.cylinder(material, [37.9, y, z], .45, .75, axis);
    a.box('dark', [38.2, y * .83, z * .83], [1, 1.4, 1.5], [t, 0, 0]);
    pipe(a, material, [[38, y, z], [38.4, y * .7, z * .7], [38.5, i % 2 ? 2.1 : -2.1, z * .25], [38.5, i % 2 ? 2.1 : -2.1, 0]], .19);
    tankPositions.push([31, y, z]);
    // Separate valve/electronics trays; no continuous solid platform below tanks.
    if (i % 2 === 0) {
      a.box('frame', [25, y * .58, z * .58], [2, 2, 2.7], [t, 0, 0]);
      a.box('foil', [25.2, y * .6, z * .6], [1.8, 1.7, 2.3], [t, 0, 0]);
      a.part(resources.geometries.sphere, 'silver', [26.3, y * .45, z * .45], [1, 1, 1]);
    }
  }
  for (const y of [-5.4, 5.4]) for (const z of [-5.4, 5.4]) {
    a.beam('silver', [38, 0, 0], [38, y, z], .65);
    // The four stand-off feet attach to an open local frame, which crosses
    // the existing radial thrust beam at the engine's mounting centre.
    for (const offset of [-1.25, 1.25]) {
      a.beam('silver', [38, y + offset, z - 1.25], [38, y + offset, z + 1.25], .24);
      a.beam('silver', [38, y - 1.25, z + offset], [38, y + 1.25, z + offset], .24);
    }
    a.beam('silver', [38, y - 1.25, z], [38, y + 1.25, z], .28);
    a.beam('silver', [38, y, z - 1.25], [38, y, z + 1.25], .28);
    const start = w.engineExit - tailOffset - w.mainNozzleLength;
    const mount = start - 1.25;
    // Compact engine assembly on an open stand-off; exit and rack stay in place.
    for (const dy of [-1.25, 1.25]) for (const dz of [-1.25, 1.25]) {
      a.beam('silver', [38, y + dy, z + dz], [mount, y + dy * .35, z + dz * .35], .18);
      a.box('silver', [38, y + dy, z + dz], [.2, .45, .45]);
    }
    a.box('hullShade', [mount - .15, y, z], [.16, 2.8, 2.8]);
    a.cylinder('silver', [start - .6, y, z], .48, 1.2, axis);
    a.cylinder('dark', [start - .95, y, z], .6, .22, axis);
    a.box('service', [start - .8, y + .66, z + .3], [.4, .35, .4]);
    a.part(resources.geometries.nozzle, 'dark', [start, y, z],
      [mainRadialScale, w.mainNozzleLength / 2.8, mainRadialScale], [0, 0, -Math.PI / 2]);
    a.cylinder('silver', [start + .5, y, z], .48, .12, axis);
    for (const material of ['fuelPipe', 'oxidizerPipe']) {
      const sy = material === 'fuelPipe' ? -2.1 : 2.1;
      pipe(a, material, [[38.5, sy, 0], [38.4, sy, z], [mount + .2, y + (sy > 0 ? .65 : -.65), z], [start - .2, y, z]], .06);
    }
    enginePositions.push([w.engineExit - tailOffset, y, z]);
  }
  // Single-propellant RCS has its own small storage and delivery hardware.
  for (const nominalX of [-31, 22]) {
    const x = nominalX < 0 ? nominalX + frontOffset - tailOffset : nominalX;
    const radius = w.rcsTankRadius, halfBarrel = w.rcsTankBarrelLength / 2;
    a.cylinder('foil', [x, -5.7, -1.7], radius, w.rcsTankBarrelLength, axis);
    for (const side of [-1, 1]) a.part(resources.geometries.sphere, 'foil',
      [x + side * halfBarrel, -5.7, -1.7], [.45, radius, radius]);
    for (const side of [-1, 1]) {
      a.cylinder('silver', [x + side * .5, -5.7, -1.7], radius + .04, .12, axis);
      a.beam('silver', [x + side * .5, -4.5, -1.7], [x + side * .5, -5.2, -1.7], .04);
    }
    a.box('service', [x, -5.2, .7], [.9, .55, .7]);
  }
  const dirs = [[0, 1, 0], [0, -1, 0], [0, 0, 1]];
  for (const nominalX of [-37, 37]) for (const sign of [-1, 1]) {
    const x = nominalX < 0 ? nominalX + frontOffset - tailOffset : nominalX;
    const y = sign * (x < 0 ? 6.8 : 14.3), z = -2.5;
    const face = w.rcsPodSize / 2;
    // Paired chords and a light equipment saddle expose each nozzle cluster.
    for (const dx of [-.45, .45]) {
      a.beam('silver', [x + dx, sign * 3.7, 0], [x + dx, y, z], x < 0 ? .05 : .08);
      a.beam('frame', [x + dx, sign * 4.5, -1], [x - dx, y, z], x < 0 ? .025 : .04);
    }
    a.box('silver', [x, y - sign * .45, z], [1.25, .22, 1]);
    a.box('service', [x, y - sign * .8, z], [.8, .45, .65]);
    a.box('dark', [x, y, z], [w.rcsPodSize, w.rcsPodSize, w.rcsPodSize]);
    for (const dir of dirs) {
      // A compact nozzle cluster with different transverse / axial directions.
      const rotation = dir[2] ? [Math.PI / 2, 0, 0] : dir[1] < 0 ? [Math.PI, 0, 0] : [0, 0, 0];
      a.part(resources.geometries.nozzle, 'dark', [x + (dir[2] ? .1 : 0), y + dir[1] * face, z + dir[2] * face],
        [rcsRadialScale, w.rcsNozzleLength / 2.8, rcsRadialScale], rotation);
    }
    a.part(resources.geometries.nozzle, 'dark', [x + (x < 0 ? -face : face), y, z],
      [rcsRadialScale, w.rcsNozzleLength / 2.8, rcsRadialScale], [0, 0, x < 0 ? Math.PI / 2 : -Math.PI / 2]);
    const reservoirX = x < 0 ? -31 + frontOffset - tailOffset : 22;
    const aroundX = x < 0 ? x : 39; // Aft manifold goes behind the tank end caps.
    const route = [[reservoirX, -5.7, -1.7], [aroundX, -5.7, -1.7]];
    if (sign > 0) {
      const clearance = x < 0 ? 7.6 : 16;
      route.push([aroundX, -clearance * .65, -clearance * .8], [aroundX, 0, -clearance],
        [aroundX, clearance * .75, -clearance * .7]);
    }
    route.push([aroundX, y, z]);
    if (aroundX !== x) route.push([x, y, z]);
    pipe(a, 'silver', route, .012);
    (x < 0 ? front : rear).push([x, y, z]);
  }
  const object = a.build('Fixed propulsion / six tanks and four engines');
  object.position.x = tailOffset;
  return { object, anchors: {
    tanks: tankPositions.map((p, i) => anchor(object, `Tank ${i + 1} / ${i % 2 ? 'O' : 'F'} visual circuit`, p)),
    engines: enginePositions.map((p, i) => anchor(object, `Main engine ${i + 1}`, p)),
    rcsFront: front.map((p, i) => anchor(object, `Forward RCS ${i + 1}`, p)),
    rcsRear: rear.map((p, i) => anchor(object, `Aft RCS ${i + 1}`, p)),
  } };
}
