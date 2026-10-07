import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// Load and screenshot only: no clicks, form filling, or interaction testing.
const output = fileURLToPath(new URL('./previews/', import.meta.url));
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];
try {
  for (const [name, width, height] of [['desktop', 1440, 1000], ['mobile', 390, 844]]) {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
    page.on('pageerror', error => errors.push(`${name}: ${error.message}`));
    page.on('console', message => { if (message.type() === 'error') errors.push(`${name}: ${message.text()}`); });
    await page.goto('http://127.0.0.1:26107/?static', { waitUntil: 'networkidle' });
    await page.waitForFunction(() => document.documentElement.dataset.ready === 'true', { timeout: 30000 });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: `${output}${name}.png` });
    await page.screenshot({ path: `${output}${name}-full.png`, fullPage: true });
    console.log(`${name}: ${width}×${height}; viewport and full-page screenshots saved`);
    await page.close();
  }
  if (errors.length) throw new Error(errors.join('\n'));
  console.log('No page or console errors during screenshot capture.');
} finally { await browser.close(); }
