// The ninos (components-v2.md F1; the user's canvas comment #86, D-u): every pose the screens name ships as a sticker
// made by tools/ninos/stickers.ts from its brand doodle, and each moment draws from a pool without repeating itself.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { NINO_FOR, ninoFor, ninosFor, type NinoMoment } from '../../../../../packages/ui/concepts.ts';
import { NINO_POSES, ninoUrl } from '../../../../../packages/ui/ninos.ts';
import { FINALE_POSES } from '../../../../../packages/rules/finale.ts';
import { STICKERS, roundPath, sticker } from '../../../../../tools/ninos/stickers.ts';

const ROOT = fileURLToPath(new URL('../../../../../', import.meta.url));

test('every pose ships, and the generator makes exactly these', () => {
  assert.deepEqual([...NINO_POSES].sort(), Object.keys(STICKERS).sort());
  for (const pose of NINO_POSES) assert.ok(existsSync(fileURLToPath(ninoUrl(pose))), pose);
});

test('the stickers are up to date with their doodles (node tools/ninos/stickers.ts)', () => {
  for (const [pose, spec] of Object.entries(STICKERS)) {
    const made = sticker(readFileSync(`${ROOT}brand/ninos/figures/nino-${pose}.svg`, 'utf8'), spec);
    assert.equal(readFileSync(`${ROOT}packages/ui/assets/ninos/nino-${pose}.svg`, 'utf8'), made, pose);
  }
});

test('never the adults-only nino, nor the drinking ones (brand/ninos/README.md)', () => {
  for (const pose of NINO_POSES) assert.doesNotMatch(pose, /sexe|beguda|cervesa|gin/);
});

test('the finalists have poses that ship, all different', () => {
  for (const pose of FINALE_POSES) assert.ok((NINO_POSES as readonly string[]).includes(pose), pose);
  assert.equal(new Set(FINALE_POSES).size, FINALE_POSES.length);
});

test('a moment never shows the same nino twice in a row', () => {
  for (const moment of Object.keys(NINO_FOR) as NinoMoment[]) {
    const pool = NINO_FOR[moment];
    assert.equal(new Set(pool).size, pool.length, `${moment}: no pose twice in a pool`);
    for (let seed = 0; seed < 12; seed++) {
      if (pool.length > 1) assert.notEqual(ninoFor(moment, seed), ninoFor(moment, seed + 1), `${moment} @${seed}`);
      assert.ok(pool.includes(ninoFor(moment, -seed)), 'negative seeds stay in the pool');
    }
  }
  assert.equal(ninoFor('roundIntro', Number.NaN), NINO_FOR.roundIntro[0]);
});

test('several at once are all different', () => {
  const two = ninosFor('break', 7, 2);
  assert.equal(two.length, 2);
  assert.notEqual(two[0], two[1]);
  assert.equal(new Set(ninosFor('lastStanding', 3, 3)).size, 3);
  assert.equal(ninosFor('pause', 5, 2).length, 1, 'never more than the pool');
});

test('paths keep one decimal and stay valid', () => {
  assert.equal(roundPath('M353.257 622.599C354.901 622.804 -0.04 0.5'), 'M353.3 622.6C354.9 622.8 0 .5');
  assert.equal(roundPath('M1 2 L-3.21-4.0Z'), 'M1 2L-3.2-4Z');
});
