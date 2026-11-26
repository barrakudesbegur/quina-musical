// «Llançament» and «Tempesta» (D138, D151, D155): where the buttons show, what each says, and what a tap or a hold sends.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SHOW_SCENES, type ThrowInfo } from '@quina/protocol';
import { FIXTURES } from '../../../../../packages/ui/fixtures/states.ts';
import { flowOf } from '../../../../../packages/ui/flow.ts';
import { canSend } from '../../../../console/logic/scene.ts';
import { throwButtonState, throwClock, throwCommand, throwLayout, throwProgress } from '../../../../console/logic/throw-songs.ts';
import { S } from '../../../../console/strings.ts';

const NOW = 1_800_000_000_000;
const flying = (song: ThrowInfo['song'], playing: boolean): ThrowInfo => ({ song, title: 'Flying Free', artist: 'Pont Aeri', startSec: 193.18, dropSec: 208.76, durationSec: 406.4, playing, sinceMs: NOW, posSec: 193.18 });

test('«Llançament» takes Següent\'s place before the night and in a break; the end screen has both, «Tempesta» big', () => {
  assert.deepEqual(throwLayout('before', false), { big: 'throw', beside: null, top: null });
  assert.deepEqual(throwLayout('interval', false), { big: 'throw', beside: null, top: null });
  assert.deepEqual(throwLayout('after', false), { big: 'storm', beside: 'throw', top: null });
  assert.deepEqual(throwLayout('after', true), { big: 'storm', beside: 'throw', top: null });
});

test("«Tempesta» joins the top row in the night's last round, in play and in its Check; never in a Celebration (U138)", () => {
  assert.deepEqual(throwLayout('play', true), { big: 'next', beside: null, top: 'storm' });
  assert.deepEqual(throwLayout('check', true), { big: 'next', beside: null, top: 'storm' });
  assert.deepEqual(throwLayout('play', false), { big: 'next', beside: null, top: null });
  assert.deepEqual(throwLayout('check', false), { big: 'next', beside: null, top: null });
  for (const scene of ['roundStart', 'celebration'] as const) assert.deepEqual(throwLayout(scene, true), { big: 'next', beside: null, top: null }, scene);
});

test('every button shown is one the scene rules allow (the engine has the same table)', () => {
  const cases = { before: 'before', interval: 'interval', afterMusic: 'after', lastRound: 'play', checkLastRound: 'check', play: 'play', celebration: 'celebration' } as const;
  for (const [name, scene] of Object.entries(cases)) {
    const state = FIXTURES[name](NOW).state;
    const flow = flowOf(state);
    assert.equal(flow.scene, scene, name);
    const layout = throwLayout(flow.scene, state.lastRound);
    const shown = [layout.big, layout.beside, layout.top].filter((b): b is 'throw' | 'storm' => b === 'throw' || b === 'storm');
    for (const song of shown) assert.equal(canSend(song, { state, flow, online: true }), true, `${name}: ${song}`);
    for (const song of ['throw', 'storm'] as const) if (!shown.includes(song)) assert.equal(canSend(song, { state, flow, online: true }), false, `${name}: no ${song}`);
  }
  assert.equal(SHOW_SCENES.length, 7, 'a new scene needs its place here');
});

test("each button's state comes from `throwSong`: idle, playing, stopped, or the other song on", () => {
  assert.equal(throwButtonState(null, 'throw'), 'idle');
  assert.equal(throwButtonState(undefined, 'storm'), 'idle');
  assert.equal(throwButtonState(flying('throw', true), 'throw'), 'playing');
  assert.equal(throwButtonState(flying('throw', false), 'throw'), 'stopped');
  assert.equal(throwButtonState(flying('throw', true), 'storm'), 'other', 'a tap on «Tempesta» replaces it');
  assert.equal(throwButtonState(FIXTURES.intervalThrowStopped(NOW).state.throwSong, 'throw'), 'stopped');
  assert.equal(throwButtonState(FIXTURES.afterStorm(NOW).state.throwSong, 'storm'), 'playing');
});

test('a tap toggles the song, a hold plays it again from its hook, letting go of the hold sends nothing more', () => {
  assert.deepEqual(throwCommand('throw', 'tap'), { cmd: 'throw', args: {} });
  assert.deepEqual(throwCommand('storm', 'tap'), { cmd: 'storm', args: {} });
  assert.deepEqual(throwCommand('throw', 'escalate'), { cmd: 'throw', args: { restart: true } });
  assert.deepEqual(throwCommand('storm', 'escalate'), { cmd: 'storm', args: { restart: true } });
  assert.equal(throwCommand('throw', 'release'), null);
});

test('both buttons have their words, and the commands their toast names', () => {
  for (const song of ['throw', 'storm'] as const) {
    const t = S.throws.names[song];
    assert.ok(t.label && t.start && t.replace, song);
    assert.match(t.stopped('Cançó 3 de 50'), /^Cançó 3 de 50 · /);
  }
  assert.equal(S.commands.throw, 'Llançament');
  assert.equal(S.commands.storm, 'Tempesta');
});

test('the time on the button counts from the hook, moves on with the show clock while it plays, and waits when stopped', () => {
  // «Flying Free» from its hook (193.18 s): 3:33 to its end, the drop 15.6 s in.
  const on = throwProgress(flying('throw', true), NOW + 42_000);
  assert.equal(throwClock(on.atSec), '0:42');
  assert.equal(throwClock(on.totalSec), '3:33');
  assert.ok(Math.abs(on.fraction - 42 / 213.22) < 1e-9);
  assert.ok(on.dropAt !== null && Math.abs(on.dropAt - 15.58 / 213.22) < 1e-9, 'the drop mark');
  const stopped = { ...flying('throw', false), posSec: 193.18 + 65, sinceMs: NOW - 5000 };
  assert.equal(throwClock(throwProgress(stopped, NOW + 60_000).atSec), '1:05', 'stopped: it stays where it stopped');
  assert.equal(throwProgress(flying('throw', true), NOW + 3_600_000).fraction, 1, 'never past its end');
  assert.equal(throwProgress(flying('throw', true), NOW - 2000).atSec, 0, 'a clock a little behind: not before its hook');
});

test('«Tempesta» starts at its drop: no drop mark', () => {
  const storm = { ...flying('storm', true), startSec: 208.76, posSec: 208.76 };
  const p = throwProgress(storm, NOW + 20_000);
  assert.equal(p.dropAt, null);
  assert.equal(throwClock(p.atSec), '0:20');
  assert.equal(throwClock(Math.round(p.totalSec)), '3:18', 'the length rounds, as the board');
});

test('the clock reads like a player’s', () => {
  assert.deepEqual([0, 9.99, 60, 65.4, 600].map(throwClock), ['0:00', '0:09', '1:00', '1:05', '10:00']);
});
