import { build } from 'vite';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdtemp, rm, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, extname, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';

const root = fileURLToPath(new URL('.', import.meta.url));
const temporary = await mkdtemp(join(tmpdir(), 'station-drawing-'));
const output = fileURLToPath(new URL('../../../public/station-drawings/', import.meta.url));
let browser, server;
try {
  await build({ configFile: false, root, logLevel: 'warn', resolve: { dedupe: ['three'] }, build: { outDir: temporary, emptyOutDir: true } });
  server = createServer(async (request, response) => {
    try {
      const path = resolve(temporary, '.' + (request.url === '/' ? '/index.html' : new URL(request.url, 'http://localhost').pathname));
      if (!path.startsWith(temporary + sep)) { response.writeHead(403).end(); return; }
      response.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.woff2': 'font/woff2' })[extname(path)] || 'application/octet-stream');
      response.end(await readFile(path));
    } catch { response.writeHead(404).end(); }
  });
  await new Promise(accept => server.listen(0, '127.0.0.1', accept));
  browser = await chromium.launch({ headless: true,
    ...(process.env.STATION_BROWSER_PATH ? { executablePath: process.env.STATION_BROWSER_PATH } : {}),
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1100 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.documentElement.dataset.ready === 'true');
  if (errors.length) throw new Error(errors.join('\n'));
  await mkdir(output, { recursive: true });
  await page.screenshot({ path: join(output, 'overview.png') });
  // Element screenshots include overlapping siblings, so hide the diagram's
  // annotation layer before exporting the reusable station-only asset.
  await page.addStyleTag({ content: '#annotations, header, footer { visibility: hidden; }' });
  await page.locator('#drawing').screenshot({ path: join(output, 'side-elevation.png') });
  console.log('Saved public/station-drawings/overview.png (1600 × 1100); page errors: 0');
} finally {
  await browser?.close();
  if (server) await new Promise(accept => server.close(accept));
  await rm(temporary, { recursive: true, force: true });
}
