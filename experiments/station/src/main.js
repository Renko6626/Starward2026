import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createEnvironment } from './materials.js';
import { createStationBlockout } from './station-blockout.js';
import { createStars, createPlanet, createMoon } from './space.js';
import './style.css';

const root = document.querySelector('#observatory');
const loading = document.querySelector('#loading');
const failure = document.querySelector('#failure');

function mount() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth < 700 ? 1.4 : 1.75));
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.tabIndex = 0;
  renderer.domElement.setAttribute('aria-label', '空间站。拖动旋转，滚轮缩放，方向键调整视角。');
  document.querySelector('#viewport').append(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x03060b);
  let environment = createEnvironment(renderer);
  scene.environment = environment.texture;
  scene.environmentIntensity = .72;

  const camera = new THREE.PerspectiveCamera(37, innerWidth / innerHeight, .1, 1800);
  const desktopPosition = new THREE.Vector3(44, 36, 88);
  const target = new THREE.Vector3(5, -1, 0);
  const homePosition = () => desktopPosition.clone().multiplyScalar(innerWidth < 700 ? 2.5 : 1);
  camera.position.copy(homePosition()).multiplyScalar(1.13);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(target);
  controls.enableDamping = true;
  controls.dampingFactor = .055;
  controls.enablePan = false;
  controls.minDistance = 25;
  controls.maxDistance = 400;
  controls.minPolarAngle = .18;
  controls.maxPolarAngle = Math.PI - .18;
  controls.rotateSpeed = .38;
  controls.zoomSpeed = .65;
  controls.update();

  const key = new THREE.DirectionalLight(0xffead0, 4.2);
  key.position.set(-45, 65, 30);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = key.shadow.camera.bottom = -70;
  key.shadow.camera.right = key.shadow.camera.top = 70;
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 200;
  // Thin protective sheets need an offset at the scale of a shadow texel.
  key.shadow.normalBias = .12;
  key.shadow.bias = -.00008;
  scene.add(key);
  const bounce = new THREE.DirectionalLight(0x7aafd8, .85);
  bounce.position.set(13, -8, 14); scene.add(bounce);
  const rim = new THREE.DirectionalLight(0xb3ccea, 2.4);
  rim.position.set(0, 6, -30); scene.add(rim);
  scene.add(new THREE.AmbientLight(0x567080, .16));

  const station = createStationBlockout();
  scene.add(station.object);
  const labelLayer = document.createElement('div');
  labelLayer.className = 'model-labels';
  labelLayer.setAttribute('aria-hidden', 'true');
  root.append(labelLayer);
  const labels = station.markers.map(marker => {
    const element = document.createElement('span');
    element.dataset.priority = marker.primary ? 'primary' : 'secondary';
    element.textContent = marker.label; labelLayer.append(element);
    return { ...marker, element };
  });
  const projected = new THREE.Vector3();
  const updateLabels = () => {
    station.object.updateWorldMatrix(true, false);
    for (const marker of labels) {
      projected.copy(marker.position);
      station.object.localToWorld(projected); projected.project(camera);
      marker.element.hidden = projected.z < -1 || projected.z > 1 || Math.abs(projected.x) > 1.1 || Math.abs(projected.y) > 1.1;
      marker.element.style.left = `${(projected.x + 1) * innerWidth / 2}px`;
      marker.element.style.top = `${(1 - projected.y) * innerHeight / 2}px`;
    }
  };
  const envelopeControl = document.querySelector('#envelopes');
  const toggleEnvelopes = () => {
    station.envelopes.visible = !station.envelopes.visible;
    envelopeControl.setAttribute('aria-pressed', String(station.envelopes.visible));
    needsRender = true;
  };
  envelopeControl.addEventListener('click', toggleEnvelopes);
  const stars = createStars(); scene.add(stars);
  const planet = createPlanet(); scene.add(planet);
  const moon = createMoon(); scene.add(moon);
  const layoutBackdrop = () => {
    // Earth–Moon Lagrange-point setting; the exact L point is not yet chosen.
    // Frame both distant bodies at the home viewpoint on narrow screens too.
    // Once framed they remain world-space objects during camera exploration.
    const framingCamera = camera.clone();
    framingCamera.position.copy(homePosition());
    framingCamera.lookAt(target); framingCamera.updateMatrixWorld();
    const galacticBand = stars.getObjectByName('Galactic dust band');
    galacticBand.quaternion.copy(framingCamera.quaternion);
    galacticBand.rotateX(.12); galacticBand.rotateZ(-.3);
    const place = (object, x, y, distance) => {
      object.position.set(x, y, .99).unproject(framingCamera)
        .sub(framingCamera.position).normalize().multiplyScalar(distance).add(framingCamera.position);
    };
    const narrow = innerWidth < 700;
    place(planet, narrow ? -.62 : -.67, narrow ? .54 : .28, 420);
    planet.scale.setScalar(22.5);
    station.aimAntennaAt(planet.getWorldPosition(new THREE.Vector3()));
    place(moon, narrow ? .65 : .76, narrow ? .68 : .64, 420);
    moon.scale.setScalar(6.15);
  };
  layoutBackdrop();

  const renderTarget = new THREE.WebGLRenderTarget(innerWidth, innerHeight, { type: THREE.HalfFloatType, samples: 2 });
  const composer = new EffectComposer(renderer, renderTarget);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), .23, .4, 1.55);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  const media = matchMedia('(prefers-reduced-motion: reduce)');
  let paused = media.matches;
  let intro = !paused;
  let time = 0;
  let introTime = 0;
  let last = performance.now();
  let rendered = false;
  let needsRender = true;
  let disposed = false;
  const motion = document.querySelector('#motion');
  const reset = document.querySelector('#reset');
  const clean = document.querySelector('#clean');
  const syncMotion = () => {
    motion.textContent = paused ? '继续运动' : '暂停运动';
    motion.setAttribute('aria-pressed', String(paused));
  };
  syncMotion();
  if (paused) camera.position.copy(homePosition());
  const abortIntro = () => { intro = false; };
  const invalidate = () => { needsRender = true; };
  controls.addEventListener('start', abortIntro);
  controls.addEventListener('change', invalidate);
  const toggleMotion = () => { paused = !paused; intro = false; syncMotion(); };
  const resetView = () => {
    intro = false;
    // Recreating controls is unnecessary: update with damping temporarily off
    // to clear the residual rotation before restoring the composed viewpoint.
    controls.enableDamping = false; controls.update();
    camera.position.copy(homePosition()); controls.target.copy(target);
    controls.update(); controls.enableDamping = true;
  };
  const toggleClean = () => {
    const isClean = root.classList.toggle('clean');
    clean.setAttribute('aria-pressed', String(isClean));
    clean.textContent = isClean ? '显示说明' : '纯净画面';
  };
  const onKey = (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault(); intro = false;
    const offset = camera.position.clone().sub(controls.target);
    const spherical = new THREE.Spherical().setFromVector3(offset);
    if (event.key === 'ArrowLeft') spherical.theta -= .06;
    if (event.key === 'ArrowRight') spherical.theta += .06;
    if (event.key === 'ArrowUp') spherical.phi -= .06;
    if (event.key === 'ArrowDown') spherical.phi += .06;
    spherical.phi = THREE.MathUtils.clamp(spherical.phi, controls.minPolarAngle, controls.maxPolarAngle);
    camera.position.copy(controls.target).add(offset.setFromSpherical(spherical));
    controls.update();
  };
  const onMotionPreference = () => { paused = media.matches; intro = false; syncMotion(); };
  motion.addEventListener('click', toggleMotion);
  reset.addEventListener('click', resetView);
  clean.addEventListener('click', toggleClean);
  renderer.domElement.addEventListener('keydown', onKey);
  media.addEventListener('change', onMotionPreference);

  const onResize = () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    const ratio = Math.min(devicePixelRatio, innerWidth < 700 ? 1.4 : 1.75);
    renderer.setPixelRatio(ratio); renderer.setSize(innerWidth, innerHeight);
    composer.setPixelRatio(ratio); composer.setSize(innerWidth, innerHeight);
    stars.material.uniforms.pixelRatio.value = ratio;
    stars.getObjectByName('Bright star optics').material.uniforms.pixelRatio.value = ratio;
    layoutBackdrop();
    needsRender = true;
  };
  window.addEventListener('resize', onResize);
  const onContextLost = (event) => {
    event.preventDefault(); renderer.setAnimationLoop(null);
    environment.dispose(); scene.environment = null;
    root.dataset.ready = 'false';
    failure.textContent = '图形设备连接中断，正在等待恢复。刷新页面可重试。';
    loading.hidden = true; failure.hidden = false;
  };
  const onContextRestored = () => {
    if (disposed) return;
    // Render-target contents do not survive a lost context. Rebuild the
    // prefiltered environment, then let the composer redraw its targets.
    environment = createEnvironment(renderer);
    scene.environment = environment.texture;
    failure.hidden = true;
    rendered = false; needsRender = true; last = performance.now();
    renderer.setAnimationLoop(renderFrame);
  };
  renderer.domElement.addEventListener('webglcontextlost', onContextLost);
  renderer.domElement.addEventListener('webglcontextrestored', onContextRestored);

  const renderFrame = (now) => {
    if (disposed) return;
    const delta = Math.min((now - last) / 1000, .05); last = now;
    if (document.hidden) return;
    if (!paused) time += delta;
    if (intro) {
      introTime += delta;
      const t = Math.min(introTime / 6, 1);
      const ease = 1 - (1 - t) ** 3;
      camera.position.copy(homePosition()).multiplyScalar(1.13 - .13 * ease);
      if (t === 1) intro = false;
    }
    station.update(time);
    stars.getObjectByName('Bright star optics').material.uniforms.time.value = time;
    controls.update(delta);
    updateLabels();
    if (paused && !needsRender && rendered) return;
    composer.render(delta);
    needsRender = false;
    if (!rendered) {
      rendered = true; loading.classList.add('ready');
      root.dataset.ready = 'true';
    }
  };
  renderer.setAnimationLoop(renderFrame);

  return () => {
    disposed = true; renderer.setAnimationLoop(null);
    window.removeEventListener('resize', onResize);
    media.removeEventListener('change', onMotionPreference);
    motion.removeEventListener('click', toggleMotion);
    reset.removeEventListener('click', resetView);
    clean.removeEventListener('click', toggleClean);
    envelopeControl.removeEventListener('click', toggleEnvelopes);
    labelLayer.remove();
    renderer.domElement.removeEventListener('keydown', onKey);
    renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
    renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored);
    controls.dispose();
    const geometries = new Set(), disposableMaterials = new Set(), textures = new Set();
    scene.traverse((object) => {
      if (object.geometry) geometries.add(object.geometry);
      if (object.material) for (const material of [].concat(object.material)) disposableMaterials.add(material);
      if (object.shadow) object.shadow.dispose();
      if (object.isInstancedMesh) object.dispose();
    });
    for (const material of disposableMaterials) {
      for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
      material.dispose();
    }
    geometries.forEach(geometry => geometry.dispose());
    textures.forEach(texture => texture.dispose());
    environment.dispose();
    composer.passes.forEach(pass => pass.dispose?.());
    composer.dispose(); renderer.dispose(); renderer.domElement.remove();
  };
}

try {
  const dispose = mount();
  if (import.meta.hot) import.meta.hot.dispose(dispose);
} catch (error) {
  loading.hidden = true; failure.hidden = false;
  console.error('Station scene failed to start:', error);
}
