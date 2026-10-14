import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { resolveGamePath } from '../server.js';

test('resolveGamePath keeps nested assets inside the root', () => {
  const root = path.resolve('game-root');
  const file = resolveGamePath(root, '/src/main.js');
  assert.ok(file);
  assert.equal(file, path.resolve(root, 'src', 'main.js'));
});

test('resolveGamePath maps / to index.html callers via explicit path', () => {
  const root = path.resolve('game-root');
  const file = resolveGamePath(root, '/index.html');
  assert.equal(file, path.resolve(root, 'index.html'));
});

test('resolveGamePath drops .. segments so requests cannot leave the root', () => {
  const root = path.resolve('game-root');
  // Old Windows bug used startsWith(root + '/'), which 403'd valid files.
  // Dropping ".." keeps every resolved path inside root instead.
  const sneaky = resolveGamePath(root, '/foo/../../secret.txt');
  assert.equal(sneaky, path.resolve(root, 'foo', 'secret.txt'));
  assert.ok(!path.relative(root, sneaky).startsWith('..'));
});

test('windows path.relative accepts backslash roots the old prefix check rejected', () => {
  const root = 'C:\\Users\\Ben\\AppData\\Local\\Programs\\atomic-knockout\\resources\\game';
  const filePath = path.win32.resolve(root, 'index.html');
  const rootPrefix = `${root}/`; // the buggy check
  assert.equal(filePath.startsWith(rootPrefix), false);
  const fromRoot = path.win32.relative(root, filePath);
  assert.equal(fromRoot, 'index.html');
  assert.equal(path.win32.isAbsolute(fromRoot), false);
});
