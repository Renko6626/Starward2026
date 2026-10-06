import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, cp, rm, readdir, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { projectRoot, fingerprint, checkAssets, publishAssets } from './station-assets.mjs';

test('failed generation keeps both previous previews and the manifest', async () => {
  const root = await mkdtemp(join(tmpdir(), 'station-publish-'));
  const target = join(root, 'station');
  try {
    await mkdir(target);
    for (const file of ['desktop.jpg', 'mobile.jpg', 'manifest.json']) await writeFile(join(target, file), `previous ${file}`);
    await assert.rejects(publishAssets(target, async staged => {
      await writeFile(join(staged, 'desktop.jpg'), 'new desktop');
      throw new Error('mobile capture failed');
    }), /mobile capture failed/);
    for (const file of ['desktop.jpg', 'mobile.jpg', 'manifest.json']) assert.equal(await readFile(join(target, file), 'utf8'), `previous ${file}`);
    assert.deepEqual(await readdir(root), ['station']);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('preview check rejects changed model source and corrupted images', async () => {
  const root = await mkdtemp(join(tmpdir(), 'station-fingerprint-'));
  try {
    for (const directory of ['experiments/station/ring-romantic/src', 'src/app/components/station', 'scripts/station-capture']) {
      await cp(join(projectRoot, directory), join(root, directory), { recursive: true });
    }
    await cp(join(projectRoot, 'scripts/station-assets.mjs'), join(root, 'scripts/station-assets.mjs'));
    await cp(join(projectRoot, 'package-lock.json'), join(root, 'package-lock.json'));
    const destination = join(root, 'public/station'); await mkdir(destination, { recursive: true });
    const manifest = { ...await fingerprint(root), images: {} };
    for (const name of ['desktop', 'mobile']) {
      const bytes = Buffer.from(`preview ${name}`);
      await writeFile(join(destination, `${name}.jpg`), bytes);
      manifest.images[name] = { sha256: createHash('sha256').update(bytes).digest('hex') };
    }
    await writeFile(join(destination, 'manifest.json'), JSON.stringify(manifest));
    await checkAssets(root);
    await writeFile(join(destination, 'desktop.jpg'), 'corrupted');
    await assert.rejects(checkAssets(root), /损坏/);
    await unlink(join(destination, 'desktop.jpg'));
    await assert.rejects(checkAssets(root), /缺失.*npm run station:assets/);
    await writeFile(join(destination, 'desktop.jpg'), 'preview desktop');
    await writeFile(join(root, 'experiments/station/ring-romantic/src/station-ring.js'), '// changed station');
    await assert.rejects(checkAssets(root), /过期/);
    await unlink(join(destination, 'manifest.json'));
    await assert.rejects(checkAssets(root), /缺失.*npm run station:assets/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
