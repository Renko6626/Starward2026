import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createAntennaArray } from './antenna.js';

export const antennaViews = ['overview', 'front', 'back', 'side', 'arm', 'drive', 'base'];

// Local procedural sky: no remote HDR/image dependency, and stars stay infinitely distant.
function createNightSky() {
  const width = 2048, height = 1024, canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, '#020711'); sky.addColorStop(0.48, '#101d32');
  sky.addColorStop(0.56, '#080e19'); sky.addColorStop(1, '#02050a');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, width, height);
  let seed = 731;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  // A faint, inclined stellar band breaks uniformity without drawing an invented constellation.
  for (let i = 0; i < 1100; i++) {
    const x = random() * width, band = 0.30 + 0.13 * Math.sin(x / width * Math.PI * 2 + 0.6);
    const y = (band + (random() + random() + random() - 1.5) * 0.045) * height;
    const alpha = 0.04 + random() * 0.11;
    ctx.fillStyle = `rgba(124,153,197,${alpha})`; ctx.beginPath(); ctx.arc(x, y, 0.4 + random() * 0.6, 0, Math.PI * 2); ctx.fill();
  }
  for (let i = 0; i < 2400; i++) {
    const x = random() * width, y = Math.acos(random()) / Math.PI * height;
    const bright = random(), radius = bright > 0.97 ? 0.55 : 0.15 + random() * 0.25;
    const alpha = 0.10 + Math.pow(bright, 5) * 0.72;
    ctx.fillStyle = `rgba(193,214,243,${alpha})`; ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();
    if (bright > 0.985) {
      const glow = ctx.createRadialGradient(x, y, 0, x, y, 1.5);
      glow.addColorStop(0, 'rgba(170,203,247,0.12)'); glow.addColorStop(1, 'rgba(170,203,247,0)');
      ctx.fillStyle = glow; ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
    }
  }
  const background = new THREE.CanvasTexture(canvas);
  background.mapping = THREE.EquirectangularReflectionMapping; background.colorSpace = THREE.SRGBColorSpace;
  // Separate low-frequency HDR sky radiance makes PBR metal readable at any view angle.
  const ew = 256, eh = 128, pixels = new Float32Array(ew * eh * 4);
  const moon = new THREE.Vector3(-0.65, 0.65, -0.40).normalize();
  for (let y = 0; y < eh; y++) for (let x = 0; x < ew; x++) {
    const latitude = (y / (eh - 1) - 0.5) * Math.PI, longitude = (x / ew - 0.5) * Math.PI * 2;
    const dir = new THREE.Vector3(Math.cos(latitude) * Math.cos(longitude), Math.sin(latitude), Math.cos(latitude) * Math.sin(longitude));
    const dome = Math.max(0, dir.y), lobe = Math.pow(Math.max(0, dir.dot(moon)), 48) * 4.0;
    const i = (y * ew + x) * 4;
    pixels[i] = 0.025 + dome * 0.13 + lobe * 0.64;
    pixels[i + 1] = 0.033 + dome * 0.19 + lobe * 0.79;
    pixels[i + 2] = 0.050 + dome * 0.29 + lobe;
    pixels[i + 3] = 1;
  }
  const radiance = new THREE.DataTexture(pixels, ew, eh, THREE.RGBAFormat, THREE.FloatType);
  radiance.mapping = THREE.EquirectangularReflectionMapping; radiance.needsUpdate = true;
  return { background, radiance };
}

export function mountArray(container, { view = null, animate = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;
  container.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const antenna = createAntennaArray(); scene.add(antenna);
  const inspection = antennaViews.includes(view);
  const sky = createNightSky();
  let environment = null;
  const rebuildEnvironment = () => {
    // Render targets lose their generated pixels on context restoration; retain CPU radiance.
    const pmrem = new THREE.PMREMGenerator(renderer), previous = environment;
    sky.radiance.needsUpdate = true;
    environment = pmrem.fromEquirectangular(sky.radiance);
    scene.environment = environment.texture;
    sky.radiance.dispose(); pmrem.dispose(); previous?.dispose();
  };
  rebuildEnvironment();
  scene.environmentIntensity = 0.8;
  if (inspection) scene.background = view === 'overview' ? sky.background : new THREE.Color(0x060d19);
  scene.add(new THREE.HemisphereLight(0x88a6d0, 0x192331, 0.26));
  const key = new THREE.DirectionalLight(0xb9d1ff, 3.6);
  key.position.set(-70, 90, -65); key.target.position.set(0, 24, 0); scene.add(key.target, key);
  key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, {left: -42, right: 42, top: 42, bottom: -42, near: 1, far: 220});
  key.shadow.bias = -0.00002; key.shadow.normalBias = 0.018;
  const rim = new THREE.DirectionalLight(0x7fa5df, 1.0);
  rim.position.set(45, 45, 35); rim.target.position.set(0, 25, 0); scene.add(rim.target, rim);
  antenna.traverse(object => { if (object.isMesh) {object.castShadow = true; object.receiveShadow = true;} });
  if (inspection) {
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(220, 220), new THREE.MeshStandardMaterial({color: 0x111923, roughness: 0.96}));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.03; ground.receiveShadow = true; scene.add(ground);
  }
  renderer.shadowMap.needsUpdate = true;
  // Ground-level perspective gives a true upward view; orthographic views remain for inspection.
  const groundView = view === null || view === 'overview';
  const camera = groundView ? new THREE.PerspectiveCamera(32, 1, 0.1, 600)
    : new THREE.OrthographicCamera(-40, 40, 40, -40, 0.1, 600);
  const details = {
    arm: new THREE.Box3().setFromObject(antenna.getObjectByName('curved-twin-box-girder-arm')),
    drive: new THREE.Box3(new THREE.Vector3(-14, 19, -5), new THREE.Vector3(-8, 32, 5)),
    base: new THREE.Box3(new THREE.Vector3(-12, 0, -12), new THREE.Vector3(12, 10, 12)),
  };
  const bounds = details[view] || new THREE.Box3().setFromObject(antenna), centre = bounds.getCenter(new THREE.Vector3());
  const elevation = antenna.userData.elevation.rotation.x;
  const directions = {
    front: new THREE.Vector3(0, -Math.sin(elevation), Math.cos(elevation)),
    back: new THREE.Vector3(0, 0.4, -1.5),
    side: new THREE.Vector3(1, 0.10, 0),
    arm: new THREE.Vector3(1, 0.12, -0.25),
    drive: new THREE.Vector3(-1.4, 0.18, -0.6),
    base: new THREE.Vector3(-1, 0.5, -1.25),
  };
  let controls = null, initialized = false, orthoFrame = null;
  const render = () => renderer.render(scene, camera);
  const resize = () => {
    const { width, height } = container.getBoundingClientRect(); if (!width || !height) return;
    const aspect = width / height;
    const target = inspection ? centre : new THREE.Vector3(0, 25, 0);
    if (groundView && (!inspection || !initialized)) {
      const verticalSpan = inspection ? Math.max(bounds.max.y * 1.22, 50 / aspect) : width < 640 ? 82 : 68;
      const distance = verticalSpan / (2 * Math.tan(THREE.MathUtils.degToRad(16)));
      const heading = inspection
        ? new THREE.Vector3(-1.6, 0, -1).normalize()
        : new THREE.Vector3(1, 0, 0.32).normalize()
          .applyAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(-20));
      camera.position.set(heading.x * distance, 1.7, heading.z * distance);
      camera.lookAt(target); camera.aspect = aspect;
      camera.clearViewOffset();
      if (!inspection) camera.setViewOffset(width, height, -width * 0.29, 0, width, height);
    } else if (!initialized || !inspection) {
      camera.position.copy(target).addScaledVector(directions[view] || directions.back, 140);
      camera.lookAt(target);
    }
    if (groundView) camera.aspect = aspect;
    camera.updateMatrixWorld(true);
    if (inspection && !groundView && !initialized) {
      // Fit projected physical bounds, without rescaling any part of the metre-based model.
      const projected = new THREE.Box3();
      for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) projected.expandByPoint(new THREE.Vector3(x, y, z).applyMatrix4(camera.matrixWorldInverse));
      const span = projected.getSize(new THREE.Vector3());
      const vertical = Math.max(span.y, span.x / aspect) * 1.20;
      const mid = projected.getCenter(new THREE.Vector3());
      orthoFrame = { vertical, mid };
      camera.left = mid.x - vertical * aspect / 2; camera.right = mid.x + vertical * aspect / 2;
      camera.top = mid.y + vertical / 2; camera.bottom = mid.y - vertical / 2;
    } else if (!groundView) {
      const vertical = width < 640 ? 82 : 68, horizontal = vertical * aspect;
      camera.left = -horizontal * 0.79; camera.right = horizontal * 0.21;
      camera.top = vertical / 2; camera.bottom = -vertical / 2;
    }
    if (inspection && !groundView && orthoFrame) {
      const { vertical, mid } = orthoFrame;
      camera.left = mid.x - vertical * aspect / 2; camera.right = mid.x + vertical * aspect / 2;
      camera.top = mid.y + vertical / 2; camera.bottom = mid.y - vertical / 2;
    }
    camera.updateProjectionMatrix(); renderer.setSize(width, height);
    initialized = true; controls?.update(); render();
    container.classList.add('ready');
  };
  const observer = new ResizeObserver(resize); observer.observe(container); resize();
  if (inspection) {
    controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(centre);
    controls.enableDamping = false;
    controls.minDistance = 2; controls.maxDistance = 450;
    controls.minZoom = 0.25; controls.maxZoom = 25;
    controls.rotateSpeed = 0.7; controls.zoomSpeed = 0.85;
    controls.screenSpacePanning = true;
    controls.addEventListener('change', render); controls.update();
    renderer.domElement.classList.add('is-orbit-preview');
  }
  // Small tracking corrections around the authored pose; the footing stays fixed.
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const azimuth = antenna.userData.azimuth, reflector = antenna.userData.elevation;
  const restAzimuth = azimuth.rotation.y, restElevation = reflector.rotation.x;
  let frame = 0, elapsed = 0, previousTime = null, lastShadow = -Infinity;
  let visible = true, contextLost = false;
  const moving = () => animate && !inspection && !motion.matches && !document.hidden && visible && !contextLost;
  const stop = () => {
    cancelAnimationFrame(frame); frame = 0; previousTime = null;
  };
  const tick = time => {
    frame = 0;
    if (!moving()) { previousTime = null; return; }
    if (previousTime === null) previousTime = time;
    const delta = time - previousTime;
    // Background motion needs only 24 fps. Pauses reset the timestamp above;
    // visible frame drops must not slow the azimuth drive's tracking sweep.
    if (delta >= 1000 / 24) {
      elapsed += delta / 1000; previousTime = time;
      azimuth.rotation.y = restAzimuth + THREE.MathUtils.degToRad(6) * Math.sin(elapsed * Math.PI * 2 / 90);
      reflector.rotation.x = restElevation + THREE.MathUtils.degToRad(0.3) * Math.sin(elapsed * Math.PI * 2 / 80);
      // At this speed, shadow maps can refresh less often than the metal reflections.
      if (elapsed - lastShadow >= 0.25) {
        renderer.shadowMap.needsUpdate = true; lastShadow = elapsed;
      }
      render();
    }
    frame = requestAnimationFrame(tick);
  };
  const syncMotion = () => {
    if (motion.matches) {
      azimuth.rotation.y = restAzimuth; reflector.rotation.x = restElevation;
      elapsed = 0; lastShadow = -Infinity;
      if (!contextLost && !document.hidden) { renderer.shadowMap.needsUpdate = true; render(); }
    }
    if (moving()) { if (!frame) frame = requestAnimationFrame(tick); }
    else stop();
  };
  const visibility = animate && !inspection ? new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting; syncMotion();
  }) : null;
  visibility?.observe(container);
  if (animate && !inspection) {
    motion.addEventListener('change', syncMotion);
    document.addEventListener('visibilitychange', syncMotion);
    syncMotion();
  }
  const lost = event => { event.preventDefault(); contextLost = true; stop(); container.classList.remove('ready'); };
  renderer.domElement.addEventListener('webglcontextlost', lost);
  const restored = () => {contextLost = false; rebuildEnvironment(); renderer.shadowMap.needsUpdate = true; resize(); syncMotion();};
  renderer.domElement.addEventListener('webglcontextrestored', restored);
  return () => {
    stop(); visibility?.disconnect();
    motion.removeEventListener('change', syncMotion);
    document.removeEventListener('visibilitychange', syncMotion);
    observer.disconnect();
    controls?.removeEventListener('change', render); controls?.dispose();
    renderer.domElement.removeEventListener('webglcontextlost', lost);
    renderer.domElement.removeEventListener('webglcontextrestored', restored);
    const geometries = new Set(), materials = new Set();
    scene.traverse(object => {
      if (object.geometry) geometries.add(object.geometry);
      if (object.material) (Array.isArray(object.material) ? object.material : [object.material]).forEach(material => materials.add(material));
    });
    geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose());
    key.shadow.dispose(); environment.dispose(); sky.background.dispose();
    renderer.dispose(); renderer.domElement.remove();
  };
}
