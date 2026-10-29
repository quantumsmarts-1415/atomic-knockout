// Headless: a match plays its stage's track (needs the dev server on PORT, like the campaign checks).
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const PORT = process.env.PORT || 5173;

test('fight mode: the stage track plays during a match and stops after it', async () => {
  const up = await fetch(`http://127.0.0.1:${PORT}/`).then((r) => r.ok).catch(() => false);
  assert.ok(up, `dev server not reachable on ${PORT}`);
  const r = spawnSync('node', ['tools/stage-music-check.mjs'], { env: { ...process.env, PORT: String(PORT) }, encoding: 'utf8', timeout: 170000 });
  assert.equal(r.status, 0, r.stdout + r.stderr);
});
