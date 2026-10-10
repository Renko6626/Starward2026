import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRenderQuality } from '../src/app/components/station/render-quality.js';

function samples(quality, start, step, count) {
  let scale;
  for (let i = 0; i <= count; i++) scale = quality.sample(start + step * i);
  return scale;
}

test('full quality stays unchanged at the intended 30 FPS', () => {
  const quality = createRenderQuality();
  assert.equal(samples(quality, 0, 1000 / 30, 600), 1);
});

test('sustained slow rendering lowers resolution with a bounded floor', () => {
  const quality = createRenderQuality();
  assert.equal(samples(quality, 0, 50, 40), .85);
  assert.equal(samples(quality, 2050, 50, 600), .6);
});

test('quality recovers slowly after performance improves', () => {
  const quality = createRenderQuality();
  assert.equal(samples(quality, 0, 50, 40), .85);
  quality.reset();
  assert.equal(samples(quality, 3000, 1000 / 30, 120), .85);
  assert.equal(samples(quality, 7034, 1000 / 30, 130), 1);
});

test('pausing and isolated stalls do not count as sustained slow rendering', () => {
  const quality = createRenderQuality();
  samples(quality, 0, 50, 20);
  quality.reset();
  assert.equal(samples(quality, 10000, 1000 / 30, 100), 1);
  assert.equal(samples(quality, 60000, 1000 / 30, 100), 1);
});
