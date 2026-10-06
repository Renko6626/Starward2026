import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { createSolarCellTexture, createStationSurfaceMaps } from '../materials.js';

export function createStationResources() {
  const maps = createStationSurfaceMaps();
  const inventoryLabel = (title, subtitle, stripe) => {
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 192;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#d4dbd7'; ctx.fillRect(0, 0, 512, 192);
    ctx.fillStyle = stripe; ctx.fillRect(0, 0, 28, 192);
    ctx.fillStyle = '#20303b'; ctx.font = 'bold 60px sans-serif'; ctx.fillText(title, 48, 88);
    ctx.font = '26px sans-serif'; ctx.fillText(subtitle, 50, 142);
    ctx.fillRect(444, 38, 24, 24);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4; return texture;
  };
  const metal = (color, roughness = .48, extra = {}) => new THREE.MeshStandardMaterial({
    color, metalness: .72, roughness, roughnessMap: maps.metalRoughness, ...extra,
  });
  const paint = (color) => new THREE.MeshStandardMaterial({
    color, metalness: .18, roughness: .64, map: maps.panel,
    roughnessMap: maps.paintRoughness, bumpMap: maps.paintHeight, bumpScale: .008,
  });
  const materials = {
    hull: paint(0xc7cfcc), hullPanel: paint(0xaebbbd), hullWarm: paint(0xc1bfb1),
    hullShade: paint(0x97a8af), service: paint(0x627b86),
    pressureHull: metal(0x88989e, .43, { bumpMap: maps.paintHeight, bumpScale: .006 }),
    silver: metal(0x9faeb4, .36), frame: metal(0x576874), dark: metal(0x26313a),
    red: paint(0x97564b), radiator: paint(0xd6dcd9),
    foil: metal(0xb6a078, .57, { map: maps.blanket, bumpMap: maps.foilHeight, bumpScale: .05 }),
    tank: metal(0xb6b4a4, .48, { bumpMap: maps.foilHeight, bumpScale: .015 }),
    reserveTank: metal(0xbac9cb, .5), reserveCargo: paint(0xb9b8a7), reservePipe: metal(0x678c9a),
    waterLabel: new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: .1, roughness: .75,
      map: inventoryLabel('WATER', 'RESERVE / ISOLATED', '#526f88') }),
    cargoLabel: new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: .1, roughness: .75,
      map: inventoryLabel('STORES', 'DRY CARGO / SEALED', '#9e7b4f') }),
    crewLabel: new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: .1, roughness: .75,
      map: inventoryLabel('ACCESS', 'CREW / TRANSFER', '#526f88') }),
    workLabel: new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: .1, roughness: .75,
      map: inventoryLabel('WORK', 'RESERVE OPERATIONS', '#526f88') }),
    substrateLabel: new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: .1, roughness: .75,
      map: inventoryLabel('SUBSTRATE', 'SEALED / DRY MEDIA', '#9e7b4f') }),
    sparesLabel: new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: .1, roughness: .75,
      map: inventoryLabel('SPARES', 'REPLACEABLE UNITS', '#647d79') }),
    fuelPipe: metal(0xa87550), oxidizerPipe: metal(0x7793a0),
    solar: metal(0x93b9d1, .44, { map: createSolarCellTexture() }),
    glass: metal(0x122834, .22, { emissive: 0x204357, emissiveIntensity: .22 }),
    light: new THREE.MeshStandardMaterial({ color: 0xd1e1df, emissive: 0x9ccfdd, emissiveIntensity: .7 }),
    dish: metal(0xc2cbc9, .52, { side: THREE.DoubleSide }),
  };
  const geometries = {
    box: new THREE.BoxGeometry(1, 1, 1),
    rounded: new RoundedBoxGeometry(1, 1, 1, 2, .08),
    cylinder: new THREE.CylinderGeometry(1, 1, 1, 20),
    sphere: new THREE.SphereGeometry(1, 20, 12),
    nozzle: new THREE.LatheGeometry([
      new THREE.Vector2(.46, 0), new THREE.Vector2(.5, .35),
      new THREE.Vector2(.62, .75), new THREE.Vector2(.86, 1.25),
      new THREE.Vector2(1.25, 1.9), new THREE.Vector2(1.7, 2.55),
      new THREE.Vector2(1.8, 2.8), new THREE.Vector2(1.72, 2.8),
      new THREE.Vector2(1.61, 2.52), new THREE.Vector2(1.17, 1.87),
      new THREE.Vector2(.79, 1.22), new THREE.Vector2(.56, .73),
      new THREE.Vector2(.44, .35), new THREE.Vector2(.4, 0),
    ], 32),
  };
  return { materials, geometries };
}
