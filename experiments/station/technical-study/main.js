import * as THREE from 'three';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { createRingStation } from '../ring-romantic/src/station-ring.js';

const width = 1260, height = 850;
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(width, height);
renderer.setPixelRatio(2);
renderer.setClearColor(0x090909);
document.querySelector('#drawing').append(renderer.domElement);
const station = createRingStation();
station.update(0);
const scene = new THREE.Scene();
scene.add(station.object);
const camera = new THREE.OrthographicCamera(-118, 118, 118 * height / width, -118 * height / width, 1, 1000);
// Look across the main X axis, keeping it horizontal with only a slight reveal.
camera.position.set(-30, -300, 22);
camera.up.set(0, 0, 1);
camera.lookAt(0, 0, 0);
camera.updateMatrixWorld();

// Capture smooth surfaces separately so their silhouettes survive hard-edge filtering.
const normalTarget = new THREE.WebGLRenderTarget(width * 2, height * 2);
normalTarget.depthTexture = new THREE.DepthTexture(width * 2, height * 2);
scene.overrideMaterial = new THREE.MeshNormalMaterial();
renderer.setRenderTarget(normalTarget);
renderer.setClearColor(0x000000);
renderer.render(scene, camera);
scene.overrideMaterial = null;

const black = new THREE.MeshBasicMaterial({ color: 0x090909, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
// Render two physical pixels per edge so downsampling retains a full pixel.
const lineMaterial = new LineMaterial({ color: 0xeeeeee, linewidth: 2.2, depthWrite: false, depthTest: false });
// Use a two-pixel surface tolerance: thin fittings and curved panel edges
// share depth samples with the hull when projected at this drawing scale.
const edgeDepthTolerance = 2 * (camera.right - camera.left) / (width * 2);
lineMaterial.onBeforeCompile = shader => {
  shader.uniforms.surfaceDepth = { value: normalTarget.depthTexture };
  shader.fragmentShader = 'uniform sampler2D surfaceDepth;\n' + shader.fragmentShader;
  shader.fragmentShader = shader.fragmentShader.replace('#include <clipping_planes_fragment>', `
    #include <clipping_planes_fragment>
    float surfaceZ = texture2D(surfaceDepth, gl_FragCoord.xy / vec2(${width * 2}.0, ${height * 2}.0)).r;
    if (gl_FragCoord.z > surfaceZ + ${edgeDepthTolerance / (camera.far - camera.near)}) discard;
  `);
};
const lineScene = new THREE.Scene(), edgesCache = new Map();
const transform = new THREE.Matrix4(), world = new THREE.Matrix4(), size = new THREE.Vector3();
station.object.traverse(object => {
  if (!object.isMesh) return;
  object.material = black;
  let edges = edgesCache.get(object.geometry);
  if (!edges) {
    const hardEdges = new THREE.EdgesGeometry(object.geometry, 28);
    edges = new LineSegmentsGeometry().fromEdgesGeometry(hardEdges);
    hardEdges.dispose();
    edgesCache.set(object.geometry, edges);
    object.geometry.computeBoundingBox();
  }
  const count = object.isInstancedMesh ? object.count : 1;
  for (let index = 0; index < count; index++) {
    if (object.isInstancedMesh) { object.getMatrixAt(index, transform); world.multiplyMatrices(object.matrixWorld, transform); }
    else world.copy(object.matrixWorld);
    const bounds = object.geometry.boundingBox.clone().applyMatrix4(world);
    bounds.getSize(size);
    // At this scale fasteners add noise; retain larger panels and structural members.
    if (Math.max(size.x, size.y, size.z) < .8) continue;
    const line = new LineSegments2(edges, lineMaterial);
    line.matrixAutoUpdate = false;
    line.matrix.copy(world);
    lineScene.add(line);
  }
});
const lineTarget = new THREE.WebGLRenderTarget(width * 2, height * 2);
renderer.setRenderTarget(lineTarget);
renderer.setClearColor(0x090909);
renderer.render(lineScene, camera);

const composite = new THREE.Scene();
composite.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
  uniforms: { normals: { value: normalTarget.texture }, depth: { value: normalTarget.depthTexture }, lines: { value: lineTarget.texture }, pixel: { value: new THREE.Vector2(1 / (width * 2), 1 / (height * 2)) } },
  vertexShader: 'varying vec2 uvOut; void main(){uvOut=uv;gl_Position=vec4(position.xy,0.,1.);}',
  fragmentShader: `
    uniform sampler2D normals, depth, lines; uniform vec2 pixel; varying vec2 uvOut;
    void main(){
      vec3 n = texture2D(normals, uvOut).rgb;
      float d = texture2D(depth, uvOut).r;
      float edge = 0.;
      for(int x=-1;x<=1;x++) for(int y=-1;y<=1;y++) {
        vec2 at=uvOut+vec2(float(x),float(y))*pixel;
        float dd=abs(d-texture2D(depth,at).r);
        float nn=length(n-texture2D(normals,at).rgb);
        edge=max(edge,max(smoothstep(.0015,.004,dd),smoothstep(.24,.48,nn)));
      }
      vec3 base=texture2D(lines,uvOut).rgb;
      gl_FragColor=vec4(max(base,vec3(edge*.83)),1.);
    }`,
  depthTest: false, depthWrite: false,
})));
renderer.setRenderTarget(null);
renderer.render(composite, new THREE.Camera());

const svg = document.querySelector('#annotations');
const project = point => {
  const p = point.clone().project(camera);
  return [170 + (p.x + 1) * width / 2, 140 + (1 - p.y) * height / 2];
};
// Put ring callouts on the upper shell instead of their side-on centreline.
const ringRim = index => {
  const p = station.markers[index].position.clone();
  p.z = Math.hypot(p.y, p.z);
  p.y = 0;
  return p;
};
const labels = [
  { title: 'MAIN ECOLOGY RING', detail: 'Ø 112 m', marker: 0, point: ringRim(0), x: 810, y: 218, side: 'top' },
  { title: 'MATERIAL RESERVE RING', detail: 'Ø 84 m', marker: 1, point: ringRim(1), x: 535, y: 285, side: 'top' },
  { title: 'FIXED ANALYSIS MODULE', marker: 2, x: 535, y: 680, side: 'left' },
  { title: 'CREW DOCKING PORT', marker: 4, x: 425, y: 570, side: 'left' },
  { title: 'CARGO DOCKING PORT', marker: 5, x: 425, y: 480, side: 'left' },
  { title: 'ASSEMBLY ARM', marker: 7, x: 475, y: 405, side: 'left' },
  { title: 'INSPECTION ARM', marker: 8, x: 545, y: 775, side: 'left' },
  { title: 'COMMUNICATIONS DISH', detail: 'FAR SIDE', marker: 6, x: 405, y: 625, side: 'left' },
  { title: 'SOLAR ARRAYS', marker: 12, x: 1175, y: 270, side: 'right' },
  { title: 'RADIATOR PANEL', marker: 13, x: 1175, y: 410, side: 'right' },
  { title: 'PROPELLANT TANKS', marker: 10, x: 1220, y: 495, side: 'right' },
  { title: 'MAIN ENGINES', marker: 11, x: 1220, y: 650, side: 'right' },
];
for (const { title, detail, marker, point, x, y, side } of labels) {
  const [px, py] = project(point ?? station.markers[marker].position);
  const anchor = side === 'left' ? 'end' : side === 'top' ? 'middle' : 'start';
  const endX = side === 'left' ? x + 12 : side === 'right' ? x - 12 : x;
  const endY = side === 'top' ? y + (detail ? 32 : 12) : y - 4;
  const elbowX = side === 'left' ? endX + 24 : side === 'right' ? endX - 24 : endX;
  const elbowY = side === 'top' ? endY + 18 : endY;
  svg.insertAdjacentHTML('beforeend', `<g><path d="M ${px} ${py} L ${elbowX} ${elbowY} L ${endX} ${endY}"/><circle cx="${px}" cy="${py}" r="3"/><text x="${x}" y="${y}" text-anchor="${anchor}">${title}</text>${detail ? `<text class="sub" x="${x}" y="${y+19}" text-anchor="${anchor}">${detail}</text>` : ''}</g>`);
}
await document.fonts.ready;
document.documentElement.dataset.ready = 'true';
