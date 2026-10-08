import * as THREE from 'three';

// A conceptual ground array: selected structural curves, rather than a triangle wireframe.
export function createAntennaArray() {
 const array = new THREE.Group();
 const dark = new THREE.MeshBasicMaterial({color:0x080a0b,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1});
 const primary = new THREE.LineBasicMaterial({color:0x858f8e});
 const secondary = new THREE.LineBasicMaterial({color:0x414d4e});
 function segments(points, material = primary) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(points.flat(),3));
  return new THREE.LineSegments(geometry,material);
 }
 function curve(points, material = primary) {
  return new THREE.Line(new THREE.BufferGeometry().setFromPoints(points.map(p=>new THREE.Vector3(...p))),material);
 }
 function edged(geometry, position, parent, material = secondary) {
  const group = new THREE.Group();group.position.set(...position);
  group.add(new THREE.Mesh(geometry,dark));
  group.add(new THREE.LineSegments(new THREE.EdgesGeometry(geometry,22),material));parent.add(group);return group;
 }
 function dish(radius, azimuth, elevation, position) {
  const root = new THREE.Group();root.position.set(...position);root.rotation.y=azimuth;
  const height = radius * 1.4;
  edged(new THREE.CylinderGeometry(radius*.23,radius*.42,height*.62,8),[0,height*.31,0],root);
  edged(new THREE.BoxGeometry(radius*.95,radius*.12,radius*.85),[0,radius*.06,0],root);
  const fork=[];
  for(const side of [-1,1]) {
   const x=side*radius*.48;
   fork.push([side*radius*.26,height*.48,0],[x,height*.86,0],[x,height*.86,0],[x,height,0]);
   fork.push([side*radius*.26,height*.48,0],[x,height*.86,-radius*.35],[x,height*.86,-radius*.35],[x,height,0]);
   const pivot=edged(new THREE.CylinderGeometry(radius*.14,radius*.14,radius*.13,16),[x,height,0],root,primary);pivot.rotation.z=Math.PI/2;
  }
  root.add(segments(fork,primary));
  const bowl = new THREE.Group();bowl.position.y=height;bowl.rotation.x=-elevation;
  const focus=radius*.72;
  const depth=r=>r*r/(4*focus);
  const points=[],indices=[];const radial=14,angular=64;
  for(let ring=0;ring<=radial;ring++) for(let i=0;i<=angular;i++) {
   const r=radius*ring/radial,a=i/angular*Math.PI*2;points.push(Math.cos(a)*r,Math.sin(a)*r,depth(r));
  }
  for(let ring=0;ring<radial;ring++) for(let i=0;i<angular;i++) {const a=ring*(angular+1)+i,b=a+angular+1;indices.push(a,b,a+1,a+1,b,b+1);}
  const surface=new THREE.BufferGeometry();surface.setAttribute('position',new THREE.Float32BufferAttribute(points,3));surface.setIndex(indices);
  bowl.add(new THREE.Mesh(surface,dark));
  for(let ring=1;ring<=8;ring++) {
   const r=radius*ring/8;
   bowl.add(curve(Array.from({length:97},(_,i)=>{const a=i/96*Math.PI*2;return [Math.cos(a)*r,Math.sin(a)*r,depth(r)+.005];}),ring===8?primary:secondary));
  }
  for(let i=0;i<24;i++) {
   const a=i/24*Math.PI*2;
   bowl.add(curve(Array.from({length:17},(_,j)=>{const r=radius*j/16;return [Math.cos(a)*r,Math.sin(a)*r,depth(r)+.006];}),secondary));
  }
  const ribs=[];
  for(let i=0;i<12;i++) {
   const a=i/12*Math.PI*2,b=(i+1)/12*Math.PI*2;
   const inner=[Math.cos(a)*radius*.28,Math.sin(a)*radius*.28,-radius*.2];
   const outer=[Math.cos(a)*radius,Math.sin(a)*radius,depth(radius)-radius*.03];
   ribs.push(inner,outer,inner,[Math.cos(b)*radius,Math.sin(b)*radius,depth(radius)-radius*.03]);
  }
  bowl.add(segments(ribs,secondary));
  const supports=[];
  for(let i=0;i<4;i++) {const a=Math.PI/4+i*Math.PI/2;supports.push([Math.cos(a)*radius*.9,Math.sin(a)*radius*.9,depth(radius*.9)],[0,0,focus]);}
  bowl.add(segments(supports,primary));
  const feed=edged(new THREE.CylinderGeometry(radius*.065,radius*.095,radius*.15,12),[0,0,focus],bowl,primary);feed.rotation.x=Math.PI/2;
  root.add(bowl);
  for(const side of [-1,1]) root.add(segments([[side*radius*.55,0,-radius*.55],[side*radius*.55,0,radius*.55],[side*radius*.55,0,radius*.55],[-side*radius*.55,0,radius*.55]],secondary));
  return root;
 }
 array.add(dish(2.8,-.12,.85,[0,0,2.1]));
 return array;
}
