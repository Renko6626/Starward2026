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
  { name: 'assembly', file: 'assembly.svg', width: 1120, height: 930, view: 'side' },
  { name: 'endView', file: 'end-view.svg', width: 1120, height: 930, view: 'front' },
  { name: 'docking', file: 'docking.svg', width: 1120, height: 650, view: 'dock' },
  { name: 'propulsion', file: 'propulsion.svg', width: 1120, height: 650, view: 'aft' },
];
const drawingFontPath = 'src/assets/fonts/ibm-plex-mono-400.woff2';
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
  files.push(join(root, drawingFontPath));
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
  const fontBase64 = (await readFile(join(projectRoot, drawingFontPath))).toString('base64');
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
        const pathname = new URL(request.url, 'http://localhost').pathname;
        const path = resolve(temporary, '.' + (pathname === '/' ? '/index.html' : pathname));
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
          if (view.view) {
            await page.goto(`http://127.0.0.1:${server.address().port}/?view=${view.view}`, { waitUntil: 'networkidle' });
            await page.waitForFunction(() => document.documentElement.dataset.ready === 'true', { timeout: 30000 });
            const geometry = await page.locator('#page-sheet').innerHTML();
            await page.addStyleTag({ content: '#annotations, header, footer { visibility: hidden; }' });
            const raster = await page.locator('#drawing').screenshot();
            const viewTop = view.height === 650 ? 240 : 100;
            const frameTop = view.height === 650 ? 280 : 145;
            const frameHeight = view.height === 650 ? 530 : 850;
            bytes = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="200 ${viewTop} 1120 ${view.height}" width="1120" height="${view.height}">
<style>
@font-face{font-family:"IBM Plex Mono";font-style:normal;font-weight:400;src:url("data:font/woff2;base64,${fontBase64}") format("woff2")}
svg{background:#090909}text{font-family:"IBM Plex Mono",monospace;font-weight:400;fill:#81949c;text-anchor:middle}
.frame,.zone-tick{fill:none;stroke:#637984;stroke-width:1.2}.coordinate{font-size:23px}
.datum{fill:none;stroke:#536f7d;stroke-width:1;stroke-dasharray:18 5 3 5}
.dimension,.dimension path{fill:none;stroke:#a8bec9;stroke-width:1.3}.extension{opacity:.55}
.dimension text,.dimension-label{fill:#b7cbd5;stroke:none;font-size:27px;paint-order:stroke;stroke:#090909;stroke-width:7px;stroke-linejoin:round}
.leader path,.leader circle{fill:none;stroke:#8da7b4;stroke-width:1.2}.leader text{font-size:23px;fill:#a8bec9}
.detail-boundary{fill:none;stroke:#6c8795;stroke-width:1;stroke-dasharray:10 5}.view-ref{font-size:23px;fill:#bacbd3}
.scale{fill:none;stroke:#81949c;stroke-width:1.4}.scale-label,.unit-label{font-size:20px}
</style>
<defs><clipPath id="drawing-clip"><rect x="240" y="${frameTop}" width="1050" height="${frameHeight}"/></clipPath></defs>
<image clip-path="url(#drawing-clip)" href="data:image/png;base64,${raster.toString('base64')}" x="170" y="140" width="1260" height="850"/>
${geometry}</svg>`);
            await writeFile(join(staged, view.file), bytes);
          } else if (view.name === 'overview') bytes = await page.screenshot({ path: join(staged, view.file) });
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
