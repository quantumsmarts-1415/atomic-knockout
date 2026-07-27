// Tiny zero-dependency static file server — replaces a bundler for now.
// The game is plain ES modules; index.html maps the bare "phaser" import to
// the local phaser dist file, so no build step is needed at all.
// Run with: npm run dev  (then open http://localhost:5173)
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

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

http.createServer(async (req, res) => {
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
    let urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (urlPath === '/') urlPath = '/index.html';
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
}).listen(PORT, () => {
  console.log(`Periodic Table Game running at http://localhost:${PORT}`);
});
