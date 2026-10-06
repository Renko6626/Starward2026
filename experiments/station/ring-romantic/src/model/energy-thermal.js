import { Assembly, anchor, pipe } from './assembly.js';

export function createEnergyThermal({ layout, resources }) {
  const a = new Assembly(resources), w = layout.working;
  const solarPositions = [], radiatorPositions = [];
  for (const sign of [-1, 1]) {
    // Fixed two-level energy truss attaches aft of the main ring.
    for (const x of [14, 20]) for (const y of [-3, 0]) a.beam('silver', [x, y, sign * 4.5], [x, y, sign * w.solarRootZ], .4);
    for (let i = 0; i <= 8; i++) {
      const bay = (w.solarRootZ - 5) / 8;
      const z = sign * (5 + i * bay), nz = z + sign * bay;
      for (const y of [-3, 0]) {
        a.beam('frame', [14, y, z], [20, y, z], .22);
        if (i < 8) a.beam('frame', [14, y, z], [20, y, nz], .22);
      }
      for (const x of [14, 20]) a.beam('frame', [x, -3, z], [x, 0, z], .22);
      if (i % 2 === 1) {
        a.box('frame', [17, .4, z], [3.8, .5, 2.3]);
        a.box('service', [17, 1.3, z], [2.8, 1.3, 1.8]);
        a.box('foil', [19.1, .8, z], [1, 1, 1.3]);
      }
    }
    pipe(a, 'silver', [[15, -3.6, sign * 4.7], [15, -3.6, sign * 20], [15, -3.6, sign * w.solarRootZ]], .14);
    for (const x of [16, 32]) {
      // Two wings per side, with separate root bearings and deployment masts.
      a.beam('silver', [20, -1.5, sign * (w.solarRootZ - 3)], [x, -4, sign * w.solarRootZ], .6);
      a.beam('frame', [20, 0, sign * (w.solarRootZ - 7)], [x, -3.5, sign * w.solarRootZ], .3);
      a.cylinder('dark', [x, -3.3, sign * w.solarRootZ], 1.25, 1.3);
      a.cylinder('silver', [x, -4, sign * w.solarRootZ], 1.35, .32);
      a.box('service', [x, -1.7, sign * (w.solarRootZ - 1)], [1.8, 1.7, 2.1]);
      const pieces = 7, panelLength = w.solarWingLength / pieces;
      for (let i = 0; i < pieces; i++) {
        const z = sign * (w.solarRootZ + (i + .5) * panelLength);
        a.box('frame', [x, -4, z], [w.solarPanelWidth + .24, .19, panelLength - .09]);
        a.part(resources.geometries.box, 'solar', [x, -3.87, z], [w.solarPanelWidth, .08, panelLength - .22]);
        a.part(resources.geometries.box, 'solar', [x, -4.13, z], [w.solarPanelWidth, .08, panelLength - .22]);
        a.beam('silver', [x - 3.7, -4, z + sign * panelLength / 2], [x + 3.7, -4, z + sign * panelLength / 2], .12);
        a.box('silver', [x, -4.3, z + sign * panelLength / 2], [.85, .55, .65]);
        a.beam('silver', [x, -4.8, z - panelLength / 2], [x, -4.8, z + panelLength / 2], .22);
        a.beam('frame', [x - 3.3, -4.25, z], [x, -4.85, z + panelLength / 2], .1);
        a.beam('frame', [x + 3.3, -4.25, z], [x, -4.85, z - panelLength / 2], .1);
      }
      solarPositions.push([x, -4, sign * (w.solarRootZ + w.solarWingLength / 2)]);
    }
    // The root saddle attaches directly to the photovoltaic truss. The YZ
    // radiator extends along +Y, leaving the outward Z photovoltaic spans clear.
    const x = w.radiatorRootX, z = sign * w.radiatorRootZ, startY = w.radiatorStartY;
    a.beam('silver', [14, 0, z], [20, 0, z], .5);
    a.box('frame', [x, .4, z], [3.8, .8, 2.7]);
    a.cylinder('dark', [x, 1.1, z], .95, 1.5, [0, 0, Math.PI / 2]);
    a.beam('silver', [x, 1.1, z], [x, startY, z], .6);
    a.box('service', [18.5, .9, z - sign * 4], [2.1, 1.5, 2.4]);
    for (const dx of [-.35, .35]) pipe(a, 'silver', [[18 + dx, .3, sign * 4.7], [18 + dx, .3, sign * 20], [18.5 + dx, .9, z - sign * 4]], .12);
    for (let i = 0; i < 6; i++) {
      const length = w.radiatorLength / 6, y = startY + (i + .5) * length;
      a.box('radiator', [x, y, z], [.2, length - .18, w.radiatorWidth]);
      for (const dz of [-w.radiatorWidth / 2, w.radiatorWidth / 2]) {
        a.beam('silver', [x + .22, y - length / 2, z + dz], [x + .22, y + length / 2, z + dz], .15);
      }
      for (const dy of [-length / 2, length / 2]) a.beam('silver', [x + .32, y + dy, z - 2.5], [x + .32, y + dy, z + 2.5], .14);
      a.beam('frame', [x + .43, y - length / 2, z - 2.4], [x + .43, y + length / 2, z + 2.4], .13);
      a.box('silver', [x, y + length / 2, z], [.65, .4, .8]);
    }
    for (const dz of [-2, 2]) pipe(a, 'silver', [[18.5, .9, z - sign * 4], [x + .5, startY, z + dz], [x + .5, startY + w.radiatorLength, z + dz]], .13);
    radiatorPositions.push([x, startY + w.radiatorLength / 2, z]);
  }
  const object = a.build('Fixed energy and thermal wings');
  object.position.x = w.energyAxialOffset;
  return { object, anchors: {
    solar: solarPositions.map((p, i) => anchor(object, `Photovoltaic wing ${i + 1}`, p)),
    radiators: radiatorPositions.map((p, i) => anchor(object, `Radiator ${i + 1}`, p)),
  } };
}
