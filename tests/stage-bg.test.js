// painted stage backgrounds cover the whole view at every zoom and scroll (headless Chrome through the real scene; tools/stage-bg-check.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const PORT = process.env.PORT || 5173;

test('painted stage backgrounds cover the whole view at every zoom and scroll', async () => {
  const up = await fetch(`http://127.0.0.1:${PORT}/`).then((r) => r.ok).catch(() => false);
  assert.ok(up, `dev server not reachable on ${PORT}`);
  const r = spawnSync('node', ['tools/stage-bg-check.mjs'], { env: { ...process.env, PORT: String(PORT) }, encoding: 'utf8', timeout: 240000 });
  assert.equal(r.status, 0, r.stdout + r.stderr);
});
