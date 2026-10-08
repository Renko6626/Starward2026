// Metres; confirmed describes the brief, working describes this exterior study.
export const layout = {
  confirmed: {
    location: 'Earth–Moon L4', mainOuterRadius: 56, ecologicalClearHeight: 8,
    usableAxialWidth: 16, serviceBandWidth: 2, gravityTarget: .16,
    mainSpokes: 4, mainTanks: 6, mainEngines: 4, solarWings: 4, radiators: 4,
    counterDiameter: 84, counterRpmTarget: 2, crew: 4, residenceMonths: [2, 3],
    counterRole: 'Material reserves / angular momentum balancing',
    radiatorExtensionAxis: 'Y', radiatorMount: 'Fixed photovoltaic truss',
  },
  working: {
    mainX: 0, mainRadialEnvelope: 11, floorRadius: 54, mainAxialEnvelope: 18,
    mainSegments: 16, counterDiameter: 84, counterX: -30, counterDepth: 6.8,
    mainCrewSpokeIndices: [0, 2], mainAccessShaftX: -1.6,
    mainAccessInnerRadius: 10.6, mainAccessOuterRadius: 44.8,
    mainTransferX: -8.5, mainTransferRadius: 9.3,
    // Subdued exterior support study; these are envelope/display dimensions,
    // not newly verified load-bearing sections or pressure-vessel properties.
    mainSurface: {
      circumferentialPanels: 3, axialRows: 2, sideRows: 2,
      panelOffset: .065, panelThickness: .025, seam: .045,
      outerJointOffset: .16, outerJointThickness: .025,
      ordinaryNodeColumns: 2, majorCentreKeepoutHalfWidth: 4.55,
    },
    mainInnerSupport: {
      axialOffset: 7.15, inwardOffset: .28, baysPerSegment: 5, jointDepth: .42,
      tieWidth: .12, braceWidth: .07, seatWidth: .08, nodeBraceWidth: .14,
    },
    counterStorageBays: 32, counterStorageRadius: 39.2, counterInnerRadius: 36.6,
    counterTankRadius: .8, counterTankBarrelLength: 2, counterTankCapDepth: .4,
    counterPodArcLength: 24, counterPodAxialWidth: 6, counterPodRadialHeight: 4,
    counterPodCentreBay: 6,
    counterWorkPodIndices: [0, 2], counterTransferX: -5.2, counterTransferRadius: 8.2,
    counterCrewInnerRadius: 9.5,
    coreFront: -60, engineExit: 66, energyAxialOffset: 10,
    coreModules: [
      [-51, 14, 4.5, 'hull'], [-40.5, 7, 4.7, 'hullShade'],
      [-16, 18, 4.9, 'hull'], [15, 16, 4.5, 'hullShade'], [30, 10, 3.8, 'service'],
    ],
    // Exterior working dimensions; original module centres and envelopes stay.
    coreDetail: {
      panelOffset: .06, panelThickness: .025, seam: .035,
      axialPanelLength: 4, shieldOffset: .20, shieldThickness: .025,
      shieldAxialPadding: .55, shieldArcPadding: .50,
      serviceAxialPadding: .90, serviceArcPadding: .70,
      angularSegments: 16, beamBandAngle: 8 * Math.PI / 180,
      modules: [
        { role: 'personnel', shoulderLength: 1, shoulderInset: .45, features: [
          { kind: 'window', localX: -2.65, angle: 0, axialWidth: 1.2, arcWidth: 1.1, lift: .24 },
          { kind: 'window', localX: 1.4, angle: 0, axialWidth: 1.2, arcWidth: 1.1, lift: .24 },
          { kind: 'hatch', localX: 2.8, angle: Math.PI / 2, axialWidth: 1.5, arcWidth: 1.6, lift: .25 },
        ] },
        { role: 'transfer', shoulderLength: .7, shoulderInset: .35, features: [
          { kind: 'equipmentPack', localX: 0, angle: 0, axialWidth: 4.1, arcWidth: 2.6, lift: .95 },
          { kind: 'sealedPort', localX: -1.5, angle: Math.PI / 2, axialWidth: 1.1, arcWidth: 1.2, lift: .26 },
          { kind: 'sealedPort', localX: 1.2, angle: Math.PI, axialWidth: 1.1, arcWidth: 1.2, lift: .26 },
          { kind: 'hatch', localX: -1, angle: Math.PI * 1.5, axialWidth: 1.4, arcWidth: 1.5, lift: .25 },
        ] },
        { role: 'analysis', shoulderLength: 1.1, shoulderInset: .5, features: [
          { kind: 'equipmentPack', localX: -1.2, angle: 0, axialWidth: 3, arcWidth: 2.5, lift: 1.2 },
          { kind: 'hatch', localX: -5, angle: Math.PI / 2, axialWidth: 1.8, arcWidth: 1.8, lift: .26 },
          { kind: 'hatch', localX: 1, angle: Math.PI / 2, axialWidth: 1.6, arcWidth: 1.8, lift: .26 },
          { kind: 'sealedPort', localX: -4, angle: Math.PI, axialWidth: 1, arcWidth: 1.1, lift: .25 },
          { kind: 'sealedPort', localX: 2, angle: Math.PI, axialWidth: 1, arcWidth: 1.1, lift: .25 },
        ] },
        { role: 'equipment', shoulderLength: 1, shoulderInset: .45, features: [
          { kind: 'equipmentPack', localX: -4, angle: 0, axialWidth: 2.1, arcWidth: 1.8, lift: .75 },
          { kind: 'equipmentPack', localX: 0, angle: 0, axialWidth: 2.1, arcWidth: 1.8, lift: .75 },
          { kind: 'hatch', localX: 3, angle: Math.PI / 2, axialWidth: 2, arcWidth: 1.8, lift: .27 },
        ] },
        { role: 'energy', shoulderLength: .7, shoulderInset: .35, features: [
          { kind: 'hatch', localX: -2, angle: 0, axialWidth: 1.7, arcWidth: 1.8, lift: .24 },
          { kind: 'hatch', localX: 2, angle: 0, axialWidth: 1.7, arcWidth: 1.8, lift: .24 },
          { kind: 'junction', localX: -2, angle: Math.PI, axialWidth: 1.4, arcWidth: 1.4, lift: .34 },
        ] },
      ],
    },
    mainDisplaySpeed: .025,
    tankRadius: 3.5, tankBarrelLength: 9, tankCircleRadius: 10,
    mainNozzleDiameter: 2.4, mainNozzleLength: 2,
    rcsNozzleDiameter: .2, rcsNozzleLength: .24, rcsPodSize: .55,
    rcsTankRadius: .55, rcsTankBarrelLength: 1.6,
    armBoomWidth: .35, armJointDiameter: .7,
    assemblyArmLength: 17, inspectionArmLength: 13,
    // Reference poses are fitted to the centreline lengths above, around each
    // fixed carriage. Inspection targets the fixed side of the front bearing.
    assemblyArmPose: [[-24, -7.5, 6.3], [-30, -12, 9], [-22, -16, 17], [-18, -11, 19]],
    inspectionArmPose: [[-7, -7.5, -6.3], [-8.5, -10.2, -6.5], [-12.5, -9.4, -5], [-15.3, -4.7, -4]],
    solarPanelWidth: 10, solarWingLength: 45, solarRootZ: 58,
    radiatorWidth: 6, radiatorLength: 40, radiatorRootX: 17, radiatorRootZ: 32,
    radiatorStartY: 4.5, antennaDiameter: 9,
    // Approved middle-load study: [outer width, candidate wall], metres.
    // Rendering represents the outer envelope, not solid metal or tube mass.
    structuralSections: {
      coreChord: [.35, .012], mainSpokeChord: [.28, .01],
      counterSpokeChord: [.3, .014], spokeAxialDiagonal: [.16, .008],
      mainRingChord: [.25, .008], counterRingChord: [.28, .01],
      mainTransverseFrame: [.45, .025], counterLoadedCrossbeam: [.25, .01],
      energyChord: [.2, .006], energyVerticalDiagonal: [.1, .005],
      solarChord: [.05, .003], solarDiagonal: [.025, .002],
      radiatorChord: [.08, .004], radiatorDiagonal: [.06, .003],
      planarThrustBeam: [.65, .035],
    },
    radiatorBackTrussDepth: .6,
    // Shell-supported fixed chords: closed rings, no straight cross-shell braces.
    coreSupportStations: [-58, -51, -44, -37, -30, -25, -16, -7, 0, 7, 15, 23, 30, 35, 40, 45.3],
  },
};
