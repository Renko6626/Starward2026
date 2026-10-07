import * as THREE from 'three';

// Camera-local geometry in metres. Concept structure, not a qualified vehicle.
export function createCockpit(aspect) {
  const root = new THREE.Group();
  root.position.z = -.18;
  const metal = new THREE.MeshStandardMaterial({ color: 0x354149, metalness: .72, roughness: .48 });
  const edge = new THREE.MeshStandardMaterial({ color: 0x738080, metalness: .78, roughness: .34 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x080e11, roughness: .9 });
  const panel = new THREE.MeshStandardMaterial({ color: 0x19242b, metalness: .38, roughness: .66 });
  const bolt = new THREE.MeshStandardMaterial({ color: 0x899393, metalness: .86, roughness: .3 });
  const light = new THREE.MeshBasicMaterial({ color: 0xa5c6be });
  const amber = new THREE.MeshBasicMaterial({ color: 0xc1a272 });
  const w = Math.max(.96, aspect * 1.63), h = 1.48;
  const outline = (x, y) => [[-x + .28, y], [x - .28, y], [x, y - .28], [x, -y + .35], [x - .35, -y], [-x + .35, -y], [-x, -y + .35], [-x, y - .28]];
  function shape(points) {
    const result = new THREE.Shape();
    points.forEach(([x, y], i) => i ? result.lineTo(x, y) : result.moveTo(x, y));
    result.closePath(); return result;
  }
  function rim(inset, thickness, depth, z, material) {
    const ring = shape(outline(w + inset + thickness, h + inset + thickness));
    ring.holes.push(new THREE.Path(shape(outline(w + inset, h + inset)).getPoints().reverse()));
    const geometry = new THREE.ExtrudeGeometry(ring, { depth, bevelEnabled: true, bevelThickness: .018, bevelSize: .018, bevelSegments: 2, steps: 1 });
    const mesh = new THREE.Mesh(geometry, material); mesh.position.z = z; root.add(mesh);
  }
  rim(0, .065, .035, -3.02, rubber);
  rim(.065, .05, .08, -3.0, edge);
  rim(.115, .26, .25, -2.97, metal);
  rim(.38, .1, .1, -2.85, rubber);
  function box(x, y, z, sx, sy, sz, material, rotation = 0) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), material);
    mesh.position.set(x, y, z); mesh.rotation.z = rotation; root.add(mesh); return mesh;
  }
  const boltGeometry = new THREE.CylinderGeometry(.025, .025, .025, 6);
  const washerGeometry = new THREE.CylinderGeometry(.04, .04, .009, 20);
  function fastener(x, y) {
    for (const [geometry, material, z] of [[washerGeometry, rubber, -2.716], [boltGeometry, bolt, -2.702]]) {
      const mesh = new THREE.Mesh(geometry, material); mesh.rotation.x = Math.PI / 2;
      mesh.position.set(x, y, z); root.add(mesh);
    }
  }
  for (let x = -w + .4; x <= w - .35; x += .38) { fastener(x, h + .13); fastener(x, -h - .13); }
  for (let y = -h + .4; y <= h - .35; y += .36) { fastener(-w - .08, y); fastener(w + .08, y); }
  // Side rails support the instrument shelf, with recessed fastened plates.
  for (const side of [-1, 1]) {
    box(side * (w + .24), -.75, -2.81, .22, 1.6, .15, panel, side * -.04);
    box(side * (w + .11), -.95, -2.71, .025, 1.05, .05, edge, side * -.04);
  }
  box(0, -1.64, -2.52, w * 2 + 1.1, .25, .9, panel);
  box(0, -1.48, -2.62, w * 2 + .6, .065, .5, metal);
  box(0, -1.437, -2.66, w * 1.8, .012, .018, light);
  for (const side of [-1, 1]) {
    const x = side * (w - .38);
    box(x, -1.43, -2.7, .55, .22, .06, rubber);
    for (let i = 0; i < 4; i++) {
      box(x - .2 + i * .135, -1.385, -2.655, .07, .023, .02, i === 0 ? amber : light);
      box(x - .2 + i * .135, -1.46, -2.655, .04, .045, .035, edge);
    }
  }
  // Printed maintenance identification belongs to the structure, not the HUD.
  const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 128;
  const context = canvas.getContext('2d');
  context.clearRect(0, 0, 1024, 128); context.fillStyle = '#c3cac1';
  context.font = '24px monospace'; context.fillText('FWD / PRESSURE WINDOW', 24, 45);
  context.fillStyle = '#788988'; context.font = '17px monospace';
  context.fillText('INNER PANE RETAINER     ACCESS FROM CABIN', 24, 83);
  const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace;
  const label = new THREE.Mesh(new THREE.PlaneGeometry(1.7, .21), new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false }));
  label.position.set(0, h + .13, -2.696); root.add(label);
  // Window coating is intentionally subtle and has no expensive transmission.
  const glass = new THREE.Mesh(new THREE.ShapeGeometry(shape(outline(w, h))), new THREE.MeshPhysicalMaterial({
    color: 0x8fa9ac, metalness: .1, roughness: .18, transparent: true, opacity: .025, depthWrite: false, side: THREE.DoubleSide,
  }));
  glass.position.z = -3.04; root.add(glass);
  root.name = 'Forward pressure window and instrument coaming';
  return root;
}
