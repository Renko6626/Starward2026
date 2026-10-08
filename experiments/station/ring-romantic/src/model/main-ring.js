import * as THREE from 'three';
import { Assembly, anchor, arcGeometry, arcPanelGeometry, polar, radialTruss, crewLift } from './assembly.js';

// Cladding follows the existing rounded envelope, including its corners. The
// structural interface remains open on the axial faces, underneath local
// shields; it is not replaced by another circumferential pressure passage.
function ringShielding(a, radius, axialWidth, radialHeight, pitch, surface, jointGeometry) {
  const hx = axialWidth / 2, hr = radialHeight / 2, corner = 2;
  const flatX = hx - corner, flatR = hr - corner, gap = surface.seam;
  const cache = new Map(), host = new THREE.Mesh(jointGeometry, a.resources.materials.ringJoint);
  const ray = new THREE.Raycaster();
  const patch = (material, profile, start, end, raised = false) => {
    const span = end - start, offset = raised ? surface.outerJointOffset : surface.panelOffset;
    const thickness = raised ? surface.outerJointThickness : surface.panelThickness;
    const key = JSON.stringify([radius, profile, +span.toFixed(8), offset, thickness, 12]);
    if (!cache.has(key)) {
      const geometry = arcPanelGeometry(radius, profile, span, offset, thickness);
      geometry.userData.surfaceLayer = raised ? 'ring-joint-outer' : 'ring-primary';
      cache.set(key, geometry);
    }
    a.part(cache.get(key), material, [0, 0, 0], [1, 1, 1], [(start + end) / 2, 0, 0]);
  };
  const tiles = (start, end, stagger, callback) => {
    const step = (end - start) / surface.circumferentialPanels;
    const boundaries = [start];
    for (let edge = start + (stagger ? .75 : 1) * step; edge < end - .00001; edge += step) boundaries.push(edge);
    boundaries.push(end);
    if (boundaries.at(-1) - boundaries.at(-2) < step * .4) boundaries.splice(-2, 1);
    for (let i = 1; i < boundaries.length; i++) {
      const lo = boundaries[i - 1] + gap / radius / 2, hi = boundaries[i] - gap / radius / 2;
      if (hi > lo) callback(lo, hi);
    }
  };
  const curve = (side, radialSide) => Array.from({ length: 9 }, (_, k) => {
    const t = .012 + (Math.PI / 2 - .024) * k / 8;
    return [side * (flatX + corner * Math.cos(t)), radialSide * (flatR + corner * Math.sin(t)),
      side * Math.cos(t), radialSide * Math.sin(t)];
  });
  // Mounts are fitted once during assembly against the real polygonal neck,
  // including its smaller corner radius. No raycasting runs in frame updates.
  const mount = (x, dr, nx, nr, angle) => {
    const normal = new THREE.Vector3(nx, nr * Math.cos(angle), nr * Math.sin(angle));
    const back = new THREE.Vector3(x, (radius + dr) * Math.cos(angle), (radius + dr) * Math.sin(angle))
      .addScaledVector(normal, surface.outerJointOffset);
    ray.set(back.clone().addScaledVector(normal, .3), normal.clone().negate());
    const hit = ray.intersectObject(host, false)[0];
    if (!hit) throw new Error('Main joint shield mount does not reach its neck');
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
    a.box('ringSupport', hit.point.clone().addScaledVector(normal, .012).toArray(), [.20, .034, .18], q);
    a.beam('ringSupport', hit.point.clone().addScaledVector(normal, .018).toArray(), back.toArray(), .06);
    a.box('ringRim', back.clone().addScaledVector(normal, .008).toArray(), [.18, .032, .16], q);
  };
  return angle => {
    const start = angle - (pitch - .06) / 2, end = angle + (pitch - .06) / 2;
    for (const radialSide of [-1, 1]) for (let row = 0; row < surface.axialRows; row++) {
      const width = flatX * 2 / surface.axialRows;
      const x0 = -flatX + row * width + gap / 2, x1 = x0 + width - gap;
      tiles(start, end, row % 2, (lo, hi) => patch(radialSide < 0 ? 'ringPanel' : 'ringHull',
        [[x0, radialSide * hr, 0, radialSide], [x1, radialSide * hr, 0, radialSide]], lo, hi));
    }
    for (const side of [-1, 1]) {
      for (let row = 0; row < surface.sideRows; row++) {
        const height = flatR * 2 / surface.sideRows;
        const r0 = -flatR + row * height + gap / 2, r1 = r0 + height - gap;
        tiles(start, end, row % 2, (lo, hi) => patch(side > 0 && row === 0 ? 'ringPanel' : 'ringHull',
          [[side * hx, r0, side, 0], [side * hx, r1, side, 0]], lo, hi));
      }
      for (const radialSide of [-1, 1]) tiles(start, end, false,
        (lo, hi) => patch('ringHull', curve(side, radialSide), lo, hi));
    }
    const jointAngle = angle + pitch / 2;
    host.rotation.x = jointAngle; host.updateMatrixWorld(true);
    // Set-back rims reveal the darker neck, while inward and axial-face plates
    // keep their old shallow level beside the inner structure and crew routes.
    for (const [lo, hi] of [[-.026, -.002], [.002, .026]]) {
      for (const radialSide of [-1, 1]) for (let row = 0; row < surface.axialRows; row++) {
        const width = flatX * 2 / surface.axialRows;
        const x0 = -flatX + row * width + gap / 2, x1 = x0 + width - gap;
        patch('ringPanel', [[x0, radialSide * hr, 0, radialSide], [x1, radialSide * hr, 0, radialSide]],
          jointAngle + lo, jointAngle + hi, radialSide > 0);
      }
      for (const side of [-1, 1]) for (const radialSide of [-1, 1]) {
        patch('ringHull', curve(side, radialSide), jointAngle + lo, jointAngle + hi, radialSide > 0);
        patch('ringService', [[side * hx, radialSide * 2.95, side, 0],
          [side * hx, radialSide * (flatR - gap), side, 0]], jointAngle + lo, jointAngle + hi);
      }
      const t = jointAngle + (lo + hi) / 2;
      for (const x of [-5.25, 5.25]) mount(x, hr, 0, 1, t);
      for (const side of [-1, 1]) mount(side * (flatX + corner / Math.SQRT2),
        flatR + corner / Math.SQRT2, side / Math.SQRT2, 1 / Math.SQRT2, t);
    }
  };
}

function ringServiceFace(a, radius, angle, index) {
  const observation = -1;
  for (const side of [-1, 1]) {
    const at = (x, dr, dt = 0) => polar(side * x, radius + dr, angle + dt / radius);
    // Observation face: recessed glass, thin compression frame and shutter
    // parked above. Maintenance face: mostly closed covers and service ports.
    const visibleWindow = side === observation || index % 4 === 0;
    a.box('dark', at(9.16, -.25), [.16, 1.8, 3.6], [angle, 0, 0]);
    a.box(visibleWindow ? 'glass' : 'hullShade', at(9.26, -.25), [.06, 1.45, 3.2], [angle, 0, 0]);
    for (const dr of [-1.04, .54]) a.box('ringRim', at(9.32, dr), [.06, .065, 3.46], [angle, 0, 0]);
    for (const dt of [-1.72, 1.72]) a.box('ringRim', at(9.32, -.25, dt), [.06, 1.6, .065], [angle, 0, 0]);
    if (visibleWindow) {
      a.box('hullShade', at(9.19, 1.47), [.13, 1.1, 3.45], [angle, 0, 0]);
      for (const dt of [-1.5, 1.5]) a.box('ringRim', at(9.32, 1.47, dt), [.08, .75, .055], [angle, 0, 0]);
    }
    // Isolated sample coupling has a backing plate, recessed seal and cap.
    a.box('hullShade', at(9.21, -2.58, 3.9), [.18, .86, .95], [angle, 0, 0]);
    a.cylinder('ringRim', at(9.39, -2.58, 3.9), .27, .12, [0, 0, Math.PI / 2]);
    a.cylinder('dark', at(9.46, -2.58, 3.9), .21, .035, [0, 0, Math.PI / 2]);
    a.cylinder('hullShade', at(9.49, -2.58, 3.9), .185, .035, [0, 0, Math.PI / 2]);
    if (side !== observation) {
      for (const dt of [-4.3, -2.9]) {
        a.box('ringRim', at(9.16, -2.55, dt), [.09, .88, 1.06], [angle, 0, 0]);
        a.box('hullShade', at(9.23, -2.55, dt), [.055, .7, .88], [angle, 0, 0]);
      }
    }
    // Short identification bars stay at service fixtures, clear of the corners.
    a.box(index % 4 === 0 ? 'red' : 'service', at(9.19, 2.43, 4.7), [.035, .09, 1.1], [angle, 0, 0]);
  }
}

// Two close-fitting inner-edge chords connect the existing segment interfaces.
// Light ties stay below the service equipment; the major nodes have side bays
// only, leaving their central crew/material routes open. This is an exterior
// load-path study, not validation of shell stiffness or beam capacity.
function innerRingSupports(resources, w, outer, pitch) {
  const a = new Assembly(resources), s = w.mainInnerSupport;
  const shellInner = outer - w.mainRadialEnvelope, r = shellInner - s.inwardOffset;
  const chord = w.structuralSections.mainRingChord[0], step = pitch / s.baysPerSegment;
  const at = (x, radius, angle, tangent = 0) => {
    const p = polar(x, radius, angle);
    p[1] -= Math.sin(angle) * tangent; p[2] += Math.cos(angle) * tangent; return p;
  };
  const section = (x0, x1, angle, top, bottom, bays) => {
    // Short straight pieces with real braced nodes, rather than one stretched
    // rounded block spanning the whole axial width of the habitat.
    for (let bay = 0; bay < bays; bay++) {
      const x = x0 + (x1 - x0) * bay / bays, next = x0 + (x1 - x0) * (bay + 1) / bays;
      for (const radius of [top, bottom]) a.beam('ringSupport', at(x, radius, angle), at(next, radius, angle), s.tieWidth);
      a.beam('ringSupport', at(x, bay % 2 ? bottom : top, angle), at(next, bay % 2 ? top : bottom, angle), s.braceWidth);
    }
    for (let bay = 0; bay <= bays; bay++) {
      const x = x0 + (x1 - x0) * bay / bays;
      a.beam('ringSupport', at(x, bottom, angle), at(x, top, angle), s.braceWidth);
    }
  };
  for (let i = 0; i < w.mainSegments; i++) {
    const start = i * pitch - pitch / 2, joint = i * pitch + pitch / 2;
    for (const side of [-1, 1]) for (let bay = 0; bay < s.baysPerSegment; bay++) {
      const t = start + bay * step, x = side * s.axialOffset;
      a.beam('ringSupport', at(x, r, t), at(x, r, t + step), chord);
      a.part(resources.geometries.box, 'ringSupport', at(x, r, t), [.31, .29, .28], [t, 0, 0]);
      // The interface itself connects to the existing end frame below. Other
      // bay nodes use short structural seats through the removable cladding.
      if (bay === 0) continue;
      a.beam('ringSupport', at(x, r, t), at(x, shellInner + .12, t), s.seatWidth);
      a.part(resources.geometries.box, 'ringSupport', at(x, shellInner - .035, t), [.32, .10, .34], [t, 0, 0]);
    }
    const major = i % 4 === 0, top = r - .23, bottom = r - s.jointDepth;
    if (major) {
      // Keep the open middle wider than the existing 8.4 m spoke frame. The
      // crew vestibule and axial branches retain their existing envelopes.
      section(-s.axialOffset, -4.55, joint, top, bottom, 1);
      section(4.55, s.axialOffset, joint, top, bottom, 1);
    } else section(-s.axialOffset, s.axialOffset, joint, top, bottom, 4);
    for (const side of [-1, 1]) {
      const x = side * s.axialOffset;
      a.beam('ringSupport', at(x, bottom, joint), at(x, r, joint), s.tieWidth);
      if (!major) {
        // Ordinary feet meet the actual transverse end-frame chord rather than
        // the shield sheet. Major-node feet must clear the axial crew branches.
        a.beam('ringSupport', at(x, r, joint), at(side * 8.2, outer - 9.5, joint), s.nodeBraceWidth);
        a.part(resources.geometries.box, 'ringSupport', at(side * 8.2, outer - 9.5, joint), [.28, .28, .32], [joint, 0, 0]);
        continue;
      }
      const outerSpoke = 40.5 + outer - 50;
      for (const tangent of [-1.6, 1.6]) {
        // Fan from the four real spoke end-chord points into two neighbouring
        // seats on each ring chord. Most of each brace is inside the major node.
        const targetAngle = joint + Math.sign(tangent) * step;
        a.beam('ringSupport', at(side * 4.2, outerSpoke, joint, tangent), at(x, r, targetAngle), s.nodeBraceWidth);
        a.part(resources.geometries.box, 'ringSupport', at(side * 4.2, outerSpoke, joint, tangent), [.30, .30, .28], [joint, 0, 0]);
        // Route around each landing to a real corner of the axial-face truss.
        // Both ends lie on existing chords; no member crosses the crew volume.
        const frameAngle = joint + Math.sign(tangent) * .032;
        a.beam('ringSupport', at(x, r, targetAngle), at(side * 9.1, outer - 8.5, frameAngle), s.nodeBraceWidth);
        a.part(resources.geometries.box, 'ringSupport', at(side * 9.1, outer - 8.5, frameAngle), [.28, .28, .32], [frameAngle, 0, 0]);
      }
    }
  }
  return a.build('Main ring inner structure / shell seats and local node reinforcement');
}

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
  const collar = arcGeometry(radius, w.mainAxialEnvelope + .26, w.mainRadialEnvelope + .26, .0032, 2.13, 2);
  const shield = ringShielding(a, radius, w.mainAxialEnvelope, w.mainRadialEnvelope, pitch, w.mainSurface, joint);
  const rails = [-.65, .65].map(offset => arcGeometry(radius + offset, .22, .22, pitch - .06, .08, 12));
  const anchors = { serviceNodes: [], crewLandings: [] };
  const serviceAngles = [], crewAngles = [];
  for (let i = 0; i < w.mainSegments; i++) {
    const angle = i * pitch;
    a.part(shell, 'pressureHull', [0, 0, 0], [1, 1, 1], [angle, 0, 0]);
    a.part(joint, 'ringJoint', [0, 0, 0], [1, 1, 1], [angle + pitch / 2, 0, 0]);
    shield(angle);
    ringServiceFace(a, radius, angle, i);
    for (const sign of [-1, 1]) a.part(collar, 'ringRim', [0, 0, 0], [1, 1, 1],
      [angle + pitch / 2 + sign * .0313, 0, 0]);
    // End frames, fastening plates and segmented circumferential members lie
    // inside the same radial band as the pressure shell, not on a second ring.
    const t = angle + pitch / 2;
    // Hinge feet and locking tabs sit on the interface shields. Their small
    // mounting plates give the covers an attachment scale in close views.
    const shieldTop = outer + w.mainSurface.outerJointOffset + w.mainSurface.outerJointThickness;
    for (const x of [-5.25, 5.25]) for (const dt of [-.014, .014]) {
      a.part(resources.geometries.box, 'ringRim', polar(x, shieldTop + .012, t + dt), [.34, .035, .24], [t + dt, 0, 0]);
      a.beam('silver', polar(x - .14, shieldTop + .035, t + dt), polar(x + .14, shieldTop + .035, t + dt), .045);
      for (const dx of [-.12, .12]) a.cylinder('dark', polar(x + dx, shieldTop + .018, t + dt), .013, .012, [t + dt, 0, 0]);
    }
    for (const x of [-1.75, 1.75]) {
      a.part(resources.geometries.box, 'ringRim', polar(x, shieldTop + .008, t + .004), [.18, .04, .32], [t, 0, 0]);
      a.part(resources.geometries.box, 'dark', polar(x, shieldTop + .034, t + .004), [.07, .025, .08], [t, 0, 0]);
    }
    // Exposed circumferential truss bays alternate with hull segments. The
    // sealed joint lies underneath these bays within the same radial band as the enlarged shell.
    for (const x of [-9.1, 9.1]) {
      for (const r of [41.5, 47.7].map(r => r + ringOffset)) a.beam('silver', polar(x, r, t - .032), polar(x, r, t + .032), w.structuralSections.mainRingChord[0]);
      for (const dt of [-.032, .032]) a.beam('silver', ringAt(x, 41.5, t + dt), ringAt(x, 47.7, t + dt), .14);
      a.beam('frame', ringAt(x, 41.5, t - .032), ringAt(x, 47.7, t + .032), .08);
      a.beam('frame', ringAt(x, 47.7, t - .032), ringAt(x, 41.5, t + .032), .08);
    }
    for (const side of [-1, 1]) {
      a.beam('silver', ringAt(side * 8.2, 40.3, t), ringAt(side * 8.2, 48.7, t), .55, .7);
      for (const r of [40.5, 48.4].map(r => r + ringOffset)) {
        a.beam('silver', polar(-8.2, r, t), polar(8.2, r, t), w.structuralSections.mainTransverseFrame[0]);
        a.box('silver', polar(side * 8.7, r, t), [.22, 1.5, 1.7], [t, 0, 0]);
        for (const offset of [-.01, .01]) a.cylinder('dark', polar(side * 8.92, r, t + offset), .13, .12, [0, 0, Math.PI / 2]);
      }
    }
    // Each fourth junction is a larger structural / circulation node.
    const major = i % 4 === 0;
    const nodeWidth = major ? 13 : 8, nodeHeight = major ? 3 : 1.8, nodeDepth = major ? 5.4 : 3;
    a.box('service', ringAt(0, 40.1, t), [nodeWidth, nodeHeight, nodeDepth], [t, 0, 0]);
    // Removable inward-facing equipment covers share the existing node body;
    // no new pressure volume or circulation subsystem is introduced.
    const nodeBands = major ? [[-nodeWidth / 2, -w.mainSurface.majorCentreKeepoutHalfWidth],
      [w.mainSurface.majorCentreKeepoutHalfWidth, nodeWidth / 2]]
      : Array.from({ length: w.mainSurface.ordinaryNodeColumns }, (_, j) => [
        -nodeWidth / 2 + j * nodeWidth / w.mainSurface.ordinaryNodeColumns,
        -nodeWidth / 2 + (j + 1) * nodeWidth / w.mainSurface.ordinaryNodeColumns]);
    const tangentBands = major ? [[-nodeDepth / 2 + .04, -.20], [.20, nodeDepth / 2 - .04]]
      : [[-nodeDepth / 2 + .04, nodeDepth / 2 - .04]];
    for (const [lo, hi] of nodeBands) for (const [near, far] of tangentBands) {
      const x = (lo + hi) / 2, face = 40.1 + ringOffset - nodeHeight / 2;
      const tangent = (near + far) / 2, p = polar(x, face - .022, t);
      p[1] -= Math.sin(t) * tangent; p[2] += Math.cos(t) * tangent;
      // Flat lids sit on the existing box face. Major lids leave a narrow
      // transverse-chord slot as well as the central crew/material keepout.
      a.part(resources.geometries.box, 'hullShade', p,
        [hi - lo - .08, .055, far - near], [t, 0, 0]);
    }
    for (const side of [-1, 1]) for (const dr of [-2.7, 2.7]) for (const dt of [-.028, .028])
      a.cylinder('ringRim', polar(side * 9.24, radius + dr, t + dt), .027, .04, [0, 0, Math.PI / 2]);
    a.box('foil', ringAt(5, 39.8, t), [3.5, 2.2, 2.6], [t, 0, 0]);
    a.cylinder('tank', ringAt(-4, 39.7, t), major ? 1.25 : .72, 3.8, [0, 0, Math.PI / 2]);
    for (const x of [-6, 6]) {
      a.beam('fuelPipe', ringAt(x, 40, angle + .1), ringAt(x, 40, angle + pitch - .1), .16);
      a.box('dark', ringAt(x, 40, t), [1.4, .8, 1], [t, 0, 0]);
    }
    if (major) {
      const crewSpoke = w.mainCrewSpokeIndices.includes(i / 4);
      radialTruss(a, t, 6.8, 40.5 + ringOffset, 0, 4.2, 1.6, 7, {
        chord: w.structuralSections.mainSpokeChord[0],
        axialDiagonal: w.structuralSections.spokeAxialDiagonal[0],
      });
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
  object.add(innerRingSupports(resources, w, outer, pitch));
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
