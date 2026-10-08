import * as Phaser from 'phaser';
import { LOCAL_SERVER_REQUIRED, resolveControllerLink } from '../net/joinLink.js';
import { qrPngDataUrl } from '../net/qrCode.js';

function loadHtmlImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('QR image failed to load'));
    image.src = src;
  });
}

/**
 * Fetch /lan-ip, then draw a scannable QR for the controller URL.
 *
 * `x`/`y` are the center of the code in game pixels. `onLabel` receives the
 * instruction line (same URL as the QR) or the local-server message.
 * `hideWhenOffline` skips both the QR and the label when /lan-ip isn't
 * served — used on the title screen so a static deploy stays quiet there.
 * The lobby still explains that phone controllers need the local server.
 */
export function attachPhoneJoin(scene, { x, y, size = 280, hideWhenOffline = false, onLabel } = {}) {
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
      const dataUrl = qrPngDataUrl(link.url, size);
      const image = await loadHtmlImage(dataUrl);
      if (cancelled) return;

      if (scene.textures.exists(key)) scene.textures.remove(key);
      scene.textures.addImage(key, image);
      scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);

      const pad = scene.add.graphics().setDepth(4);
      pad.fillStyle(0xffffff, 1);
      pad.fillRoundedRect(x - size / 2 - 12, y - size / 2 - 12, size + 24, size + 24, 12);
      owned.push(pad);

      const sprite = scene.add.image(x, y, key).setDisplaySize(size, size).setDepth(5);
      owned.push(sprite);

      const caption = scene.add.text(x, y + size / 2 + 18, 'Scan to join', {
        fontFamily: 'Arial, sans-serif', fontSize: '16px', color: '#5c7a94',
      }).setOrigin(0.5, 0).setDepth(5);
      owned.push(caption);
    })
    .catch(() => {
      if (cancelled || hideWhenOffline) return;
      onLabel?.(LOCAL_SERVER_REQUIRED);
    });

  return drop;
}
