import { Assembly, anchor, pipe } from './assembly.js';

// Replaceable equipment boxes use the same grey-white cladding as the core.
function cabinet(a, [x, y, z], size, material = 'hullShade') {
  const [width, height, length] = size;
  a.box(material, [x, y, z], size);
  a.box('hull', [x, y + height / 2 + .04, z], [width - .25, .1, length - .2]);
  a.box('hullPanel', [x - width / 2 - .04, y, z], [.1, height - .2, length - .2]);
  for (const sign of [-1, 1]) {
    a.box('silver', [x - width / 2 - .12, y, z + sign * (length / 2 - .32)], [.1, .6, .12]);
    for (const side of [-1, 1])
      a.box('silver', [x + side * (width / 2 - .3), y - height / 2 - .15, z + sign * (length / 2 - .3)], [.35, .3, .35]);
  }
  for (const dy of [-.25, 0, .25])
    a.box('dark', [x - width / 2 - .1, y + dy, z], [.025, .055, length * .45]);
}

function energyEquipment(a, sign) {
  const at = (x, y, z) => [x, y, sign * z];
  // Four battery drawers at the root; their count does not prescribe capacity.
  for (const z of [8, 10.8, 13.6, 16.4]) {
    a.beam('silver', at(14, -3, z), at(20, -3, z), .08);
    a.box('frame', at(17, -2.85, z), [4.5, .3, 2.3]);
    cabinet(a, at(17, -1.35, z), [3.8, 2.1, 2.2]);
  }
  a.beam('silver', at(14, -3, 19), at(20, -3, 19), .08);
  a.box('frame', at(17, -2.75, 19), [4.5, .5, 2.3]);
  cabinet(a, at(17, -1.3, 19), [3.6, 1.8, 2.1], 'service');
  // Two distinct power-conditioning trays, with reachable connector faces.
  for (const z of [23, 27]) {
    a.beam('silver', at(14, 0, z), at(20, 0, z), .08);
    a.box('frame', at(17, .2, z), [4.8, .4, 3.2]);
    for (const x of [15.9, 18.1]) cabinet(a, at(x, 1.05, z), [1.7, 1.3, 2.5]);
    a.box('service', at(17, .8, z - 1.1), [.35, .65, .35]);
  }
  // Twin pumps and a small coolant compensation tank near the radiator saddle.
  for (const z of [27.3, 29.7]) a.beam('silver', at(14, -3, z), at(20, -3, z), .1);
  a.box('frame', at(17, -2.8, 28.5), [4.8, .4, 3]);
  for (const x of [15.9, 18.1]) {
    a.box('silver', at(x, -2.35, 28.5), [1, .5, 1]);
    a.cylinder('silver', at(x, -1.35, 28.5), .45, 1.5);
    a.cylinder('dark', at(x, -.55, 28.5), .48, .2);
    a.box('hull', at(x, -1.2, 29.3), [1, 1.3, .55]);
    pipe(a, 'reservePipe', [at(x, -1.8, 28.5), at(x, -1.8, 28), at(21.5, -.9, 28)], .1);
  }
  a.cylinder('tank', at(18.6, -1, 36), .7, 2.2, [Math.PI / 2, 0, 0]);
  for (const offset of [-1.1, 1.1])
    a.part(a.resources.geometries.sphere, 'tank', at(18.6, -1, 36 + offset), [.7, .7, .45]);
  for (const offset of [-.65, .65]) {
    a.beam('silver', at(14, -3, 36 + offset), at(20, -3, 36 + offset), .08);
    a.cylinder('silver', at(18.6, -1, 36 + offset), .75, .16, [Math.PI / 2, 0, 0]);
    a.box('silver', at(18.6, -2.35, 36 + offset), [.7, 1.4, .35]);
  }
  pipe(a, 'reservePipe', [at(18.6, -1, 34.8), at(18.6, -1.8, 33.5), at(17, -1.8, 28.5)], .1);
  // One spare-unit pallet; the outer bays remain open for servicing.
  a.beam('silver', at(14, 0, 39.5), at(20, 0, 39.5), .08);
  a.box('frame', at(17.5, .25, 39.5), [4.2, .5, 3.3]);
  cabinet(a, at(16.4, 1.1, 39.5), [1.5, 1.2, 2.4]);
  a.box('foil', at(18.6, 1, 39.5), [1.2, 1, 2]);
  for (const z of [38.5, 40.5]) a.beam('silver', at(14.8, .6, z), at(19.5, .6, z), .025);
  // Narrow outboard rails and one parked inspection carriage; no work animation.
  for (const x of [13.2, 13.8]) a.beam('silver', at(x, -3.3, 18), at(x, -3.3, 53), .05);
  for (const z of [18, 25, 32, 39, 46, 53])
    a.beam('frame', at(14, -3, z), at(13.2, -3.3, z), .04);
  a.box('silver', at(13.5, -3.7, 44), [1.7, .6, 2.1]);
  a.box('hull', at(13.5, -4.35, 44), [1.4, .7, 1.7]);
  a.beam('silver', at(13.5, -4.7, 44), at(13.5, -5.6, 44.7), .025);
  a.box('dark', at(13.5, -5.6, 44.7), [.5, .4, .6]);
  a.part(a.resources.geometries.sphere, 'glass', at(13.5, -5.6, 45.05), [.13, .13, .13]);
  a.beam('silver', at(14, 0, 53), at(20, 0, 53), .08);
  cabinet(a, at(17, 1, 53), [2.2, 1.5, 2.3], 'service');
  // Continuous cable trays and separately clipped coolant supply / return lines.
  for (let z = 8; z <= 53; z += 5) {
    a.box('frame', at(16, -3.65, z), [.85, .22, 4.9]);
    a.box('silver', at(16, -3.8, z), [.65, .08, 4.8]);
    a.beam('silver', at(14, -3, z), at(16, -3.65, z), .025);
  }
  for (const x of [18, 18.5]) pipe(a, 'reservePipe', [at(x, -3.5, 5), at(x, -3.5, 20), at(x, -3.5, 32)], .1);
}

export function createEnergyThermal({ layout, resources }) {
  const a = new Assembly(resources), w = layout.working;
  const solarPositions = [], radiatorPositions = [];
  for (const sign of [-1, 1]) {
    // Short root brackets tie both chords into the adjacent fixed pressure shells.
    for (const y of [-3, 0]) {
      a.beam('silver', [12, y, sign * Math.sqrt(4.5 ** 2 - y ** 2)], [14, y, sign * 4.5], .55);
      a.beam('silver', [20, y, sign * Math.sqrt(3.8 ** 2 - y ** 2)], [20, y, sign * 4.5], .55);
    }
    // Fixed two-level energy truss attaches aft of the main ring.
    for (const x of [14, 20]) for (const y of [-3, 0]) a.beam('silver', [x, y, sign * 4.5], [x, y, sign * w.solarRootZ], .4);
    for (let i = 0; i <= 8; i++) {
      const bay = (w.solarRootZ - 5) / 8;
      const z = sign * (5 + i * bay), nz = z + sign * bay;
      for (const y of [-3, 0]) {
        a.beam('frame', [14, y, z], [20, y, z], .08);
        if (i < 8) a.beam('frame', [14, y, z], [20, y, nz], .12);
      }
      for (const x of [14, 20]) a.beam('frame', [x, -3, z], [x, 0, z], .06);
    }
    energyEquipment(a, sign);
    pipe(a, 'silver', [[15, -3.6, sign * 4.7], [15, -3.6, sign * 20], [15, -3.6, sign * w.solarRootZ]], .14);
    for (const x of [16, 32]) {
      // Two wings per side, with separate root bearings and deployment masts.
      a.beam('silver', [20, -1.5, sign * (w.solarRootZ - 3)], [x, -4, sign * w.solarRootZ], .16);
      a.beam('frame', [20, 0, sign * (w.solarRootZ - 7)], [x, -3.5, sign * w.solarRootZ], .1);
      a.cylinder('dark', [x, -3.3, sign * w.solarRootZ], 1.25, 1.3);
      a.cylinder('hullShade', [x, -3.3, sign * w.solarRootZ], 1.3, .9);
      a.cylinder('silver', [x, -4, sign * w.solarRootZ], 1.35, .32);
      a.box('service', [x, -1.7, sign * (w.solarRootZ - 1)], [1.8, 1.7, 2.1]);
      // Three blanket groups share one open deployment mast. The metre-wide
      // group joints and split blankets survive far-view downsampling.
      const groups = 3, piecesPerGroup = 3, groupGap = 1, centreGap = .45;
      const groupLength = (w.solarWingLength - (groups - 1) * groupGap) / groups;
      const pitch = groupLength / piecesPerGroup;
      const blanketWidth = (w.solarPanelWidth - centreGap) / 2;
      const start = sign * w.solarRootZ, end = sign * (w.solarRootZ + w.solarWingLength);
      for (const dx of [-.2, .2]) for (const dy of [-.4, .4])
        a.beam('silver', [x + dx, -4.4 + dy, start], [x + dx, -4.4 + dy, end], .05);
      const mastBays = 18;
      for (let i = 0; i < mastBays; i++) {
        const z0 = sign * (w.solarRootZ + i * w.solarWingLength / mastBays);
        const z1 = sign * (w.solarRootZ + (i + 1) * w.solarWingLength / mastBays);
        for (const dx of [-.2, .2]) {
          a.beam('frame', [x + dx, -4.8, z0], [x + dx, -4, z1], .02);
          a.beam('silver', [x + dx, -4.8, z0], [x + dx, -4, z0], .025);
        }
      }
      for (let group = 0; group < groups; group++) for (let i = 0; i < piecesPerGroup; i++) {
        const distance = group * (groupLength + groupGap) + (i + .5) * pitch;
        const z = sign * (w.solarRootZ + distance);
        for (const side of [-1, 1]) {
          const px = x + side * (centreGap / 2 + blanketWidth / 2);
          a.box('frame', [px, -4, z], [blanketWidth + .1, .19, pitch - .08]);
          for (const y of [-3.87, -4.13])
            a.part(resources.geometries.box, 'solar', [px, y, z], [blanketWidth, .08, pitch - .18]);
          a.beam('silver', [px - blanketWidth / 2, -4, z + sign * pitch / 2],
            [px + blanketWidth / 2, -4, z + sign * pitch / 2], .025);
          a.beam('frame', [px, -4.1, z], [x, -4.8, z + sign * pitch / 2], .04);
        }
      }
      for (let group = 1; group < groups; group++) {
        const z = sign * (w.solarRootZ + group * groupLength + (group - .5) * groupGap);
        a.beam('silver', [x - w.solarPanelWidth / 2, -4, z], [x + w.solarPanelWidth / 2, -4, z], .05);
        for (const dx of [-w.solarPanelWidth / 2, 0, w.solarPanelWidth / 2]) {
          a.box('silver', [x + dx, -4, z], [.25, .25, .45]);
          a.cylinder('dark', [x + dx, -4, z], .08, .45, [Math.PI / 2, 0, 0]);
        }
        pipe(a, 'silver', [[x + .3, -4.4, z - sign * .6], [x + .4, -4.55, z], [x + .3, -4.4, z + sign * .6]], .06);
      }
      solarPositions.push([x, -4, sign * (w.solarRootZ + w.solarWingLength / 2)]);
    }
    // Opposed radiator assemblies share the Z-side energy truss. Positive
    // dimensions and reflected endpoints mirror the geometry without negative
    // instance scales. Equipment stays clear of both deployment roots.
    const x = w.radiatorRootX, z = sign * w.radiatorRootZ, startY = w.radiatorStartY;
    a.beam('silver', [14, 0, z], [20, 0, z], .12);
    for (const direction of [1, -1]) {
      a.box('frame', [x, direction * .4, z], [3.8, .8, 2.7]);
      a.cylinder('dark', [x, direction * 1.1, z], .95, 1.5, [0, 0, Math.PI / 2]);
      a.beam('silver', [x, direction * 1.1, z], [x, direction * startY, z], .16);
      // Side-mounted manifolds avoid the existing power-conditioning trays.
      a.beam('silver', [20, 0, z - sign * 4], [21.5, direction * .9, z - sign * 4], .06);
      a.box('service', [21.5, direction * .9, z - sign * 4], [2.1, 1.5, 2.4]);
      for (let i = 0; i < 6; i++) {
        const length = w.radiatorLength / 6, height = startY + (i + .5) * length;
        const y = direction * height;
        a.box('radiator', [x, y, z], [.2, length - .18, w.radiatorWidth]);
        for (const dz of [-w.radiatorWidth / 2, w.radiatorWidth / 2])
          a.beam('silver', [x + .22, direction * (height - length / 2), z + dz],
            [x + .22, direction * (height + length / 2), z + dz], .05, .025);
        for (const dy of [-length / 2, length / 2])
          a.beam('silver', [x + .32, direction * (height + dy), z - w.radiatorWidth / 2],
            [x + .32, direction * (height + dy), z + w.radiatorWidth / 2], .05, .025);
        a.beam('frame', [x + .43, direction * (height - length / 2), z - (w.radiatorWidth / 2 - .1)],
          [x + .43, direction * (height + length / 2), z + (w.radiatorWidth / 2 - .1)], .03);
        a.box('silver', [x, direction * (height + length / 2), z], [.65, .4, .8]);
      }
      for (const dz of [-w.radiatorWidth / 2 + .5, w.radiatorWidth / 2 - .5])
        pipe(a, 'silver', [[21.5, direction * .9, z - sign * 4], [x + .5, direction * startY, z + dz],
          [x + .5, direction * (startY + w.radiatorLength), z + dz]], .13);
      radiatorPositions.push([x, direction * (startY + w.radiatorLength / 2), z]);
    }
    // Feed trunks stay above the occupied truss bays before branching at the
    // outboard manifold; they do not pass through battery or converter boxes.
    for (const dx of [-.35, .35]) pipe(a, 'silver', [[18 + dx, .3, sign * 4.7], [18 + dx, .3, sign * 20],
      [21.5 + dx, 3, z - sign * 8], [21.5 + dx, 3, z - sign * 4], [21.5 + dx, -.9, z - sign * 4]], .12);

  }
  const object = a.build('Fixed energy and thermal wings');
  object.position.x = w.energyAxialOffset;
  return { object, anchors: {
    solar: solarPositions.map((p, i) => anchor(object, `Photovoltaic wing ${i + 1}`, p)),
    radiators: radiatorPositions.map((p, i) => anchor(object, `Radiator ${i + 1}`, p)),
  } };
}
