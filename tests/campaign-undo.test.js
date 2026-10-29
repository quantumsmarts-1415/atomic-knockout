// Back / Esc / B / right-click undo a move until an action is confirmed (headless Chrome through the real scene).
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const PORT = process.env.PORT || 5173;

test('campaign: cancel steps back out of target, action menu and move without losing the origin tile', async () => {
  const up = await fetch(`http://127.0.0.1:${PORT}/`).then((r) => r.ok).catch(() => false);
  assert.ok(up, `dev server not reachable on ${PORT}`);
  const r = spawnSync('node', ['tools/campaign-undo-check.mjs'], { env: { ...process.env, PORT: String(PORT) }, encoding: 'utf8', timeout: 170000 });
  assert.equal(r.status, 0, r.stdout + r.stderr);
});
