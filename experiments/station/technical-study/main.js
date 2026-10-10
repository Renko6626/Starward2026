import * as THREE from 'three';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { layout } from '../ring-romantic/src/model/layout.js';
import { createRingStation } from '../ring-romantic/src/station-ring.js';

const width = 1260, height = 850;
const view = new URLSearchParams(location.search).get('view') || 'side';
const w = layout.working, c = layout.confirmed;
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(width, height);
renderer.setPixelRatio(2);
renderer.setClearColor(0x090909);
document.querySelector('#drawing').append(renderer.domElement);
const station = createRingStation();
station.update(0);
const scene = new THREE.Scene();
scene.add(station.object);
const detail = view === 'dock' || view === 'aft';
const target = view === 'dock' ? new THREE.Vector3(-56, 0, 1)
  : view === 'aft' ? new THREE.Vector3(54, 0, 0) : new THREE.Vector3();
const halfWidth = view === 'front' ? 94 : view === 'dock' ? 28 : view === 'aft' ? 36 : 170;
const camera = new THREE.OrthographicCamera(-halfWidth, halfWidth, halfWidth * height / width, -halfWidth * height / width, 1, 1000);
camera.position.copy(target).add(view === 'front' ? new THREE.Vector3(300, 0, 0) : new THREE.Vector3(0, -300, 0));
camera.up.set(0, 0, 1);
camera.lookAt(target);
camera.updateMatrixWorld();
// The end view isolates the two rotating assemblies and the core.
if (view === 'front') station.object.children[0].children.slice(1).forEach(object => { object.visible = false; });

// Capture smooth surfaces separately so their silhouettes survive hard-edge filtering.
const normalTarget = new THREE.WebGLRenderTarget(width * 2, height * 2);
normalTarget.depthTexture = new THREE.DepthTexture(width * 2, height * 2);
scene.overrideMaterial = new THREE.MeshNormalMaterial();
renderer.setRenderTarget(normalTarget);
renderer.setClearColor(0x000000);
renderer.render(scene, camera);
scene.overrideMaterial = null;

const black = new THREE.MeshBasicMaterial({ color: 0x090909, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
// Keep equipment edges fine; the normal/depth pass supplies stronger silhouettes.
const lineMaterial = new LineMaterial({ color: 0x81949c, linewidth: 1.15, depthWrite: false, depthTest: false });
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
  if (!object.isMesh || !object.visible) return;
  for (let parent = object.parent; parent; parent = parent.parent) if (!parent.visible) return;
  object.material = black;
  let edges = edgesCache.get(object.geometry);
  if (!edges) {
    const hardEdges = new THREE.EdgesGeometry(object.geometry, 38);
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
    if (Math.max(size.x, size.y, size.z) < (detail ? .12 : .8)) continue;
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
      gl_FragColor=vec4(max(base,vec3(edge*.32)),1.);
      #include <colorspace_fragment>
    }`,
  depthTest: false, depthWrite: false,
})));
renderer.setRenderTarget(null);
renderer.render(composite, new THREE.Camera());


const project = point => {
  const p = point.clone().project(camera);
  return [170 + (p.x + 1) * width / 2, 140 + (1 - p.y) * height / 2];
};
const xy = (x, z) => project(new THREE.Vector3(x, 0, z));
const top = detail ? 280 : 145, bottom = detail ? 810 : 995;
const left = 240, right = 1290;
let geometry = `<defs><marker id="arrow" viewBox="0 0 8 8" refX="4" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M8 0L0 4L8 8" fill="none" stroke="#a8bec9" stroke-width="1"/></marker></defs>`;
geometry += `<rect class="frame" x="${left}" y="${top}" width="${right-left}" height="${bottom-top}"/>`;
// Sheet zones live on all four borders; interior ticks keep the object legible.
for (let i = 0; i <= 5; i++) {
  const x = left + i * 210;
  geometry += `<path class="zone-tick" d="M${x} ${top}v12 M${x} ${bottom}v-12"/>`;
  if (i < 5) for (const y of [top - 15, bottom + 30])
    geometry += `<text class="coordinate" x="${x+105}" y="${y}">${5-i}</text>`;
}
for (let i = 0; i <= 4; i++) {
  const y = top + i * (bottom-top)/4;
  geometry += `<path class="zone-tick" d="M${left} ${y}h12 M${right} ${y}h-12"/>`;
  if (i < 4) for (const x of [left-18, right+18])
    geometry += `<text class="coordinate" x="${x}" y="${y+(bottom-top)/8+7}">${'DCBA'[i]}</text>`;
}
const [ax, ay] = project(target);
geometry += `<path class="datum" d="M${left+25} ${ay}H${right-25} M${ax} ${top+20}V${bottom-20}"/>`;
const horizontal = (p1, p2, y, label) => {
  const [x1,y1] = project(p1), [x2,y2] = project(p2);
  const centre=(x1+x2)/2;
  geometry += `<g class="dimension"><path class="extension" d="M${x1} ${y1+5}V${y+12} M${x2} ${y2+5}V${y+12}"/><path marker-start="url(#arrow)" marker-end="url(#arrow)" d="M${x1} ${y}H${x2}"/><text x="${centre}" y="${y-12}">${label}</text></g>`;
};
const vertical = (p1, p2, x, label) => {
  const [x1,y1] = project(p1), [x2,y2] = project(p2);
  geometry += `<g class="dimension"><path class="extension" d="M${x1+5} ${y1}H${x+12} M${x2+5} ${y2}H${x+12}"/><path marker-start="url(#arrow)" marker-end="url(#arrow)" d="M${x} ${y1}V${y2}"/><text transform="translate(${x-12} ${(y1+y2)/2}) rotate(-90)">${label}</text></g>`;
};
const leader = (point, x, y, label) => {
  const [px,py]=project(point);
  const end=x<px?x+18:x-18;
  geometry += `<g class="leader"><path d="M${px} ${py}L${end+(x<px?35:-35)} ${y}H${end}"/><circle cx="${px}" cy="${py}" r="3"/><text x="${x}" y="${y-10}" text-anchor="${x<px?'start':'end'}">${label}</text></g>`;
};
if (view === 'side') {
  vertical(new THREE.Vector3(w.mainX,0,c.mainOuterRadius),new THREE.Vector3(w.mainX,0,-c.mainOuterRadius),1035,`Ø${c.mainOuterRadius*2}`);
  vertical(new THREE.Vector3(w.counterX,0,c.counterDiameter/2),new THREE.Vector3(w.counterX,0,-c.counterDiameter/2),470,`Ø${c.counterDiameter}`);
  horizontal(new THREE.Vector3(w.counterX,0,-c.mainOuterRadius),new THREE.Vector3(w.mainX,0,-c.mainOuterRadius),835,`${w.mainX-w.counterX} REF`);
  horizontal(new THREE.Vector3(w.coreFront,0,0),new THREE.Vector3(w.engineExit,0,0),880,`${w.engineExit-w.coreFront} REF`);
  horizontal(new THREE.Vector3(w.mainX-w.mainAxialEnvelope/2,0,c.mainOuterRadius),new THREE.Vector3(w.mainX+w.mainAxialEnvelope/2,0,c.mainOuterRadius),310,`${w.mainAxialEnvelope} REF`);
  leader(station.markers[4].position,315,465,'DOCK');
  leader(station.markers[13].position,1160,235,'PV');
  leader(station.markers[12].position,1160,690,`${c.mainEngines}×`);
  // Detail references mark the actual camera study centres used below.
  for (const [x,r,id] of [[-56,14,'B'],[54,16,'C']]) {
    const [cx,cy]=xy(x,0); const radius=r/(halfWidth*2)*width;
    geometry+=`<circle class="detail-boundary" cx="${cx}" cy="${cy}" r="${radius}"/><text class="view-ref" x="${cx}" y="${cy+radius+28}">${id}</text>`;
  }
} else if (view === 'front') {
  const radius=c.mainOuterRadius/(halfWidth*2)*width;
  const reserve=c.counterDiameter/2/(halfWidth*2)*width;
  geometry+=`<path class="dimension" marker-start="url(#arrow)" marker-end="url(#arrow)" d="M${ax-radius} ${ay}H${ax+radius}"/><text class="dimension-label" x="${ax}" y="${ay-18}">Ø${c.mainOuterRadius*2}</text>`;
  leader(new THREE.Vector3(0,0,c.counterDiameter/2),1120,320,`Ø${c.counterDiameter}`);
  leader(new THREE.Vector3(0,c.mainOuterRadius,0),380,265,`${c.mainSpokes}× 90°`);
  geometry+=`<circle class="datum" cx="${ax}" cy="${ay}" r="${reserve}"/>`;
} else if (view === 'dock') {
  vertical(new THREE.Vector3(-51,0,4.5),new THREE.Vector3(-51,0,-4.5),1110,'Ø9 REF');
  horizontal(new THREE.Vector3(-58,0,-4.5),new THREE.Vector3(-44,0,-4.5),770,'14 REF');
  leader(station.markers[4].position,350,340,'DOCK');
  leader(station.markers[6].position,1080,365,'EVA');
} else {
  horizontal(new THREE.Vector3(w.engineExit-w.mainNozzleLength,0,0),new THREE.Vector3(w.engineExit,0,0),765,`${w.mainNozzleLength} REF`);
  leader(station.markers[11].position,340,325,`${c.mainTanks}× TANK`);
  leader(station.markers[12].position,1135,690,`${c.mainEngines}× Ø${w.mainNozzleDiameter}`);
  const tankExtent = Math.max(...Array.from({ length: c.mainTanks }, (_, i) => Math.abs(Math.sin(i * Math.PI * 2 / c.mainTanks)) * w.tankCircleRadius)) + w.tankRadius;
  vertical(new THREE.Vector3(54,0,tankExtent),new THREE.Vector3(54,0,-tankExtent),1100,`${(2*tankExtent).toFixed(1)} REF`);
}
const scaleMetres=detail?5:20, scaleLength=scaleMetres/(camera.right-camera.left)*width;
const sy=bottom-48;
geometry+=`<path class="scale" d="M300 ${sy-12}v12h${scaleLength}v-12 M${300+scaleLength/2} ${sy-6}v6"/><text class="scale-label" x="300" y="${sy+26}">0</text><text class="scale-label" x="${300+scaleLength}" y="${sy+26}">${scaleMetres} m</text>`;
geometry+=`<text class="unit-label" x="${right-50}" y="${bottom-25}">m</text>`;
document.querySelector('#page-sheet').innerHTML=geometry;
document.querySelector('#annotations').innerHTML=geometry;
await document.fonts.load('400 27px "IBM Plex Mono"');
await document.fonts.ready;
document.documentElement.dataset.ready='true';
