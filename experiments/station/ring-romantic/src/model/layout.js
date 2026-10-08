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
