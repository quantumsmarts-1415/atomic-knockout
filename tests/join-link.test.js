import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import {
  LOCAL_SERVER_REQUIRED,
  buildControllerPageUrl,
  isLoopbackHost,
  phoneJoinLabel,
  resolveControllerLink,
} from '../src/net/joinLink.js';
import { qrModules } from '../src/net/qrCode.js';

const require = createRequire(import.meta.url);
const jsQR = require('jsqr');

const LAN = { ip: '192.168.1.42', port: 5173 };

test('loopback hosts are the ones a phone cannot open', () => {
  assert.equal(isLoopbackHost('localhost'), true);
  assert.equal(isLoopbackHost('LOCALHOST'), true);
  assert.equal(isLoopbackHost('127.0.0.1'), true);
  assert.equal(isLoopbackHost('127.0.0.2'), true);
  assert.equal(isLoopbackHost('[::1]'), true);
  assert.equal(isLoopbackHost('::1'), true);
  assert.equal(isLoopbackHost('192.168.1.42'), false);
  assert.equal(isLoopbackHost('easy-cobra.runlocal.eu'), false);
});

test('localhost falls back to the server LAN address', () => {
  const url = buildControllerPageUrl({
    pageUrl: 'http://localhost:5173/',
    lanIp: LAN.ip,
    lanPort: LAN.port,
  });
  assert.equal(url, 'http://192.168.1.42:5173/controller');
});

test('127.0.0.1 and ipv6 loopback fall back to the server LAN address', () => {
  for (const pageUrl of ['http://127.0.0.1:5173/index.html', 'http://[::1]:5173/']) {
    const url = buildControllerPageUrl({ pageUrl, lanIp: LAN.ip, lanPort: LAN.port });
    assert.equal(url, 'http://192.168.1.42:5173/controller');
  }
});

test('a public tunnel origin is kept and the LAN IP is ignored', () => {
  const url = buildControllerPageUrl({
    pageUrl: 'https://easy-cobra.runlocal.eu/play?room=nope#top',
    lanIp: LAN.ip,
    lanPort: LAN.port,
  });
  assert.equal(url, 'https://easy-cobra.runlocal.eu/controller');
});

test('an explicit public port stays on the page origin', () => {
  const url = buildControllerPageUrl({
    pageUrl: 'https://easy-cobra.runlocal.eu:8443/game',
    lanIp: LAN.ip,
    lanPort: 5173,
  });
  assert.equal(url, 'https://easy-cobra.runlocal.eu:8443/controller');
});

test('a page already opened on a LAN IP keeps that origin', () => {
  const url = buildControllerPageUrl({
    pageUrl: 'http://10.0.0.8:5173/',
    lanIp: '192.168.1.42',
    lanPort: 9999,
  });
  assert.equal(url, 'http://10.0.0.8:5173/controller');
});

test('loopback with no reachable LAN address still uses the current origin', () => {
  const url = buildControllerPageUrl({
    pageUrl: 'http://localhost:5173/index.html',
    lanIp: 'localhost',
    lanPort: 5173,
  });
  assert.equal(url, 'http://localhost:5173/controller');
});

test('the controller URL has no query — opening it is the whole join', () => {
  const url = buildControllerPageUrl({
    pageUrl: 'http://localhost:5173/?room=IGNORED',
    lanIp: LAN.ip,
    lanPort: LAN.port,
  });
  assert.equal(new URL(url).search, '');
  assert.equal(new URL(url).pathname, '/controller');
});

test('the on-screen label and the QR payload are the same URL', () => {
  const link = resolveControllerLink({
    pageUrl: 'https://easy-cobra.runlocal.eu/',
    lan: LAN,
  });
  assert.equal(link.available, true);
  assert.equal(link.url, 'https://easy-cobra.runlocal.eu/controller');
  assert.equal(link.label, phoneJoinLabel(link.url));
  assert.ok(link.label.includes(link.url));
});

test('localhost label uses the LAN controller URL, not the page host', () => {
  const link = resolveControllerLink({ pageUrl: 'http://127.0.0.1:5173/', lan: LAN });
  assert.equal(link.url, 'http://192.168.1.42:5173/controller');
  assert.equal(link.label, 'Phones: open http://192.168.1.42:5173/controller on the same WiFi');
});

test('missing server advertisement hides phone join instead of inventing a URL', () => {
  for (const lan of [null, undefined, {}, { ip: '' }, { port: 5173 }]) {
    const link = resolveControllerLink({ pageUrl: 'https://atomic-knockout.netlify.app/', lan });
    assert.equal(link.available, false);
    assert.equal(link.url, null);
    assert.equal(link.label, LOCAL_SERVER_REQUIRED);
  }
});

function decodeQr(text) {
  const cells = qrModules(text);
  const n = cells.length;
  const margin = 4;
  const scale = 4;
  const size = (n + margin * 2) * scale;
  const data = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const col = Math.floor(x / scale) - margin;
      const row = Math.floor(y / scale) - margin;
      const dark = row >= 0 && col >= 0 && row < n && col < n && cells[row][col];
      const i = (y * size + x) * 4;
      const v = dark ? 0 : 255;
      data[i] = data[i + 1] = data[i + 2] = v;
      data[i + 3] = 255;
    }
  }
  const found = jsQR(data, size, size);
  return found ? found.data : null;
}

test('the QR encodes the controller URL and nothing else', () => {
  for (const url of [
    'http://192.168.1.42:5173/controller',
    'https://easy-cobra.runlocal.eu/controller',
  ]) {
    assert.equal(decodeQr(url), url);
  }
});
