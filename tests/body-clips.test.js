import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { PNG } from 'pngjs';
import { CHARACTERS } from '../src/data/characters.js';
import { MOVE_SHEETS } from '../src/data/moveSheets.js';
import { artIsUpdated } from '../src/data/updatedArt.js';
import { hasBodyClips } from '../src/data/bodyClips.js';
import { clipNameForMove, frameToWorld, sheetFrameIndex, sheetMeta } from '../src/engine/moveSheet.js';

const FIGHTERS = ['ace', 'amy', 'aurelius'];

function worldH(art, def) {
  const body = def.bodyH ?? def.visibleH;
  const scale = def.displayScale ?? (art.height / body);
  return scale * body;
}

test('per-move body clips keep the idle height and the json foot line', () => {
  for (const id of FIGHTERS) {
    const art = CHARACTERS[id].art;
    const idle = art.sheets.clips.idle;
    const attack = art.sheets.clips.attack;
    assert.equal(attack.file, undefined, `${id} generic attack.png stays the fallback`);
    assert.equal(sheetMeta(id, 'attack'), null, id);
    assert.equal(artIsUpdated(CHARACTERS[id], new Set()), true, id);
    const dir = `art-src/imported/body/${id}`;
    for (const file of readdirSync(dir).filter((name) => name.endsWith('.json'))) {
      const json = JSON.parse(readFileSync(`${dir}/${file}`, 'utf8'));
      const moveKey = Object.keys(CHARACTERS[id].moves).find((key) => {
        const name = CHARACTERS[id].moves[key]?.name || '';
        return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') === json.move;
      });
      assert.ok(moveKey, `${id} ${json.move}`);
      const clipKey = clipNameForMove(id, moveKey);
      assert.equal(clipKey, `body-${moveKey}`, `${id} ${json.move}`);
      const clip = art.sheets.clips[clipKey];
      const meta = sheetMeta(id, clipKey);
      assert.equal(clip.frameW, json.frameW, json.move);
      assert.equal(clip.frameH, json.frameH, json.move);
      assert.equal(clip.count, json.count, json.move);
      assert.equal(clip.visibleH, json.visibleH, json.move);
      assert.equal(clip.file, `${id}_${json.move}.png`, json.move);
      const foot = Math.round(clip.footY * clip.frameH) - 1;
      assert.equal(foot, json.foot_row, `${json.move} foot`);
      assert.ok(Math.abs(worldH(art, clip) - worldH(art, idle)) < 1, `${json.move} height`);
      const sole = frameToWorld(
        [clip.frameW / 2, json.foot_row], clip.frameW, clip.frameH, clip.footY, clip.displayScale, 1, 1, 100, 200,
      );
      assert.ok(Math.abs(sole.y - 200) < 1, `${json.move} sole ${sole.y}`);
      for (const index of json.strike_frames) {
        const want = json.strike_hand_xy[String(index)];
        assert.deepEqual(meta.anchors.fist[index], [want[0], want[1]], `${json.move} f${index}`);
        assert.deepEqual(meta.anchors.tip[index], [want[0], want[1]], `${json.move} tip f${index}`);
      }
      assert.equal(meta.release, json.strike_frames[0], json.move);
      const fd = { startup: 4, active: 3, recovery: 4, visible: 11 };
      const shown = sheetFrameIndex(meta, { state: 'attack', fd, attackFrame: fd.startup });
      assert.equal(shown, json.strike_frames[0], `${json.move} opens on the strike`);
      const hand = frameToWorld(
        meta.anchors.fist[shown], clip.frameW, clip.frameH, clip.footY, clip.displayScale, 1, 1, 0, 0,
      );
      assert.ok(hand.x > 0, `${json.move} hand is in front`);
      const png = PNG.sync.read(readFileSync(`${art.sheets.dir}${clip.file}`));
      assert.equal(png.width % clip.frameW, 0, json.move);
      assert.equal(png.height % clip.frameH, 0, json.move);
      const cells = (png.width / clip.frameW) * (png.height / clip.frameH);
      assert.ok(cells >= clip.count, json.move);
      assert.ok(png.width <= 8192 && png.height <= 8192, `${json.move} fits the texture limit`);
    }
  }
});

test('a move with no body clip keeps the generic attack sheet', () => {
  const id = Object.keys(CHARACTERS).find((key) => !hasBodyClips(key) && !MOVE_SHEETS[key] && CHARACTERS[key].art?.sheets?.clips?.attack);
  assert.ok(id);
  assert.equal(clipNameForMove(id, 'basicDirectional'), null);
  assert.equal(clipNameForMove(id, 'basicCharge'), null);
  assert.ok(CHARACTERS[id].art.sheets.clips.attack.count > 0);
});

test('charge loops the windup and a guard holds the strike frames', () => {
  const ray = sheetMeta('ace', 'body-basicCharge');
  const held = sheetFrameIndex(ray, { state: 'charging', animT: 0, fd: null });
  assert.ok(held >= ray.windup[0] && held <= ray.windup[1]);
  const guard = sheetMeta('ace', 'body-specialDefense');
  const pose = sheetFrameIndex(guard, { state: 'defending', animT: 0.2, fd: null });
  assert.ok(pose >= guard.active[0] && pose <= guard.active[1], pose);
});
