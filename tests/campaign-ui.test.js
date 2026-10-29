// campaign UI: long move names fit the menu, CHARGING tag, SKIP chip, back-line picking, enemies not dimmed, range notes (headless Chrome through the real scene; tools/campaign-ui-check.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const PORT = process.env.PORT || 5173;

test('campaign UI: long move names fit the menu, CHARGING tag, SKIP chip, back-line picking, enemies not dimmed, range notes', async () => {
  const up = await fetch(`http://127.0.0.1:${PORT}/`).then((r) => r.ok).catch(() => false);
  assert.ok(up, `dev server not reachable on ${PORT}`);
  const r = spawnSync('node', ['tools/campaign-ui-check.mjs'], { env: { ...process.env, PORT: String(PORT) }, encoding: 'utf8', timeout: 260000 });
  assert.equal(r.status, 0, r.stdout + r.stderr);
});
