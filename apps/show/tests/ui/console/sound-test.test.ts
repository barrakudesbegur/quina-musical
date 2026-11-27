// The PA's sound test (D229) walks the volume sliders in the menu's order; the automatic sounds (D237) read only
// `game.autoSounds`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AUTO_SOUNDS, SOUND_TEST_KINDS } from '@quina/protocol';
import { SOUND_TEST_ORDER, soundTestPlace } from '../../../../console/logic/sound-test.ts';
import { AUTO_SOUND_ORDER, autoSoundsNow } from '../../../../console/logic/auto-sounds.ts';
import { isBreakSet } from '../../../../console/logic/scene.ts';
import { S } from '../../../../console/strings.ts';

test('the sound test has every kind once, in the sliders’ order, each with its words', () => {
  assert.deepEqual([...SOUND_TEST_ORDER].sort(), [...SOUND_TEST_KINDS].sort());
  assert.equal(new Set(SOUND_TEST_ORDER).size, SOUND_TEST_ORDER.length);
  assert.equal(SOUND_TEST_ORDER[0], 'songs');
  for (const kind of SOUND_TEST_KINDS) assert.ok(S.soundTest.plays[kind], `no words for ${kind}`);
});

test('stepping stops at either end', () => {
  const first = soundTestPlace(SOUND_TEST_ORDER[0]);
  assert.equal(first.number, 1);
  assert.equal(first.prev, null);
  assert.equal(first.next, SOUND_TEST_ORDER[1]);
  const last = soundTestPlace(SOUND_TEST_ORDER[SOUND_TEST_ORDER.length - 1]);
  assert.equal(last.number, last.count);
  assert.equal(last.next, null);
  assert.equal(last.prev, SOUND_TEST_ORDER[SOUND_TEST_ORDER.length - 2]);
});

test('the automatic sounds: every key a switch with words, read from game.autoSounds only', () => {
  assert.deepEqual([...AUTO_SOUND_ORDER], [...AUTO_SOUNDS]);
  for (const key of AUTO_SOUNDS) assert.ok(S.autoSounds.keys[key].label && S.autoSounds.keys[key].note, `no words for ${key}`);
  // All on until the engine says; the old mirrors are never read.
  assert.deepEqual(autoSoundsNow(undefined), { drumTicks: true, djFx: true, finalLap: true, winFanfare: true, failFanfare: true, voices: true });
  const old = { finalLapStinger: false, voicesOn: false } as unknown as Parameters<typeof autoSoundsNow>[0];
  assert.equal(autoSoundsNow(old).finalLap, true);
  assert.equal(autoSoundsNow({ autoSounds: { drumTicks: false, djFx: true, finalLap: false, winFanfare: true, failFanfare: true, voices: false } }).voices, false);
});

test('the Descans picks between the breaks’ set and Pausa’s, never the end’s', () => {
  assert.equal(isBreakSet('breaks'), true);
  assert.equal(isBreakSet('pausa'), true);
  assert.equal(isBreakSet('end'), false);
});
