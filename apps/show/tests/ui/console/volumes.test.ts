// The volume sliders in the menu (D139, D157–D159): every key once, its value and default, and what a drag sends.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VOLUME_DEFAULTS, VOLUME_KEYS, VOLUME_MAX } from '@quina/protocol';
import { FIXTURES } from '../../../../../packages/ui/fixtures/states.ts';
import { VOLUME_GROUPS, sliderPercent, volumeRow } from '../../../../console/logic/volumes.ts';
import { S } from '../../../../console/strings.ts';

const NOW = 1_800_000_000_000;

test('the menu lists every key of the protocol exactly once, each with its Catalan label', () => {
  const order = VOLUME_GROUPS.flatMap((g) => g.keys);
  assert.equal(order.length, VOLUME_KEYS.length);
  assert.deepEqual([...order].sort(), [...VOLUME_KEYS].sort());
  for (const key of VOLUME_KEYS) assert.ok(S.volumes.keys[key].label, `missing label for ${key}`);
  for (const g of VOLUME_GROUPS) assert.ok(S.volumes.groups[g.group], `missing group ${g.group}`);
  assert.deepEqual(VOLUME_GROUPS.find((g) => g.keys.includes('throws'))?.keys.filter((k) => k === 'throws'), ['throws'], 'one slider for both chaotic moments (D159)');
});

test('a slider shows the engine value, its default until the Game has one, and the finger while it drags', () => {
  const none = volumeRow('throws', undefined);
  assert.deepEqual(none, { key: 'throws', percent: VOLUME_DEFAULTS.throws, defaultPercent: 141, max: VOLUME_MAX.throws, atDefault: true, defaultAt: 141 / 150 });
  const volumes = FIXTURES.volumes(NOW).state.game.volumes;
  assert.equal(volumeRow('master', volumes).percent, 92);
  assert.equal(volumeRow('master', volumes).atDefault, false);
  assert.equal(volumeRow('songsParlem', volumes).defaultPercent, 45, "today's Parlem duck");
  assert.equal(volumeRow('throws', volumes).atDefault, true);
  assert.equal(volumeRow('master', volumes, 120).percent, 120, 'the draft wins while dragging');
  assert.equal(volumeRow('master', { master: 400 }).percent, 150, 'a value out of range is drawn at the end of the track');
  assert.equal(volumeRow('master', { master: Number.NaN }).percent, 100);
  assert.equal(volumeRow('songs', undefined).defaultAt, 100 / 150, 'the default mark two thirds along');
});

test("a slider's value is sent as a whole percent from 0 to its max", () => {
  assert.equal(sliderPercent('master', '87'), 87);
  assert.equal(sliderPercent('master', '87.6'), 88);
  assert.equal(sliderPercent('master', '151'), 150);
  assert.equal(sliderPercent('master', '-3'), 0);
  assert.equal(sliderPercent('throws', 141), 141);
  assert.equal(sliderPercent('master', ''), null);
  assert.equal(sliderPercent('master', 'abc'), null);
});
