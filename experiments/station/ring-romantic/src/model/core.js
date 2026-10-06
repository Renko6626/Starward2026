import { Assembly, anchor, polar } from './assembly.js';

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
        a.beam('silver', at(x - length / 2 + .8, radius + .16, tangent), at(x + length / 2 - .8, radius + .16, tangent), .07);
      }
    }
    a.box('foil', [x, -radius - .55, 0], [length * .45, 1.1, 2.1]);
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
    boarding.beam('silver', polar(bx + dx, 4.5, angle), polar(bx + dx, tr - 1.3, angle), .2);
  object.add(boarding.build('Main fixed boarding vestibule / closed docking port'));
  const counterBoarding = new Assembly(resources), ca = w.counterPodCentreBay * Math.PI * 2 / w.counterStorageBays;
  const cr = w.counterTransferRadius, cx = w.counterX - 9;
  counterBoarding.beam('hull', polar(cx, 4.3, ca), polar(cx, cr, ca), 2.2, 2.3);
  counterBoarding.box('hull', polar(cx, cr, ca), [2.8, 2.6, 2.6], [ca, 0, 0]);
  counterBoarding.cylinder('silver', polar(cx + 1.5, cr, ca), 1, .18, axis);
  counterBoarding.cylinder('dark', polar(cx + 1.65, cr, ca), .82, .08, axis);
  counterBoarding.box('hullShade', polar(cx + 1.71, cr, ca), [.06, 1.18, 1.05], [ca, 0, 0]);
  counterBoarding.box('crewLabel', polar(cx - 1.45, cr, ca), [.08, .6, 1.6], [ca, 0, 0]);
  for (const dx of [-1.3, 1.3]) counterBoarding.beam('silver', polar(cx + dx, 4.5, ca), polar(cx + dx, cr - 1.3, ca), .2);
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
