import { mountSchedule } from './schedule.js';
import { mountScene } from './scene.js';
import './style.css';

mountSchedule();
let scene;
try { scene = mountScene(document.querySelector('#viewport')); }
catch (error) { document.querySelector('#failure').hidden = false; console.error(error); }
const motion = document.querySelector('#motion');
motion.hidden = !scene;
let paused = new URLSearchParams(location.search).has('static');
function syncLabel() { motion.setAttribute('aria-pressed', String(paused)); motion.textContent = paused ? '继续场景' : '暂停场景'; }
syncLabel();
motion.addEventListener('click', () => { paused = !paused; scene?.setPaused(paused); syncLabel(); });
if (import.meta.hot) import.meta.hot.dispose(() => scene?.dispose());
window.addEventListener('pagehide', () => scene?.dispose(), { once: true });
