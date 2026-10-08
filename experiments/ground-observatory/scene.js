import * as THREE from 'three';
import { createAntennaArray } from './antenna.js';

export function mountArray(container) {
 const renderer = new THREE.WebGLRenderer({alpha:true,antialias:true});
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));renderer.setClearColor(0x000000,0);
 container.appendChild(renderer.domElement);
 const scene = new THREE.Scene();
 const antenna = createAntennaArray();
 scene.add(antenna);
 const camera = new THREE.OrthographicCamera(-8,8,10,-10,.1,120);
 camera.position.set(0,12,30);camera.lookAt(0,3.6,0);
 const resize=()=>{
  const {width,height}=container.getBoundingClientRect();if(!width||!height)return;
  const aspect=width/height,vertical=20;
  const compact=width<640;
  antenna.position.x=compact?5.5:13;
  antenna.rotation.y=-.2;
  antenna.scale.setScalar(compact?1.1:2.1);
  camera.left=-vertical*aspect/2;camera.right=vertical*aspect/2;camera.top=vertical/2;camera.bottom=-vertical/2;
  camera.updateProjectionMatrix();renderer.setSize(width,height);renderer.render(scene,camera);
  container.classList.add('ready');
 };
 const observer=new ResizeObserver(resize);observer.observe(container);resize();
 const lost=e=>{e.preventDefault();container.classList.remove('ready');};
 renderer.domElement.addEventListener('webglcontextlost',lost);
 renderer.domElement.addEventListener('webglcontextrestored',resize);
 return ()=>{observer.disconnect();const geometries=new Set(),materials=new Set();scene.traverse(object=>{if(object.geometry)geometries.add(object.geometry);if(object.material)materials.add(object.material);});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());renderer.dispose();renderer.domElement.remove();};
}
