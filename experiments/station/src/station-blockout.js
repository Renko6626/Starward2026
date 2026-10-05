import * as THREE from 'three';
import { createSolarCellTexture, createStationSurfaceMaps } from './materials.js';

// One scene unit = one metre for this study. These are geometry/placeholders,
// not pressure-shell, launch, mass, propulsion or thermal design parameters.
export const BLOCKOUT_DIMENSIONS = {
  ecologyInternalDiameter: 10,
  ecologyNetHeight: 8,
  ecologyOuterDiameter: 10.8,
  forestStraightLength: 14,
  wetlandStraightLength: 9,
  mainBeamLength: 58.4,
  propellantTankDiameter: 4.6,
  propellantTankStraightLength: 5.6,
  armRailLength: 40,
  communicationDishDiameter: 7.2,
  solarWingWidth: 12,
  solarWingLength: 24,
};

export function createStationBlockout() {
  const object = new THREE.Group(); object.name = 'Torifune research layout A';
  const envelopes = new THREE.Group(); envelopes.name = 'Operation envelopes';
  envelopes.visible = false;
  const markers = [];
  const surfaces = createStationSurfaceMaps();
  const coating = { roughnessMap: surfaces.paintRoughness, bumpMap: surfaces.paintHeight, bumpScale: .004 };
  const panelCoating = { ...coating, map: surfaces.panel };
  const metalFinish = { roughnessMap: surfaces.metalRoughness };
  const blanketFinish = { map: surfaces.blanket, bumpMap: surfaces.foilHeight, bumpScale: .045, roughnessMap: surfaces.metalRoughness };
  const materials = {
    ecology: new THREE.MeshStandardMaterial({ color: 0x839195, roughness: .76, metalness: .12, ...coating }),
    hullBone: new THREE.MeshStandardMaterial({ color: 0xd7dcd7, roughness: .78, metalness: .08, ...panelCoating }),
    hullGrey: new THREE.MeshStandardMaterial({ color: 0xb4c0c2, roughness: .68, metalness: .18, ...panelCoating }),
    hullBlue: new THREE.MeshStandardMaterial({ color: 0x7f98a5, roughness: .71, metalness: .12, ...panelCoating }),
    tank: new THREE.MeshStandardMaterial({ color: 0xb9beb9, roughness: .47, metalness: .78, ...metalFinish }),
    foil: new THREE.MeshStandardMaterial({ color: 0xc2ad82, roughness: .74, metalness: .66, ...blanketFinish, bumpScale: .24, roughnessMap: surfaces.foilHeight }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0xb2d4dd, roughness: .08, metalness: 0, ior: 1.46, clearcoat: 1, clearcoatRoughness: .1, envMapIntensity: .7, transparent: true, opacity: .16, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true }),
    gasket: new THREE.MeshStandardMaterial({ color: 0x27363b, roughness: .92, metalness: 0 }),
    windowFrame: new THREE.MeshStandardMaterial({ color: 0xd4dce0, roughness: .34, metalness: .8, ...metalFinish }),
    soil: new THREE.MeshStandardMaterial({ color: 0x5c5546, roughness: 1 }),
    foliage: new THREE.MeshStandardMaterial({ color: 0x587752, roughness: .95 }),
    foliageLight: new THREE.MeshStandardMaterial({ color: 0x739367, roughness: .95 }),
    trunk: new THREE.MeshStandardMaterial({ color: 0x71614c, roughness: 1 }),
    water: new THREE.MeshStandardMaterial({ color: 0x557d86, roughness: .24, metalness: .18 }),
    service: new THREE.MeshStandardMaterial({ color: 0x82949d, roughness: .73, metalness: .16, ...coating }),
    structure: new THREE.MeshStandardMaterial({ color: 0x9ba8b2, roughness: .5, metalness: .68, ...metalFinish }),
    truss: new THREE.MeshStandardMaterial({ color: 0xa6afb6, roughness: .58, metalness: .84, envMapIntensity: .9, ...metalFinish }),
    trussJoint: new THREE.MeshStandardMaterial({ color: 0x657078, roughness: .52, metalness: .78, ...metalFinish }),
    equipment: new THREE.MeshStandardMaterial({ color: 0x627985, roughness: .76, metalness: .18, ...coating }),
    engine: new THREE.MeshStandardMaterial({ color: 0x535d65, roughness: .62, metalness: .65, side: THREE.DoubleSide }),
    nozzleJacket: new THREE.MeshStandardMaterial({ color: 0x8a9396, roughness: .48, metalness: .72, ...metalFinish }),
    nozzleExtension: new THREE.MeshStandardMaterial({ color: 0x666762, roughness: .7, metalness: .48 }),
    nozzleInterior: new THREE.MeshStandardMaterial({ color: 0x252b30, roughness: .94, metalness: .15, side: THREE.BackSide }),
    insulation: new THREE.MeshStandardMaterial({ color: 0xd9d7c9, roughness: .98, metalness: .04, ...blanketFinish, bumpScale: .018 }),
    plumbing: new THREE.MeshStandardMaterial({ color: 0xc3cdd0, roughness: .3, metalness: .85, ...metalFinish }),
    arm: new THREE.MeshStandardMaterial({ color: 0xd3d1c5, roughness: .79, metalness: .1, ...coating }),
    transportArm: new THREE.MeshStandardMaterial({ color: 0x96a9b4, roughness: .76, metalness: .12, ...coating }),
    joint: new THREE.MeshStandardMaterial({ color: 0x536774, roughness: .46, metalness: .65, ...metalFinish }),
    antenna: new THREE.MeshStandardMaterial({ color: 0xd5d6ce, roughness: .66, metalness: .3, side: THREE.DoubleSide }),
    antennaBack: new THREE.MeshStandardMaterial({ color: 0x73828a, roughness: .62, metalness: .48, side: THREE.DoubleSide }),
    docking: new THREE.MeshStandardMaterial({ color: 0xc2c8c9, roughness: .36, metalness: .82, ...metalFinish }),
    hatch: new THREE.MeshStandardMaterial({ color: 0x475966, roughness: .78, metalness: .2 }),
    guide: new THREE.MeshStandardMaterial({ color: 0xb7a276, roughness: .76, metalness: .1 }),
    panels: new THREE.MeshStandardMaterial({ color: 0xffffff, map: createSolarCellTexture(), roughness: .36, metalness: .28, side: THREE.DoubleSide }),
    radiator: new THREE.MeshStandardMaterial({ color: 0xb9c0c2, roughness: .85, metalness: .05, side: THREE.DoubleSide }),
  };
  const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
  // Small chamfers catch light along extruded metal members; flat faces stay
  // distinct from the round plumbing and the painted robotic arms.
  const trussSection = new THREE.Shape();
  const corners = [[-.4, -.5], [.4, -.5], [.5, -.4], [.5, .4], [.4, .5], [-.4, .5], [-.5, .4], [-.5, -.4]];
  corners.forEach(([x, y], i) => i ? trussSection.lineTo(x, y) : trussSection.moveTo(x, y));
  trussSection.closePath();
  const trussGeometry = new THREE.ExtrudeGeometry(trussSection, { depth: 1, bevelEnabled: false });
  trussGeometry.translate(0, 0, -.5); trussGeometry.rotateX(Math.PI / 2);
  const cylinderGeometry = new THREE.CylinderGeometry(1, 1, 1, 28);
  const headGeometry = new THREE.SphereGeometry(1, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2);
  const up = new THREE.Vector3(0, 1, 0);
  const vector = (p) => new THREE.Vector3(...p);

  function mesh(geometry, material, position, scale, parent = object) {
    const part = new THREE.Mesh(geometry, materials[material]);
    part.position.set(...position); part.scale.set(...scale);
    part.castShadow = true; part.receiveShadow = true;
    parent.add(part); return part;
  }
  const box = (material, position, size) => mesh(boxGeometry, material, position, size);
  function link(material, start, end, radius) {
    const a = vector(start), b = vector(end), direction = b.clone().sub(a);
    const part = mesh(cylinderGeometry, material, a.clone().add(b).multiplyScalar(.5).toArray(), [radius, direction.length(), radius]);
    part.quaternion.setFromUnitVectors(up, direction.normalize()); return part;
  }
  function trussMember(start, end, radius, ferrules = false) {
    const a = vector(start), b = vector(end), axis = b.clone().sub(a).normalize();
    const part = mesh(trussGeometry, 'truss', a.clone().add(b).multiplyScalar(.5).toArray(), [radius * 2, a.distanceTo(b), radius * 2]);
    part.quaternion.setFromUnitVectors(up, axis);
    if (ferrules) for (const [point, sign] of [[a, 1], [b, -1]]) {
      const collar = mesh(trussGeometry, 'trussJoint', point.clone().addScaledVector(axis, radius * sign).toArray(), [radius * 2.3, radius * 2, radius * 2.3]);
      collar.quaternion.copy(part.quaternion);
    }
    return part;
  }
  // Structural rails flank the pressure passage. Port bays remain open;
  // no cross-brace is allowed to run through a branch passage or the R module.
  function axialSpine(stations, halfWidth, portBays = [], processClearance = false) {
    const bottom = -3.8, top = 1.3;
    for (const x of stations) {
      trussMember([x, bottom, -halfWidth], [x, bottom, halfWidth], .11);
      if (!processClearance || x < 5.3 || x > 9.7) {
        trussMember([x, top, -halfWidth], [x, top, halfWidth], .11);
      }
      for (const side of [-1, 1]) {
        trussMember([x, bottom, side * halfWidth], [x, top, side * halfWidth], .1);
        for (const y of [bottom, top]) {
          box('trussJoint', [x, y, side * (halfWidth + .1)], [.42, .28, .045]);
        }
      }
    }
    for (let i = 0; i < stations.length - 1; i++) {
      const a = stations[i], b = stations[i + 1];
      for (const side of [-1, 1]) {
        for (const y of [bottom, top]) trussMember([a, y, side * halfWidth], [b, y, side * halfWidth], .13);
        const port = portBays.some(p => p.side === side && p.x - p.radius < b && p.x + p.radius > a);
        if (!port && b - a > 1) trussMember([a, bottom, side * halfWidth], [b, top, side * halfWidth], .06, true);
      }
      if (b - a > 1) {
        trussMember([a, bottom, -halfWidth], [b, bottom, halfWidth], .06, true);
        if (!processClearance || b < 5.3 || a > 9.7) trussMember([a, top, -halfWidth], [b, top, halfWidth], .06, true);
      }
    }
  }
  // A bent sheet with real edge returns. UVs cover each outer panel once,
  // regardless of its angular position; adjacent sheets share their maps.
  function curvedPlate(start, arc, thickness = .009, segments = 16) {
    const positions = [], uvs = [], indices = [];
    const point = (r, y, theta) => [r * Math.sin(theta), y, r * Math.cos(theta)];
    const strip = (r0, y0, r1, y1) => {
      const base = positions.length / 3;
      for (let i = 0; i <= segments; i++) {
        const theta = start + arc * i / segments;
        positions.push(...point(r0, y0, theta), ...point(r1, y1, theta));
        uvs.push(i / segments, 0, i / segments, 1);
        if (i < segments) {
          const a = base + i * 2;
          indices.push(a, a + 2, a + 1, a + 2, a + 3, a + 1);
        }
      }
    };
    strip(1, -.5, 1, .5);
    strip(1 - thickness, .5, 1 - thickness, -.5);
    strip(1, .5, 1 - thickness, .5);
    strip(1 - thickness, -.5, 1, -.5);
    for (const end of [0, 1]) {
      const theta = start + arc * end, base = positions.length / 3;
      positions.push(...point(1, -.5, theta), ...point(1, .5, theta), ...point(1 - thickness, .5, theta), ...point(1 - thickness, -.5, theta));
      uvs.push(0, 0, 0, 1, 1, 1, 1, 0);
      indices.push(...(end ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3]).map(i => base + i));
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices); geometry.computeVertexNormals();
    return geometry;
  }
  function hullPanels(position, length, radius, palette, start = 0, arc = Math.PI * 2) {
    const columns = Math.max(2, Math.ceil(length / 2.8));
    const rows = Math.max(4, Math.round(arc / .65));
    for (let row = 0; row < rows; row++) {
      const geometry = curvedPlate(start + row * arc / rows + .009, arc / rows - .018, .035 / (radius + .065));
      for (let column = 0; column < columns; column++) {
        const x = position[0] - length / 2 + (column + .5) * length / columns;
        // Broad functional bands with occasional replacement-panel variation.
        const material = palette[column === columns - 1 && row % 3 === 0 ? (row + 1) % palette.length : row % palette.length];
        const panel = mesh(geometry, material, [x, position[1], position[2]], [radius + .065, length / columns - .065, radius + .065]);
        panel.rotation.z = -Math.PI / 2;
      }
    }
  }
  function endHardware(position, length, radius) {
    const capRingGeometry = new THREE.TorusGeometry(radius * .55, .04, 8, 32);
    for (const side of [-1, 1]) {
      const x = position[0] + side * (length / 2 + radius * .24);
      link('joint', [x, position[1], position[2]], [x + side * .065, position[1], position[2]], radius * .27);
      const ring = mesh(capRingGeometry, 'structure', [position[0] + side * (length / 2 + radius * .24 * Math.sqrt(1 - .55 ** 2) + .025), position[1], position[2]], [1, 1, 1]);
      ring.rotation.y = Math.PI / 2;
      for (let i = 0; i < 8; i++) {
        const angle = i * Math.PI * 2 / 8;
        link('docking', [x + side * .07, position[1] + Math.cos(angle) * radius * .21, position[2] + Math.sin(angle) * radius * .21], [x + side * .105, position[1] + Math.cos(angle) * radius * .21, position[2] + Math.sin(angle) * radius * .21], .045);
      }
    }
  }
  function vessel(position, straightLength, diameter, material) {
    const radius = diameter / 2;
    const body = mesh(cylinderGeometry, material, position, [radius, straightLength, radius]);
    body.rotation.z = -Math.PI / 2;
    if (material === 'tank') {
      hullPanels(position, straightLength, radius, ['tank', 'tank', 'hullGrey', 'tank']);
    } else {
      hullPanels(position, straightLength, radius, material === 'insulation' ? ['insulation', 'insulation', 'foil', 'insulation'] : ['hullGrey', 'hullGrey', 'hullBlue', material]);
    }
    endHardware(position, straightLength, radius);
    for (const side of [-1, 1]) {
      const head = mesh(headGeometry, material, [position[0] + side * straightLength / 2, position[1], position[2]], [radius, radius * .24, radius]);
      head.rotation.z = -side * Math.PI / 2;
    }
  }
  function ecologyVessel(position, length, kind) {
    const radius = BLOCKOUT_DIMENSIONS.ecologyOuterDiameter / 2;
    const windowLength = kind === 'forest' ? 8 : 5;
    const panes = kind === 'forest' ? 3 : 2;
    const start = -.55, arc = .8;
    const sector = new THREE.CylinderGeometry(1, 1, 1, 56, 1, true, start + arc, Math.PI * 2 - arc);
    hullPanels(position, length, radius, ['hullBone', 'hullBone', 'hullGrey', 'hullBone'], start + arc, Math.PI * 2 - arc);
    endHardware(position, length, radius);
    const shell = mesh(sector, 'ecology', position, [radius, windowLength, radius]);
    shell.rotation.z = -Math.PI / 2;
    const remaining = (length - windowLength) / 2;
    for (const side of [-1, 1]) {
      const end = mesh(cylinderGeometry, 'ecology', [position[0] + side * (windowLength + remaining) / 2, 0, position[2]], [radius, remaining, radius]);
      end.rotation.z = -Math.PI / 2;
      const head = mesh(headGeometry, 'ecology', [position[0] + side * length / 2, 0, position[2]], [radius, radius * .24, radius]);
      head.rotation.z = -side * Math.PI / 2;
    }
    const surfacePoint = (x, theta, r = radius + .045) => [x, -r * Math.sin(theta), position[2] + r * Math.cos(theta)];
    const windowGeometry = new THREE.CylinderGeometry(1, 1, 1, 32, 1, true, start + .025, arc - .05);
    for (let i = 0; i < panes; i++) {
      const x = position[0] - windowLength / 2 + (i + .5) * windowLength / panes;
      const pane = mesh(windowGeometry, 'glass', [x, 0, position[2]], [radius + .015, windowLength / panes - .18, radius + .015]);
      pane.rotation.z = -Math.PI / 2;
      pane.castShadow = false; pane.receiveShadow = false;
      // Transparent panes stay individual so Three.js sorts them per window.
      pane.renderOrder = 1;
    }
    // Recessed seal, deep reveal and a narrower machined outer pressure frame.
    for (const theta of [start, start + arc]) {
      for (const [material, r, width, depth] of [['gasket', radius + .045, .27, .13], ['windowFrame', radius + .14, .16, .19]]) {
        const rail = box(material, surfacePoint(position[0], theta, r), [windowLength + .18, width, depth]);
        rail.rotation.x = theta;
      }
    }
    const sealGeometry = curvedPlate(start, arc, .036, 32);
    const frameGeometry = curvedPlate(start - .014, arc + .028, .043, 32);
    for (let i = 0; i <= panes; i++) {
      const x = position[0] - windowLength / 2 + i * windowLength / panes;
      for (const [geometry, material, r, width] of [[sealGeometry, 'gasket', radius + .07, .24], [frameGeometry, 'windowFrame', radius + .22, .12]]) {
        const frame = mesh(geometry, material, [x, 0, position[2]], [r, width, r]);
        frame.rotation.z = -Math.PI / 2;
      }
      for (let j = 0; j <= 4; j++) {
        const theta = start + arc * j / 4;
        link('joint', surfacePoint(x, theta, radius + .22), surfacePoint(x, theta, radius + .255), .038);
      }
    }
    // Four folded protective leaves park above each opening. Static appearance
    // only: the hinge sweep and a pressure-rated emergency cover are not solved.
    const coverGeometry = curvedPlate(start - .25, .2, .008, 16);
    for (let i = 0; i < panes; i++) {
      const x = position[0] - windowLength / 2 + (i + .5) * windowLength / panes;
      const width = windowLength / panes - .24;
      for (let leaf = 0; leaf < 4; leaf++) {
        const r = radius + .17 + leaf * .052;
        const cover = mesh(coverGeometry, leaf === 3 ? 'hullBone' : 'hullGrey', [x, 0, position[2]], [r, width, r]);
        cover.rotation.z = -Math.PI / 2;
      }
      for (const dx of [-width * .33, width * .33]) {
        link('joint', surfacePoint(x + dx - .13, start - .038, radius + .19), surfacePoint(x + dx + .13, start - .038, radius + .19), .085);
        const latch = box('windowFrame', surfacePoint(x + dx, start - .22, radius + .38), [.17, .16, .09]);
        latch.rotation.x = start - .22;
      }
    }
    const seamGeometry = new THREE.TorusGeometry(radius + .025, .045, 8, 48);
    for (const side of [-1, 1]) {
      const seam = mesh(seamGeometry, 'structure', [position[0] + side * (length / 2 - .7), 0, position[2]], [1, 1, 1]);
      seam.rotation.y = Math.PI / 2;
    }
    // Solid protection panels sit around the opaque upper/back shell sector.
    const panelGeometry = curvedPlate(-2.7, .48);
    for (let i = 0; i < panes + 1; i++) {
      const panel = mesh(panelGeometry, i % 2 ? 'foil' : 'hullGrey', [position[0] - length * .35 + i * length * .7 / panes, 0, position[2]], [radius + .09, length / (panes + 1) - .18, radius + .09]);
      panel.rotation.z = -Math.PI / 2;
    }
    // Small outside service units and covered inspection ports flank the glass.
    for (const side of [-1, 1]) {
      const x = position[0] + side * (windowLength / 2 + .7);
      box('equipment', [x, -.2, position[2] + radius + .15], [.8, 1.2, .3]);
      box('hullGrey', [x, -.2, position[2] + radius + .32], [.71, 1.08, .065]);
      for (const dy of [-.38, .38]) {
        box('joint', [x + .3, -.2 + dy, position[2] + radius + .38], [.065, .17, .055]);
      }
      link('windowFrame', [x - .2, -.36, position[2] + radius + .43], [x - .2, -.04, position[2] + radius + .43], .027);
      box('guide', [x, -.2, position[2] + radius + .32], [.36, .055, .04]);
      link('plumbing', [x, -1, position[2] + radius + .15], [x, -2.4, position[2] + radius - .5], .06);
    }

    // Minimal interior cues for recognition, not a complete ecology simulation.
    box('soil', [position[0], -3.05, position[2]], [length - .8, .3, 8]);
    box('service', [position[0], -2.85, position[2] + 3.3], [length - 1, .12, .65]);
    const crownGeometry = new THREE.IcosahedronGeometry(1, 2);
    if (kind === 'forest') {
      for (let i = 0; i < 6; i++) {
        const x = position[0] - 4 + i * 1.6;
        const z = position[2] + (i % 2 ? 1.6 : -.8);
        const height = 3.4 + (i % 3) * .45;
        link('trunk', [x, -2.85, z], [x, -2.85 + height, z], .14);
        mesh(crownGeometry, i % 2 ? 'foliage' : 'foliageLight', [x, -2.7 + height, z], [1.15, 1.35, 1.1]);
        mesh(crownGeometry, 'foliage', [x - .55, -3.1 + height, z + .35], [.85, .8, .8]);
      }
    } else {
      box('water', [position[0], -2.78, position[2] + .5], [length - 1.4, .05, 4.8]);
      for (let i = 0; i < 14; i++) {
        const x = position[0] - 3 + (i % 7);
        const z = position[2] + (i < 7 ? -2.2 : 2.6);
        const height = 1.1 + (i % 3) * .25;
        link('foliage', [x, -2.8, z], [x + .1, -2.8 + height, z], .045);
        mesh(crownGeometry, 'foliageLight', [x, -2.15 + height * .45, z], [.17, .6, .12]);
      }
    }
  }
  function dockingPort(position, direction) {
    const axis = vector(direction);
    const frame = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), axis);
    const place = (local) => vector(local).applyQuaternion(frame).add(vector(position)).toArray();
    const ringGeometry = new THREE.TorusGeometry(1.35, .095, 10, 40);
    const sealGeometry = new THREE.TorusGeometry(1.04, .055, 8, 40);
    // Closed hatch recessed behind the capture plane; not an exposed corridor.
    link('hatch', place([0, 0, -.36]), place([0, 0, -.28]), 1.03);
    for (const depth of [-.35, .05]) {
      const ring = mesh(ringGeometry, 'docking', place([0, 0, depth]), [1, 1, 1]);
      ring.quaternion.copy(frame);
    }
    const seal = mesh(sealGeometry, 'engine', place([0, 0, -.23]), [1, 1, 1]);
    seal.quaternion.copy(frame);
    for (let i = 0; i < 12; i++) {
      const angle = i * Math.PI * 2 / 12;
      const c = Math.cos(angle), sn = Math.sin(angle);
      link('structure', place([1.35 * c, 1.35 * sn, -.35]), place([1.35 * c, 1.35 * sn, .05]), .065);
      const latch = box('equipment', place([1.48 * c, 1.48 * sn, -.1]), [.22, .17, .36]);
      latch.rotation.z = angle; latch.quaternion.premultiply(frame);
    }
    for (let i = 0; i < 3; i++) {
      const angle = i * Math.PI * 2 / 3;
      const local = [1.17 * Math.cos(angle), 1.17 * Math.sin(angle), .08];
      const guide = box('docking', place(local), [.28, .34, .24]);
      guide.rotation.z = angle; guide.quaternion.premultiply(frame);
    }
    // Passive visual targets remain legible on a powered-down station.
    for (const local of [[0, 1.68, -.25], [-1.68, 0, -.25], [1.68, 0, -.25]]) {
      const target = box('guide', place(local), [.22, .22, .06]);
      target.quaternion.copy(frame);
    }
    const handle = box('docking', place([0, 0, -.2]), [.45, .065, .08]);
    handle.quaternion.copy(frame);
  }
  function mark(label, position, primary = false) { markers.push({ label, position: vector(position), primary }); }
  function transverseTruss(x, fromZ, toZ, y, width = 1.2, height = 1.4) {
    const count = Math.max(1, Math.ceil(Math.abs(toZ - fromZ) / 2.7));
    const zAt = i => fromZ + (toZ - fromZ) * i / count;
    for (const dx of [-width / 2, width / 2]) for (const dy of [-height / 2, height / 2]) {
      trussMember([x + dx, y + dy, fromZ], [x + dx, y + dy, toZ], .11);
    }
    for (let i = 0; i <= count; i++) {
      for (const dy of [-height / 2, height / 2]) trussMember([x - width / 2, y + dy, zAt(i)], [x + width / 2, y + dy, zAt(i)], .07);
      for (const dx of [-width / 2, width / 2]) trussMember([x + dx, y - height / 2, zAt(i)], [x + dx, y + height / 2, zAt(i)], .07);
      if (i < count) {
        for (const dx of [-width / 2, width / 2]) trussMember([x + dx, y - height / 2, zAt(i)], [x + dx, y + height / 2, zAt(i + 1)], .047, true);
        trussMember([x - width / 2, y + height / 2, zAt(i)], [x + width / 2, y + height / 2, zAt(i + 1)], .047, true);
      }
    }
  }
  function envelope(name, position, size) {
    const geometry = new THREE.BoxGeometry(...size);
    const wire = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), new THREE.LineBasicMaterial({ color: 0xba9169, transparent: true, opacity: .65 }));
    wire.name = name; wire.position.set(...position); envelopes.add(wire); geometry.dispose();
  }

  // X is the assembly/transfer axis, Y the proposed artificial-gravity vertical.
  // Two ecological units share a candidate circular section but differ in length.
  ecologyVessel([-.5, 0, -9], BLOCKOUT_DIMENSIONS.forestStraightLength, 'forest');
  ecologyVessel([10, 0, 9], BLOCKOUT_DIMENSIONS.wetlandStraightLength, 'wetland');
  mark('E-A 林地', [-.5, 6.3, -9], true);
  mark('E-B 湿地', [10, 6.3, 9], true);

  // Compact service group; internal division D/H/M is not modelled yet.
  vessel([-20, -1.4, 0], 7, 4.2, 'service');
  // Axial crew vestibule connects directly to the H/M service volume.
  link('service', [-25.8, -1.4, 0], [-23.9, -1.4, 0], 1.25);
  dockingPort([-26.15, -1.4, 0], [-1, 0, 0]);
  mark('D 人员对接', [-27, 1.4, 0]);

  // Side cargo receiving/checking vestibule, separate from ecological access.
  // Internal hatches/partitions are reserved in the design, not modelled here.
  link('service', [-20, -1.4, 1.7], [-20, -1.4, 3.3], 1.05);
  link('service', [-20, -1.4, 3.3], [-20, -1.4, 7], 1.6);
  link('equipment', [-20, -1.4, 7], [-20, -1.4, 7.6], 1.25);
  dockingPort([-20, -1.4, 7.95], [0, 0, 1]);
  for (const z of [3.5, 6.5]) {
    const band = mesh(new THREE.TorusGeometry(1.65, .065, 8, 32), 'structure', [-20, -1.4, z], [1, 1, 1]);
    box('equipment', [-20, -3.1, z], [2.8, .3, .7]);
  }
  for (const x of [-21.2, -18.8]) {
    trussMember([x, -3.8, 2.75], [x, -3.35, 6.5], .12);
    trussMember([x, -3.35, 3.5], [x, -3.35, 6.5], .1);
  }
  // Receiver targets/sensor housings, without assigning a rendezvous standard.
  for (const x of [-21.8, -18.2]) box('hatch', [x, -.3, 7.2], [.3, .3, .4]);
  mark('D 货运检查与暂存', [-20, 1.1, 5.3]);
  vessel([-12.9, -1.4, 0], 2.4, 3.5, 'equipment');
  vessel([-8.6, -1.4, 0], 2.4, 3.5, 'service');
  link('service', [-16, -1.4, 0], [-14.5, -1.4, 0], 1.15);
  link('service', [-11.3, -1.4, 0], [-10.1, -1.4, 0], 1.15);
  link('service', [-7.1, -1.4, 0], [10, -1.4, 0], 1.2);
  link('service', [-4, -1.4, 0], [-4, -1.4, -4], 1.2);
  link('service', [10, -1.4, 0], [10, -1.4, 4], 1.2);
  mark('D/H/M 服务组', [-20, 2, 0]);
  mark('Q/N 隔离与分配', [-10.7, 2, 0]);

  // Main communications antenna: art-directed aperture, not an RF/link budget.
  // The mast is supported outside the service pressure hull.
  for (const x of [-21.6, -18.4]) {
    trussMember([x, -3.8, -2.75], [x, -3.8, -3.2], .12);
    trussMember([x, -3.8, -3.2], [x, 1.6, -3.2], .14);
    link('structure', [x, 1.6, -3.2], [-20, 2.2, -3], .14);
  }
  box('equipment', [-20, 2, -3], [2.8, .35, 2]);
  link('joint', [-20, 2.2, -3], [-20, 2.85, -3], .62);
  link('structure', [-20, 2.85, -3], [-20, 6.7, -3], .25);
  link('joint', [-20, 6.7, -3.7], [-20, 6.7, -2.3], .38);
  const dishOrigin = new THREE.Vector3(-20, 7.2, -3);
  link('structure', [-20, 6.7, -3], dishOrigin.toArray(), .23);
  mesh(new THREE.SphereGeometry(.28, 16, 10), 'joint', dishOrigin.toArray(), [1, 1, 1]);
  const antenna = new THREE.Group(); antenna.name = 'Earth-pointing reflector';
  antenna.position.copy(dishOrigin);
  const antennaMeshStart = object.children.length;
  const dishAxis = new THREE.Vector3(0, 1, 0);
  const dishRotation = new THREE.Quaternion().setFromUnitVectors(up, dishAxis);
  const dishPoint = local => vector(local).applyQuaternion(dishRotation).add(dishOrigin).toArray();
  const dishRadius = BLOCKOUT_DIMENSIONS.communicationDishDiameter / 2;
  const focalLength = 2.5;
  const depth = radius => .45 + radius * radius / (4 * focalLength);
  const dishProfile = Array.from({ length: 41 }, (_, i) => {
    const r = dishRadius * i / 40;
    return new THREE.Vector2(r, depth(r));
  });
  for (const [profile, material] of [[dishProfile, 'antenna'], [dishProfile.map(p => new THREE.Vector2(p.x, p.y - .065)), 'antennaBack']]) {
    const surface = mesh(new THREE.LatheGeometry(profile, 64), material, dishOrigin.toArray(), [1, 1, 1]);
    surface.quaternion.copy(dishRotation);
  }
  const dishRim = mesh(new THREE.TorusGeometry(dishRadius, .055, 8, 64), 'docking', dishPoint([0, depth(dishRadius) - .025, 0]), [1, 1, 1]);
  dishRim.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dishAxis);
  // Rear radial ribs and central hub make the large reflector an assembly.
  link('equipment', dishPoint([0, 0, 0]), dishPoint([0, .42, 0]), .45);
  for (let i = 0; i < 12; i++) {
    const angle = i * Math.PI * 2 / 12;
    for (let j = 0; j < 6; j++) {
      const a = .45 + (dishRadius - .45) * j / 6;
      const b = .45 + (dishRadius - .45) * (j + 1) / 6;
      link('structure', dishPoint([Math.cos(angle) * a, depth(a) - .12, Math.sin(angle) * a]), dishPoint([Math.cos(angle) * b, depth(b) - .12, Math.sin(angle) * b]), .035);
    }
  }
  // Three slender feed supports stay subordinate to the reflector silhouette.
  for (let i = 0; i < 3; i++) {
    const angle = i * Math.PI * 2 / 3;
    link('structure', dishPoint([Math.cos(angle) * 3.25, depth(3.25), Math.sin(angle) * 3.25]), dishPoint([0, focalLength + .45, 0]), .055);
  }
  link('joint', dishPoint([0, focalLength + .3, 0]), dishPoint([0, focalLength + .75, 0]), .17);
  for (const part of object.children.slice(antennaMeshStart)) {
    part.position.sub(dishOrigin);
    antenna.add(part);
  }
  object.add(antenna);
  const aimAntennaAt = worldTarget => {
    object.updateWorldMatrix(true, false);
    const localTarget = object.worldToLocal(worldTarget.clone());
    antenna.quaternion.setFromUnitVectors(up, localTarget.sub(dishOrigin).normalize());
  };
  mark('对地通信主天线', [-20, 11.4, -3], true);

  // A few small navigation and docking-camera housings support the design;
  // they are visual placeholders, without assigned optics or sensor fields.
  for (const [x, y, z] of [[-23, 1.1, 1.2], [-17, 1.1, -1.2], [33, 2, 0]]) {
    box('equipment', [x, y, z], [.65, .5, .55]);
    link('hatch', [x, y + .25, z], [x, y + .55, z], .16);
  }
  for (const z of [-1.6, 1.6]) {
    box('equipment', [-25.2, -.45, z], [.4, .3, .4]);
    link('hatch', [-25.35, -.45, z], [-25.65, -.45, z], .1);
  }

  // The process module sits above the passage, not inside the corridor volume.
  vessel([7.5, 2.4, 0], 3.4, 3.2, 'equipment');
  link('service', [7.5, -.25, 0], [7.5, .9, 0], .85);
  mark('R 循环处理', [7.5, 4.6, 0]);

  // The spine surrounds the pressure passage instead of forming a floor.
  axialSpine([-24, -16, -13, -8, -6.7, -1, 5.7, 6.3, 13.7, 16], 2.75, [
    { x: -20, radius: 1.8, side: 1 },
    { x: -4, radius: 1.45, side: -1 },
    { x: 10, radius: 1.45, side: 1 },
  ], true);
  mark('T 纵向承力骨架', [-1, 2.2, 2.75]);
  // Pressure-shell attachment rings are conceptual reinforced interfaces,
  // separate from the existing pressure passage and removable outer panels.
  for (const [x, radius] of [[-22, 2.2], [-18, 2.2], [-12.9, 1.85], [-8.6, 1.85]]) {
    const ring = mesh(new THREE.TorusGeometry(radius, .065, 8, 40), 'trussJoint', [x, -1.4, 0], [1, 1, 1]);
    ring.rotation.y = Math.PI / 2;
    for (const side of [-1, 1]) for (const vertical of [-1, 1]) {
      const localY = radius * .5, localZ = radius * Math.sqrt(.75);
      trussMember([x, vertical < 0 ? -3.8 : 1.3, side * 2.75], [x, -1.4 + vertical * localY, side * localZ], .09);
    }
  }
  const ecologyRingRadius = 5.52;
  const ecologyRingGeometry = new THREE.TorusGeometry(ecologyRingRadius, .085, 8, 64);
  for (const [xs, side] of [[[-6.7, 5.7], -1], [[6.3, 13.7], 1]]) {
    for (const x of xs) {
      const ring = mesh(ecologyRingGeometry, 'trussJoint', [x, 0, side * 9], [1, 1, 1]);
      ring.rotation.y = Math.PI / 2;
      for (const vertical of [-1, 1]) {
        const y = vertical * 1.2, z = side * (9 - Math.sqrt(ecologyRingRadius ** 2 - y ** 2));
        trussMember([x, vertical < 0 ? -3.8 : 1.3, side * 2.75], [x, y, z], .13, true);
        box('trussJoint', [x, y, z], [.52, .3, .24]);
      }
    }
  }
  // R keeps its current volume; only its structural mounting is updated.
  for (const side of [-1, 1]) {
    trussMember([7.5, 1.3, side * 2.75], [7.5, 2.4, side * 1.7], .1);
    box('trussJoint', [7.5, 2.4, side * 1.7], [.8, .4, .15]);
  }
  // Utilities run on the outside of the spine, clear of the pressure branches.
  for (const z of [-2.9, 2.9]) box('equipment', [-4, -3.55, z], [40, .14, .18]);
  box('equipment', [-9, -3.8, -4], [4.5, .2, 2.4]);
  for (const x of [-10.8, -7.2]) trussMember([x, -3.8, -2.75], [x, -3.8, -5.1], .08);

  // The transporter stays beneath the spine, with a much shorter suspension.
  const railY = -5.2;
  for (const z of [3, 4.6]) {
    box('structure', [-4, railY, z], [BLOCKOUT_DIMENSIONS.armRailLength, .24, .22]);
    box('plumbing', [-4, railY + .15, z], [BLOCKOUT_DIMENSIONS.armRailLength, .065, .3]);
  }
  for (let x = -24; x <= 16; x += 4) {
    trussMember([x, -3.8, 2.75], [x, -5.55, 2.6], .085);
    trussMember([x, -5.55, 2.6], [x, -5.55, 4.8], .085);
    trussMember([x, -3.8, 2.75], [x, -5.55, 4.8], .065);
    for (const z of [3, 4.6]) box('structure', [x, -5.4, z], [.28, .3, .22]);
  }
  for (const x of [-24, 16]) box('guide', [x, -4.75, 3.8], [.24, .7, 2.2]);
  for (const x of [-20, -9, 2, 14]) {
    box('joint', [x, -5.55, 3.8], [.7, .15, .5]);
    box('guide', [x, -5.54, 4.86], [.36, .15, .05]);
  }
  box('equipment', [-9, -4.7, 3.8], [2.4, .45, 2.5]);
  for (const x of [-9.85, -8.15]) for (const z of [3, 4.6]) {
    link('joint', [x - .18, -5.02, z], [x + .18, -5.02, z], .25);
  }
  box('joint', [-9, -4.35, 3.8], [1.1, .3, 1.1]);
  link('structure', [-9, -4.35, 3.8], [-9, -3.9, 3.8], .35);
  grappleFixture([-9, -3.9, 3.8], [0, 1, 0]);

  // Outboard work bases attach locally to each end ring, not a transverse floor.
  for (const [x, side] of [[-6.7, -1], [6.3, 1]]) {
    for (const y of [-1.2, 1.2]) {
      const z = side * (9 + Math.sqrt(ecologyRingRadius ** 2 - y ** 2));
      trussMember([x, y, z], [x, -3.2, side * 15.9], .1, true);
    }
    box('structure', [x, -3.05, side * 15.9], [2.2, .25, 2]);
    grappleFixture([x, -2.9, side * 15.9], [0, 1, 0]);
  }
  trussMember([-11, -3.8, -2.75], [-11, -4.5, -5.5], .13);
  box('structure', [-11, -4.35, -5.5], [1.8, .25, 1.8]);
  grappleFixture([-11, -4.2, -5.5], [0, 1, 0]);

  const armMeshStart = object.children.length;
  const shoulder = [6.3, -1.75, 15.9];
  const elbow = [6.3, 4.95, 16.4];
  const wrist = [11.5, 7.55, 16.5];
  const armJointGeometry = new THREE.SphereGeometry(1, 20, 12);
  function armJoint(position, radius, direction) {
    mesh(armJointGeometry, 'joint', position, [radius, radius, radius]);
    const axis = vector(direction).normalize();
    const a = vector(position).addScaledVector(axis, -radius * 1.2);
    const b = vector(position).addScaledVector(axis, radius * 1.2);
    link('plumbing', a.toArray(), b.toArray(), radius * .64);
    link('guide', b.toArray(), b.clone().addScaledVector(axis, .055).toArray(), radius * .42);
  }
  function armSegment(start, end, radius) {
    const a = vector(start), b = vector(end), axis = b.clone().sub(a).normalize();
    const innerA = a.clone().addScaledVector(axis, .55);
    const innerB = b.clone().addScaledVector(axis, -.55);
    link('arm', innerA.toArray(), innerB.toArray(), radius);
    for (const point of [innerA, innerB]) {
      link('joint', point.clone().addScaledVector(axis, -.13).toArray(), point.clone().addScaledVector(axis, .13).toArray(), radius * 1.18);
    }
    // Narrow cable cover follows the link instead of dangling into its path.
    const coverOffset = new THREE.Vector3(0, 0, -radius * .95);
    link('equipment', innerA.clone().add(coverOffset).toArray(), innerB.clone().add(coverOffset).toArray(), .065);
  }
  armJoint(shoulder, .46, [0, 0, 1]);
  armJoint(elbow, .5, [0, 0, 1]);
  armJoint(wrist, .35, [0, 0, 1]);
  armSegment(shoulder, elbow, .26);
  armSegment(elbow, wrist, .23);

  // Both ends have compatible grapple heads; either end can anchor to a base.
  function grappleHead(position, direction) {
    const axis = vector(direction).normalize();
    const frame = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(-1, 0, 0), axis);
    const toolBase = vector(position).addScaledVector(axis, .55);
    link('joint', position, toolBase.toArray(), .26);
    const ring = mesh(new THREE.TorusGeometry(.34, .065, 8, 24), 'docking', toolBase.toArray(), [1, 1, 1]);
    ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), axis);
    for (let i = 0; i < 3; i++) {
      const angle = i * Math.PI * 2 / 3;
      const offset = new THREE.Vector3(0, Math.cos(angle) * .29, Math.sin(angle) * .29).applyQuaternion(frame);
      const root = toolBase.clone().add(offset), tip = root.clone().addScaledVector(axis, .42);
      link('plumbing', root.toArray(), tip.toArray(), .055);
      link('plumbing', tip.toArray(), tip.clone().addScaledVector(offset, -.4).toArray(), .05);
    }
  }
  grappleHead(shoulder, [0, -1, 0]);
  grappleHead(wrist, [1, 0, 0]);
  box('hatch', [11.9, 7.93, 16.5], [.22, .17, .3]);
  box('guide', [11.9, 7.93, 16.82], [.14, .1, .06]);

  // A second identical arm stays on the mobile transporter. Its own static
  // pose occupies the open service-side gap, not the ecological hull volume.
  const transportShoulder = new THREE.Vector3(-9, -2.75, 3.8);
  const transportRotation = new THREE.Quaternion().setFromAxisAngle(up, Math.PI);
  for (const part of object.children.slice(armMeshStart)) {
    if (!part.isMesh) continue;
    const second = part.clone();
    second.position.sub(vector(shoulder)).applyQuaternion(transportRotation).add(transportShoulder);
    second.quaternion.premultiply(transportRotation);
    if (second.material === materials.arm) second.material = materials.transportArm;
    object.add(second);
  }
  mark('T 运输装配臂', [-12, 7.6, 3.2]);

  // Payload fixture: exposed equipment tray, not cargo passing through a hull.
  box('structure', [-14.5, -3.6, 5], [2.8, .2, 2.1]);
  trussMember([-14.5, -3.8, 2.75], [-14.5, -3.7, 5], .13);
  box('equipment', [-14.5, -3.1, 5], [1.9, .8, 1.35]);
  function grappleFixture(position, direction) {
    const axis = vector(direction).normalize(), origin = vector(position);
    link('joint', origin.toArray(), origin.clone().addScaledVector(axis, .15).toArray(), .34);
    link('plumbing', origin.clone().addScaledVector(axis, .15).toArray(), origin.clone().addScaledVector(axis, .47).toArray(), .12);
    link('guide', origin.clone().addScaledVector(axis, .47).toArray(), origin.clone().addScaledVector(axis, .55).toArray(), .2);
  }
  grappleFixture([-14.5, -2.7, 5], [0, 1, 0]);
  // Other fixtures attach to equipment supports, not arbitrary shell patches.
  grappleFixture([13.7, -1.2, 3.4], [0, 0, -1]);
  mark('T 外侧检修臂', [6.3, 6.2, 16.4]);
  mark('T 林地检修基座', [-6.7, -1.8, -15.9]);
  mark('T 湿地检修基座', [6.3, -1.8, 15.9]);
  mark('T 下方转接基座', [-11, -2.8, -5.5]);
  mark('T 轨道与移动底座', [-9, -5.8, 3.8]);
  mark('M 舱外设备托盘', [-14.5, -1.8, 5]);
  envelope('Wetland outboard work zone', [10, 3.5, 17], [14, 13, 4]);
  envelope('Forest outboard work zone', [-.5, 3.5, -17], [18, 13, 4]);
  envelope('Arm folded parking', [-3.4, -4.2, 4.2], [13.8, 1.6, 1.9]);

  // Transfer-stage volume: four substantial tank placeholders, cradles,
  // manifold bay and twin storable-bipropellant chemical engine study. Fuel
  // species, feed cycle, thrust, Isp and required mass fraction remain undecided.
  // The rear spine fits between the tanks; transition members stay ahead of
  // their forward heads. Tank rings attach inboard instead of sitting on a deck.
  axialSpine([18, 20, 24, 27.4, 31.4, 34.4], .55);
  for (const side of [-1, 1]) {
    for (const y of [-3.8, 1.3]) trussMember([16, y, side * 2.75], [18, y, side * .55], .15);
    trussMember([16, -3.8, side * 2.75], [18, 1.3, side * .55], .08);
  }
  const tankBandGeometry = new THREE.TorusGeometry(2.36, .075, 8, 32);
  for (const x of [22, 29.4]) for (const z of [-3.2, 3.2]) {
    vessel([x, -.6, z], BLOCKOUT_DIMENSIONS.propellantTankStraightLength, BLOCKOUT_DIMENSIONS.propellantTankDiameter, 'tank');
    for (const dx of [-2, 2]) {
      const band = mesh(tankBandGeometry, 'structure', [x + dx, -.6, z], [1, 1, 1]);
      band.rotation.y = Math.PI / 2;
      const side = Math.sign(z);
      const inboardZ = side * (3.2 - Math.sqrt(2.36 ** 2 - 1.1 ** 2));
      for (const vertical of [-1, 1]) {
        const y = -.6 + vertical * 1.1;
        trussMember([x + dx, vertical < 0 ? -3.8 : 1.3, side * .55], [x + dx, y, inboardZ], .12, true);
        box('trussJoint', [x + dx, y, inboardZ], [.4, .22, .2]);
      }
    }
    link('equipment', [x + 2.9, -.6, z], [x + 3.2, -3.5, z], .12);
  }
  // A split thermal screen leaves a narrow structural opening for the spine.
  // Engine-frame struts begin behind it, so they do not cut through the blankets.
  for (const side of [-1, 1]) box('insulation', [33, -1.5, side * 2.85], [.16, 6.2, 4.3]);
  for (const y of [-4.5, 1.5]) link('structure', [34.4, y, -5], [34.4, y, 5], .19);
  for (const y of [-3.8, 1.3]) trussMember([33.1, y, -.55], [33.1, y, .55], .13);
  for (const z of [-5, 0, 5]) {
    link('structure', [34.4, -4.5, z], [34.4, 1.5, z], .19);
    trussMember([33.1, 1.3, Math.sign(z) * .55], [34.4, 1.5, z], .18);
    trussMember([33.1, -3.8, Math.sign(z) * .55], [34.4, -4.5, z], .2);
  }
  for (const z of [-2.8, 2.8]) for (const side of [-1, 1]) {
    link('structure', [34.4, -1.5 + side * 3, z + side * 1.8], [35, -1.5, z], .16);
  }

  // Two separate feed trunks, isolation-valve blocks and pressurant bottles.
  // Their routes convey subsystem separation, not a validated fluid schematic.
  for (const side of [-1, 1]) {
    const z = side * 3.2;
    const feedZ = z + side * .65;
    // Feed trunks retain a clear route under the tanks, outside the rear spine.
    link('plumbing', [19.4, -3.85, feedZ], [32.7, -3.85, feedZ], .1);
    for (const x of [22, 29.4]) {
      link('plumbing', [x + 3.2, -3.5, z], [x + 3.2, -3.85, feedZ], .1);
      box('engine', [x + 3.2, -3.85, feedZ], [.5, .45, .5]);
    }
    // Separate service trays expose the frame and leave gaps between equipment.
    for (const x of [25.2, 32.4]) {
      box('trussJoint', [x, -4.32, z], [2.15, .12, 1.9]);
      for (const dx of [-.82, .82]) {
        trussMember([x + dx, -4.4, z - .98], [x + dx, -4.4, z + .98], .075);
        trussMember([x + dx, -3.8, side * .55], [x + dx, -4.4, z + side * .98], .075);
      }
      box('insulation', [x, -4.02, z + side * .96], [2.05, .6, .045]);
      for (const dx of [-.87, .87]) {
        trussMember([x + dx, -4.32, z + side * .96], [x + dx, -3.7, z + side * .96], .025);
      }
    }
    box('equipment', [25.2, -4.02, z - side * .24], [.85, .48, .65]);
    vessel([27, 2.5, side * 1.1], 2.6, 1.15, 'insulation');
    for (const x of [26, 28]) {
      trussMember([x, 1.3, side * .55], [x, 1.76, side * 1.1], .07);
      box('trussJoint', [x, 1.84, side * 1.1], [.25, .16, .9]);
    }
    link('plumbing', [28.6, 2.5, side * 1.1], [32.5, 2.5, side * 1.1], .075);
    link('plumbing', [32.5, 2.5, side * 1.1], [32.5, -3.25, z], .075);
    box('equipment', [32.2, -3.9, z], [1.3, .7, .9]);
    box('engine', [32.4, -3.25, z], [.75, .55, .65]);
    link('plumbing', [32.7, -3.85, feedZ], [32.7, -3.25, feedZ], .1);
    link('plumbing', [32.7, -3.25, feedZ], [32.4, -3.25, z], .1);
  }
  const engineBandGeometry = new THREE.TorusGeometry(.68, .075, 8, 28);
  // Art-directed bell contour, not a calculated expansion/thermal design.
  // Rapid throat expansion eases into a shallower vacuum extension.
  const bellCurve = new THREE.SplineCurve([
    new THREE.Vector2(.36, -1.9), new THREE.Vector2(.65, -1.58),
    new THREE.Vector2(1.02, -1.08), new THREE.Vector2(1.36, -.25),
    new THREE.Vector2(1.59, .75), new THREE.Vector2(1.75, 1.9),
  ]);
  const nozzleProfile = bellCurve.getPoints(60);
  const splitIndex = 24;
  const jacketGeometry = new THREE.LatheGeometry(nozzleProfile.slice(0, splitIndex + 1), 48);
  const extensionGeometry = new THREE.LatheGeometry(nozzleProfile.slice(splitIndex), 48);
  const interiorGeometry = new THREE.LatheGeometry(nozzleProfile.map(p => new THREE.Vector2(p.x - .045, p.y)), 48);
  const joint = nozzleProfile[splitIndex];
  const jointGeometry = new THREE.TorusGeometry(joint.x + .025, .045, 8, 48);
  const nozzleRimGeometry = new THREE.TorusGeometry(1.73, .035, 8, 48);
  for (const z of [-2.8, 2.8]) {
    // Injector head, chamber casing and mounting collar ahead of the bell.
    link('engine', [34.55, -1.5, z], [35.9, -1.5, z], .63);
    link('plumbing', [34.65, -1.5, z], [34.9, -1.5, z], .82);
    link('engine', [35.9, -1.5, z], [36.2, -1.5, z], .36);
    for (const x of [35.05, 35.55]) {
      const band = mesh(engineBandGeometry, 'plumbing', [x, -1.5, z], [1, 1, 1]);
      band.rotation.y = Math.PI / 2;
    }
    for (const [geometry, material] of [[jacketGeometry, 'nozzleJacket'], [extensionGeometry, 'nozzleExtension'], [interiorGeometry, 'nozzleInterior']]) {
      const nozzle = mesh(geometry, material, [38.1, -1.5, z], [1, 1, 1]);
      nozzle.rotation.z = -Math.PI / 2;
    }
    for (const [geometry, x] of [[jointGeometry, 38.1 + joint.y], [nozzleRimGeometry, 40]]) {
      const ring = mesh(geometry, 'plumbing', [x, -1.5, z], [1, 1, 1]);
      ring.rotation.y = Math.PI / 2;
    }
    // Subtle longitudinal jacket ribs stop at the extension joint; they do
    // not claim to model regenerative-cooling channels or their flow paths.
    for (let i = 0; i < 16; i++) {
      const angle = i * Math.PI * 2 / 16;
      const point = p => [38.1 + p.y, -1.5 + Math.cos(angle) * (p.x + .025), z + Math.sin(angle) * (p.x + .025)];
      for (let j = 0; j < splitIndex; j += 3) {
        link('plumbing', point(nozzleProfile[j]), point(nozzleProfile[Math.min(j + 3, splitIndex)]), .022);
      }
      if (i % 4 === 0) {
        const p = point(joint);
        box('engine', p, [.16, .13, .13]);
      }
    }
    for (const side of [-1, 1]) {
      const supplyZ = side * 3.2;
      link('plumbing', [32.75, -3.25, supplyZ], [32.75, -4.95, supplyZ], .11);
      link('plumbing', [32.75, -4.95, supplyZ], [35.2, -4.95, z + side * .85], .11);
      link('plumbing', [35.2, -4.95, z + side * .85], [35.2, -1.5, z + side * .85], .11);
      link('plumbing', [35.2, -1.5, z + side * .85], [35.2, -1.5, z], .11);
      box('engine', [35.2, -3.7, z + side * .85], [.5, .65, .5]);
    }
  }

  // Fore/aft attitude-control pods: outward-facing bells, separated along X
  // to suggest torque authority. Counts and plume clearances need engineering.
  const attitudeGeometry = new THREE.LatheGeometry([
    new THREE.Vector2(.1, 0), new THREE.Vector2(.13, .16), new THREE.Vector2(.32, .65),
  ], 16);
  for (const x of [-26, 33]) for (const side of [-1, 1]) {
    const y = x < 0 ? -1.4 : 3;
    const z = side * (x < 0 ? 3 : 6.1);
    const rootX = x < 0 ? -24 : 34.4;
    const rootZ = side * (x < 0 ? 2.75 : 5);
    for (const rootY of (x < 0 ? [-3.8, 1.3] : [-4.5, 1.5])) {
      trussMember([rootX, rootY, rootZ], [x, y, z], .1);
    }
    box('equipment', [x, y, z], [1.25, 1.15, 1.15]);
    for (const direction of [[0, 0, side], [0, 1, 0], [0, -1, 0], [x < 0 ? -1 : 1, 0, 0]]) {
      const axis = vector(direction);
      const origin = vector([x, y, z]).addScaledVector(axis, .62);
      link('engine', origin.clone().addScaledVector(axis, -.2).toArray(), origin.toArray(), .17);
      const bell = mesh(attitudeGeometry, 'engine', origin.toArray(), [1, 1, 1]);
      bell.quaternion.setFromUnitVectors(up, axis);
    }
  }
  mark('P 双组元化学推进段', [25.8, 4.4, 0], true);
  mark('P 燃烧室与推力框', [36, 2.3, 0]);
  mark('P 前端姿控', [-26, 1.8, -3]);

  // ISS-inspired equipment trusses and rotary roots; static display only.
  // Existing 12 x 24 m footprints remain a gross area, not assigned power.
  const solarFaceGeometry = new THREE.PlaneGeometry(1, 1);
  const rotaryGeometry = new THREE.TorusGeometry(1.52, .14, 10, 40);
  for (const side of [-1, 1]) {
    // Fixed feeder boom stays below the propellant tank envelope.
    transverseTruss(18.5, side * 1.6, side * 6.4, -4.8, 1.4, 1.4);
    for (const x of [17.8, 19.2]) {
      const spineZ = x < 18 ? .77 : .55;
      trussMember([x, -3.8, side * spineZ], [x, -4.1, side * 1.6], .13);
    }
    for (const dx of [-.65, .65]) link('structure', [18.5 + dx, -4.1, side * 6.4], [18.5 + dx, -3.2, side * 6.4], .16);
    const rotary = mesh(rotaryGeometry, 'joint', [18.5, -3.2, side * 6.4], [1, 1, 1]);
    link('equipment', [18.5, -3.2, side * 6.1], [18.5, -3.2, side * 6.7], .92);
    for (let i = 0; i < 6; i++) {
      const angle = i * Math.PI / 3;
      box('docking', [18.5 + Math.cos(angle) * 1.5, -3.2 + Math.sin(angle) * 1.5, side * 6.4], [.24, .24, .32]);
    }
    // Deep rectangular bus carries a power cabinet, cable ducts and joints.
    transverseTruss(18.5, side * 6.8, side * 18.5, -3.2, 3.4, 3);
    // Distributed side-mounted electrical trays leave the central bay open.
    for (let i = 0; i < 3; i++) {
      const z = side * (8.8 + i * 3.3);
      const mountSide = i % 2 ? -1 : 1;
      const x = 18.5 + mountSide * 1.12;
      box('structure', [x, -3.15, z], [.1, 1.75, 1.85]);
      for (const dy of [-.7, .7]) {
        link('structure', [18.5 + mountSide * 1.65, -3.15 + dy, z - .75], [x, -3.15 + dy, z - .75], .055);
        link('structure', [18.5 + mountSide * 1.65, -3.15 + dy, z + .75], [x, -3.15 + dy, z + .75], .055);
      }
      const faceX = x + mountSide * .28;
      box(i % 2 ? 'equipment' : 'hullGrey', [faceX, -2.95, z - .38], [.45, .82, .78]);
      box('service', [faceX, -3.62, z + .42], [.38, .42, .62]);
      box('joint', [faceX, -2.6, z + .48], [.3, .28, .45]);
      // Cover seam, heatsink fins, connector sockets and a short harness branch.
      box('joint', [faceX + mountSide * .235, -3.16, z - .38], [.025, .04, .64]);
      for (let fin = 0; fin < 5; fin++) {
        box('docking', [faceX + mountSide * .255, -2.72 + fin * .09, z - .38], [.06, .035, .58]);
      }
      for (const dz of [-.16, .16]) {
        link('joint', [faceX, -3.7, z + .42 + dz], [faceX + mountSide * .26, -3.7, z + .42 + dz], .07);
      }
      link('plumbing', [faceX + mountSide * .26, -3.7, z + .26], [18.5 + mountSide * 1.2, -4.35, z + .26], .045);
      box('guide', [faceX + mountSide * .24, -3.04, z - .38], [.035, .04, .27]);
    }
    for (const dx of [-1.2, 1.2]) {
      link('plumbing', [18.5 + dx, -4.35, side * 7], [18.5 + dx, -4.35, side * 18.5], .055);
    }
    link('joint', [17.65, -1.35, side * 19.5], [19.35, -1.35, side * 19.5], .58);
    link('structure', [18.5, -3.2, side * 18.5], [18.5, -1.35, side * 19.5], .2);
    transverseTruss(18.5, side * 20, side * 44, -1.45, .85, .85);

    // Panel banks have visible fold lines, narrow frames and dark cell faces.
    for (const x of [12.4, 24.6]) box('structure', [x, -1, side * 32], [.12, .18, 24.2]);
    for (const z of [side * 20, side * 44]) box('structure', [18.5, -1, z], [12.2, .18, .12]);
    for (let ix = 0; ix < 4; ix++) for (let iz = 0; iz < 6; iz++) {
      const x = 18.5 - 4.5 + ix * 3, z = side * 32 - 10 + iz * 4;
      box('equipment', [x, -1, z], [2.9, .1, 3.86]);
      const face = mesh(solarFaceGeometry, 'panels', [x, -.935, z], [2.79, 3.73, 1]);
      face.rotation.x = -Math.PI / 2;
      face.castShadow = false;
    }
    for (let i = 1; i < 6; i++) {
      const z = side * (20 + i * 4);
      box('structure', [18.5, -.94, z], [12.1, .075, .09]);
      for (const x of [13, 18.5, 24]) link('joint', [x - .22, -1, z], [x + .22, -1, z], .115);
    }

    // Independent radiator support, root manifold and five hinged white leaves.
    transverseTruss(31, side * 1.6, side * 11, -5.2, 2, 2);
    for (const x of [30, 32]) trussMember([x, -3.8, side * .55], [x, -4.2, side * 1.6], .13);
    trussMember([31, -3.8, side * .55], [31, -5.2, side * 9], .14);
    box('equipment', [31, -4.6, side * 10.5], [2.8, .8, 1.15]);
    const radiatorMeshStart = object.children.length;
    link('joint', [31, -4.15, side * 9.8], [31, -4.15, side * 12.2], .36);
    for (const x of [27.1, 34.9]) {
      link('plumbing', [x, -4.33, side * 11], [x, -4.33, side * 21], .065);
    }
    for (let i = 0; i < 5; i++) {
      const z = side * (12 + i * 2);
      box('structure', [31, -4.12, z], [8, .14, 1.92]);
      box('radiator', [31, -4.025, z], [7.83, .055, 1.8]);
      box('radiator', [31, -4.215, z], [7.83, .03, 1.8]);
      for (const x of [27.4, 29.2, 31, 32.8, 34.6]) {
        link('structure', [x, -4.25, z - .88], [x, -4.25, z + .88], .04);
      }
      link('plumbing', [27.1, -4.32, z], [34.9, -4.32, z], .045);
      if (i < 4) link('joint', [27.3, -4.14, side * (13 + i * 2)], [34.7, -4.14, side * (13 + i * 2)], .075);
    }
    // Solar normals stay on Y; radiator normals lie along the station X axis.
    // Rotate the complete leaf/frame/plumbing assembly around its root hinge.
    const radiatorPivot = new THREE.Vector3(31, -4.15, side * 11);
    const radiatorRotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2);
    for (const part of object.children.slice(radiatorMeshStart)) {
      if (!part.isMesh) continue;
      part.position.sub(radiatorPivot).applyQuaternion(radiatorRotation).add(radiatorPivot);
      part.quaternion.premultiply(radiatorRotation);
    }
    for (const x of [27.1, 34.9]) {
      const manifoldRoot = new THREE.Vector3(x, -4.33, side * 11).sub(radiatorPivot).applyQuaternion(radiatorRotation).add(radiatorPivot);
      link('plumbing', [31, -4.6, side * 10.5], manifoldRoot.toArray(), .085);
    }
  }
  mark('W 能源设备桁架', [18.5, -.8, -12.8]);
  mark('W 双侧光伏翼', [18.5, 1.4, -32]);
  mark('W 轴向散热器', [31, 1, 16]);

  // One model metre is visible; this bar is not an assigned station dimension.
  box('structure', [-17, -8.3, 10], [10, .12, .12]);
  for (const x of [-22, -17, -12]) box('structure', [x, -8.3, 10], [.12, .8, .12]);
  mark('10 m 参考尺', [-17, -8.3, 10]);

  envelope('Crew docking approach', [-33.3, -1.4, 0], [13.8, 4.6, 4.6]);
  envelope('Cargo docking approach', [-20, -1.4, 15.1], [5, 5, 13.8]);
  envelope('Forest work area', [-.5, -2.1, -16.2], [18, 6, 3]);
  envelope('Wetland work area', [10, -2.1, 16.2], [12, 6, 3]);
  for (const side of [-1, 1]) {
    envelope('Solar deployment', [18.5, -.85, side * 32], [14, 3.5, 26]);
    envelope('Radiator deployment', [31, -4.15, side * 16], [3.5, 10, 12]);
  }
  envelope('Exhaust clearance', [51, -1.5, 0], [20, 15, 15]);
  object.add(envelopes);
  // Batch static repeated structural pieces; the mesh count can grow without
  // adding one draw call for every diagonal, panel tile or mounting block.
  for (const parent of [object, antenna]) {
    const batches = new Map();
    for (const part of [...parent.children]) {
      if (!part.isMesh || part.material.transparent) continue;
      part.updateMatrix();
      const key = `${part.geometry.uuid}/${part.material.uuid}/${part.castShadow}/${part.receiveShadow}`;
      if (!batches.has(key)) batches.set(key, { geometry: part.geometry, material: part.material, castShadow: part.castShadow, receiveShadow: part.receiveShadow, matrices: [] });
      batches.get(key).matrices.push(part.matrix.clone());
      parent.remove(part);
    }
    for (const batch of batches.values()) {
      const instance = new THREE.InstancedMesh(batch.geometry, batch.material, batch.matrices.length);
      batch.matrices.forEach((matrix, index) => instance.setMatrixAt(index, matrix));
      instance.instanceMatrix.needsUpdate = true;
      instance.castShadow = batch.castShadow; instance.receiveShadow = batch.receiveShadow;
      instance.computeBoundingSphere(); parent.add(instance);
    }
  }
  return { object, markers, envelopes, aimAntennaAt, update() {} };
}
