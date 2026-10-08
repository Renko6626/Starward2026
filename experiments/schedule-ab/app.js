const slots = await fetch(new URL('./sample.json', import.meta.url)).then(response => response.json());
const variant = document.body.dataset.variant;
const devOrigin = `${location.protocol}//${location.hostname}:20262`;
document.querySelector('.brand').href = devOrigin + '/';
document.querySelector('.original').href = devOrigin + '/works/';
const labels = { confirmed: '已确认', reserved: '已预留' };
const board = document.querySelector('#board');
const dialog = document.querySelector('#mobile-detail');
const mobile = window.matchMedia('(max-width:640px)');
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clock = h => String(h).padStart(2, '0') + ':00';
let selected = 10;
let trigger = null;
for (let h = 0; h <= 24; h++) {
 document.querySelector('#ruler-ticks').insertAdjacentHTML('beforeend', `<i class="tick ${h % 6 === 0 ? 'major' : ''}" style="left:${h / 24 * 100}%">${h % 2 === 0 ? `<span>${clock(h)}</span>` : ''}</i>`);
}
document.querySelector('#ruler-points').innerHTML = slots.map(s => `<i class="overview-point ${s.status}" data-hour="${s.hour}" style="left:${s.hour / 24 * 100}%"></i>`).join('');
for (let start = 0; start < 24; start += 6) {
 const entries = slots.slice(start, start + 6);
 const heading = `<header class="shift-header"><h2>${String(start).padStart(2,'0')}<span>—</span>${String(start+6).padStart(2,'0')}<small>时</small></h2><span>第 ${start+1}—${start+6} 棒</span></header>`;
 const content = variant === 'a' ? `<ol class="axis-list">${entries.map(s => `<li><button type="button" class="task ${s.status}" data-hour="${s.hour}" aria-pressed="false" aria-label="${escape(`${s.time} ${s.author} ${labels[s.status]}，查看详情`)}"><time class="clock">${s.time}</time><span class="axis-anchor" aria-hidden="true"></span><span class="task-content"><span class="author">${escape(s.author)}${s.hour===10?'<small class="mine">我的</small>':''}</span><span class="work">${escape(s.title)}</span></span></button></li>`).join('')}</ol>` : `<div class="plot-scale"><span>作者署名</span><div class="plot-hours">${Array.from({length:7},(_,i)=>`<span style="left:${i/6*100}%">${String(start+i).padStart(2,'0')}</span>`).join('')}</div></div><div class="lanes">${entries.map((s,i)=>`<button type="button" class="lane ${s.status} ${i>=4?'late':''}" data-hour="${s.hour}" aria-pressed="false" aria-label="${escape(`${s.time} ${s.author} ${labels[s.status]}，查看详情`)}"><span class="lane-name">${escape(s.author)}${s.hour===10?'<small class="mine">我的</small>':''}</span><span class="lane-track" style="--x:${i/6*100}%"><i class="release" aria-hidden="true"></i><span class="lane-note"><b>${s.time}</b>${escape(s.title)}</span></span></button>`).join('')}</div>`;
 board.insertAdjacentHTML('beforeend',`<section class="shift" aria-label="${clock(start)} 到 ${clock(start+6)}">${heading}${content}<footer class="shift-end"><span>${clock(start)} 起</span><span>${entries.filter(s=>s.status==='confirmed').length} 棒已确认</span></footer></section>`);
}
function detail(s, suffix) {
 return `<div class="detail"><div class="detail-clock"><small>选中时段</small><strong>${s.time}</strong><span>第 ${s.hour+1} 棒${s.hour===10?' / 我的时段':''}</span></div><div><div class="detail-meta"><span><i class="mark ${s.status}"></i> ${labels[s.status]}</span><span>${escape(s.kind)}</span></div><h2 id="detail-author${suffix}">${escape(s.author)}</h2><h3>${escape(s.title)}</h3><p>${escape(s.description)}</p></div><div class="detail-actions"><a href="${devOrigin}/portal/login">前往创作者入口</a><p>作品详情在接力结束后开放。</p></div></div>`;
}
function select(hour, open = false) {
 selected = hour;
 const s = slots[hour];
 board.querySelectorAll('[data-hour]').forEach(el=>{const current=Number(el.dataset.hour)===hour;el.classList.toggle('selected',current);el.setAttribute('aria-pressed',String(current));});
 document.querySelectorAll('.overview-point').forEach(el=>el.classList.toggle('selected',Number(el.dataset.hour)===hour));
 const cursor = document.querySelector('#ruler-cursor');cursor.style.left=`${hour/24*100}%`;cursor.classList.toggle('near-end',hour>21);cursor.firstElementChild.textContent=`${s.time} 已选`;
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
