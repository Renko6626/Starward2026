import { Assembly, anchor, polar, arcGeometry, pipe } from './assembly.js';

export function createCore({ layout, resources }) {
  const a = new Assembly(resources), w = layout.working, axis = [0, 0, Math.PI / 2];
  // Each cylinder is a distinct functional module with short connecting necks.
  const modules = w.coreModules;
  const spineFront = w.coreFront + 2, spineRear = w.engineExit - 20.7;
  a.cylinder('silver', [(spineFront + spineRear) / 2, 0, 0], 2.8, spineRear - spineFront, axis);
  for (const [x, length, radius, mat] of modules) {
    a.cylinder('pressureHull', [x, 0, 0], radius, length, axis);
    for (const side of [-1, 1]) {
      const end = x + side * length / 2;
      a.cylinder('frame', [end, 0, 0], radius + .14, .48, axis);
      a.cylinder('silver', [end + side * .35, 0, 0], radius - .3, .26, axis);
      for (let i = 0; i < 8; i++) {
        const t = i * Math.PI / 4;
        a.box('silver', [end, Math.cos(t) * (radius + .2), Math.sin(t) * (radius + .2)], [.8, .7, .5], [t, 0, 0]);
      }
    }
    const panels = Math.max(2, Math.ceil((length - 1.6) / 3.2)), pitch = (length - 1.6) / panels;
    for (let seam = 1; seam < panels; seam++)
      a.cylinder('silver', [x - (length - 1.6) / 2 + seam * pitch, 0, 0], radius + .14, .12, axis);
    for (let i = 0; i < 8; i++) {
      const t = i * Math.PI / 4;
      const at = (px, r, tangent = 0) => [px, r * Math.cos(t) - tangent * Math.sin(t), r * Math.sin(t) + tangent * Math.cos(t)];
      for (let panel = 0; panel < panels; panel++) {
        const px = x - (length - 1.6) / 2 + (panel + .5) * pitch;
        const material = i % 3 === 0 ? 'service' : (panel + i) % 5 === 0 ? 'hullWarm' : (panel + i) % 3 === 0 ? 'hullPanel' : mat;
        a.box(material, at(px, radius + .08), [pitch - .12, .18, 2.35], [t, 0, 0]);
        for (const dx of [-1, 1]) for (const dt of [-1, 1])
          a.cylinder('silver', at(px + dx * (pitch / 2 - .19), radius + .2, dt * .97), .055, .09, [t, 0, 0]);
        if ((panel + i) % 4 === 0) {
          a.box('dark', at(px, radius + .2), [pitch * .5, .08, .95], [t, 0, 0]);
          a.box('hullShade', at(px, radius + .26), [pitch * .43, .06, .81], [t, 0, 0]);
        }
      }
      if (i % 2 === 0) {
        const tangent = 1.28;
        a.beam('silver', at(x - length / 2 + .8, radius + .16, tangent), at(x + length / 2 - .8, radius + .16, tangent), .025);
      }
    }
    a.box('foil', [x, -radius - .55, 0], [length * .45, 1.1, 2.1]);
  }
  // Four fixed chords remain at the approved radius, inside the rotor bores.
  // Straight face diagonals would cut through the pressure modules. Closed
  // support rings transfer restraint through the fixed shell/bearing frames;
  // their actual stiffness is still an engineering assumption, not verified.
  const supports = w.coreSupportStations.filter(x => x >= spineFront && x <= spineRear);
  const chordRadius = 5.15, chordWidth = w.structuralSections.coreChord[0];
  for (const x of supports) {
    const module = modules.find(([centre, length]) => Math.abs(x - centre) <= length / 2 + .001);
    const bearing = [[w.mainX, 6.1, 6.2], [w.counterX, 5, 2.8]]
      .find(([centre, , halfLength]) => Math.abs(x - centre) <= halfLength);
    const shellRadius = bearing ? bearing[1] : module ? module[2] : 2.8;
    a.part(arcGeometry(shellRadius + .1, .3, .2, Math.PI * 2, .04, 48), 'silver', [x, 0, 0]);
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
    a.beam('silver', [modules[1][0], 3.9, z], [w.counterX - 3.4, 3.9, z], .19);
    a.beam('silver', [w.counterX + 3.4, 3.9, z], [-7.1, 3.9, z], .19);
    a.beam('silver', [7.1, 3.9, z], [spineRear - .8, 3.9, z], .19);
  }
  a.box('service', [modules[1][0], 5.3, 0], [4.5, 1.5, 3.8]);
  a.box('hullShade', [modules[2][0], 5.6, 0], [3, 1.8, 4.2]);
  const object = a.build('Fixed modular core');
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
