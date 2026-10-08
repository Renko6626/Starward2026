import * as THREE from 'three';
import { createRingStation } from '../../../../experiments/station/ring-romantic/src/station-ring.js';
import { createEnvironment } from '../../../../experiments/station/ring-romantic/src/materials.js';
import { createStars, createPlanet, createMoon } from '../../../../experiments/station/ring-romantic/src/space.js';
import { mobileBreakpoint } from './config.js';

export function mountStationScene(container, options = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'low-power' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  container.append(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x03060b);
  let environment;
  let disposed = false;
  let observer;
  let resizeObserver;
  let ready = false;
  let contextLost = false;
  let visible = true;
  let paused = !!options.paused;
  let time = 0;
  let last = 0;
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  const camera = new THREE.PerspectiveCamera(37, 1, 1, 3000);
  const basePosition = new THREE.Vector3();
  const orbitAxis = new THREE.Vector3();
  let narrow = false;
  let scrollProgress = 0;
  let targetProgress = 0;
  let station, stars, earth, moon;

  function updateCamera() {
    const angle = media.matches ? 0 : THREE.MathUtils.degToRad(narrow ? 10 : 22) * scrollProgress;
    camera.position.copy(basePosition).applyAxisAngle(orbitAxis, angle);
    camera.up.copy(orbitAxis);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
  }

  function restoreEnvironment() {
    environment?.dispose();
    environment = createEnvironment(renderer);
    scene.environment = environment.texture;
    scene.environmentIntensity = .72;
  }
  function draw() {
    if (disposed || contextLost || document.hidden || !visible) return;
    station.update(time);
    stars.getObjectByName('Bright star optics').material.uniforms.time.value = time;
    renderer.render(scene, camera);
    if (!ready) { ready = true; options.onReady?.(); }
  }
  function frame(now) {
    const delta = last ? Math.min((now - last) / 1000, .05) : 0;
    last = now;
    time += delta;
    scrollProgress = THREE.MathUtils.damp(scrollProgress, targetProgress, 8, delta);
    updateCamera();
    draw();
  }
  function syncLoop() {
    const animate = !disposed && !contextLost && visible && !document.hidden
      && !paused && !media.matches && !options.staticFrame;
    last = 0;
    renderer.setAnimationLoop(animate ? frame : null);
    updateCamera();
    draw();
  }
  function resize() {
    const { width, height } = container.getBoundingClientRect();
    if (!width || !height || disposed || contextLost) return;
    // Capture mobile at 2x resolution while keeping the same CSS viewport.
    narrow = width < mobileBreakpoint;
    const ratio = Math.min(devicePixelRatio, narrow ? 1.4 : 1.75);
    renderer.setPixelRatio(ratio);
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.fov = narrow ? 43 : 37;
    basePosition.set(-120, 310, 170).multiplyScalar(narrow ? 1.58 : .93);
    orbitAxis.set(0, basePosition.z, -basePosition.y).normalize();
    updateCamera();
    camera.setViewOffset(width, height, narrow ? 0 : -width * .19, narrow ? height * .17 : -height * .01, width, height);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    const place = (object, x, y, distance) => {
      object.position.set(x, y, .99).unproject(camera).sub(camera.position)
        .normalize().multiplyScalar(distance).add(camera.position);
    };
    place(earth, narrow ? -.66 : -.72, narrow ? .68 : .46, 720);
    earth.scale.setScalar(narrow ? 19 : 32);
    place(moon, narrow ? .69 : .80, narrow ? .78 : .68, 720);
    moon.scale.setScalar(narrow ? 6 : 8);
    station.aimAntennaAt(earth.getWorldPosition(new THREE.Vector3()));
    const band = stars.getObjectByName('Galactic dust band');
    band.quaternion.copy(camera.quaternion);
    band.rotateX(.12); band.rotateZ(-.3);
    stars.material.uniforms.pixelRatio.value = ratio;
    stars.getObjectByName('Bright star optics').material.uniforms.pixelRatio.value = ratio;
    draw();
  }
  function lost(event) {
    event.preventDefault(); contextLost = true; ready = false;
    renderer.setAnimationLoop(null);
    scene.environment = null;
    options.onUnavailable?.();
  }
  function restored() {
    if (disposed) return;
    try { restoreEnvironment(); contextLost = false; resize(); syncLoop(); }
    catch (error) { contextLost = true; options.onUnavailable?.(); console.error('Station restore failed', error); }
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    renderer.setAnimationLoop(null);
    observer?.disconnect(); resizeObserver?.disconnect();
    document.removeEventListener('visibilitychange', syncLoop);
    media.removeEventListener('change', syncLoop);
    renderer.domElement.removeEventListener('webglcontextlost', lost);
    renderer.domElement.removeEventListener('webglcontextrestored', restored);
    const geometries = new Set(), materials = new Set(), textures = new Set();
    scene.traverse(object => {
      if (object.geometry) geometries.add(object.geometry);
      if (object.material) for (const material of [].concat(object.material)) materials.add(material);
      object.shadow?.dispose();
      if (object.isInstancedMesh) object.dispose();
    });
    for (const material of materials) {
      for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
      material.dispose();
    }
    geometries.forEach(value => value.dispose());
    textures.forEach(value => value.dispose());
    environment?.dispose(); renderer.dispose(); renderer.domElement.remove();
  }
  try {
  station = createRingStation();
  scene.add(station.object);
  stars = createStars(); earth = createPlanet(); moon = createMoon();
  scene.add(stars, earth, moon);
  const sun = new THREE.DirectionalLight(0xffead0, 4.2);
  sun.position.set(-100, 90, 65);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -95, right: 95, top: 95, bottom: -95, near: 1, far: 300 });
  sun.shadow.normalBias = .12;
  sun.shadow.bias = -.00008;
  const bounce = new THREE.DirectionalLight(0x7aafd8, .85);
  bounce.position.set(13, -8, 14);
  const rim = new THREE.DirectionalLight(0xb3ccea, 2.4);
  rim.position.set(0, 6, -30);
  scene.add(sun, bounce, rim, new THREE.AmbientLight(0x567080, .16));

    restoreEnvironment();
    resize();
    resizeObserver = new ResizeObserver(resize); resizeObserver.observe(container);
    observer = new IntersectionObserver(([entry]) => { visible = !!entry?.isIntersecting; syncLoop(); });
    observer.observe(container);
    document.addEventListener('visibilitychange', syncLoop);
    media.addEventListener('change', syncLoop);
    renderer.domElement.addEventListener('webglcontextlost', lost);
    renderer.domElement.addEventListener('webglcontextrestored', restored);
    syncLoop();
  } catch (error) { dispose(); throw error; }
  return {
    setPaused(value) { paused = value; syncLoop(); },
    setScrollProgress(value) {
      targetProgress = THREE.MathUtils.clamp(value, 0, 1);
    },
    dispose,
  };
}
