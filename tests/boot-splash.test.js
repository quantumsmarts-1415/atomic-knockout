import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('index splash stays until __akUiReady, not merely canvas creation', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /__akUiReady/);
  assert.match(html, /data-boot-status/);
  assert.doesNotMatch(html, /querySelector\('#game canvas'\)/);
});

test('desktop shell forces Canvas renderer for Electron', () => {
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(main, /isElectronShell\(\)/);
  assert.match(main, /Phaser\.CANVAS/);
});
