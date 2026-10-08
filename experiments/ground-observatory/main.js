import slots from '../schedule-ab/sample.json';
import { mountArray } from './scene.js';
import { renderOrbit, diagramVariants } from './orbit.js';
document.querySelector('.brand img').src = new URL('../../public/brand/moon-phase.png', import.meta.url).href;
const requestedVariant = new URLSearchParams(location.search).get('diagram');
const variant = Object.hasOwn(diagramVariants, requestedVariant) ? requestedVariant : 'maneuvers';
document.body.dataset.diagram = variant;
renderOrbit(document.querySelector('#orbit'), variant);
document.title = diagramVariants[variant].name + '｜地面观测站样稿';
document.querySelector('.site-foot > span').textContent = diagramVariants[variant].name + '构图样稿';
try { const dispose = mountArray(document.querySelector('#antenna')); window.addEventListener('pagehide', dispose, { once:true }); } catch(error) { document.querySelector('.array-background').classList.add('unavailable'); console.warn('Antenna preview unavailable', error); }
const devOrigin = `${location.protocol}//${location.hostname}:20262`;
document.querySelector('.brand').href = devOrigin + '/';
document.querySelectorAll('nav a').forEach(a=>{a.href=a.href.replace('http://localhost:20262',devOrigin);});
const labels = { confirmed: '已确认', reserved: '已预留' };
const board = document.querySelector('#board');
const dialog = document.querySelector('#mobile-detail');
const mobile = window.matchMedia('(max-width:640px)');
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clock = h => 'T+' + String(h).padStart(2, '0') + ':00';
const clockHTML = value => `<span class="prefix">T+</span>${value}`;
let selected = 10;
let trigger = null;
for (let tick = 0; tick <= 96; tick++) {
 const h=tick/4;
 document.querySelector('#ruler-ticks').insertAdjacentHTML('beforeend', `<i class="tick ${tick % 24 === 0 ? 'major' : ''}" style="left:${h / 24 * 100}%">${tick % 8 === 0 ? `<span>${clock(h)}</span>` : ''}</i>`);
}
document.querySelector('#ruler-points').innerHTML = slots.map(s => `<i class="overview-point ${s.status}" data-hour="${s.hour}" style="left:${s.hour / 24 * 100}%"></i>`).join('');
for (let start = 0; start < 24; start += 6) {
 const entries = slots.slice(start, start + 6);
 const heading = `<header class="shift-header"><h2>${clock(start)}<span>—</span>${clock(start+6)}</h2><span>第 ${start+1}—${start+6} 棒</span></header>`;
 const content = `<ol class="axis-list">${entries.map(s => `<li><span class="minor-ticks" aria-hidden="true">${Array.from({length:5},(_,i)=>`<i class="${i===2?'half':''}" style="top:${(i+1)/6*100}%"></i>`).join('')}</span><button type="button" class="task ${s.status}" data-hour="${s.hour}" aria-pressed="false" aria-label="${escape(`${clock(s.hour)} ${s.author} ${labels[s.status]}，查看详情`)}"><time class="clock">${clockHTML(s.time)}</time><span class="axis-anchor" aria-hidden="true"></span><span class="task-content"><span class="author">${escape(s.author)}${s.hour===10?'<small class="mine">我的</small>':''}</span><span class="work">${escape(s.title)}</span></span></button></li>`).join('')}</ol>`;
 board.insertAdjacentHTML('beforeend',`<section class="shift" aria-label="${clock(start)} 到 ${clock(start+6)}">${heading}${content}<footer class="shift-end"><span>${clock(start+6)} 止</span><span>${entries.filter(s=>s.status==='confirmed').length} 棒已确认</span></footer></section>`);
}
function detail(s, suffix) {
 return `<div class="detail"><div class="detail-clock"><small>选中时段</small><strong>${clock(s.hour)}</strong><span>第 ${s.hour+1} 棒${s.hour===10?' / 我的时段':''}</span></div><div><div class="detail-meta"><span><i class="mark ${s.status}"></i> ${labels[s.status]}</span><span>${escape(s.kind)}</span></div><h2 id="detail-author${suffix}">${escape(s.author)}</h2><h3>${escape(s.title)}</h3><p>${escape(s.description)}</p></div><div class="detail-actions"><a href="${devOrigin}/portal/login">前往创作者入口</a><p>作品详情在接力结束后开放。</p></div></div>`;
}
function select(hour, open = false) {
 selected = hour;
 const s = slots[hour];
 board.querySelectorAll('[data-hour]').forEach(el=>{const current=Number(el.dataset.hour)===hour;el.classList.toggle('selected',current);el.setAttribute('aria-pressed',String(current));});
 document.querySelectorAll('.overview-point').forEach(el=>el.classList.toggle('selected',Number(el.dataset.hour)===hour));
 const cursor = document.querySelector('#ruler-cursor');cursor.style.left=`${hour/24*100}%`;cursor.classList.toggle('near-end',hour>21);cursor.firstElementChild.textContent=`${clock(s.hour)} 已选`;
 document.querySelector('#desktop-detail').innerHTML=detail(s,'').replace('<div class="detail">','').replace(/<\/div>$/,'');
 document.querySelector('#dialog-content').innerHTML=detail(s,'-mobile');
 if (open && mobile.matches && !dialog.open) { dialog.showModal(); document.body.style.overflow = 'hidden'; }
}
board.addEventListener('click',event=>{const button=event.target.closest('button[data-hour]');if(button){trigger=button;select(Number(button.dataset.hour),true);}});
document.querySelector('#search').addEventListener('input',event=>{
 const query=event.target.value.trim().toLocaleLowerCase();let count=0;
 board.querySelectorAll('[data-hour]').forEach(el=>{const s=slots[Number(el.dataset.hour)];const match=`${s.author} ${s.title}`.toLocaleLowerCase().includes(query);el.classList.toggle('dimmed',!match);if(match)count++;});
 document.querySelector('#search-result').textContent=query?`${count} 个匹配`:'';
});
document.querySelector('#locate').addEventListener('click',()=>{const el=board.querySelector('[data-hour="10"]');trigger=el;document.querySelector('#search').value='';document.querySelector('#search').dispatchEvent(new Event('input'));select(10,mobile.matches);if(!mobile.matches){el.scrollIntoView({block:'center',behavior:'smooth'});el.focus({preventScroll:true});}});
dialog.querySelector('.close').addEventListener('click',()=>dialog.close());
dialog.addEventListener('close',()=>{document.body.style.overflow='';trigger?.focus({preventScroll:true});});
mobile.addEventListener('change',()=>{if(!mobile.matches&&dialog.open)dialog.close();});
select(selected);
