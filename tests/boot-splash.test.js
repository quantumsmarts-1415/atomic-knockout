import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('index splash stays until __akUiReady and catches module failures', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /__akUiReady/);
  assert.match(html, /data-boot-status/);
  assert.match(html, /await import\('\/src\/main\.js'\)/);
  assert.match(html, /boot-splash-detail/);
  assert.match(html, /\/vendor\/phaser\.esm\.js/);
  assert.doesNotMatch(html, /querySelector\('#game canvas'\)/);
});

test('publish ships Phaser under vendor/ not node_modules/', () => {
  const pub = readFileSync(new URL('../tools/publish.mjs', import.meta.url), 'utf8');
  assert.match(pub, /vendor\/phaser\.esm\.js/);
  assert.match(pub, /electron-builder strips any `node_modules`/);
});

test('desktop shell forces Canvas renderer for Electron', () => {
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(main, /isElectronShell\(\)/);
  assert.match(main, /Phaser\.CANVAS/);
});

test('TitleScene dismisses the HTML splash after painting', () => {
  const title = readFileSync(new URL('../src/scenes/TitleScene.js', import.meta.url), 'utf8');
  assert.match(title, /hideBootSplash/);
  assert.match(title, /TITLE_DISPLAY/);
});
