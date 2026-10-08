// Client-side QR images. qrcode-generator runs locally — no network call —
// so a phone on the same WiFi can be pointed at a host that is offline from
// the public internet.
import { qrcode } from 'qrcode-generator';

/** Boolean module grid (true = dark), error correction M, smallest version that fits. */
export function qrModules(text) {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  const cells = [];
  for (let r = 0; r < n; r++) {
    const row = new Array(n);
    for (let c = 0; c < n; c++) row[c] = qr.isDark(r, c);
    cells.push(row);
  }
  return cells;
}

/**
 * PNG data URL of `text`, drawn near `targetPx` on a side (quiet zone included).
 * Browser only — the host screen paints this into the Phaser canvas.
 */
export function qrPngDataUrl(text, targetPx) {
  const cells = qrModules(text);
  const n = cells.length;
  const margin = 4;
  const total = n + margin * 2;
  const cell = Math.max(3, Math.ceil(targetPx / total));
  const size = total * cell;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#000000';
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!cells[r][c]) continue;
      ctx.fillRect((c + margin) * cell, (r + margin) * cell, cell, cell);
    }
  }
  return canvas.toDataURL('image/png');
}
