// Chapter 2 in headless Chrome: seize hint, the throne boss never leaves its tile, Van's idle facing, and Scarlett's cut-out rocket (tools/campaign-ch2-check.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const PORT = process.env.PORT || 5173;

test('campaign ch2: seize hint, throne boss stays put, Van idle facing, Scarlett rocket cut-out', async () => {
  const up = await fetch(`http://127.0.0.1:${PORT}/`).then((r) => r.ok).catch(() => false);
  assert.ok(up, `dev server not reachable on ${PORT}`);
  const r = spawnSync('node', ['tools/campaign-ch2-check.mjs'], { env: { ...process.env, PORT: String(PORT) }, encoding: 'utf8', timeout: 400000 });
  assert.equal(r.status, 0, r.stdout + r.stderr);
});
