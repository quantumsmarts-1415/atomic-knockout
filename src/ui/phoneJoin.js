import * as Phaser from 'phaser';
import { LOCAL_SERVER_REQUIRED, resolveControllerLink } from '../net/joinLink.js';
import { qrPngDataUrl } from '../net/qrCode.js';
import { FONT_BODY, FONT_MONO, THEME } from './theme.js';

function loadHtmlImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('QR image failed to load'));
    image.src = src;
  });
}

/**
 * Rings around the QR so the white code reads as a reactor core, not a sticker.
 * The code itself stays black-on-white so it still scans.
 */
function drawReactorBezel(scene, x, y, size, depth) {
  const g = scene.add.graphics().setDepth(depth);
  const outer = size / 2 + 34;
  g.lineStyle(1.25, THEME.pink, 0.55);
  g.strokeCircle(x, y, outer + 16);
  g.lineStyle(2, THEME.teal, 0.9);
  g.strokeCircle(x, y, outer);
  g.lineStyle(1.5, THEME.gold, 0.75);
  g.strokeCircle(x, y, size / 2 + 10);
  g.fillStyle(0xffffff, 1);
  g.fillRoundedRect(x - size / 2 - 8, y - size / 2 - 8, size + 16, size + 16, 10);
  g.fillStyle(THEME.teal, 1);
  g.fillCircle(x + outer * 0.72, y - outer * 0.62, 5);
  g.fillStyle(THEME.pink, 1);
  g.fillCircle(x - outer * 0.78, y + outer * 0.28, 4);
  return g;
}

/**
 * Fetch /lan-ip, then draw a scannable QR for the controller URL.
 *
 * `x`/`y` are the center of the code in game pixels. `onLabel` receives the
 * instruction line (same URL as the QR) or the local-server message.
 * `onLink` receives `{ url, label }` when a code is actually drawn.
 * `hideWhenOffline` skips both the QR and the label when /lan-ip isn't
 * served — used on the title screen so a static deploy stays quiet there.
 * The lobby still explains that phone controllers need the local server.
 *
 * `bezel` draws the reactor rings around the code. The caption is optional
 * so a screen can place the URL in its own column instead of under the code.
 */
export function attachPhoneJoin(scene, {
  x, y, size = 280, hideWhenOffline = false, onLabel, onLink, bezel = false, caption = true, depth = 5,
} = {}) {
  let cancelled = false;
  const key = `phone-qr-${scene.scene.key}`;
  const owned = [];

  const drop = () => {
    cancelled = true;
    for (const obj of owned) obj.destroy();
    owned.length = 0;
    if (scene.textures.exists(key)) scene.textures.remove(key);
  };
  scene.events.once('shutdown', drop);

  fetch('/lan-ip', { cache: 'no-store' })
    .then((res) => {
      if (!res.ok) throw new Error(`lan-ip ${res.status}`);
      return res.json();
    })
    .then(async (lan) => {
      if (cancelled) return;
      const link = resolveControllerLink({ pageUrl: location.href, lan });
      if (!link.available) {
        if (!hideWhenOffline) onLabel?.(link.label);
        return;
      }
      onLabel?.(link.label);
      onLink?.(link);
      const dataUrl = qrPngDataUrl(link.url, size);
      const image = await loadHtmlImage(dataUrl);
      if (cancelled) return;

      if (scene.textures.exists(key)) scene.textures.remove(key);
      scene.textures.addImage(key, image);
      scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);

      if (bezel) {
        owned.push(drawReactorBezel(scene, x, y, size, depth));
      } else {
        const pad = scene.add.graphics().setDepth(depth);
        pad.fillStyle(0xffffff, 1);
        pad.fillRoundedRect(x - size / 2 - 6, y - size / 2 - 6, size + 12, size + 12, 8);
        pad.lineStyle(2, THEME.teal, 0.9);
        pad.strokeRoundedRect(x - size / 2 - 6, y - size / 2 - 6, size + 12, size + 12, 8);
        owned.push(pad);
      }

      const sprite = scene.add.image(x, y, key).setDisplaySize(size, size).setDepth(depth + 1);
      owned.push(sprite);

      if (caption) {
        const cap = scene.add.text(x, y + size / 2 + (bezel ? 46 : 16), 'Scan to join', {
          fontFamily: bezel ? FONT_MONO : FONT_BODY, fontSize: '14px', color: THEME.goldCss,
        }).setOrigin(0.5, 0).setDepth(depth + 1);
        owned.push(cap);
      }
    })
    .catch(() => {
      if (cancelled || hideWhenOffline) return;
      onLabel?.(LOCAL_SERVER_REQUIRED);
    });

  return drop;
}
