// campaign close-up: blended ground, no impact FX on a miss, HP bar starts at the pre-hit value (headless Chrome through the real scene; tools/campaign-closeup-check.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const PORT = process.env.PORT || 5173;

test('campaign close-up: blended ground, no impact FX on a miss, HP bar starts at the pre-hit value', async () => {
  const up = await fetch(`http://127.0.0.1:${PORT}/`).then((r) => r.ok).catch(() => false);
  assert.ok(up, `dev server not reachable on ${PORT}`);
  const r = spawnSync('node', ['tools/campaign-closeup-check.mjs'], { env: { ...process.env, PORT: String(PORT) }, encoding: 'utf8', timeout: 260000 });
  assert.equal(r.status, 0, r.stdout + r.stderr);
});
