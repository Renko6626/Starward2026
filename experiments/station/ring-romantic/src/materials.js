import * as THREE from 'three';

function canvasTexture(width, height, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext('2d'), width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

export function createMaterials() {
  const hullMap = canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#c9cecb'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#9ba6a5'; ctx.lineWidth = 2;
    ctx.strokeRect(12, 12, 488, 488);
    ctx.strokeRect(33, 33, 446, 340);
    ctx.fillStyle = '#acb5b4'; ctx.fillRect(32, 394, 155, 66);
    ctx.fillStyle = '#5a666c';
    for (let i = 0; i < 13; i++) ctx.fillRect(215 + i * 18, 410, 6, 34);
    for (const x of [24, 488]) for (const y of [24, 488]) {
      ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#8c4d41'; ctx.fillRect(32, 53, 7, 90);
  });
  const solarMap = canvasTexture(256, 512, (ctx, w, h) => {
    ctx.fillStyle = '#122937'; ctx.fillRect(0, 0, w, h);
    for (let row = 0; row < 16; row++) for (let col = 0; col < 6; col++) {
      ctx.fillStyle = (row + col) % 3 ? '#203c51' : '#294856';
      ctx.fillRect(col * 42 + 3, row * 32 + 3, 38, 28);
      ctx.fillStyle = '#6d8b965c'; ctx.fillRect(col * 42 + 19, row * 32 + 3, 1, 28);
    }
  });
  const labelMap = canvasTexture(1024, 256, (ctx, w, h) => {
    ctx.fillStyle = '#cdd0c9'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#26313a'; ctx.font = '500 82px sans-serif';
    ctx.fillText('秘封', 38, 113);
    ctx.font = '26px sans-serif'; ctx.fillText('HIFUU OBSERVATORY', 42, 175);
    ctx.fillStyle = '#8d4940'; ctx.fillRect(793, 28, 13, 190);
    ctx.font = '72px sans-serif'; ctx.fillText('01', 834, 129);
  });
  const standard = (color, metalness = .5, roughness = .5, extra = {}) =>
    new THREE.MeshStandardMaterial({ color, metalness, roughness, ...extra });
  const materials = {
    hull: standard(0xd9dcd3, .34, .56, { map: hullMap }),
    white: standard(0xd1d4cf, .42, .43),
    silver: standard(0x879ba7, .82, .3),
    frame: standard(0x32414d, .78, .48),
    dark: standard(0x111d27, .5, .56),
    red: standard(0x934d40, .38, .5),
    gold: standard(0xb39462, .8, .38),
    solar: standard(0xc9e0ee, .42, .42, { map: solarMap }),
    glass: standard(0x142b35, .72, .19, { emissive: 0x173947, emissiveIntensity: .22 }),
    warm: standard(0xffd399, .1, .4, { emissive: 0xffb966, emissiveIntensity: 2.8 }),
    cool: standard(0xb3d9ed, .1, .4, { emissive: 0x9ccce5, emissiveIntensity: 2.1 }),
    signal: standard(0xf78060, .1, .4, { emissive: 0xff4524, emissiveIntensity: 4 }),
    label: standard(0xffffff, .25, .58, { map: labelMap }),
  };
  return materials;
}

// A sparse reflection field gives exposed metal a cold bounce and a warm sun.
// It illuminates materials only; it is not used as the background.
export function createEnvironment(renderer) {
  const map = canvasTexture(1024, 512, (ctx, w, h) => {
    ctx.fillStyle = '#141c27'; ctx.fillRect(0, 0, w, h);
    const cold = ctx.createRadialGradient(230, 290, 0, 230, 290, 250);
    cold.addColorStop(0, '#678194'); cold.addColorStop(1, '#141c27');
    ctx.fillStyle = cold; ctx.fillRect(0, 0, w, h);
    const sun = ctx.createRadialGradient(740, 100, 0, 740, 100, 105);
    sun.addColorStop(0, '#fff3d7'); sun.addColorStop(.2, '#d1c5ae'); sun.addColorStop(1, '#141c2700');
    ctx.fillStyle = sun; ctx.fillRect(0, 0, w, h);
  });
  map.mapping = THREE.EquirectangularReflectionMapping;
  const generator = new THREE.PMREMGenerator(renderer);
  const target = generator.fromEquirectangular(map);
  generator.dispose(); map.dispose();
  return target;
}


export function createSolarCellTexture() {
  return canvasTexture(256, 512, (ctx, width, height) => {
    ctx.fillStyle = '#182632'; ctx.fillRect(0, 0, width, height);
    for (let row = 0; row < 12; row++) for (let col = 0; col < 6; col++) {
      const x = col * width / 6 + 2, y = row * height / 12 + 2;
      ctx.fillStyle = (row + col) % 4 === 0 ? '#304c61' : '#243f54';
      ctx.fillRect(x, y, width / 6 - 4, height / 12 - 4);
      ctx.fillStyle = '#6a7a83';
      ctx.fillRect(x + 10, y, .8, height / 12 - 4);
      ctx.fillRect(x + 27, y, .8, height / 12 - 4);
    }
  });
}

// Shared, deterministic surface maps for the current station. Colour maps use
// sRGB; height and roughness are linear data. No external texture downloads.
export function createStationSurfaceMaps() {
  const dataMap = (draw) => {
    const texture = canvasTexture(256, 256, draw);
    texture.colorSpace = THREE.NoColorSpace;
    return texture;
  };
  const grain = (ctx, w, h, base, amplitude, brushed = false) => {
    const pixels = ctx.createImageData(w, h);
    let seed = 1637;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const value = base + amplitude * (seed / 4294967296 - .5)
        + (brushed ? Math.sin(y * 2.7) * 9 : 0);
      const offset = (y * w + x) * 4;
      pixels.data[offset] = pixels.data[offset + 1] = pixels.data[offset + 2] = value;
      pixels.data[offset + 3] = 255;
    }
    ctx.putImageData(pixels, 0, 0);
  };
  const panel = canvasTexture(512, 512, (ctx, w, h) => {
    grain(ctx, w, h, 244, 5);
    // Folded perimeter and captive fasteners, kept subtle at full-station scale.
    ctx.strokeStyle = '#b4bab8'; ctx.lineWidth = 3;
    ctx.strokeRect(5, 5, w - 10, h - 10);
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
    ctx.strokeRect(10, 10, w - 20, h - 20);
    for (const x of [24, w - 24]) for (const y of [24, h - 24]) {
      ctx.fillStyle = '#a3aaa9'; ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#59636a'; ctx.fillRect(x - 2, y - 1, 4, 2);
    }
  });
  const foilHeight = dataMap((ctx, w, h) => {
    const pixels = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const u = x / w, v = y / h;
      const wave = Math.sin(u * 31 + Math.sin(v * 19) * 2.1)
        + .55 * Math.sin(v * 47 + Math.sin(u * 17) * 2.8)
        + .25 * Math.sin(u * 103 + v * 81);
      const edge = Math.min(1, Math.min(x, y, w - 1 - x, h - 1 - y) / 16);
      const value = 128 + wave * 35 * edge;
      const offset = (y * w + x) * 4;
      pixels.data[offset] = pixels.data[offset + 1] = pixels.data[offset + 2] = value;
      pixels.data[offset + 3] = 255;
    }
    ctx.putImageData(pixels, 0, 0);
  });
  const blanket = canvasTexture(512, 512, (ctx, w, h) => {
    grain(ctx, w, h, 238, 9);
    ctx.strokeStyle = '#b8b5a8'; ctx.lineWidth = 15;
    ctx.strokeRect(10, 10, w - 20, h - 20);
    ctx.strokeStyle = '#e7e5db'; ctx.lineWidth = 2; ctx.setLineDash([5, 4]);
    ctx.strokeRect(14, 14, w - 28, h - 28); ctx.setLineDash([]);
    for (const x of [20, w - 20]) for (const y of [60, h / 2, h - 60]) {
      ctx.fillStyle = '#d1cec1'; ctx.fillRect(x - 12, y - 18, 24, 36);
      ctx.fillStyle = '#777f7c'; ctx.fillRect(x - 3, y - 4, 6, 8);
    }
  });
  const paintRoughness = dataMap((ctx, w, h) => {
    grain(ctx, w, h, 207, 14);
    // Small finish variations, retained fastener pads and folded edges. These
    // modulate reflection; they do not add broad dirt to the colour map.
    ctx.strokeStyle = '#f0f0f0'; ctx.lineWidth = 8;
    ctx.strokeRect(4, 4, w - 8, h - 8);
    for (let row = 0; row < 4; row++) for (let col = 0; col < 4; col++) {
      const tone = 186 + (row * 13 + col * 7) % 34;
      ctx.fillStyle = `rgb(${tone},${tone},${tone})`;
      ctx.fillRect(col * 64 + 12, row * 64 + 12, 39, 39);
    }
  });
  const metalRoughness = dataMap((ctx, w, h) => grain(ctx, w, h, 192, 18, true));
  const paintHeight = dataMap((ctx, w, h) => grain(ctx, w, h, 128, 8));
  return { panel, blanket, foilHeight, paintRoughness, metalRoughness, paintHeight };
}
