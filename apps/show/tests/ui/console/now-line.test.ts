// «Ara sona» in one line (D196, D199): what it names, and when it says the music is far down.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FIXTURES } from '../../../../../packages/ui/fixtures/states.ts';
import { flowOf } from '../../../../../packages/ui/flow.ts';
import { nowLine } from '../../../../console/logic/now-line.ts';
import { S } from '../../../../console/strings.ts';

const NOW = 1_800_000_000_000;
const lineOf = (name: string, instead: 'hold' | 'error' | null = null) => {
  const state = FIXTURES[name](NOW).state;
  return nowLine(state, flowOf(state).scene, instead);
};

test('in play it names the round\'s song, at its level', () => {
  const view = lineOf('play');
  assert.equal(view.sound.kind, 'song');
  assert.equal(view.low, false);
});

test('in a Check the music from before it is named, far down (D118, D191)', () => {
  const view = lineOf('check');
  assert.equal(view.low, true);
  assert.notEqual(view.sound.kind, 'none');
  assert.equal(S.nowLine.low, "baixa, d'abans de la comprovació");
});

test('a throw song playing over the break music comes first; stopped, the break music is named again', () => {
  assert.deepEqual(lineOf('intervalThrow').sound, { kind: 'throw', song: 'throw', title: FIXTURES.intervalThrow(NOW).state.throwSong!.title, artist: FIXTURES.intervalThrow(NOW).state.throwSong!.artist });
  assert.deepEqual(lineOf('intervalThrowStopped').sound, { kind: 'playlist', title: 'Last Christmas', artist: 'Wham!' });
  assert.equal(lineOf('afterStorm').sound.kind, 'throw');
});

test('the playlist is named once its track is known; before that, what plays instead or the song', () => {
  assert.deepEqual(lineOf('interval').sound, { kind: 'playlist', title: 'Last Christmas', artist: 'Wham!' });
  assert.deepEqual(lineOf('afterMusic').sound, { kind: 'playlist', title: 'Feliz Navidad', artist: 'José Feliciano' });
  assert.deepEqual(lineOf('after').sound, { kind: 'none' });
  assert.deepEqual(lineOf('stay', 'hold').sound, { kind: 'music', music: 'hold' });
  assert.deepEqual(lineOf('checkFailed', 'error').sound, { kind: 'music', music: 'error' });
});
