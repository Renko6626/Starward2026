import { Assembly, anchor, arcGeometry, polar, radialTruss, crewLift } from './assembly.js';

// Exterior study of a pressure-tight car in a vented guide shaft. This is a
// departure/travel pose, not an animated or permanently sealed rotary passage.
function crewAccess(resources, w, angle, index) {
  const a = new Assembly(resources), x = w.mainAccessShaftX;
  const at = (axial, r, tangent = 0) => {
    const p = polar(axial, r, angle);
    p[1] -= Math.sin(angle) * tangent; p[2] += Math.cos(angle) * tangent;
    return p;
  };
  const inner = w.mainAccessInnerRadius, outer = w.mainAccessOuterRadius;
  const carRadius = index === 0 ? 23.8 : 15.8;
  crewLift(a, angle, { x, inner, outer, carRadius, trussDepth: 4.2, trussWidth: 1.6 });
  // Rotating-side receiving neck. The independently mounted transfer cabin is
  // parked here in the synchronized departure pose, with its door closed.
  const tx = w.mainTransferX, tr = w.mainTransferRadius;
  a.beam('hullShade', at(tx + 1.4, tr), at(-4.5, inner), 2.05, 2.1);
  a.beam('hullShade', at(-4.5, inner), at(x, inner), 2.05, 2.1);
  for (const r of [tr - 1.45, tr + 1.45])
    a.beam('silver', at(-5.5, r), at(tx + 1.4, r), .06);
  // Entry vestibule embeds into the existing junction pressure envelope.
  a.box('hull', at(x, outer + .6), [3, 3.1, 3.2], [angle, 0, 0]);
  a.box('dark', at(x, outer - 1.02), [2.45, .16, 2.35], [angle, 0, 0]);
  a.box('hullShade', at(x, outer - 1.12), [1.9, .08, 1.7], [angle, 0, 0]);
  // Axial branches join both service bands inside the existing shell. No new
  // external circumferential pressure ring is introduced.
  const landingRadius = outer + 1.2;
  for (const side of [-1, 1]) {
    a.beam('hullShade', at(x, landingRadius), at(side * 7.8, landingRadius), 1.9, 2.1);
    a.box('hull', at(side * 8.2, landingRadius + .3), [1.2, 2.5, 3], [angle, 0, 0]);
    a.box('silver', at(side * 9.15, landingRadius + .8), [.2, 2.2, 2], [angle, 0, 0]);
    a.box('dark', at(side * 9.29, landingRadius + .8), [.1, 1.7, 1.5], [angle, 0, 0]);
    a.box('hullShade', at(side * 9.36, landingRadius + .8), [.08, 1.45, 1.25], [angle, 0, 0]);
    a.box('crewLabel', at(side * 9.45, landingRadius + 2.5), [.06, .6, 1.6], [angle, 0, 0]);
    for (const dt of [-1.2, 1.2]) a.box('silver', at(side * 9.34, landingRadius + .8, dt), [.18, .25, .4], [angle, 0, 0]);
  }
  const object = a.build(`Main crew lift ${index + 1} / sealed car and isolated landings`);
  return { object, landing: anchor(object, `Main crew landing ${index + 1}`, at(-9.6, landingRadius + .8)),
    car: anchor(object, `Main sealed lift car ${index + 1}`, at(x - 1.3, carRadius)) };
}

export function createMainRing({ layout, resources }) {
  const { mainOuterRadius: outer, mainSpokes } = layout.confirmed;
  const w = layout.working, radius = outer - w.mainRadialEnvelope / 2;
  // Keep the service fittings tied to the shell when its radius changes; the
  // hub and inboard shaft ends retain their existing radius.
  const ringOffset = outer - 50;
  const ringAt = (x, r, t) => polar(x, r + ringOffset, t);
  const a = new Assembly(resources), pitch = Math.PI * 2 / w.mainSegments;
  const shell = arcGeometry(radius, w.mainAxialEnvelope, w.mainRadialEnvelope, pitch - .06, 2);
  const joint = arcGeometry(radius, 16.8, 10.5, .066, 1.8, 5);
  const plate = arcGeometry(radius, .13, 7, (pitch - .06) / 3, .05, 8);
  const stripe = arcGeometry(radius + 3.8, .15, .48, pitch - .09, .04, 12);
  const outerPlate = arcGeometry(outer + .01, 4.5, .08, (pitch - .08) / 3 - .014, .025, 8);
  const rails = [-.65, .65].map(offset => arcGeometry(radius + offset, .22, .22, pitch - .06, .08, 12));
  const anchors = { serviceNodes: [], crewLandings: [] };
  const serviceAngles = [], crewAngles = [];
  for (let i = 0; i < w.mainSegments; i++) {
    const angle = i * pitch;
    a.part(shell, 'pressureHull', [0, 0, 0], [1, 1, 1], [angle, 0, 0]);
    a.part(joint, 'dark', [0, 0, 0], [1, 1, 1], [angle + pitch / 2, 0, 0]);
    for (const side of [-1, 1]) {
      // Local shield panels and service strips on both axial faces.
      for (let panel = -1; panel <= 1; panel++) a.part(plate,
        (i + panel + 1) % 7 === 0 ? 'hullWarm' : (i + panel + 1) % 3 === 0 ? 'hullPanel' : 'hull',
        [side * 9.04, 0, 0], [1, 1, 1], [angle + panel * (pitch - .06) / 3, 0, 0]);
      for (const dt of [-1, 1]) {
        const t = angle + dt * (pitch - .06) / 6;
        a.beam('frame', polar(side * 9.12, radius - 3.4, t), polar(side * 9.12, radius + 3.4, t), .025);
      }
      for (const dr of [-3.3, 3.3]) for (const dt of [-1.5, -.5, .5, 1.5]) {
        const t = angle + dt * (pitch - .06) / 3;
        a.cylinder('silver', polar(side * 9.13, radius + dr, t), .08, .11, [0, 0, Math.PI / 2]);
      }
      a.part(stripe, i % 4 === 0 ? 'red' : 'service', [side * 9.14, 0, 0], [1, 1, 1], [angle, 0, 0]);
      // Window, protective shutter and sealed sample port, all small exterior fittings.
      const frameAt = polar(side * 9.2, radius - .3, angle);
      a.box('dark', frameAt, [.3, 2.1, 4.4], [angle, 0, 0]);
      a.box('glass', polar(side * 9.39, radius - .3, angle), [.12, 1.5, 3.6], [angle, 0, 0]);
      for (const dz of [-.65, .65]) a.box('silver', polar(side * 9.5, radius - .3, angle + dz / radius), [.15, 1.65, .09], [angle, 0, 0]);
      a.box('hullShade', polar(side * 9.46, radius + 1.8, angle), [.22, 1.35, 4.3], [angle, 0, 0]);
      a.box('service', polar(side * 9.32, radius - 2.5, angle + .08), [.6, 1.2, 1.5], [angle, 0, 0]);
      a.cylinder('silver', polar(side * 9.75, radius - 2.5, angle + .08), .36, .4, [0, 0, Math.PI / 2]);
    }
    // Replace a broad moulded-looking outer surface with separate shield
    // panels attached to the pressure shell, exposing metal between them.
    for (const x of [-4.8, 0, 4.8]) for (const dt of [-1, 0, 1])
      a.part(outerPlate, (i + dt + 1) % 5 === 0 ? 'hullPanel' : 'hull',
        [x, 0, 0], [1, 1, 1], [angle + dt * (pitch - .08) / 3, 0, 0]);
    for (const sign of [-1, 1]) {
      const t = angle + sign * (pitch / 2 - .055);
      a.beam('silver', polar(-7, outer + .02, t), polar(7, outer + .02, t), .025);
    }
    // End frames, fastening plates and segmented circumferential members lie
    // inside the same radial band as the pressure shell, not on a second ring.
    const t = angle + pitch / 2;
    // Exposed circumferential truss bays alternate with hull segments. The
    // sealed joint lies underneath these bays within the same radial band as the enlarged shell.
    for (const x of [-9.1, 9.1]) {
      for (const r of [41.5, 47.7].map(r => r + ringOffset)) a.beam('silver', polar(x, r, t - .032), polar(x, r, t + .032), .14);
      for (const dt of [-.032, .032]) a.beam('silver', ringAt(x, 41.5, t + dt), ringAt(x, 47.7, t + dt), .14);
      a.beam('frame', ringAt(x, 41.5, t - .032), ringAt(x, 47.7, t + .032), .08);
      a.beam('frame', ringAt(x, 47.7, t - .032), ringAt(x, 41.5, t + .032), .08);
    }
    for (const side of [-1, 1]) {
      a.beam('silver', ringAt(side * 8.2, 40.3, t), ringAt(side * 8.2, 48.7, t), .55, .7);
      for (const r of [40.5, 48.4].map(r => r + ringOffset)) {
        a.beam('silver', polar(-8.2, r, t), polar(8.2, r, t), .46);
        a.box('silver', polar(side * 8.7, r, t), [.22, 1.5, 1.7], [t, 0, 0]);
        for (const offset of [-.01, .01]) a.cylinder('dark', polar(side * 8.92, r, t + offset), .13, .12, [0, 0, Math.PI / 2]);
      }
    }
    // Each fourth junction is a larger structural / circulation node.
    const major = i % 4 === 0;
    a.box('service', ringAt(0, 40.1, t), [major ? 13 : 8, major ? 3 : 1.8, major ? 5.4 : 3], [t, 0, 0]);
    a.box('foil', ringAt(5, 39.8, t), [3.5, 2.2, 2.6], [t, 0, 0]);
    a.cylinder('tank', ringAt(-4, 39.7, t), major ? 1.25 : .72, 3.8, [0, 0, Math.PI / 2]);
    for (const x of [-6, 6]) {
      a.beam('fuelPipe', ringAt(x, 40, angle + .1), ringAt(x, 40, angle + pitch - .1), .16);
      a.box('dark', ringAt(x, 40, t), [1.4, .8, 1], [t, 0, 0]);
    }
    if (major) {
      const crewSpoke = w.mainCrewSpokeIndices.includes(i / 4);
      radialTruss(a, t, 6.8, 40.5 + ringOffset, 0, 4.2, 1.6, 7);
      // Attached utilities + sealed solid-sample carrier, separately readable.
      for (const side of [-1, 1]) a.beam('oxidizerPipe', polar(side * 3.2, 7, t), ringAt(side * 3.2, 39, t), .21);
      a.beam('service', polar(crewSpoke ? 1.7 : -1.2, 7, t), ringAt(crewSpoke ? 1.7 : -1.2, 40, t), .72, .95);
      if (crewSpoke) crewAngles.push(t);
      serviceAngles.push(t);
      // Local arm track and spare transfer base; this track belongs to main rotation.
      for (const localRail of rails) {
        a.part(localRail, 'silver', [-10.4, 0, 0], [1, 1, 1], [t, 0, 0]);
      }
      a.box('dark', polar(-10.9, radius, t), [1.1, 2.2, 2.8], [t, 0, 0]);
      a.cylinder('red', polar(-11.7, radius, t), .65, .5, [0, 0, Math.PI / 2]);
    }
    // Grab fittings tied to the segment's end frame, not floating decor.
    for (const x of [-8.7, 8.7]) a.box('foil', ringAt(x, 47.5, angle - .12), [.4, .6, 1.2], [angle, 0, 0]);
  }
  // Rotating hub; fixed bearing housings are provided by core.js.
  a.cylinder('frame', [0, 0, 0], 7.2, 10.2, [0, 0, Math.PI / 2]);
  for (const x of [-5.2, 5.2]) a.cylinder('silver', [x, 0, 0], 7.5, .65, [0, 0, Math.PI / 2]);
  const object = a.build('Main ecology ring / rotating'); object.position.x = w.mainX;
  const transfer = new Assembly(resources);
  // Co-rotating annular cradle: mechanical guides only, not a rotating seal.
  for (const r of [w.mainTransferRadius - 1.45, w.mainTransferRadius + 1.45]) {
    const guide = arcGeometry(r, .24, .18, Math.PI * 2, .04, 96);
    transfer.part(guide, 'silver', [-6.9, 0, 0]);
  }
  for (let i = 0; i < 8; i++) {
    const angle = i * Math.PI / 4;
    transfer.beam('frame', polar(-5.5, 7.3, angle), polar(-6.9, w.mainTransferRadius - 1.45, angle), .08);
    transfer.beam('frame', polar(-6.9, w.mainTransferRadius - 1.45, angle), polar(-6.9, w.mainTransferRadius + 1.45, angle), .08);
    transfer.box('service', polar(-6.9, w.mainTransferRadius + 1.45, angle), [.65, .45, .55], [angle, 0, 0]);
  }
  object.add(transfer.build('Main rotating transfer cradle / guide and drive equipment'));
  crewAngles.forEach((angle, i) => {
    const access = crewAccess(resources, w, angle, i);
    object.add(access.object); anchors.crewLandings.push(access.landing);
    if (i === 0) anchors.crewAccess = access.car;
  });
  // Separate from both the fixed core and rotating cradle so a later staged
  // transfer can stop this cabin at the fixed port without stopping the ring.
  const cabin = new Assembly(resources), angle = crewAngles[0];
  const tx = w.mainTransferX, tr = w.mainTransferRadius;
  cabin.box('hullShade', polar(tx, tr, angle), [2.9, 2.8, 2.4], [angle, 0, 0]);
  for (const side of [-1, 1]) {
    cabin.cylinder('silver', polar(tx + side * 1.55, tr, angle), .99, .15, [0, 0, Math.PI / 2]);
    cabin.cylinder('dark', polar(tx + side * 1.63, tr, angle), .82, .06, [0, 0, Math.PI / 2]);
    cabin.box('hull', polar(tx + side * 1.68, tr, angle), [.06, 1.18, 1.05], [angle, 0, 0]);
  }
  cabin.box('crewLabel', polar(tx - 1.74, tr + 1, angle), [.06, .4, 1.25], [angle, 0, 0]);
  for (const r of [tr - 1.45, tr + 1.45])
    cabin.box('dark', polar(-6.9, r, angle), [.4, .3, .65], [angle, 0, 0]);
  const transferCabin = cabin.build('Main independent transfer cabin / synchronized departure pose');
  transferCabin.position.x = w.mainX;
  anchors.mainRing = anchor(object, 'Ecology / sealed service band', ringAt(-10, 49, .04));
  anchors.serviceNodes = serviceAngles.map((t, i) => anchor(object, `Main-ring transfer base ${i + 1}`, polar(-11.7, radius, t)));
  return { object, transferCabin, anchors };
}
