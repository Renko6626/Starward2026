import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, cp, rm, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { projectRoot } from './station-assets.mjs';
import { fingerprintDrawings, checkDrawings } from '../experiments/station/technical-study/capture.mjs';

test('drawing check rejects changed model or renderer, corrupted and missing outputs', async () => {
  const root = await mkdtemp(join(tmpdir(), 'station-drawings-check-'));
  try {
    for (const directory of ['experiments/station/ring-romantic/src', 'experiments/station/technical-study']) {
      await cp(join(projectRoot, directory), join(root, directory), { recursive: true });
    }
    await mkdir(join(root, 'src/assets/fonts'), { recursive: true });
    await cp(join(projectRoot, 'src/assets/fonts/ibm-plex-mono-400.woff2'), join(root, 'src/assets/fonts/ibm-plex-mono-400.woff2'));
    await cp(join(projectRoot, 'package-lock.json'), join(root, 'package-lock.json'));
    const destination = join(root, 'public/station-drawings');
    await mkdir(destination, { recursive: true });
    const manifest = { ...await fingerprintDrawings(root), images: {} };
    for (const [name, file, width, height] of [
      ['overview', 'overview.png', 1600, 1100],
      ['sideElevation', 'side-elevation.png', 1260, 850],
      ['assembly', 'assembly.svg', 1120, 930],
      ['endView', 'end-view.svg', 1120, 930],
      ['docking', 'docking.svg', 1120, 650],
      ['propulsion', 'propulsion.svg', 1120, 650],
    ]) {
      const bytes = Buffer.from(`drawing ${name}`);
      await writeFile(join(destination, file), bytes);
      manifest.images[name] = { width, height, sha256: createHash('sha256').update(bytes).digest('hex') };
    }
    await writeFile(join(destination, 'manifest.json'), JSON.stringify(manifest));
    await checkDrawings(root);
    for (const source of ['experiments/station/ring-romantic/src/station-ring.js', 'experiments/station/technical-study/main.js', 'src/assets/fonts/ibm-plex-mono-400.woff2']) {
      const file = join(root, source), previous = await readFile(file);
      await writeFile(file, '// changed source');
      await assert.rejects(checkDrawings(root), /过期.*station:drawings/);
      await writeFile(file, previous);
    }
    await writeFile(join(destination, 'side-elevation.png'), 'corrupted');
    await assert.rejects(checkDrawings(root), /损坏.*side-elevation/);
    await unlink(join(destination, 'overview.png'));
    await assert.rejects(checkDrawings(root), /缺失.*station:drawings/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
