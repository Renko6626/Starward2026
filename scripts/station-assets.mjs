import { createHash } from 'node:crypto';
import { readFile, readdir, mkdir, mkdtemp, rename, rm, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { stationViews, captureQuality } from '../src/app/components/station/config.js';

export const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = join(projectRoot, 'public/station');
const sourceDirectories = ['experiments/station/ring-romantic/src', 'src/app/components/station', 'scripts/station-capture'];

async function filesUnder(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const children = await Promise.all(entries.map(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [path];
  }));
  return children.flat();
}
export async function fingerprint(root = projectRoot) {
  const files = (await Promise.all(sourceDirectories.map(path => filesUnder(join(root, path))))).flat()
    .filter(path => !path.endsWith('StationBackdrop.tsx') && !path.endsWith('.d.ts'));
  files.push(join(root, 'scripts/station-assets.mjs'));
  const hash = createHash('sha256');
  for (const file of files.sort()) {
    hash.update(relative(root, file).split(sep).join('/'));
    hash.update('\0'); hash.update(await readFile(file)); hash.update('\0');
  }
  const lock = JSON.parse(await readFile(join(root, 'package-lock.json'), 'utf8'));
  const dependencies = Object.fromEntries(['three', 'vite', 'playwright'].map(name => [name, lock.packages[`node_modules/${name}`].version]));
  hash.update(JSON.stringify(dependencies));
  return { fingerprint: hash.digest('hex'), dependencies };
}
async function readAsset(file) {
  try { return await readFile(file); }
  catch (error) {
    if (error.code === 'ENOENT') throw new Error(`鸟船预览缺失：${file}，请运行 npm run station:assets。`);
    throw error;
  }
}
export async function checkAssets(root = projectRoot) {
  const destination = join(root, 'public/station');
  const expected = await fingerprint(root);
  const manifest = JSON.parse((await readAsset(join(destination, 'manifest.json'))).toString());
  if (manifest.fingerprint !== expected.fingerprint) throw new Error('鸟船静态预览已过期，请运行 npm run station:assets。');
  for (const view of stationViews) {
    const file = join(destination, view.file);
    const data = await readAsset(file);
    if (!data.length || manifest.images?.[view.name]?.sha256 !== createHash('sha256').update(data).digest('hex')) {
      throw new Error(`鸟船预览缺失或损坏：${view.file}，请运行 npm run station:assets。`);
    }
  }
  return manifest;
}
// Generate the entire replacement before changing the published directory.
export async function publishAssets(destination, generate) {
  await mkdir(dirname(destination), { recursive: true });
  const temporary = await mkdtemp(join(dirname(destination), '.station-assets-'));
  const staged = join(temporary, 'next'), backup = join(temporary, 'previous');
  await mkdir(staged);
  let previous = false;
  try {
    await generate(staged);
    try { await stat(destination); previous = true; } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (previous) await rename(destination, backup);
    try { await rename(staged, destination); }
    catch (error) { if (previous) await rename(backup, destination); throw error; }
  } finally { await rm(temporary, { recursive: true, force: true }); }
}
async function serve(directory) {
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://localhost');
      const path = resolve(directory, `.${decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)}`);
      if (!path.startsWith(`${directory}${sep}`)) { response.writeHead(403).end(); return; }
      const data = await readFile(path);
      response.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' })[extname(path)] || 'application/octet-stream');
      response.end(data);
    } catch { response.writeHead(404).end(); }
  });
  await new Promise((accept, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', accept); });
  return { url: `http://127.0.0.1:${server.address().port}`, close: () => new Promise(accept => server.close(accept)) };
}
async function generateAssets() {
  const initial = await fingerprint();
  const { build } = await import('vite');
  const { chromium } = await import('playwright');
  const work = await mkdtemp(join(projectRoot, '.station-build-'));
  let service, browser;
  try {
    const directory = join(work, 'dist');
    await build({ configFile: false, root: join(projectRoot, 'scripts/station-capture'),
      resolve: { dedupe: ['three'] }, logLevel: 'warn', build: { outDir: directory, emptyOutDir: true } });
    service = await serve(directory);
    browser = await chromium.launch({ headless: true,
      ...(process.env.STATION_BROWSER_PATH ? { executablePath: process.env.STATION_BROWSER_PATH } : {}),
      args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    await publishAssets(output, async staged => {
      const manifest = { ...initial, images: {} };
      for (const view of stationViews) {
        const scale = view.name === 'mobile' ? 2 : 1;
        const page = await browser.newPage({ viewport: { width: view.width / scale, height: view.height / scale }, deviceScaleFactor: scale, reducedMotion: 'reduce' });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
        try {
          await page.goto(service.url, { waitUntil: 'networkidle' });
          await page.waitForFunction(() => document.querySelector('#capture')?.dataset.ready === 'true', { timeout: 30000 });
          if (errors.length) throw new Error(errors.join('\n'));
          const bytes = await page.screenshot({ type: 'jpeg', quality: captureQuality, path: join(staged, view.file), scale: 'device' });
          manifest.images[view.name] = { file: view.file, width: view.width, height: view.height, sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length };
          console.log(`${view.file}: ${view.width}×${view.height}, ${(bytes.length / 1024).toFixed(1)} KiB`);
        } finally { await page.close(); }
      }
      if ((await fingerprint()).fingerprint !== initial.fingerprint) throw new Error('捕获期间源码发生变化，已保留原预览；请重新生成。');
      await import('node:fs/promises').then(({ writeFile }) => writeFile(join(staged, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n'));
    });
  } finally {
    await browser?.close(); await service?.close(); await rm(work, { recursive: true, force: true });
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    if (process.argv.includes('--check')) { await checkAssets(); console.log('鸟船预览与当前场景一致。'); }
    else await generateAssets();
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
