// Three independent composition diagrams. These are geometric studies, not flight predictions.
const TAU=Math.PI*2;
const point=(x,y)=>({x,y});
const path=points=>points.map((p,i)=>`${i?'L':'M'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');
const line=(a,b,attributes='')=>`<path d="M${a.x} ${a.y}L${b.x} ${b.y}" ${attributes}/>`;
const text=(p,value,attributes='')=>`<text x="${p.x}" y="${p.y}" ${attributes}>${value}</text>`;
const dot=(p,r=4)=>`<circle cx="${p.x}" cy="${p.y}" r="${r}"/>`;
const arrow=(a,b)=>line(a,b,'marker-end="url(#diagram-arrow)"');
const sample=(fn,count=100)=>Array.from({length:count+1},(_,i)=>fn(i/count));
const add=(a,b)=>a.map((v,i)=>v+b[i]);
const mul=(v,s)=>v.map(x=>x*s);
const length=v=>Math.hypot(...v);
function projection(cx,cy,scale=1) {
 const ax=.46,ay=-.30;
 return values=>{
  const [x,y,z]=values,y1=y*Math.cos(ax)-z*Math.sin(ax),z1=y*Math.sin(ax)+z*Math.cos(ax);
  return {x:cx+(x*Math.cos(ay)+z1*Math.sin(ay))*scale,y:cy-y1*scale,depth:-x*Math.sin(ay)+z1*Math.cos(ay)};
 };
}
function sphere(cx,cy,r) {
 const project=projection(cx,cy,r);let front='',back='';
 const curves=[];
 for(const lat of [-60,-30,0,30,60])curves.push(sample(t=>{const phi=lat*Math.PI/180,a=t*TAU;return project([Math.cos(phi)*Math.cos(a),Math.sin(phi),Math.cos(phi)*Math.sin(a)]);},120));
 for(let longitude=0;longitude<180;longitude+=30)curves.push(sample(t=>{const a=t*TAU,l=longitude*Math.PI/180;return project([Math.cos(a)*Math.cos(l),Math.sin(a),Math.cos(a)*Math.sin(l)]);},120));
 for(const points of curves)for(let i=1;i<points.length;i++){
  const segment=line(points[i-1],points[i]);if((points[i].depth+points[i-1].depth)/2>0)front+=segment;else back+=segment;
 }
 return `<g class="diagram-back">${back}</g><g class="diagram-grid">${front}<circle cx="${cx}" cy="${cy}" r="${r}"/></g>`;
}
function tracking() {
 const project=projection(450,555,255);
 const lat=Math.PI/6,lon=50*Math.PI/180;
 const up=[Math.cos(lat)*Math.cos(lon),Math.sin(lat),Math.cos(lat)*Math.sin(lon)];
 const east=[-Math.sin(lon),0,Math.cos(lon)],north=[-Math.sin(lat)*Math.cos(lon),Math.cos(lat),-Math.sin(lat)*Math.sin(lon)];
 const site=project(up);
 const ground=p=>project(add(up,add(mul(east,p[0]),mul(north,p[1]))));
 const target3=add(mul(up,2.5),add(mul(east,-1.2),mul(north,.7))),target=project(target3);
 const horizon=[[-.8,-.7],[.8,-.7],[.8,.7],[-.8,.7],[-.8,-.7]].map(ground);
 const zenith=project(mul(up,1.8));
 const orbit=sample(t=>project(add(target3,[1.55*(t-.5),-.9*(t-.5)**2,.95*(t-.5)])),90);
 const angle=sample(t=>project(add(up,add(mul(east,-.32*Math.cos(t*.66)),mul(up,.32*Math.sin(t*.66))))),30);
 return `${sphere(450,555,255)}
 <g class="diagram-reference">${line(project([-1.4,0,0]),project([1.4,0,0]))}${line(project([0,-1.4,0]),project([0,1.4,0]))}${line(point(450,555),site,'stroke-dasharray="3 8"')}</g>
 <g class="diagram-plane"><path d="${path(horizon)}"/>${line(ground([-.8,0]),ground([.8,0]))}${line(ground([0,-.7]),ground([0,.7]))}</g>
 <g class="diagram-primary"><path d="${path(orbit)}"/>${arrow(site,target)}${dot(site,4)}${dot(target,5)}${line(site,zenith,'stroke-dasharray="4 8"')}<path d="${path(angle)}"/></g>
 <g class="diagram-labels">${text(point(430,845),'Earth')}${text(point(site.x-88,site.y+28),'地面站')}${text(point(target.x+12,target.y-18),'观测目标')}${text(point(zenith.x+8,zenith.y),'天顶')}${text(point(horizon[2].x+10,horizon[2].y+18),'局部地平面')}${text(point(angle[15].x-12,angle[15].y-12),'ε')}</g>`;
}
function sky() {
 const radius=355;
 const polar=(azimuth,elevation)=>{const a=(azimuth-90)*Math.PI/180,r=radius*(90-elevation)/90;return point(Math.cos(a)*r,Math.sin(a)*r);};
 const track=sample(t=>polar(220+210*t,70*Math.sin(Math.PI*t)),120);
 const current=polar(220+210*.58,70*Math.sin(Math.PI*.58));
 const innerArc=sample(t=>polar(35+145*t,60),60);
 return `<g transform="translate(550 540) rotate(-18) scale(1 .78)">
 <g class="diagram-reference"><circle r="${radius}"/><circle r="${radius*.5}"/><path d="${path(innerArc)}"/>${line(point(0,0),current,'stroke-dasharray="3 10"')}</g>
 <g class="diagram-primary"><path d="${path(track)}"/>${dot(track[0],3)}${dot(track.at(-1),3)}${dot(current,5)}${line(point(-6,0),point(6,0))}${line(point(0,-6),point(0,6))}</g></g>`;
}
function orbitalPlane() {
 const project=projection(520,565,1),inclination=55*Math.PI/180,a=360,e=.28,b=a*Math.sqrt(1-e*e);
 const orbitAt=E=>[a*(Math.cos(E)-e),b*Math.sin(E)*Math.sin(inclination),b*Math.sin(E)*Math.cos(inclination)];
 const orbit=sample(t=>project(orbitAt(t*TAU)),160);
 const reference=[[-480,0,-265],[480,0,-265],[480,0,265],[-480,0,265],[-480,0,-265]].map(project);
 const equator=sample(t=>project([360*Math.cos(t*TAU),0,360*Math.sin(t*TAU)]),120);
 const center=project([0,0,0]),E=.95,position=orbitAt(E),satellite=project(position);
 const velocity=[-a*Math.sin(E),b*Math.cos(E)*Math.sin(inclination),b*Math.cos(E)*Math.cos(inclination)];
 const velocityTip=project(add(position,mul(velocity,130/length(velocity))));
 const normal=project([0,270*Math.cos(inclination),-270*Math.sin(inclination)]);
 const inclinationArc=sample(t=>project([260,95*Math.sin(t*inclination),95*Math.cos(t*inclination)]),40);
 return `<g class="diagram-plane"><path d="${path(reference)}"/></g>
 <g class="diagram-reference"><path d="${path(equator)}"/>${line(project([-480,0,0]),project([480,0,0]))}${line(project([0,0,-300]),project([0,0,300]))}</g>
 ${sphere(520,565,66)}
 <g class="diagram-primary"><path d="${path(orbit)}"/>${arrow(center,satellite)}${arrow(satellite,velocityTip)}${arrow(center,normal)}${dot(satellite,5)}<path d="${path(inclinationArc)}"/></g>
 <g class="diagram-labels">${text(point(center.x-24,center.y+94),'中心天体')}${text(point((satellite.x+center.x)/2+10,(satellite.y+center.y)/2),'r')}${text(point(velocityTip.x+10,velocityTip.y),'v')}${text(point(normal.x+10,normal.y),'n')}${text(point(inclinationArc[20].x+12,inclinationArc[20].y),'i')}${text(point(reference[1].x-80,reference[1].y-15),'参考平面')}${text(point(orbit[35].x-35,orbit[35].y-18),'轨道平面')}</g>`;
}
// Geometric maneuver studies: tangent transfer ellipses, plane-change nodes and phasing loops.
// No flight timings or spacecraft orbit parameters are inferred from the relay schedule.
function maneuvers() {
 const view=(cx,cy,roll,inclination)=>{
  const base=projection(cx,cy,1);
  return ([x,y,z=0])=>{
   const xr=x*Math.cos(roll)-y*Math.sin(roll),yr=x*Math.sin(roll)+y*Math.cos(roll);
   return base([xr,yr*Math.cos(inclination)-z*Math.sin(inclination),yr*Math.sin(inclination)+z*Math.cos(inclination)]);
  };
 };
 const circlePath=(project,r)=>path(sample(t=>project([r*Math.cos(t*TAU),r*Math.sin(t*TAU)]),140));
 const impulse=(project,p,v,scale=60)=>{
  const a=project(p),b=project(add(p,mul(v,scale/length(v))));
  return `${dot(a,3.5)}${arrow(a,b)}`;
 };
 const transfer=view(650,540,-.36,.75),r1=125,r2=335,high=430;
 const ellipse=(peri,apo,E)=>{const a=(peri+apo)/2,c=(apo-peri)/2;return [c+a*Math.cos(E),Math.sqrt(peri*apo)*Math.sin(E)];};
 let transferReferences=`<path d="${circlePath(transfer,r1)}"/><path d="${circlePath(transfer,r2)}"/>`;
 for(const apo of [275,390])transferReferences+=`<path d="${path(sample(t=>transfer(ellipse(r1,apo,Math.PI*(1-t))),100))}"/>`;
 const direct=path(sample(t=>transfer(ellipse(r1,r2,Math.PI*(1-t))),120));
 const climb=path(sample(t=>transfer(ellipse(r1,high,Math.PI*(1-t))),120));
 const returnArc=path(sample(t=>{const p=ellipse(r2,high,Math.PI*t);p[1]*=-1;return transfer(p);},120));
 const coast=path(sample(t=>transfer([r2*Math.cos(-Math.PI*t),r2*Math.sin(-Math.PI*t)]),100));
 const transferDrawing=`<g class="maneuver-secondary">${transferReferences}<path d="${climb}"/><path d="${returnArc}"/></g><g class="maneuver-primary"><path d="${direct}"/><path d="${coast}"/>${impulse(transfer,[-r1,0,0],[0,1,0])}${impulse(transfer,[r2,0,0],[0,-1,0])}${dot(transfer([high,0]),3)}${dot(transfer([0,0]),7)}</g>`;

 const plane=projection(340,270,1),radius=175;
 const orbit=i=>path(sample(t=>plane([radius*Math.cos(t*TAU),radius*Math.sin(t*TAU)*Math.cos(i),radius*Math.sin(t*TAU)*Math.sin(i)]),140));
 const node=[radius,0,0];
 const planeDrawing=`<g class="maneuver-secondary"><path d="${orbit(.2)}"/>${line(plane([-radius-35,0,0]),plane([radius+35,0,0]),'stroke-dasharray="3 10"')}</g><g class="maneuver-primary"><path d="${orbit(1.12)}"/>${impulse(plane,node,[0,Math.cos(.2),Math.sin(.2)],65)}${impulse(plane,node,[0,Math.cos(1.12),Math.sin(1.12)],65)}${dot(plane([-radius,0,0]),3)}${dot(plane([0,0,0]),7)}</g>`;

 const phase=view(325,795,.32,.58),phaseRadius=180;
 const phasing=(a,t)=>{const c=phaseRadius-a,b=Math.sqrt(a*a-c*c);return phase([c+a*Math.cos(t*TAU),b*Math.sin(t*TAU)]);};
 let phaseReferences=`<path d="${circlePath(phase,phaseRadius)}"/>`;
 for(const a of [125,158])phaseReferences+=`<path d="${path(sample(t=>phasing(a,t),120))}"/>`;
 const rendezvous=phase([phaseRadius,0]),approach=path(sample(t=>phasing(142,t*.55),90));
 const phaseDrawing=`<g class="maneuver-secondary">${phaseReferences}</g><g class="maneuver-primary"><path d="${approach}"/>${impulse(phase,[phaseRadius,0,0],[0,1,0],55)}${dot(phase([0,0]),7)}${dot(phase([phaseRadius*Math.cos(.2),phaseRadius*Math.sin(.2)]),2.5)}${dot(phase([phaseRadius*Math.cos(.4),phaseRadius*Math.sin(.4)]),2)}</g>`;
 return `<g class="maneuver-suite">${planeDrawing}${transferDrawing}${phaseDrawing}</g>`;
}
export const diagramVariants={
 maneuvers:{name:"空间变轨机动",draw:maneuvers},
 tracking:{name:'A 地面跟踪几何',draw:tracking},
 sky:{name:'B 方位角与仰角',draw:sky},
 plane:{name:'C 轨道平面与姿态',draw:orbitalPlane},
};
export function renderOrbit(container,variant='maneuvers') {
 const chosen=diagramVariants[variant]??diagramVariants.maneuvers;
 container.innerHTML=`<svg viewBox="0 0 1200 1000" role="presentation"><defs><marker id="diagram-arrow" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto"><path d="M1 1L7 4.5L1 8" fill="none" stroke="#9eaaa0"/></marker></defs>${chosen.draw()}</svg>`;
}
