import * as THREE from 'three';
import { createRingStation } from '../../station/ring-romantic/src/station-ring.js';
import { createEnvironment } from '../../station/ring-romantic/src/materials.js';
import { createStars, createPlanet } from '../../station/ring-romantic/src/space.js';
import { createCockpit } from './cockpit.js';

function release(root) {
  const geometries = new Set(), materials = new Set(), textures = new Set();
  root.traverse(object => {
    if (object.geometry) geometries.add(object.geometry);
    for (const material of [].concat(object.material || [])) materials.add(material);
    object.shadow?.dispose();
    if (object.isInstancedMesh) object.dispose();
  });
  materials.forEach(material => {
    Object.values(material).forEach(value => { if (value?.isTexture) textures.add(value); });
    material.dispose();
  });
  geometries.forEach(geometry => geometry.dispose()); textures.forEach(texture => texture.dispose());
}

export function mountScene(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'low-power' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  container.append(renderer.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x03070a);
  const camera = new THREE.PerspectiveCamera(62, 1, .08, 2500);
  scene.add(camera);
  const environment = createEnvironment(renderer);
  scene.environment = environment.texture; scene.environmentIntensity = .48;
  const station = createRingStation();
  station.object.rotation.set(.16, -.58, -.2);
  scene.add(station.object);
  const stars = createStars(); scene.add(stars);
  const earth = createPlanet(); scene.add(earth);
  const sun = new THREE.DirectionalLight(0xffefd4, 3.7); sun.position.set(-100, 100, 80);
  const rim = new THREE.DirectionalLight(0x91b5c6, 1.4); rim.position.set(140, 20, -90);
  scene.add(sun, rim, new THREE.AmbientLight(0x7898a9, .24));
  const cabinLight = new THREE.PointLight(0xa1c3ca, 3.8, 9, 2);
  cabinLight.position.set(-1, .35, -.4); camera.add(cabinLight);
  let cockpit, disposed = false, last = null, elapsed = 0;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let paused = new URLSearchParams(location.search).has('static');
  let lost = false;
  function render() {
    if (disposed || lost) return;
    station.update(elapsed);
    stars.getObjectByName('Bright star optics').material.uniforms.time.value = elapsed;
    renderer.render(scene, camera);
    document.documentElement.dataset.ready = 'true';
  }
  function resize() {
    if (disposed || lost) return;
    const width = innerWidth, height = innerHeight, aspect = width / height, mobile = width < 700;
    renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.25 : 1.5));
    renderer.setSize(width, height); camera.aspect = aspect; camera.updateProjectionMatrix();
    if (cockpit) { camera.remove(cockpit); release(cockpit); }
    cockpit = createCockpit(aspect); camera.add(cockpit);
    // Art-directed observed geometry; no range/velocity telemetry is invented.
    const depth = mobile ? 630 : 410;
    station.object.position.set(mobile ? 12 : 170, mobile ? 160 : 91, -depth);
    earth.position.set(-depth * aspect * .35, depth * .3, -1100); earth.scale.setScalar(mobile ? 24 : 35);
    station.aimAntennaAt(earth.getWorldPosition(new THREE.Vector3()));
    const ratio = renderer.getPixelRatio();
    stars.material.uniforms.pixelRatio.value = ratio;
    stars.getObjectByName('Bright star optics').material.uniforms.pixelRatio.value = ratio;
    render();
  }
  function frame(time) {
    if (last !== null) elapsed += Math.min((time - last) / 1000, .05);
    last = time; render();
  }
  function sync() {
    last = null;
    renderer.setAnimationLoop(!paused && !reduced.matches && !document.hidden && !lost ? frame : null);
    render();
  }
  function onLost(event) { event.preventDefault(); lost = true; renderer.setAnimationLoop(null); document.querySelector('#failure').hidden = false; }
  function onRestored() { location.reload(); }
  resize(); sync();
  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', sync);
  reduced.addEventListener('change', sync);
  renderer.domElement.addEventListener('webglcontextlost', onLost);
  renderer.domElement.addEventListener('webglcontextrestored', onRestored);
  return {
    setPaused(value) { paused = value; sync(); },
    dispose() {
      if (disposed) return; disposed = true; renderer.setAnimationLoop(null);
      window.removeEventListener('resize', resize); document.removeEventListener('visibilitychange', sync);
      reduced.removeEventListener('change', sync);
      renderer.domElement.removeEventListener('webglcontextlost', onLost); renderer.domElement.removeEventListener('webglcontextrestored', onRestored);
      release(scene); environment.dispose(); renderer.dispose(); renderer.domElement.remove();
    },
  };
}
