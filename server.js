// Static file server + phone-controller relay.
// The game is plain ES modules; index.html maps the bare "phaser" import to
// the local phaser dist file, so no build step is needed at all. The one
// real dependency is "ws" (pure JS, installs in seconds — unlike Vite's
// native deps, which is why this project has no bundler at all).
// Run with: npm run dev  (then open http://localhost:5173)
import http from 'node:http';
import os from 'node:os';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';

const root = fileURLToPath(new URL('.', import.meta.url));
const PORT = process.env.PORT || 5173;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
};

function lanIp() {
  for (const iface of Object.values(os.networkInterfaces())) {
    for (const addr of iface ?? []) {
      if (addr.family === 'IPv4' && !addr.internal) return addr.address;
    }
  }
  return 'localhost';
}

const server = http.createServer(async (req, res) => {
  try {
    // dev-only helper: lets in-browser art tooling save processed PNGs
    // back into art-src (e.g. background removal on AI renders)
    if (req.method === 'POST' && req.url.startsWith('/save-art')) {
      const name = (new URL(req.url, 'http://x').searchParams.get('name') || '')
        .replace(/[^a-z0-9-]/gi, '');
      if (!name) { res.writeHead(400).end('bad name'); return; }
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const { writeFile, mkdir } = await import('node:fs/promises');
      await mkdir(join(root, 'art-src'), { recursive: true });
      await writeFile(join(root, 'art-src', `${name}.png`), Buffer.concat(chunks));
      res.writeHead(200).end('saved');
      return;
    }
    if (req.method === 'GET' && req.url === '/lan-ip') {
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ ip: lanIp(), port: PORT }));
      return;
    }
    let urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (urlPath === '/') urlPath = '/index.html';
    if (urlPath === '/controller') urlPath = '/controller.html';
    const filePath = normalize(join(root, urlPath));
    if (!filePath.startsWith(root)) {
      res.writeHead(403).end('Forbidden');
      return;
    }
    const data = await readFile(filePath);
    res.writeHead(200, {
      'Content-Type': MIME[extname(filePath).toLowerCase()] ?? 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  } catch {
    res.writeHead(404).end('Not found');
  }
});

server.listen(PORT, () => {
  console.log(`Atomic Knockout running at http://localhost:${PORT}`);
  console.log(`Phones on the same WiFi: http://${lanIp()}:${PORT}/controller`);
});

// ---------------------------------------------------------------------------
// Phone controller relay (Phase 3). One browser tab is the "host" (the actual
// game); up to 4 phones connect as "controllers" and get assigned player
// slots 2-5 (slots 0/1 are always the two local keyboard players). The
// server just relays JSON input messages from controllers to the host —
// all game logic lives in the browser, this is a dumb pipe.
// ---------------------------------------------------------------------------
const wss = new WebSocketServer({ server, path: '/ws' });
const MAX_CONTROLLERS = 4;
let hostWs = null;
const controllers = new Map(); // ws -> { slot, name }

function sendJSON(ws, obj) {
  if (ws && ws.readyState === ws.OPEN) ws.send(JSON.stringify(obj));
}

function broadcastRoster() {
  const roster = [...controllers.values()].sort((a, b) => a.slot - b.slot);
  sendJSON(hostWs, { type: 'roster', controllers: roster });
}

wss.on('connection', (ws, req) => {
  const { searchParams } = new URL(req.url, 'http://x');
  const role = searchParams.get('role');

  if (role === 'host') {
    hostWs = ws;
    broadcastRoster();
    ws.on('close', () => { if (hostWs === ws) hostWs = null; });
    return;
  }

  // role === 'controller' (a phone)
  if (controllers.size >= MAX_CONTROLLERS) {
    sendJSON(ws, { type: 'full' });
    ws.close();
    return;
  }
  const used = new Set([...controllers.values()].map((c) => c.slot));
  let slot = 2;
  while (used.has(slot)) slot += 1;
  const name = (searchParams.get('name') || '').slice(0, 16).trim() || `Player ${slot + 1}`;
  controllers.set(ws, { slot, name });
  sendJSON(ws, { type: 'assigned', slot, label: `P${slot + 1}` });
  broadcastRoster();

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    if (msg.type !== 'input') return;
    sendJSON(hostWs, {
      type: 'input',
      slot,
      left: !!msg.left, right: !!msg.right, up: !!msg.up, down: !!msg.down,
      confirm: !!msg.confirm, back: !!msg.back,
    });
  });

  ws.on('close', () => {
    controllers.delete(ws);
    broadcastRoster();
  });
});
