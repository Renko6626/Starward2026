import * as THREE from 'three';
import { createRingStation } from '../../../../experiments/station/ring-romantic/src/station-ring.js';
import { createEnvironment } from '../../../../experiments/station/ring-romantic/src/materials.js';
import { createStars, createPlanet, createMoon } from '../../../../experiments/station/ring-romantic/src/space.js';
import { mobileBreakpoint } from './config.js';
import { batchStaticMeshes } from './static-batches.js';

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
  let lastRender = 0;
  const renderInterval = 1000 / 30;
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  const camera = new THREE.PerspectiveCamera(37, 1, 1, 3000);
  const basePosition = new THREE.Vector3();
  const orbitAxis = new THREE.Vector3();
  const cameraRight = new THREE.Vector3();
  const pointer = new THREE.Vector2(), pointerTarget = new THREE.Vector2();
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  const antennaAim = new THREE.Quaternion();
  const signals = [];
  let narrow = false;
  let scrollProgress = 0;
  let targetProgress = 0;
  let station, stars, earth, moon, antenna;

  function updateCamera() {
    const motion = !media.matches && !options.staticFrame;
    const cruise = motion ? Math.sin(time * Math.PI * 2 / 40) * (narrow ? 1.5 : 4) : 0;
    const parallax = motion && !narrow && finePointer.matches ? pointer.x * 1.4 : 0;
    const angle = media.matches ? 0 : THREE.MathUtils.degToRad((narrow ? 10 : 22) * scrollProgress + cruise + parallax);
    camera.position.copy(basePosition).applyAxisAngle(orbitAxis, angle);
    if (motion && !narrow && finePointer.matches) {
      camera.position.applyAxisAngle(cameraRight, THREE.MathUtils.degToRad(pointer.y * .8));
    }
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
    if (antenna) {
      antenna.quaternion.copy(antennaAim);
      // A short calibration sweep, followed by a long hold on the Earth target.
      const phase = time % 20;
      const correction = !media.matches && !options.staticFrame && phase < 5
        ? Math.sin(phase * Math.PI / 5) * Math.sin(phase * Math.PI * 2 / 5) * THREE.MathUtils.degToRad(4) : 0;
      antenna.rotateY(correction);
      antenna.rotateX(correction * .35);
    }
    signals.forEach(({ lamp, halo, phase }, index) => {
      const pulseTime = (time + phase) % 6;
      const pulse = !media.matches && !options.staticFrame && pulseTime < .9
        ? Math.sin(pulseTime * Math.PI / .9) ** 2 : 0;
      lamp.material.opacity = .22 + pulse * .78;
      halo.material.opacity = pulse * .16;
      halo.scale.setScalar(1.8 + pulse * .8);
    });
    stars.getObjectByName('Bright star optics').material.uniforms.time.value = time;
    renderer.render(scene, camera);
    if (!ready) { ready = true; options.onReady?.(); }
  }
  function frame(now) {
    const delta = last ? (now - last) / 1000 : 0;
    last = now;
    time += delta;
    scrollProgress = THREE.MathUtils.damp(scrollProgress, targetProgress, 8, delta);
    pointer.x = THREE.MathUtils.damp(pointer.x, pointerTarget.x, 5, delta);
    pointer.y = THREE.MathUtils.damp(pointer.y, pointerTarget.y, 5, delta);
    // Advance motion on every tick; only limit GPU submissions, preserving speed.
    const elapsed = now - lastRender;
    if (lastRender && elapsed < renderInterval) return;
    lastRender = lastRender ? now - elapsed % renderInterval : now;
    updateCamera();
    draw();
  }
  function syncLoop() {
    const animate = !disposed && !contextLost && visible && !document.hidden
      && !paused && !media.matches && !options.staticFrame;
    last = 0;
    lastRender = 0;
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
    cameraRight.crossVectors(orbitAxis, basePosition).normalize();
    if (narrow) { pointer.set(0, 0); pointerTarget.set(0, 0); }
    updateCamera();
    // Shift in CSS pixels without changing FOV or distance. Keep the composition
    // anchored after 1920px while the rendered starfield continues to fill the viewport.
    const compositionWidth = Math.min(width, 1920);
    const stationShift = Math.min(100, Math.max(0, (width - 1440) * .25));
    camera.setViewOffset(width, height, narrow ? 0 : -compositionWidth * .19 - stationShift, narrow ? height * .17 : -height * .01, width, height);
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
    if (antenna) antennaAim.copy(antenna.quaternion);
    const band = stars.getObjectByName('Galactic dust band');
    band.quaternion.copy(camera.quaternion);
    band.rotateX(.12); band.rotateZ(-.3);
    stars.material.uniforms.pixelRatio.value = ratio;
    stars.getObjectByName('Bright star optics').material.uniforms.pixelRatio.value = ratio;
    draw();
  }
  function movePointer(event) {
    if (event.pointerType !== 'mouse' || narrow || paused || media.matches || !finePointer.matches || !visible) return;
    const { left, top, width, height } = container.getBoundingClientRect();
    if (!width || !height) return;
    pointerTarget.set(THREE.MathUtils.clamp((event.clientX - left) / width * 2 - 1, -1, 1),
      THREE.MathUtils.clamp((event.clientY - top) / height * 2 - 1, -1, 1));
  }
  function resetPointer() { pointerTarget.set(0, 0); }
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
    window.removeEventListener('pointermove', movePointer);
    document.removeEventListener('mouseleave', resetPointer);
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
  const retired = batchStaticMeshes(station.object.getObjectByName('Fixed group / no ring rotation'));
  const retained = new Set();
  station.object.traverse(object => { if (object.geometry) retained.add(object.geometry); });
  retired.forEach(geometry => { if (!retained.has(geometry)) geometry.dispose(); });
  scene.add(station.object);
  antenna = station.object.getObjectByName('Pointable main dish / +Z boresight');
  const signalGeometry = new THREE.SphereGeometry(.28, 10, 8);
  for (const [name, offset, color, phase] of [
    ['Crew docking', [-.3, 1.65, 1.4], 0xf4dfb0, 0],
    ['Cargo and quarantine', [1.4, 1.65, .3], 0xb8dbd8, 2],
    ['Main communications dish', [-.7, -1.6, .8], 0xf4dfb0, 4],
  ]) {
    const anchor = station.object.getObjectByName(name);
    if (!anchor) continue;
    const lamp = new THREE.Mesh(signalGeometry, new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false, toneMapped: false }));
    lamp.name = `${name} / signal lamp`;
    lamp.position.set(...offset);
    const halo = new THREE.Mesh(signalGeometry, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    halo.position.copy(lamp.position);
    anchor.add(lamp, halo);
    signals.push({ lamp, halo, phase });
  }
  stars = createStars(); earth = createPlanet(); moon = createMoon();
  scene.add(stars, earth, moon);
  const sun = new THREE.DirectionalLight(0xffead0, 4.2);
  sun.position.set(-100, 90, 65);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
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
    window.addEventListener('pointermove', movePointer, { passive: true });
    document.addEventListener('mouseleave', resetPointer);
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
