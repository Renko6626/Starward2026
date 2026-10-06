import { Assembly, anchor, arcGeometry, polar, radialTruss, crewLift } from './assembly.js';

const offsetAt = (x, radius, angle, tangent = 0) => {
  const p = polar(x, radius, angle);
  p[1] -= Math.sin(angle) * tangent; p[2] += Math.cos(angle) * tangent;
  return p;
};

function liquidReserve(a, w, angle, x, radius, mount) {
  const tank = w.counterTankRadius, halfBarrel = w.counterTankBarrelLength / 2;
  const axis = [0, 0, Math.PI / 2], sign = Math.sign(x);
  a.cylinder('reserveTank', polar(x, radius, angle), tank, w.counterTankBarrelLength, axis);
  for (const dx of [-halfBarrel, halfBarrel])
    a.part(a.resources.geometries.sphere, 'reserveTank', polar(x + dx, radius, angle), [w.counterTankCapDepth, tank, tank]);
  // Each small tank is removable from its cradle. Offset standoffs pass beside
  // the lower tank row rather than through it on their way to the inner chord.
  for (const dx of [-.62, .62]) {
    a.cylinder('silver', polar(x + dx, radius, angle), tank + .035, .1, axis);
    for (const side of [-1, 1]) {
      const saddle = offsetAt(x + dx, radius - tank, angle, side * .92);
      a.beam('silver', polar(x + dx, radius - tank, angle), saddle, .12);
      const foot = offsetAt(x + dx, w.counterInnerRadius, angle, side * .92);
      a.beam('frame', saddle, foot, .12); mount(foot);
    }
  }
  const end = halfBarrel + w.counterTankCapDepth;
  a.cylinder('silver', polar(x + sign * (end + .08), radius, angle), .12, .16, axis);
  a.box('service', polar(x + sign * (end + .2), radius, angle), [.16, .22, .25], [angle, 0, 0]);
  // Both axial rows feed into the gap between their inward-facing end caps.
  const feed = x - sign * end;
  a.beam('reservePipe', polar(feed, radius, angle), polar(0, radius, angle), .055);
  a.box('service', polar(feed / 2, radius, angle), [.1, .15, .15], [angle, 0, 0]);
  if (x > 0) {
    a.beam('reservePipe', polar(0, radius, angle), polar(0, w.counterInnerRadius - .3, angle), .055);
    a.beam('reservePipe', polar(0, w.counterInnerRadius - .3, angle), polar(-2.8, w.counterInnerRadius - .3, angle), .055);
  }
}

function storagePod(a, w, angle, shell, facePlate, outerPlate, occupied, mount) {
  const r = w.counterStorageRadius, face = w.counterPodAxialWidth / 2;
  const at = (x, dr = 0, dt = 0) => offsetAt(x, r + dr, angle, dt);
  a.part(shell, 'pressureHull', [0, 0, 0], [1, 1, 1], [angle, 0, 0]);
  const arc = w.counterPodArcLength / r;
  for (const side of [-1, 1]) for (const dt of [-1.5, -.5, .5, 1.5])
    a.part(facePlate, occupied ? (dt > 0 ? 'hullPanel' : 'hull') : 'reserveCargo',
      [side * (face + .04), 0, 0], [1, 1, 1], [angle + dt * arc / 4, 0, 0]);
  for (const x of [-1.15, 1.15]) for (const dt of [-1, 0, 1])
    a.part(outerPlate, occupied ? 'hull' : 'reserveCargo', [x, 0, 0], [1, 1, 1], [angle + dt * arc / 3, 0, 0]);
  const ends = [-1, 1].map(sign => angle + sign * w.counterPodArcLength / (2 * r));
  for (const t of ends) {
    for (const x of [-face + .2, face - .2]) {
      a.beam('silver', polar(x, r - 1.8, t), polar(x, r + 1.8, t), .2);
      const foot = polar(x, w.counterInnerRadius, t);
      a.beam('frame', foot, polar(x, r - 1.8, t), .24); mount(foot);
    }
    for (const dr of [-1.8, 1.8]) a.beam('silver', polar(-face + .2, r + dr, t), polar(face - .2, r + dr, t), .2);
  }
  a.box(occupied ? 'service' : 'frame', at(-face - .12, -1.05), [.1, .18, w.counterPodArcLength * .66], [angle, 0, 0]);
  // Closed maintenance hatch, thermal equipment and cartridge receiving neck.
  a.box('silver', at(-face - .05), [.18, 1.9, 1.6], [angle, 0, 0]);
  a.box('dark', at(-face - .17), [.1, 1.6, 1.3], [angle, 0, 0]);
  a.box('hullShade', at(-face - .24), [.08, 1.4, 1.1], [angle, 0, 0]);
  a.box('silver', at(-face - .16, 1.05), [.15, .6, 1.6], [angle, 0, 0]);
  a.box(occupied ? 'workLabel' : 'cargoLabel', at(-face - .25, 1.05), [.06, .5, 1.45], [angle, 0, 0]);
  if (occupied) for (const dt of [-8, -5.5, 5.5, 8]) {
    a.box('silver', at(-face - .04, -.25, dt), [.16, .85, 1.25], [angle, 0, 0]);
    a.box('dark', at(-face - .14, -.25, dt), [.08, .7, 1.05], [angle, 0, 0]);
    a.box('glass', at(-face - .19, -.25, dt), [.05, .5, .85], [angle, 0, 0]);
    a.box('hullShade', at(-face - .2, .44, dt), [.08, .45, 1.25], [angle, 0, 0]);
    a.box('silver', at(-face - .12, .44, dt), [.18, .12, 1.1], [angle, 0, 0]);
  }
  for (const dt of [-3.5, 3.5]) {
    a.beam('silver', at(-face - .2, -.7, dt), at(-face - .2, .7, dt), .08);
    for (const dr of [-.7, .7]) a.beam('silver', at(-face - .02, dr, dt), at(-face - .2, dr, dt), .08);
    a.box('service', at(face + .06, .2, dt), [.3, .9, .8], [angle, 0, 0]);
  }
  a.box('hullShade', polar(-.65, w.counterInnerRadius + .45, angle), [1.8, 2.5, 2], [angle, 0, 0]);
  a.box('dark', at(-.65, -2.08), [1.3, .12, 1.35], [angle, 0, 0]);
}

// Pallet-sized bundles contain smaller stores. Different equipment and media
// share a rack interface, while labels and hardware make their roles readable.
function bulkReserve(a, w, angle, kind, positions, mount) {
  const at = (x, r, dt = 0) => offsetAt(x, r, angle, dt);
  const r = w.counterStorageRadius, material = kind === 'substrate' ? 'foil' : kind === 'spares' ? 'service' : 'reserveCargo';
  for (const x of [-2.9, 2.9]) for (const dt of [-2.85, 2.85]) {
    const foot = at(x, w.counterInnerRadius, dt);
    a.beam('frame', foot, at(x, r + 1.8, dt), .18); mount(foot);
    a.beam('silver', at(x, r - 1.6, dt), at(x, r + 1.6, dt), .13);
  }
  for (const x of [-1.6, 1.6]) for (const dr of [-1, 1]) for (const dt of [-1.5, 1.5]) {
    a.box(material, at(x, r + dr, dt), [2.5, 1.15, 2.1], [angle, 0, 0]);
    positions.push(at(x, r + dr, dt));
    a.box('silver', at(x, r + dr - .65, dt), [2.7, .15, 2.3], [angle, 0, 0]);
    for (const dx of [-.85, .85]) a.box('silver', at(x + dx, r + dr + .6, dt), [.12, .08, 2.15], [angle, 0, 0]);
    if (kind === 'spares') {
      for (const d of [-.28, 0, .28]) a.box('dark', at(x - Math.sign(x) * 1.26, r + dr + d, dt), [.06, .07, 1.4], [angle, 0, 0]);
      a.box('silver', at(x + Math.sign(x) * 1.29, r + dr, dt), [.1, .18, .55], [angle, 0, 0]);
    } else {
      for (const d of [-.5, .5]) a.box('frame', at(x + Math.sign(x) * 1.28, r + dr, dt + d), [.06, 1, .07], [angle, 0, 0]);
    }
  }
  for (const x of [-2.9, 2.9]) for (const r0 of [r - 1.6, r + 1.6])
    a.beam('silver', at(x, r0, -2.85), at(x, r0, 2.85), .16);
  for (const x of [-2.9, 2.9]) for (const r0 of [r - 1.65, r + .35])
    a.beam('silver', at(x, r0, -2.85), at(x, r0, 2.85), .16);
  a.box(kind === 'substrate' ? 'substrateLabel' : kind === 'spares' ? 'sparesLabel' : 'cargoLabel',
    at(-w.counterDepth / 2 - .12, r), [.06, .5, 1.5], [angle, 0, 0]);
  for (const dt of [-.5, .5]) a.beam('frame', at(-2.9, r - 1.6, dt), at(-w.counterDepth / 2 - .1, r, dt), .13);
}

export function createCounterRing({ layout, resources }) {
  const a = new Assembly(resources), w = layout.working;
  const outer = layout.confirmed.counterDiameter / 2 - .2, inner = w.counterInnerRadius;
  const depth = w.counterDepth / 2, count = w.counterStorageBays, pitch = Math.PI * 2 / count;
  const liquidPositions = [], dryPositions = [], servicePositions = [], podPositions = [], workPositions = [], bulkPositions = [];
  const floorBeams = new Set();
  const mount = foot => {
    const t = Math.atan2(foot[2], foot[1]), bayAngle = Math.round(t / pitch) * pitch;
    // The ring chords are straight, not circular. Intersect the radial foot
    // direction with the real polygon edge, then span both axial chords.
    const chordRadius = inner * Math.cos(pitch / 2) / Math.cos(t - bayAngle);
    const key = t.toFixed(7);
    if (!floorBeams.has(key)) {
      a.beam('frame', polar(-depth, chordRadius, t), polar(depth, chordRadius, t), .18);
      floorBeams.add(key);
    }
    a.beam('silver', foot, polar(foot[0], chordRadius, t), .16);
  };

  for (let i = 0; i < count; i++) {
    const angle = i * pitch, start = angle - pitch / 2, end = angle + pitch / 2;
    for (const x of [-depth, depth]) for (const r of [inner, outer])
      a.beam('silver', polar(x, r, start), polar(x, r, end), .28);
    for (const r of [inner, outer]) {
      a.beam('frame', polar(-depth, r, start), polar(depth, r, start), .2);
      a.beam('frame', polar(-depth, r, start), polar(depth, r, end), .15);
    }
    for (const x of [-depth, depth]) a.beam('frame', polar(x, inner, start), polar(x, outer, start), .2);
    if (i % 8 === 0 || i % 8 === 3) {
      // Only two bays per sector hold liquid; six small tanks in each bay.
      for (const dx of [-1.5, 1.5]) for (const dr of [0]) for (const dt of [-2, 0, 2]) {
        const t = angle + dt / w.counterStorageRadius, r = w.counterStorageRadius + dr;
        liquidReserve(a, w, t, dx, r, mount); liquidPositions.push(polar(dx, r, t));
      }

      a.box('waterLabel', polar(-depth - .12, w.counterStorageRadius, angle), [.06, .5, 1.35], [angle, 0, 0]);
      for (const dt of [-.4, .4]) a.beam('frame', offsetAt(-2.8, inner, angle, dt), offsetAt(-depth - .1, w.counterStorageRadius, angle, dt), .12);
    } else if (i % 8 < 5) {
      const kind = i % 8 === 1 ? 'substrate' : i % 8 === 2 ? 'spares' : 'consumables';
      bulkReserve(a, w, angle, kind, dryPositions, mount); bulkPositions.push({ kind, position: polar(0, w.counterStorageRadius, angle) });
    }
  }
  const podShell = arcGeometry(w.counterStorageRadius, w.counterPodAxialWidth,
    w.counterPodRadialHeight, w.counterPodArcLength / w.counterStorageRadius, .65, 16);
  const podFacePlate = arcGeometry(w.counterStorageRadius, .1, 2.55,
    w.counterPodArcLength / w.counterStorageRadius / 4 - .018, .035, 8);
  const podOuterPlate = arcGeometry(w.counterStorageRadius + w.counterPodRadialHeight / 2 + .01,
    2.15, .07, w.counterPodArcLength / w.counterStorageRadius / 3 - .018, .025, 8);
  const railRadius = inner - 1.25;
  const rails = [-.45, .45].map(dr => arcGeometry(railRadius + dr, .16, .16, Math.PI / 2 - .11, .04, 24));
  for (let i = 0; i < 4; i++) {
    const angle = (w.counterPodCentreBay + i * 8) * pitch;
    radialTruss(a, angle, 5.6, inner, 0, 2.2, 1.3, 7);
    const occupied = w.counterWorkPodIndices.includes(i);
    storagePod(a, w, angle, podShell, podFacePlate, podOuterPlate, occupied, mount); podPositions.push(polar(-w.counterPodAxialWidth / 2 - .3, w.counterStorageRadius, angle));
    if (occupied) {
      workPositions.push(polar(-w.counterPodAxialWidth / 2 - .3, w.counterStorageRadius, angle));
      crewLift(a, angle, { x: 0, inner: w.counterCrewInnerRadius, outer: inner + .6,
        carRadius: i === 0 ? 24 : 18, trussDepth: 2.2, trussWidth: 1.3 });
      a.beam('hullShade', polar(w.counterTransferX + 1.4, w.counterTransferRadius, angle), polar(-1.9, w.counterCrewInnerRadius, angle), 2.05, 2.1);
      a.beam('hullShade', polar(-1.9, w.counterCrewInnerRadius, angle), polar(0, w.counterCrewInnerRadius, angle), 2.05, 2.1);
    }
    for (const x of [-depth, depth]) for (const r of [inner, outer]) {
      a.beam('silver', polar(Math.sign(x) * 2.2, inner - 3.5, angle), polar(x, r, angle), .3);
      a.box('silver', polar(x, r, angle), [.25, .3, 1], [angle, 0, 0]);
    }
    // Small cargo and fluid routes remain separate from the crew shaft; their
    // interfaces stop at the hub service equipment on this rotating group.
    const cargoX = occupied ? 1.7 : -.65, fluidX = -1.5;
    a.beam('service', polar(cargoX, 6.5, angle), polar(cargoX, w.counterStorageRadius - w.counterPodRadialHeight / 2 + .2, angle), .7, .85);
    a.beam('silver', polar(fluidX, 6.5, angle), polar(fluidX, inner - .3, angle), .13);
    for (let j = 0; j < 4; j++) a.beam('reservePipe', polar(-2.8, inner - .3, (j + i * 8) * pitch), polar(-2.8, inner - .3, (j + 1 + i * 8) * pitch), .1);
    const sectorEnd = (4 + i * 8) * pitch;
    a.beam('reservePipe', polar(-2.8, inner - .3, sectorEnd), polar(-2.8, inner - .3, angle), .1);
    a.box('service', polar(-2.8, inner - .3, angle), [.5, .5, .6], [angle, 0, 0]);
    a.beam('reservePipe', polar(-2.8, inner - .3, angle), polar(fluidX, inner - .3, angle), .1);
    // Local rotating tracks carry a small parked cart, not a fixed arm trying
    // to catch a passing storage unit. Empty grapple bases remain separate.
    for (const rail of rails) a.part(rail, 'silver', [-depth - .35, 0, 0], [1, 1, 1], [angle, 0, 0]);
    for (const dt of [-.45, 0, .45]) a.beam('frame', polar(-depth, inner, angle + dt), polar(-depth - .35, railRadius, angle + dt), .18);
    const cartAngle = angle + .28, cartX = -depth - .6;
    a.box('silver', polar(cartX, railRadius, cartAngle), [.6, 1.25, 1.5], [cartAngle, 0, 0]);
    a.box('silver', polar(cartX - .34, railRadius, cartAngle), [.2, .7, .9], [cartAngle, 0, 0]);
    a.box('reserveCargo', polar(cartX - .65, railRadius, cartAngle), [.8, .75, .9], [cartAngle, 0, 0]);
    a.box('dark', polar(cartX, railRadius, angle), [.55, 1.1, 1.5], [angle, 0, 0]);
    a.cylinder('red', polar(cartX - .4, railRadius, angle), .38, .3, [0, 0, Math.PI / 2]);
    servicePositions.push(polar(cartX - .6, railRadius, angle));
  }
  a.cylinder('frame', [0, 0, 0], 5.8, 3.6, [0, 0, Math.PI / 2]);
  for (const x of [-1.9, 1.9]) {
    a.cylinder('silver', [x, 0, 0], 6, .4, [0, 0, Math.PI / 2]);
    for (let i = 0; i < 8; i++) a.box('service', polar(x, 6.1, i * Math.PI / 4), [.7, .7, 1], [i * Math.PI / 4, 0, 0]);
  }
  // Mechanical cradle and separately owned pressure-tight transfer cabin.
  const tx = w.counterTransferX, tr = w.counterTransferRadius;
  for (const r of [tr - 1.45, tr + 1.45]) {
    const guide = arcGeometry(r, .24, .18, Math.PI * 2, .04, 96);
    a.part(guide, 'silver', [tx + 1.6, 0, 0]);
  }
  for (let i = 0; i < 8; i++) {
    const t = i * Math.PI / 4;
    a.beam('frame', polar(-2.05, 5.85, t), polar(tx + 1.6, tr - 1.45, t), .2);
    a.beam('frame', polar(tx + 1.6, tr - 1.45, t), polar(tx + 1.6, tr + 1.45, t), .2);
  }
  const cabin = new Assembly(resources), cabinAngle = w.counterPodCentreBay * pitch;
  cabin.box('hullShade', polar(tx, tr, cabinAngle), [2.9, 2.8, 2.4], [cabinAngle, 0, 0]);
  for (const sign of [-1, 1]) {
    cabin.cylinder('silver', polar(tx + sign * 1.55, tr, cabinAngle), .99, .15, [0, 0, Math.PI / 2]);
    cabin.cylinder('dark', polar(tx + sign * 1.63, tr, cabinAngle), .82, .06, [0, 0, Math.PI / 2]);
    cabin.box('hull', polar(tx + sign * 1.68, tr, cabinAngle), [.06, 1.18, 1.05], [cabinAngle, 0, 0]);
  }
  for (const r of [tr - 1.45, tr + 1.45]) cabin.box('dark', polar(tx + 1.6, r, cabinAngle), [.4, .3, .65], [cabinAngle, 0, 0]);
  const transferCabin = cabin.build('Counter independent transfer cabin / synchronized departure pose');
  transferCabin.position.x = w.counterX;
  const object = a.build('Material reserve ring / independent reverse rotation'); object.position.x = w.counterX;
  const serviceNodes = servicePositions.map((p, i) => anchor(object, `Reserve-ring transfer base ${i + 1}`, p));
  return { object, transferCabin, anchors: {
    counterRing: anchor(object, 'Material reserves / balancing rotor', polar(-depth - .5, outer, 0)),
    transfer: serviceNodes[0], serviceNodes,
    workPods: workPositions.map((p, i) => anchor(object, `Counter daily work pod ${i + 1}`, p)),
    bulkReserves: bulkPositions.map((p, i) => anchor(object, `${p.kind} reserve module ${i + 1}`, p.position)),
    storagePods: podPositions.map((p, i) => anchor(object, `Reserve storage pod ${i + 1}`, p)),
    liquidReserves: liquidPositions.map((p, i) => anchor(object, `Isolated reserve-liquid tank ${i + 1}`, p)),
    dryReserves: dryPositions.map((p, i) => anchor(object, `Small sealed cargo cartridge ${i + 1}`, p)),
  } };
}
