import * as THREE from 'three';
import { layout } from './model/layout.js';
import { createStationResources } from './model/resources.js';
import { createMainRing } from './model/main-ring.js';
import { createCounterRing } from './model/counter-ring.js';
import { createCore } from './model/core.js';
import { createPropulsion } from './model/propulsion.js';
import { createEnergyThermal } from './model/energy-thermal.js';
import { createOperations } from './model/operations.js';

export function createRingStation() {
  const resources = createStationResources(), context = { layout, resources };
  // One display slowdown for both rings, preserving the confirmed operating
  // speed ratio. Operating targets do not establish mass/inertia balance.
  const mainOperatingSpeed = Math.sqrt(layout.confirmed.gravityTarget * 9.80665 / layout.working.floorRadius);
  const counterOperatingSpeed = layout.confirmed.counterRpmTarget * Math.PI * 2 / 60;
  const counterDisplaySpeed = -layout.working.mainDisplaySpeed * counterOperatingSpeed / mainOperatingSpeed;
  const object = new THREE.Group(); object.name = 'Torifune / ring exterior study';
  const fixed = new THREE.Group(); fixed.name = 'Fixed group / no ring rotation'; object.add(fixed);
  const core = createCore(context), propulsion = createPropulsion(context);
  const energy = createEnergyThermal(context), operations = createOperations(context);
  fixed.add(core.object, propulsion.object, energy.object, operations.object);
  const main = createMainRing(context), counter = createCounterRing(context);
  object.add(main.object, main.transferCabin, counter.object, counter.transferCabin);

  const markerBindings = [
    [`生态主环 / ${layout.confirmed.mainOuterRadius * 2} m`, main.anchors.mainRing, true],
    [`物资储备环 / ${layout.confirmed.counterDiameter} m`, counter.anchors.counterRing, true],
    ['固定分析舱', core.anchors.lab, false], ['人员支持', core.anchors.personnel, false],
    ['载人对接', operations.anchors.crewDock, false], ['货运检查', operations.anchors.cargoDock, false],
    ['主通信碟', operations.anchors.comms, false],
    ['装配臂', operations.anchors.assemblyArm, false], ['检修臂', operations.anchors.inspectionArm, false],
    ['主环入口', main.anchors.crewLandings[0], false],
    ['六罐化学尾段', propulsion.anchors.tanks[0], false],
    ['四主机', propulsion.anchors.engines[1], false],
    ['光伏翼', energy.anchors.solar[2], false], ['分段散热板', energy.anchors.radiators[0], false],
  ];
  const markers = markerBindings.map(([label, , primary]) => ({ label, primary, position: new THREE.Vector3() }));
  const envelopes = new THREE.Group(); envelopes.name = 'Working envelopes / unverified clearances';
  envelopes.visible = false; object.add(envelopes);
  const outline = new THREE.LineBasicMaterial({ color: 0x79abb8, transparent: true, opacity: .4, depthWrite: false });
  const envelopeBox = (name, position, size) => {
    const box = new THREE.BoxGeometry(...size), edges = new THREE.EdgesGeometry(box); box.dispose();
    const line = new THREE.LineSegments(edges, outline); line.name = name; line.position.set(...position); envelopes.add(line);
  };
  envelopeBox('Crew approach / drawing only', [layout.working.coreFront - 23, 0, 0], [24, 10, 10]);
  envelopeBox('Cargo approach / drawing only', [layout.working.coreFront - 4, 0, 22.4], [12, 12, 24]);
  envelopeBox('Fixed arm posture / drawing only', [-18 + layout.working.coreFront + 42, -11, 4], [34, 18, 28]);
  envelopeBox('Main propulsion aft region / not a plume calculation', [layout.working.engineExit + 12, 0, 0], [24, 28, 28]);
  envelopeBox('Fixed wings / static deployed envelope', [23 + layout.working.energyAxialOffset, 0, 0], [30, 90, 208]);
  const inverseRoot = new THREE.Matrix4();
  function update(time) {
    main.object.rotation.x = time * layout.working.mainDisplaySpeed;
    // Exterior travel pose only: the independent cabin is currently matched
    // to the main rotor. Boarding, spin matching and docking are not animated.
    main.transferCabin.rotation.x = main.object.rotation.x;
    counter.object.rotation.x = time * counterDisplaySpeed;
    counter.transferCabin.rotation.x = counter.object.rotation.x;
    object.updateWorldMatrix(true, true); inverseRoot.copy(object.matrixWorld).invert();
    markerBindings.forEach(([, point], i) => {
      // Preserve the Vector3 reference retained by the viewer's spread object.
      markers[i].position.setFromMatrixPosition(point.matrixWorld).applyMatrix4(inverseRoot);
    });
  }
  update(0);
  return { object, markers, envelopes, update, aimAntennaAt: operations.aimAntennaAt };
}
