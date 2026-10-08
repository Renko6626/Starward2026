import * as THREE from 'three';
import { Assembly, anchor, polar, arcGeometry, arcPanelGeometry, pipe } from './assembly.js';

const TAU = Math.PI * 2;

// Local X/r profile: short rounded chamfers, with the original barrel envelope.
function coreShellProfile(length, radius, shoulderLength, shoulderInset) {
  const front = [
    [-length / 2, radius - shoulderInset],
    [-length / 2 + .08, radius - shoulderInset + .012],
    [-length / 2 + shoulderLength * .2, radius - shoulderInset * .88],
    [-length / 2 + shoulderLength * .8, radius - shoulderInset * .08],
    [-length / 2 + shoulderLength, radius],
  ];
  return [...front, ...front.toReversed().map(([x, r]) => [-x, r])];
}

function radiusOnProfile(profile, x) {
  for (let i = 1; i < profile.length; i++) {
    if (x <= profile[i][0]) {
      const [ax, ar] = profile[i - 1], [bx, br] = profile[i];
      return THREE.MathUtils.lerp(ar, br, THREE.MathUtils.clamp((x - ax) / (bx - ax), 0, 1));
    }
  }
  return profile.at(-1)[1];
}

function coreShellGeometry(profile) {
  const geometry = new THREE.LatheGeometry(profile.map(([x, r]) => new THREE.Vector2(r, x)), 64);
  geometry.rotateZ(-Math.PI / 2);
  // Match the two-metre grain scale of the external formed plates. Default
  // lathe UVs stretch one texture over an entire module and its circumference.
  const distances = [0];
  for (let j = 1; j < profile.length; j++) distances.push(distances.at(-1)
    + Math.hypot(profile[j][0] - profile[j - 1][0], profile[j][1] - profile[j - 1][1]));
  const positions = geometry.attributes.position, uv = geometry.attributes.uv;
  for (let i = 0; i < positions.count; i++) {
    const row = Math.round(uv.getY(i) * (profile.length - 1));
    uv.setXY(i, uv.getX(i) * TAU * Math.hypot(positions.getY(i), positions.getZ(i)) / 2, distances[row] / 2);
  }
  geometry.userData.coreKind = 'shell';
  return geometry;
}

function panelProfile(profile, x0, x1, radius) {
  const points = [[x0, radiusOnProfile(profile, x0)],
    ...profile.filter(([x]) => x > x0 + .00001 && x < x1 - .00001),
    [x1, radiusOnProfile(profile, x1)]];
  const mid = (x0 + x1) / 2;
  return points.map(([x, r], i) => {
    const prev = points[Math.max(0, i - 1)], next = points[Math.min(points.length - 1, i + 1)];
    const dx = next[0] - prev[0], dr = next[1] - prev[1], size = Math.hypot(dx, dr);
    return [x - mid, r - radius, -dr / size, dx / size];
  });
}

// Subtract axis/angle rectangles before creating panels: openings have physical
// edges and backs, without runtime CSG or hidden full panels below equipment.
function subtractRectangle(rect, cut) {
  const [x0, x1, t0, t1] = rect, [a, b, c, d] = cut;
  const lo = Math.max(x0, a), hi = Math.min(x1, b), left = Math.max(t0, c), right = Math.min(t1, d);
  if (hi <= lo || right <= left) return [rect];
  return [[x0, lo, t0, t1], [hi, x1, t0, t1], [lo, hi, t0, left], [lo, hi, right, t1]]
    .filter(([x, y, u, v]) => y - x > .00001 && v - u > .00001);
}

function protectedCutouts(moduleIndex, module, w) {
  const [x, , r] = module, cuts = [];
  if (moduleIndex === 0) {
    const eva = w.evaAirlock, halfAngle = 1.42 / r;
    cuts.push([eva.x - x - 1.42, eva.x - x + 1.42,
      Math.PI - halfAngle, Math.PI + halfAngle]);
    for (const axial of [eva.routeFrontX, eva.x - 1.6, eva.x + 1.6, eva.routeRearX]) {
      cuts.push([axial - x - .12, axial - x + .12,
        Math.PI - .36 - .12 / r, Math.PI - .36 + .12 / r]);
    }
  }
  // Actual fixed vestibule roots; the covers end around, not across, these ports.
  if (moduleIndex === 1) cuts.push([-39 - x - 1.45, -39 - x + 1.45,
    Math.PI * .375 - .31, Math.PI * .375 + .31]);
  if (moduleIndex === 2) cuts.push([-12.3 - x - 1.45, -12.3 - x + 1.45,
    Math.PI / w.mainSegments - .29, Math.PI / w.mainSegments + .29]);
  // Small legacy brackets have real shell penetrations too. Reserve their
  // mounting footprints, including side stays, instead of covering the roots.
  const frontOffset = w.coreFront + 42;
  if (moduleIndex === 0) {
    const rcsX = -37 + frontOffset;
    for (const [lo, hi] of [[-.29, .02], [Math.PI - .02, Math.PI + .29]])
      for (const shift of [-TAU, 0, TAU]) cuts.push([rcsX - x - .65, rcsX - x + .65, lo + shift, hi + shift]);
    const antennaX = -34 + frontOffset;
    for (const shift of [-TAU, 0, TAU]) cuts.push([antennaX - x - .11, antennaX - x + .11, shift - .035, shift + .035]);
    const stayX = -32.5 + frontOffset, stayAngle = Math.atan2(-2, 4);
    for (const shift of [-TAU, 0, TAU]) cuts.push([stayX - x - .22, stayX - x + .22,
      stayAngle + shift - .06, stayAngle + shift + .06]);
  }
  for (let railX = -35; railX <= 20; railX += 5.5) {
    const localX = railX + frontOffset - x;
    for (const z of [-3, 3]) {
      const angle = Math.atan2(z, -3.8);
      for (const shift of [-TAU, 0, TAU]) cuts.push([localX - .14, localX + .14,
        angle + shift - .10, angle + shift + .10]);
    }
  }
  // Energy root coordinates include the existing +10 m axial offset.
  if (moduleIndex === 3 || moduleIndex === 4) {
    const rootX = (moduleIndex === 3 ? 12 : 20) + w.energyAxialOffset;
    for (const sign of [-1, 1]) for (const y of [-3, 0]) {
      const angle = Math.atan2(sign * Math.sqrt(r * r - y * y), y);
      for (const shift of [-TAU, 0, TAU]) cuts.push([rootX - x - .4, rootX - x + .7,
        angle + shift - .12, angle + shift + .12]);
    }
  }
  return cuts;
}

function coreServiceRegions(features, detail) {
  return features.flatMap((feature, index) => feature.kind === 'hatch' ? [{
    featureIndex: index,
    x0: feature.localX - feature.axialWidth / 2 - detail.serviceAxialPadding,
    x1: feature.localX + feature.axialWidth / 2 + detail.serviceAxialPadding,
    angle: feature.angle, arcWidth: feature.arcWidth + detail.serviceArcPadding * 2,
  }] : []);
}

function cachedCorePanel(detail, radius, shape, angle, offset, thickness, kind) {
  const key = JSON.stringify([radius, shape, angle, offset, thickness, 8, kind],
    (_, value) => typeof value === 'number' ? +value.toFixed(6) : value);
  if (!detail.cache.has(key)) {
    const geometry = arcPanelGeometry(radius, shape, angle, offset, thickness, 8);
    geometry.userData.coreKind = kind;
    detail.cache.set(key, geometry);
  }
  return detail.cache.get(key);
}

function addCoreMaintenanceShield(a, module, profile, feature, detail) {
  const [centre, length, radius] = module, half = length / 2;
  const x0 = Math.max(-half + detail.config.shoulderLength, feature.localX - feature.axialWidth / 2 - detail.shieldAxialPadding);
  const x1 = Math.min(half - detail.config.shoulderLength, feature.localX + feature.axialWidth / 2 + detail.shieldAxialPadding);
  const span = (feature.arcWidth / 2 + detail.shieldArcPadding) / radius;
  let pieces = [[x0, x1, feature.angle - span, feature.angle + span]];
  // The actual cover and compression frame stay intact in this central hole.
  const hole = [feature.localX - feature.axialWidth / 2 - .12,
    feature.localX + feature.axialWidth / 2 + .12,
    feature.angle - (feature.arcWidth / 2 + .12) / radius,
    feature.angle + (feature.arcWidth / 2 + .12) / radius];
  const cuts = [hole, ...detail.cutouts];
  for (const support of detail.supports) cuts.push([support - centre - .23, support - centre + .23, -TAU, TAU * 2]);
  for (let i = 0; i < 4; i++) {
    const t = Math.PI / 4 + i * Math.PI / 2;
    for (const shift of [-TAU, 0, TAU]) cuts.push([-half, half,
      t + shift - detail.beamBandAngle / 2, t + shift + detail.beamBandAngle / 2]);
  }
  for (const other of detail.config.features) {
    if (other === feature) continue;
    for (const shift of [-TAU, 0, TAU]) cuts.push([
      other.localX - other.axialWidth / 2 - .12, other.localX + other.axialWidth / 2 + .12,
      other.angle + shift - (other.arcWidth / 2 + .12) / radius,
      other.angle + shift + (other.arcWidth / 2 + .12) / radius,
    ]);
  }
  for (const cut of cuts) pieces = pieces.flatMap(rect => subtractRectangle(rect, cut));
  for (const [lo, hi, u, v] of pieces) {
    if (hi - lo < .16 || (v - u) * radius < .16) continue;
    const shape = panelProfile(profile, lo, hi, radius);
    const geometry = cachedCorePanel(detail, radius, shape, v - u,
      detail.shieldOffset, detail.shieldThickness, 'maintenanceShield');
    a.part(geometry, 'corePanel', [centre + (lo + hi) / 2, 0, 0], [1, 1, 1], [(u + v) / 2, 0, 0]);
    // Each independently cropped piece receives its own pair of short seats.
    for (const portion of [.25, .75]) {
      const localX = lo + (hi - lo) * portion, t = (u + v) / 2;
      const r = radiusOnProfile(profile, localX);
      const foot = cachedCorePanel(detail, r, [[-.07, 0, 0, 1], [.07, 0, 0, 1]], .14 / r,
        -.012, .040, 'shieldSeat');
      a.part(foot, 'coreRim', [centre + localX, 0, 0], [1, 1, 1], [t, 0, 0]);
      a.beam('silver', polar(centre + localX, r + .012, t),
        polar(centre + localX, r + detail.shieldOffset, t), .05);
    }
  }
}

function addCoreCladding(a, moduleIndex, module, profile, detail) {
  const [x, length, radius] = module, config = detail.modules[moduleIndex];
  const half = length / 2, barrel = half - config.shoulderLength;
  const pitch = barrel * 2 / Math.ceil(barrel * 2 / detail.axialPanelLength);
  const cuts = [...detail.cutouts];
  for (const region of coreServiceRegions(config.features, detail)) {
    for (const shift of [-TAU, 0, TAU]) cuts.push([region.x0, region.x1,
      region.angle + shift - region.arcWidth / radius / 2,
      region.angle + shift + region.arcWidth / radius / 2]);
  }
  for (let i = 0; i < 4; i++) {
    const t = Math.PI / 4 + i * Math.PI / 2;
    cuts.push([-half, half, t - detail.beamBandAngle / 2, t + detail.beamBandAngle / 2]);
  }
  for (const feature of config.features) {
    const span = (feature.arcWidth + .14) / radius;
    for (const shift of [-TAU, 0, TAU]) cuts.push([
      feature.localX - feature.axialWidth / 2 - .07, feature.localX + feature.axialWidth / 2 + .07,
      feature.angle + shift - span / 2, feature.angle + shift + span / 2,
    ]);
  }
  for (const support of detail.supports) {
    const local = support - x;
    if (Math.abs(local) <= half + .001) cuts.push([local - .23, local + .23, -TAU, TAU * 2]);
  }
  for (let lane = 0; lane < detail.angularSegments; lane++) {
    const step = TAU / detail.angularSegments, gap = detail.seam / radius;
    const t0 = lane * step + gap / 2, t1 = (lane + 1) * step - gap / 2;
    const rows = [-half + .05, -barrel];
    for (let edge = -barrel + (lane % 2 ? pitch / 2 : pitch); edge < barrel - .0001; edge += pitch) rows.push(edge);
    rows.push(barrel, half - .05);
    for (let j = 1; j < rows.length; j++) {
      let pieces = [[rows[j - 1] + detail.seam / 2, rows[j] - detail.seam / 2, t0, t1]];
      for (const cut of cuts) pieces = pieces.flatMap(rect => subtractRectangle(rect, cut));
      for (const [x0, x1, u, v] of pieces) {
        // Very small remnants become part of the exposed mounting margin.
        if (x1 - x0 < .12 || (v - u) * radius < .14) continue;
        const shape = panelProfile(profile, x0, x1, radius), angle = v - u;
        const geometry = cachedCorePanel(detail, radius, shape, angle,
          detail.panelOffset, detail.panelThickness, 'cladding');
        const material = (lane === 3 || lane === 12) ? 'corePanel' : 'coreHull';
        a.part(geometry, material, [x + (x0 + x1) / 2, 0, 0], [1, 1, 1], [(u + v) / 2, 0, 0]);
      }
    }
  }
}

function addCoreFeature(a, feature, module, profile, supports) {
  const [centre] = module, { kind, localX, angle: t, axialWidth: length, arcWidth: width, lift } = feature;
  const x = centre + localX, r = radiusOnProfile(profile, localX), arc = width / r;
  const at = (dx, radial, tangent = 0) => [x + dx,
    radial * Math.cos(t) - tangent * Math.sin(t), radial * Math.sin(t) + tangent * Math.cos(t)];
  const layer = (mat, offset, thickness, l = length, w = width, dx = 0, dt = 0, part = null) => {
    const geometry = arcPanelGeometry(r, [[-l / 2, 0, 0, 1], [l / 2, 0, 0, 1]], w / r, offset, thickness, 8);
    if (part) geometry.userData.coreKind = part;
    a.part(geometry, mat, [x + dx, 0, 0], [1, 1, 1], [t + dt, 0, 0]);
  };
  if (kind === 'equipmentPack') {
    // The raised chassis clears the closed support rings underneath it.
    const bottom = .31, bodyHeight = lift - bottom;
    layer('coreRim', .25, .03);
    for (const dx of [-length * .39, length * .39]) for (const tangent of [-width * .35, width * .35]) {
      const mountLift = supports.some(s => Math.abs(s - x - dx) < .22) ? .2 : 0;
      const mountRadius = r + mountLift, base = Math.sqrt(mountRadius * mountRadius - tangent * tangent);
      // Curved shoes overlap the actual 48/64-segment support surface slightly;
      // a foot positioned on an ideal circle alone leaves a visible air gap.
      layer('coreRim', mountLift - .015, .055, .14, .14, dx,
        Math.atan2(tangent, base), 'mountingSeat');
      a.beam('silver', at(dx, base + .015, tangent), at(dx, r + bottom, tangent), .06);
      a.box('coreRim', at(dx, r + bottom - .035, tangent), [.17, .07, .18], [t, 0, 0]);
    }
    a.box('coreService', at(0, r + bottom + bodyHeight / 2), [length - .06, bodyHeight, width - .1], [t, 0, 0]);
    a.box('hull', at(0, r + lift + .025), [length - .16, .05, width - .2], [t, 0, 0]);
    for (const dx of [-length * .35, 0, length * .35]) {
      a.box('coreRim', at(dx, r + lift + .05), [.045, .025, width - .24], [t, 0, 0]);
      a.box('coreSeal', at(dx, r + bottom + bodyHeight * .55, width / 2 - .025), [.06, bodyHeight * .65, .035], [t, 0, 0]);
    }
    for (const dx of [-length * .4, length * .4])
      a.box('coreRim', at(dx, r + lift + .065, width * .32), [.22, .04, .09], [t, 0, 0]);
    return;
  }
  // A raised shroud surrounds an actual shallow well. The well never cuts the
  // pressure envelope, and its four walls remain visible around a closed cover.
  const floor = lift - .12, wallHeight = .1;
  layer('coreService', floor, .02);
  for (const dx of [-length / 2 + .035, length / 2 - .035]) {
    a.part(arcGeometry(r + floor + .02 + wallHeight / 2, .07, wallHeight, arc, .008, 8),
      'coreService', [x + dx, 0, 0], [1, 1, 1], [t, 0, 0]);
  }
  for (const sign of [-1, 1]) layer('coreService', floor + .02, wallHeight,
    length - .12, .07, 0, sign * (arc / 2 - .035 / r));
  // Narrow top lips rather than a large black rectangle on a flat panel.
  for (const dx of [-length / 2 + .06, length / 2 - .06]) layer('coreRim', lift, .025, .12, width, dx);
  for (const sign of [-1, 1]) layer('coreRim', lift, .025,
    length - .24, .12, 0, sign * (arc / 2 - .06 / r));
  if (kind === 'window') {
    layer('glass', lift - .05, .02, length - .3, width - .3);
    // A closed external window with its protective shutter parked to one edge.
    layer('coreHull', lift + .026, .025, length - .2, width * .24, 0, arc * .32);
  } else if (kind === 'sealedPort') {
    layer('coreService', floor + .025, .025, length - .2, width - .2);
    a.cylinder('coreRim', at(0, r + lift - .04), .31, .09, [t, 0, 0]);
    a.cylinder('coreSeal', at(0, r + lift + .01), .25, .035, [t, 0, 0]);
    a.cylinder('coreService', at(0, r + lift + .04), .21, .025, [t, 0, 0]);
    a.box('coreRim', at(0, r + lift + .062), [.2, .025, .045], [t, 0, 0]);
  } else {
    layer('coreSeal', lift - .05, .02, length - .21, width - .21);
    layer('corePanel', lift - .028, .018, length - .3, width - .3);
    for (const dx of [-length * .32, length * .32]) {
      a.box('coreRim', at(dx, r + lift + .025, -width * .4), [.18, .05, .11], [t, 0, 0]);
      a.box('coreRim', at(dx, r + lift + .025, width * .4), [.11, .05, .13], [t, 0, 0]);
    }
    a.box('coreSeal', at(0, r + lift + .01, width * .22), [.35, .035, .13], [t, 0, 0]);
    a.box('coreRim', at(0, r + lift + .05, width * .22), [.24, .045, .04], [t, 0, 0]);
    if (kind === 'junction') {
      for (const dx of [-.31, .31]) {
        a.cylinder('reservePipe', at(dx, r + lift + .09), .085, .16, [t, 0, 0]);
        a.cylinder('coreSeal', at(dx, r + lift + .18), .068, .035, [t, 0, 0]);
      }
    }
  }
  // Small seats bridge the outer well back to the intact local shell.
  for (const dx of [-length * .38, length * .38]) for (const sign of [-1, 1]) {
    const theta = t + sign * arc * .36;
    layer('coreRim', 0, .025, .12, .12, dx, sign * arc * .36);
    a.beam('silver', polar(x + dx, r + .012, theta), polar(x + dx, r + floor, theta), .04);
  }
}

export function createCore({ layout, resources }) {
  const a = new Assembly(resources), w = layout.working, axis = [0, 0, Math.PI / 2];
  const modules = w.coreModules, detail = w.coreDetail;
  const spineFront = w.coreFront + 2, spineRear = w.engineExit - 20.7;
  const supports = w.coreSupportStations.filter(x => x >= spineFront && x <= spineRear);
  const profiles = modules.map(([, length, radius], i) => coreShellProfile(length, radius,
    detail.modules[i].shoulderLength, detail.modules[i].shoulderInset));
  const shellGroups = [], panelCache = new Map(), ends = new Map();
  a.cylinder('silver', [(spineFront + spineRear) / 2, 0, 0], 2.8, spineRear - spineFront, axis);
  modules.forEach((module, i) => {
    const [x, length, radius] = module, profile = profiles[i], body = new Assembly(resources);
    body.part(coreShellGeometry(profile), 'coreBacking', [x, 0, 0]);
    for (const side of [-1, 1]) {
      const end = x + side * length / 2, endRadius = radiusOnProfile(profile, side * length / 2);
      const cap = new THREE.RingGeometry(2.8, endRadius, 64);
      cap.rotateY(side * Math.PI / 2);
      body.part(cap, 'coreService', [end, 0, 0]);
      if (!ends.has(end)) ends.set(end, []);
      ends.get(end).push(endRadius);
    }
    addCoreCladding(body, i, module, profile, {
      ...detail, supports, cache: panelCache, cutouts: protectedCutouts(i, module, w),
    });
    const group = body.build(`Core module / ${detail.modules[i].role}`);
    for (const feature of detail.modules[i].features) {
      const featureAssembly = new Assembly(resources);
      addCoreFeature(featureAssembly, feature, module, profile, supports);
      group.add(featureAssembly.build(`Core feature / ${feature.kind} / ${feature.localX}`));
      if (feature.kind === 'hatch') {
        const shields = new Assembly(resources);
        addCoreMaintenanceShield(shields, module, profile, feature, {
          ...detail, config: detail.modules[i], cache: panelCache, supports,
          cutouts: protectedCutouts(i, module, w),
        });
        group.add(shields.build(`Core maintenance shield / ${feature.localX}`));
      }
    }
    shellGroups.push(group);
  });
  // One joint at the touching front modules, independent collars elsewhere.
  for (const [x, radii] of ends) {
    const radius = Math.max(...radii), inner = Math.min(...radii);
    a.part(arcGeometry((radius + inner) / 2, .16, radius - inner + .12, TAU, .015, 64),
      'coreRim', [x, 0, 0]);
    a.part(arcGeometry(radius + .055, .12, .11, TAU, .012, 64), 'coreService', [x, 0, 0]);
    for (let i = 0; i < 16; i++) {
      const t = (i + .5) * TAU / 16;
      a.cylinder('coreRim', polar(x, radius + .10, t), .025, .045, [t, 0, 0]);
    }
    if (radii.length === 1) {
      const module = modules.find(([cx, length]) => Math.abs(Math.abs(x - cx) - length / 2) < .001);
      const side = Math.sign(x - module[0]);
      a.cylinder('coreService', [x + side * .26, 0, 0], 2.93, .52, axis);
      a.part(arcGeometry(2.95, .1, .12, TAU, .01, 48), 'coreRim', [x + side * .49, 0, 0]);
    }
  }
  // Four fixed chords remain at the approved radius, inside the rotor bores.
  // Straight face diagonals would cut through the pressure modules. Closed
  // support rings transfer restraint through the fixed shell/bearing frames;
  // their actual stiffness is still an engineering assumption, not verified.
  const chordRadius = 5.15, chordWidth = w.structuralSections.coreChord[0];
  for (const x of supports) {
    const localRadii = modules.flatMap(([centre, length], i) => Math.abs(x - centre) <= length / 2 + .001
      ? [radiusOnProfile(profiles[i], x - centre)] : []);
    const bearing = [[w.mainX, 6.1, 6.2], [w.counterX, 5, 2.8]]
      .find(([centre, , halfLength]) => Math.abs(x - centre) <= halfLength);
    const shellRadius = bearing ? bearing[1] : localRadii.length ? Math.max(...localRadii) : 2.8;
    a.part(arcGeometry(shellRadius + .1, .3, .2, Math.PI * 2, .04, 48), 'coreRim', [x, 0, 0]);
    for (let i = 0; i < 4; i++) {
      const t = Math.PI / 4 + i * Math.PI / 2;
      a.beam('silver', polar(x, shellRadius + .2, t), polar(x, chordRadius, t), .25);
      a.beam('silver', polar(x - .12, chordRadius, t), polar(x + .12, chordRadius, t), chordWidth + .06);
      for (const dx of [-.2, .2]) {
        a.box('frame', polar(x + dx, chordRadius, t), [.12, .5, .5], [t, 0, 0]);
      }
    }
  }
  for (let i = 0; i < 4; i++) {
    const t = Math.PI / 4 + i * Math.PI / 2;
    for (let j = 0; j < supports.length - 1; j++)
      a.beam('hull', polar(supports[j], chordRadius, t), polar(supports[j + 1], chordRadius, t), chordWidth);
  }
  for (const [x, radius, length] of [[w.mainX, 6.1, 12.4], [w.counterX, 5, 5.6]]) {
    a.cylinder('dark', [x, 0, 0], radius, length, axis);
    for (const side of [-1, 1]) {
      const end = x + side * (length / 2 + .5);
      a.cylinder('hullShade', [end, 0, 0], radius + .25, .65, axis);
      for (let i = 0; i < 8; i++) {
        const t = i * Math.PI / 4;
        a.box('service', [end, (radius + .6) * Math.cos(t), (radius + .6) * Math.sin(t)], [1.1, 1, 1.3], [t, 0, 0]);
        a.box('silver', [end + side * .85, radius * Math.cos(t), radius * Math.sin(t)], [.4, .55, .8], [t, 0, 0]);
      }
    }
  }
  // Fixed service collars sit outside the rotating hub's axial envelope.
  // Annular geometry leaves the central pressure corridor continuous.
  for (const [x, rotorRadius, halfLength] of [[w.mainX, 7.5, 6.2], [w.counterX, 6, 2.8]]) {
    for (const side of [-1, 1]) {
      // Front collars stay inside the existing rotating crew-guide bores.
      const radius = rotorRadius - (side < 0 ? (x === w.mainX ? .8 : .35) : 0);
      const end = x + side * (halfLength + .65);
      a.part(arcGeometry(radius, 1.1, 1.1, Math.PI * 2, .16, 64), 'hull', [end, 0, 0]);
      a.part(arcGeometry(radius, .22, 1.25, Math.PI * 2, .06, 64), 'silver', [end + side * .62, 0, 0]);
      // Dark separation, conductive slip-ring bands and independent fluid ring.
      for (const [offset, r, mat] of [[1, radius - .35, 'dark'], [1.35, radius - .4, 'foil'],
        [1.65, radius - .4, 'silver'], [2, radius - .4, 'foil'], [2.5, radius - .65, 'reservePipe']])
        a.part(arcGeometry(r, .2, .3, Math.PI * 2, .04, 64), mat, [end + side * offset, 0, 0]);
      for (let i = 0; i < 8; i++) {
        const t = i * Math.PI / 4;
        a.beam('silver', polar(end, radius - 1.5, t), polar(end, radius, t), .4);
        a.box('dark', polar(end + side * 1.65, radius, t), [1.7, .65, .85], [t, 0, 0]);
        a.box('silver', polar(end, radius + .62, t), [.75, .32, .65], [t, 0, 0]);
      }
      const t = -Math.PI / 4;
      a.box('service', polar(end + side * 2.5, radius, t), [1.2, 1.1, 1.8], [t, 0, 0]);
      a.box('dark', polar(end + side * 1.1, radius + .85, t + .5), [1.1, .7, 1.1], [t + .5, 0, 0]);
      for (const dr of [-.25, .25]) pipe(a, 'reservePipe', [
        polar(end + side * 3.5, 4.9, t + dr), polar(end + side * 3.5, radius, t + dr),
        polar(end + side * 2.5, radius, t + dr)], .1);
    }
  }
  // Exterior fixed-side supply lines stop at bearing service equipment.
  for (const z of [-3.5, 3.5]) {
    for (const [start, end] of [[modules[1][0], w.counterX - 3.4],
      [w.counterX + 3.4, -7.1], [7.1, spineRear - .8]]) {
      a.beam('silver', [start, 3.9, z], [end, 3.9, z], .19);
      for (let x = start + 1; x < end - .5; x += 3.1) {
        a.box('coreRim', [x, 3.9, z], [.12, .24, .24]);
      }
      for (const x of [start, end]) a.box('coreService', [x, 3.9, z], [.23, .25, .25]);
    }
  }
  const object = a.build('Fixed modular core');
  object.add(...shellGroups);
  // One fixed boarding vestibule serves the main rotor. The rotating-side
  // locks are depicted disconnected with their doors closed; no fixed beam or
  // pressure tube is attached across the moving interface.
  const boarding = new Assembly(resources), angle = Math.PI / w.mainSegments;
  const tr = w.mainTransferRadius, bx = w.mainX - 12.3;
  boarding.beam('hull', polar(bx, 4.3, angle), polar(bx, tr, angle), 2.2, 2.3);
  boarding.box('hull', polar(bx, tr, angle), [2.8, 2.6, 2.6], [angle, 0, 0]);
  boarding.cylinder('silver', polar(bx + 1.5, tr, angle), 1, .18, axis);
  boarding.cylinder('dark', polar(bx + 1.65, tr, angle), .82, .08, axis);
  boarding.box('hullShade', polar(bx + 1.71, tr, angle), [.06, 1.18, 1.05], [angle, 0, 0]);
  boarding.box('crewLabel', polar(bx - 1.45, tr, angle), [.08, .6, 1.6], [angle, 0, 0]);
  boarding.box('glass', polar(bx - 1.45, tr - .8, angle), [.08, .45, .8], [angle, 0, 0]);
  for (const dx of [-1.3, 1.3])
    boarding.beam('silver', polar(bx + dx, 4.5, angle), polar(bx + dx, tr - 1.3, angle), .06);
  object.add(boarding.build('Main fixed boarding vestibule / closed docking port'));
  const counterBoarding = new Assembly(resources), ca = w.counterPodCentreBay * Math.PI * 2 / w.counterStorageBays;
  const cr = w.counterTransferRadius, cx = w.counterX - 9;
  counterBoarding.beam('hull', polar(cx, 4.3, ca), polar(cx, cr, ca), 2.2, 2.3);
  counterBoarding.box('hull', polar(cx, cr, ca), [2.8, 2.6, 2.6], [ca, 0, 0]);
  counterBoarding.cylinder('silver', polar(cx + 1.5, cr, ca), 1, .18, axis);
  counterBoarding.cylinder('dark', polar(cx + 1.65, cr, ca), .82, .08, axis);
  counterBoarding.box('hullShade', polar(cx + 1.71, cr, ca), [.06, 1.18, 1.05], [ca, 0, 0]);
  counterBoarding.box('crewLabel', polar(cx - 1.45, cr, ca), [.08, .6, 1.6], [ca, 0, 0]);
  for (const dx of [-1.3, 1.3]) counterBoarding.beam('silver', polar(cx + dx, 4.5, ca), polar(cx + dx, cr - 1.3, ca), .06);
  object.add(counterBoarding.build('Counter fixed boarding vestibule / closed docking port'));
  return { object, anchors: {
    lab: anchor(object, 'Analysis and sample preservation', [modules[2][0], 5.5, -2]),
    personnel: anchor(object, 'Four-person support', [modules[0][0], 5.3, 0]),
    mainBearing: anchor(object, 'Main fixed-side rotary interface', [6.9, 6, 0]),
    counterBearing: anchor(object, 'Counter fixed-side rotary interface', [w.counterX - 3.3, 5, 0]),
    mainBoarding: anchor(object, 'Main fixed boarding vestibule', polar(bx - 1.6, tr, angle)),
    counterBoarding: anchor(object, 'Counter fixed boarding vestibule', polar(cx - 1.6, cr, ca)),
  } };
}
