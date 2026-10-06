// Metres; confirmed describes the brief, working describes this exterior study.
export const layout = {
  confirmed: {
    location: 'Earth–Moon L4', mainOuterRadius: 56, ecologicalClearHeight: 8,
    usableAxialWidth: 16, serviceBandWidth: 2, gravityTarget: .16,
    mainSpokes: 4, mainTanks: 6, mainEngines: 4, solarWings: 4, radiators: 2,
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
    solarPanelWidth: 7, solarWingLength: 30, solarRootZ: 40,
    radiatorWidth: 5, radiatorLength: 22, radiatorRootX: 17, radiatorRootZ: 32,
    radiatorStartY: 2.5, antennaDiameter: 9,
  },
};
