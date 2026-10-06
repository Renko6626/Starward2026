import { mountStationScene } from '../../src/app/components/station/scene.js';
const container = document.querySelector('#capture');
try {
  mountStationScene(container, { staticFrame: true, onReady: () => { container.dataset.ready = 'true'; } });
} catch (error) {
  container.dataset.error = String(error);
  console.error(error);
}
