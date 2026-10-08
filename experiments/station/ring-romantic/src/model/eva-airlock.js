import * as THREE from 'three';
import { Assembly, anchor, arcGeometry, polar } from './assembly.js';

function roundedOutline(width, height, corner) {
  const s = new THREE.Shape(), x = width / 2, y = height / 2, r = corner;
  s.moveTo(-x + r, -y); s.lineTo(x - r, -y);
  s.quadraticCurveTo(x, -y, x, -y + r); s.lineTo(x, y - r);
  s.quadraticCurveTo(x, y, x - r, y); s.lineTo(-x + r, y);
  s.quadraticCurveTo(-x, y, -x, y - r); s.lineTo(-x, -y + r);
  s.quadraticCurveTo(-x, -y, -x + r, -y);
  return s;
}

// Shape X/Y maps to world X/Z; the extrusion points towards the EVA exit (−Y).
function faceGeometry(shape, depth) {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth, bevelEnabled: false, curveSegments: 8,
  });
  geometry.rotateX(Math.PI / 2);
  return geometry;
}

export function createEvaAirlock({ layout, resources }) {
  const w = layout.working.evaAirlock, a = new Assembly(resources);
  const { x, shellRadius: shell, outerRadius: radius } = w;
  const end = -shell - w.projection, bodyBack = -shell - .95, bodyFront = end + .2;
  const at = (dx, y, z = 0) => [x + dx, y, z];
  const torus = (major, minor) => {
    const g = new THREE.TorusGeometry(major, minor, 8, 48);
    g.rotateX(Math.PI / 2); return g;
  };

  // Curved saddle follows the existing cylinder; the neck overlaps the closed
  // exterior shell internally. This study does not expose a cabin interior.
  a.part(arcGeometry(shell + .065, 2.7, .13, 2.7 / shell, .04, 32),
    'coreRim', [x, 0, 0], [1, 1, 1], [Math.PI, 0, 0]);
  a.cylinder('coreService', at(0, -shell - .38), w.neckRadius, .95);
  a.part(torus(w.neckRadius + .025, .055), 'coreRim', at(0, -shell - .72));
  const shoulder = new THREE.CylinderGeometry(w.neckRadius, radius, .35, 48);
  a.part(shoulder, 'corePanel', at(0, bodyBack + .175));
  // The nominal exterior radius includes the unmodelled insulation/structure.
  const barrel = new THREE.CylinderGeometry(radius, radius, bodyBack - bodyFront, 48);
  a.part(barrel, 'coreHull', at(0, (bodyBack + bodyFront) / 2));
  const band = torus(radius + .012, .035);
  for (const y of [bodyBack - .04, bodyBack - 1.2, bodyFront + .06])
    a.part(band, 'coreRim', at(0, y));

  // A real opening in the end frame surrounds the closed hatch leaf. The dark
  // seal is narrow, instead of a large dark slab suggesting an open airlock.
  const endShape = new THREE.Shape(); endShape.absarc(0, 0, radius, 0, Math.PI * 2, false);
  const aperture = roundedOutline(w.hatchAxial, w.hatchLateral, .15);
  endShape.holes.push(new THREE.Path(aperture.getPoints(12)));
  a.part(faceGeometry(endShape, .2), 'corePanel', at(0, bodyFront));
  const sealShape = roundedOutline(w.hatchAxial + .1, w.hatchLateral + .1, .19);
  sealShape.holes.push(new THREE.Path(aperture.getPoints(12)));
  a.part(faceGeometry(sealShape, .025), 'coreSeal', at(0, end - .003));
  a.part(faceGeometry(roundedOutline(w.hatchAxial, w.hatchLateral, .15), .045),
    'coreHull', at(0, end + .015));
  for (const dx of [-.57, .57]) {
    a.box('coreRim', at(dx, end - .045, -.63), [.2, .09, .11]);
    a.box('coreRim', at(dx, end - .04, .63), [.12, .08, .12]);
  }
  a.box('coreRim', at(.37, end - .075), [.08, .1, .36]);
  a.box('coreSeal', at(.37, end - .02), [.12, .025, .4]);
  a.box('coreService', at(-.34, end - .02, .24), [.27, .035, .19]);
  a.box('light', at(-.34, end - .045, .24), [.17, .018, .05]);

  // Grab bars sit outside the door's 1.5 × 1.2 m passage and hinge area.
  for (const sign of [-1, 1]) {
    const dx = sign * 1.05;
    for (const z of [-.35, .35]) a.beam('coreRim', at(dx, end, z), at(dx, end - .2, z), .05);
    a.beam('silver', at(dx, end - .2, -.35), at(dx, end - .2, .35), .045);
    a.box('coreService', at(sign * .53, end - .045, .98), [.36, .09, .15]);
    a.box('light', at(sign * .53, end - .1, .98), [.25, .025, .06]);
  }

  // Two longitudinal rails connect end grab bars back towards the root. Their
  // short stand-offs attach to the barrel; no free-floating handrail fittings.
  for (const sign of [-1, 1]) {
    const dx = sign * 1.13, z = 1.13;
    a.beam('silver', at(dx, bodyBack - .12, z), at(dx, end - .12, z), .045);
    for (const y of [bodyBack - .15, bodyBack - 1.3, bodyFront + .1]) {
      const k = radius / Math.hypot(dx, z);
      a.beam('coreRim', at(dx * k, y, z * k), at(dx, y, z), .045);
    }
    a.beam('silver', at(sign * 1.05, end - .2, .35), at(dx, end - .12, z), .045);
    const root = at(sign * 1.6, -Math.sqrt(shell * shell - 1.6 * 1.6) - .21, 1.6);
    a.beam('silver', at(dx, bodyBack - .12, z), root, .045);
  }

  // Root routes bypass the saddle on either side. All attachment feet follow
  // the actual curved shell, clear of its 45-degree longitudinal chords.
  const routeAngle = Math.PI - .36;
  const rootRadius = shell + .23;
  for (const [start, finish] of [[w.routeFrontX, x - 1.6], [x + 1.6, w.routeRearX]]) {
    a.beam('silver', polar(start, rootRadius, routeAngle), polar(finish, rootRadius, routeAngle), .045);
    for (const axial of [start, finish]) {
      a.part(arcGeometry(shell + .06, .15, .15, .15 / shell, .01, 8),
        'coreRim', [axial, 0, 0], [1, 1, 1], [routeAngle, 0, 0]);
      a.beam('coreRim', polar(axial, shell + .12, routeAngle), polar(axial, rootRadius, routeAngle), .045);
    }
    a.beam('silver', at(Math.sign(start - x) * 1.6,
      -Math.sqrt(shell * shell - 1.6 * 1.6) - .21, 1.6), polar(Math.sign(start - x) * 1.6 + x, rootRadius, routeAngle), .045);
  }

  // Tether loops have dedicated seats at the end; they are not mounted to a
  // removable cladding panel. Their load capacity is not established here.
  const loop = torus(.075, .018);
  for (const dx of [-.98, .98]) {
    a.box('coreRim', at(dx, end - .055, -.68), [.22, .1, .2]);
    a.part(loop, 'silver', at(dx, end - .13, -.68));
  }
  // Small cradle below the hatch, plus a separate portable-foot-restraint socket.
  a.box('coreService', at(-.48, end - .12, -.98), [.55, .18, .22]);
  for (const dx of [-.74, -.22]) a.beam('coreRim', at(dx, end - .12, -.98), at(dx, end - .29, -.98), .035);
  a.beam('silver', at(-.74, end - .29, -.98), at(-.22, end - .29, -.98), .035);
  a.cylinder('coreRim', at(.51, end - .08, -.98), .11, .16);
  a.cylinder('coreSeal', at(.51, end - .17, -.98), .065, .025);
  // Discrete services box on the barrel, outside the grab rails and end opening.
  a.box('coreService', at(0, bodyBack - 1.1, -radius - .1), [.62, .9, .24]);
  const object = a.build('EVA airlock / fixed / closed study');
  object.userData.study = { ...w, pressureOpeningModelled: false, dynamicClearanceVerified: false };
  return { object, anchors: { exit: anchor(object, 'EVA exit', at(0, end - .15)) } };
}
