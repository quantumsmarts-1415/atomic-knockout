// A live round must move on the browser clock. Tournaments and clip capture
// step the sim by hand and skip the stage intro, so they never see a lock
// that only arms when the doors finish during a real frame.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const { WebSocket } = require('ws');

const BASE = process.env.AK_URL || 'http://127.0.0.1:5173';

async function serverUp() {
  try {
    const res = await fetch(BASE, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

test('fighters move within 3s of a real-time match, even after the menu clock has run', async () => {
  assert.ok(await serverUp(), `dev server not reachable at ${BASE}`);
  const browser = await chromium.launch({
    headless: !process.env.DISPLAY,
    executablePath: process.env.CHROME || '/usr/bin/google-chrome',
    args: ['--disable-gpu', '--no-sandbox', '--hide-scrollbars'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const pageErrors = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));
  try {
    // Two fighters only, so boot does not pull the whole roster. The playtest
    // URL skips the intro; the match under test is started the way Stage
    // Select does, with no playtest timer.
    await page.goto(`${BASE}/?playtest=ira,oz&stocks=3&ms=60000&stage=hydrogen-breakout`, {
      waitUntil: 'domcontentloaded',
    });
    await page.waitForFunction(() => {
      const b = window.game?.scene?.getScene?.('Battle');
      return b?.fighters?.length >= 2 && b.fighters.every((f) => f.body);
    }, null, { timeout: 30000 });

    // Sit on the running game the way a player sits in the menus. The bug
    // stamps the post-intro lock from that wall clock, so a short visit is
    // enough for a 3s match to still be frozen.
    await page.waitForTimeout(4000);

    await page.evaluate(async () => {
      const game = window.game;
      const host = game.scene.getScene('Battle');
      const doors = [
        ['stage-hydrogen-breakout-intro-doorLeft', 'art-src/stages/hydrogen-breakout/intro_door_left.jpg'],
        ['stage-hydrogen-breakout-intro-doorRight', 'art-src/stages/hydrogen-breakout/intro_door_right.jpg'],
      ];
      const missing = doors.filter(([key]) => !host.textures.exists(key));
      if (missing.length) {
        for (const [key, url] of missing) host.load.image(key, url);
        await new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('door art load timed out')), 20000);
          host.load.once('complete', () => { clearTimeout(timer); resolve(); });
          host.load.start();
        });
      }
      game.scene.stop('Battle');
      game.scene.start('Battle', {
        stageId: 'hydrogen-breakout',
        stocks: 3,
        players: [
          { charId: 'ira', palette: 0, slot: 100 },
          { charId: 'oz', palette: 1, slot: 101 },
        ],
      });
    });

    // The match card stays up until FX and shaders are warm. Movement is
    // measured after that hand-off, which is also when a stuck intro lock
    // would keep the fighters frozen.
    await page.waitForFunction(() => {
      const b = window.game?.scene?.getScene?.('Battle');
      if (!b?.sys?.isActive?.() || b.setup?.playtestMs) return false;
      if (b.fighters?.length < 2 || !b.fighters.every((f) => f.body)) return false;
      if (b.intro?.active) return false;
      return b.simNow > (b.introLockUntil || 0);
    }, null, { timeout: 90000 });

    const before = await page.evaluate(() => window.game.scene.getScene('Battle').fighters.map((f) => f.x));
    // Real time. Nothing calls runSimSteps or captureFrame.
    await page.waitForTimeout(3000);
    const after = await page.evaluate(() => {
      const b = window.game.scene.getScene('Battle');
      return {
        xs: b.fighters.map((f) => f.x),
        simNow: b.simNow,
        introActive: b.intro?.active ?? null,
        introLockUntil: b.introLockUntil,
      };
    });
    const moved = after.xs.some((x, i) => Math.abs(x - before[i]) > 24);
    assert.equal(pageErrors.length, 0, pageErrors.join('\n'));
    assert.ok(
      moved,
      `fighters did not move within 3s (x ${before.map((n) => Math.round(n))} -> ${after.xs.map((n) => Math.round(n))}, sim ${Math.round(after.simNow)}ms, introLockUntil ${Math.round(after.introLockUntil)})`,
    );
  } finally {
    await browser.close();
  }
});

test('a connected phone controller does not freeze the real-time match', async () => {
  assert.ok(await serverUp(), `dev server not reachable at ${BASE}`);
  const browser = await chromium.launch({
    headless: !process.env.DISPLAY,
    executablePath: process.env.CHROME || '/usr/bin/google-chrome',
    args: ['--disable-gpu', '--no-sandbox', '--hide-scrollbars'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const pageErrors = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));
  const wsBase = BASE.replace(/^http/, 'ws');
  const phone = new WebSocket(`${wsBase}/ws?role=controller&name=Ben`);
  const phoneMsgs = [];
  phone.on('message', (raw) => phoneMsgs.push(raw.toString()));
  try {
    await new Promise((resolve, reject) => {
      phone.once('open', resolve);
      phone.once('error', reject);
    });
    await page.goto(`${BASE}/?playtest=ira,oz&stocks=3&ms=60000&stage=hydrogen-breakout`, {
      waitUntil: 'domcontentloaded',
    });
    await page.waitForFunction(() => {
      const b = window.game?.scene?.getScene?.('Battle');
      return b?.fighters?.length >= 2 && b.fighters.every((f) => f.body);
    }, null, { timeout: 30000 });
    // The QR lobby is why a phone is connected before the round. That wait is
    // what used to stamp the post-intro lock from the page clock.
    await page.waitForTimeout(4000);
    await page.evaluate(async () => {
      const game = window.game;
      const host = game.scene.getScene('Battle');
      const doors = [
        ['stage-hydrogen-breakout-intro-doorLeft', 'art-src/stages/hydrogen-breakout/intro_door_left.jpg'],
        ['stage-hydrogen-breakout-intro-doorRight', 'art-src/stages/hydrogen-breakout/intro_door_right.jpg'],
      ];
      const missing = doors.filter(([key]) => !host.textures.exists(key));
      if (missing.length) {
        for (const [key, url] of missing) host.load.image(key, url);
        await new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('door art load timed out')), 20000);
          host.load.once('complete', () => { clearTimeout(timer); resolve(); });
          host.load.start();
        });
      }
      game.scene.stop('Battle');
      game.scene.start('Battle', {
        stageId: 'hydrogen-breakout',
        stocks: 3,
        players: [
          { charId: 'ira', palette: 0, slot: 0 },
          { charId: 'oz', palette: 1, slot: 101 },
          { charId: 'hydra', palette: 2, slot: 2 },
        ],
      });
    });
    await page.waitForFunction(() => {
      const b = window.game?.scene?.getScene?.('Battle');
      if (!b?.sys?.isActive?.() || b.setup?.playtestMs) return false;
      if (b.fighters?.length !== 3 || !b.fighters.every((f) => f.body)) return false;
      if (b.intro?.active) return false;
      return b.simNow > (b.introLockUntil || 0);
    }, null, { timeout: 90000 });
    const send = (patch) => phone.send(JSON.stringify({
      type: 'input', left: false, right: false, up: false, down: false, confirm: false, back: false, ...patch,
    }));
    send({ right: true, confirm: true });
    const before = await page.evaluate(() => window.game.scene.getScene('Battle').fighters.map((f) => ({
      id: f.charDef.id, bot: !!f.isBot, slot: f.controlSlot, x: f.x,
    })));
    // Net x can come back under 24px: the bot walks in, gets hit, and the
    // launch puts him near where he started while he plants for the next
    // swing. Travel is the farthest point he reached, which stays large
    // when the round is actually running.
    const oz0 = before.find((f) => f.id === 'oz').x;
    let ozTravel = 0;
    const started = Date.now();
    while (Date.now() - started < 3000) {
      await page.waitForTimeout(200);
      const x = await page.evaluate(() => {
        const b = window.game?.scene?.getScene?.('Battle');
        return b?.fighters?.find((f) => f.charDef.id === 'oz')?.x ?? null;
      });
      if (x != null) ozTravel = Math.max(ozTravel, Math.abs(x - oz0));
    }
    const after = await page.evaluate(() => {
      const b = window.game.scene.getScene('Battle');
      return {
        simNow: b.simNow,
        introActive: b.intro?.active ?? null,
        introLockUntil: b.introLockUntil,
        fighters: b.fighters.map((f) => ({ id: f.charDef.id, bot: !!f.isBot, slot: f.controlSlot, x: f.x })),
      };
    });
    assert.equal(pageErrors.length, 0, pageErrors.join('\n'));
    assert.ok(phoneMsgs.some((m) => m.includes('assigned')), `phone was not assigned: ${phoneMsgs.join(' ')}`);
    const moved = (id) => {
      const a = before.find((f) => f.id === id);
      const b = after.fighters.find((f) => f.id === id);
      return Math.abs(b.x - a.x) > 24;
    };
    assert.ok(ozTravel > 24, `bot did not move travel ${Math.round(ozTravel)} ${JSON.stringify(before)} -> ${JSON.stringify(after.fighters)} lock ${Math.round(after.introLockUntil)}`);
    assert.ok(moved('hydra'), `phone fighter did not move ${JSON.stringify(before)} -> ${JSON.stringify(after.fighters)}`);
  } finally {
    phone.close();
    await browser.close();
  }
});
