import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { readFile, writeFile, readdir, mkdtemp, rm } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join, extname, resolve, relative, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { projectRoot, publishAssets } from '../../../scripts/station-assets.mjs';

export const drawingViews = [
  { name: 'overview', file: 'overview.png', width: 1600, height: 1100 },
  { name: 'sideElevation', file: 'side-elevation.png', width: 1260, height: 850 },
];
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
async function filesUnder(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [path];
  }))).flat();
}
export async function fingerprintDrawings(root = projectRoot) {
  const files = (await Promise.all(['experiments/station/ring-romantic/src', 'experiments/station/technical-study']
    .map(directory => filesUnder(join(root, directory))))).flat()
    .filter(path => ['.js', '.mjs', '.html'].includes(extname(path))).sort();
  const hash = createHash('sha256');
  for (const file of files) {
    hash.update(relative(root, file).split(sep).join('/'));
    hash.update('\0'); hash.update(await readFile(file)); hash.update('\0');
  }
  const lock = JSON.parse(await readFile(join(root, 'package-lock.json'), 'utf8'));
  const dependencies = Object.fromEntries(['three', 'vite', 'playwright'].map(name => [name, lock.packages[`node_modules/${name}`].version]));
  hash.update(JSON.stringify(dependencies));
  return { fingerprint: hash.digest('hex'), dependencies };
}
export async function checkDrawings(root = projectRoot) {
  const output = join(root, 'public/station-drawings');
  const expected = await fingerprintDrawings(root);
  let manifest;
  try {
    manifest = JSON.parse(await readFile(join(output, 'manifest.json'), 'utf8'));
    if (manifest.fingerprint !== expected.fingerprint) throw new Error('空间站线稿已过期');
    for (const view of drawingViews) {
      const bytes = await readFile(join(output, view.file));
      const image = manifest.images?.[view.name];
      if (!bytes.length || image?.sha256 !== digest(bytes) || image?.width !== view.width || image?.height !== view.height) {
        throw new Error(`空间站线稿缺失或损坏：${view.file}`);
      }
    }
  } catch (error) {
    throw new Error(`${error.code === 'ENOENT' ? '空间站线稿或清单缺失' : error.message}，请运行 npm run station:drawings（或 npm run station:update）。`);
  }
  return manifest;
}
async function generateDrawings() {
  const initial = await fingerprintDrawings();
  const { build } = await import('vite');
  const { chromium } = await import('playwright');
  const root = fileURLToPath(new URL('.', import.meta.url));
  const temporary = await mkdtemp(join(tmpdir(), 'station-drawing-'));
  const output = join(projectRoot, 'public/station-drawings');
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
    await new Promise((accept, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', accept); });
    browser = await chromium.launch({ headless: true,
      ...(process.env.STATION_BROWSER_PATH ? { executablePath: process.env.STATION_BROWSER_PATH } : {}),
      args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    await publishAssets(output, async staged => {
      const page = await browser.newPage({ viewport: { width: drawingViews[0].width, height: drawingViews[0].height }, deviceScaleFactor: 1 });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
      try {
        await page.goto(`http://127.0.0.1:${server.address().port}`, { waitUntil: 'networkidle' });
        await page.waitForFunction(() => document.documentElement.dataset.ready === 'true', { timeout: 30000 });
        const manifest = { ...initial, images: {} };
        for (const view of drawingViews) {
          let bytes;
          if (view.name === 'overview') bytes = await page.screenshot({ path: join(staged, view.file) });
          else {
            // Element screenshots include overlapping siblings. Hide annotations.
            await page.addStyleTag({ content: '#annotations, header, footer { visibility: hidden; }' });
            const drawing = page.locator('#drawing');
            const bounds = await drawing.boundingBox();
            if (bounds?.width !== view.width || bounds?.height !== view.height) throw new Error('线稿捕获尺寸与配置不一致');
            bytes = await drawing.screenshot({ path: join(staged, view.file) });
          }
          manifest.images[view.name] = { ...view, sha256: digest(bytes), bytes: bytes.length };
          console.log(`${view.file}: ${view.width}×${view.height}, ${(bytes.length / 1024).toFixed(1)} KiB`);
        }
        if (errors.length) throw new Error(errors.join('\n'));
        if ((await fingerprintDrawings()).fingerprint !== initial.fingerprint) throw new Error('捕获期间源码发生变化，已保留原线稿；请重新生成');
        await writeFile(join(staged, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
      } finally { await page.close(); }
    });
  } finally {
    await browser?.close();
    if (server) await new Promise(accept => server.close(accept));
    await rm(temporary, { recursive: true, force: true });
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    if (process.argv.includes('--check')) { await checkDrawings(); console.log('空间站线稿与当前模型一致。'); }
    else await generateDrawings();
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
