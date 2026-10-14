import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { startGameServer } from '../server.js';

test('startGameServer serves index from a custom root and closes cleanly', async () => {
  const root = mkdtempSync(join(tmpdir(), 'ak-server-'));
  writeFileSync(join(root, 'index.html'), '<!doctype html><title>ok</title>');
  const game = await startGameServer({
    root,
    host: '127.0.0.1',
    port: 0,
    allowSaveArt: false,
  });
  try {
    assert.ok(game.port > 0);
    const res = await fetch(`http://127.0.0.1:${game.port}/`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /<title>ok<\/title>/);
  } finally {
    await game.close();
    rmSync(root, { recursive: true, force: true });
  }
});
