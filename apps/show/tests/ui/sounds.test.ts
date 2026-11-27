// The touch sounds (D206-D208, U182-U186; packages/ui/sounds/): the pure rules (which sample, what rate, whether
// anything may play, the voices), the show-laptop rule, the tablet's switch, the hold buttons' sequence, and that
// the generated sprites match picks.json and cover every class the apps ask for.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  MAX_VOICES,
  REPEAT_MS,
  admitVoice,
  bendRates,
  isShowLaptop,
  mayPlay,
  pickSample,
  playedMs,
  rateFor,
  storedSoundsOn,
  storedSoundsValue,
  type PlayGate,
} from '../../../../packages/ui/sounds/logic.ts';
import { SPRITES } from '../../../../packages/ui/sounds/sprites.ts';
import { holdSounds, registerTouchSounds } from '../../../../packages/ui/sounds/touch.ts';
import type { SpriteMap, TouchClass, TouchVariant } from '../../../../packages/ui/sounds/types.ts';
import { PLAYER_TOUCH } from '../../../player/device/touch-rules.ts';
import { CONSOLE_TOUCH } from '../../../console/touch-rules.ts';

const SOUNDS_DIR = path.resolve(import.meta.dirname, '../../../../packages/ui/sounds');

/** A repeatable random sequence. */
function seq(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

test('the show laptop is a page opened from the machine itself: loopback names and addresses', () => {
  for (const host of ['localhost', 'LOCALHOST', '127.0.0.1', '127.0.1.1', '::1', '[::1]', 'quina.localhost']) assert.equal(isShowLaptop(host), true, host);
  for (const host of ['192.168.43.10', '10.0.0.5', 'quina.barrakudesbegur.org', 'quina-dev.barrakudesbegur.org', 'tauleta.local', '']) assert.equal(isShowLaptop(host), false, host);
});

test('a sample is picked at random, never the one that played last when there is another', () => {
  assert.equal(pickSample(1, 0, Math.random), 0);
  assert.equal(pickSample(0, null, Math.random), 0);
  for (let last = 0; last < 4; last++) {
    const seen = new Set<number>();
    for (const r of [0, 0.2, 0.34, 0.5, 0.67, 0.8, 0.9999]) {
      const pick = pickSample(4, last, () => r);
      assert.notEqual(pick, last);
      assert.ok(pick >= 0 && pick < 4);
      seen.add(pick);
    }
    assert.equal(seen.size, 3, 'every other sample can play');
  }
  // No last one yet (or a stale index): any of them.
  assert.deepEqual([0, 0.3, 0.6, 0.9999].map((r) => pickSample(4, null, () => r)), [0, 1, 2, 3]);
  assert.equal(pickSample(4, 9, () => 0.5), 2);
});

test('the rate is uniform in its range; a bend multiplies its start and end; the played length follows the rate', () => {
  assert.equal(rateFor([0.94, 1.06], () => 0), 0.94);
  assert.ok(Math.abs(rateFor([0.94, 1.06], () => 0.5) - 1) < 1e-9);
  assert.deepEqual(bendRates(1, undefined), [1, 1]);
  assert.deepEqual(bendRates(0.95, [1, 0.82]), [0.95, 0.95 * 0.82]);
  assert.equal(playedMs(100, 1, 1), 100);
  assert.equal(playedMs(100, 2, 2), 50);
  assert.ok(Math.abs(playedMs(100, 0.9, 1.1) - 100) < 1e-9, 'a symmetric bend keeps the length');
});

test('a touch sound plays only with the switch on, the page shown, off the show laptop, unlocked, and no cue playing', () => {
  const ok: PlayGate = { enabled: true, hidden: false, showLaptop: false, ready: true, cueBusy: false };
  assert.equal(mayPlay(ok), true);
  assert.equal(mayPlay({ ...ok, enabled: false }), false, 'switched off');
  assert.equal(mayPlay({ ...ok, hidden: true }), false, 'a background tab, the screen off');
  assert.equal(mayPlay({ ...ok, showLaptop: true }), false, 'its output is the PA (D207)');
  assert.equal(mayPlay({ ...ok, ready: false }), false, 'before the first touch, or not decoded');
  assert.equal(mayPlay({ ...ok, cueBusy: true }), false, 'a game cue always wins');
});

test('voices: a double event is dropped, and a fourth voice stops the oldest', () => {
  assert.deepEqual(admitVoice([], 'digit:press', 0), { play: true, stop: [] });
  const one = [{ key: 'digit:press', startMs: 100, endMs: 180 }];
  assert.deepEqual(admitVoice(one, 'digit:press', 100 + REPEAT_MS - 1), { play: false });
  assert.deepEqual(admitVoice(one, 'digit:press', 100 + REPEAT_MS), { play: true, stop: [] });
  assert.deepEqual(admitVoice(one, 'digit:release', 105), { play: true, stop: [] }, 'another variant is no repeat');
  const three = [
    { key: 'a', startMs: 30, endMs: 500 },
    { key: 'b', startMs: 10, endMs: 500 },
    { key: 'c', startMs: 20, endMs: 500 },
    { key: 'd', startMs: 0, endMs: 50 },
  ];
  assert.equal(MAX_VOICES, 3);
  assert.deepEqual(admitVoice(three, 'e', 100), { play: true, stop: [1] }, 'the oldest still sounding stops; an ended one counts for nothing');
});

test("the tablet's switch is on unless switched off (U182)", () => {
  assert.equal(storedSoundsOn(null), true);
  assert.equal(storedSoundsOn('1'), true);
  assert.equal(storedSoundsOn('0'), false);
  assert.equal(storedSoundsOn(storedSoundsValue(false)), false);
  assert.equal(storedSoundsOn(storedSoundsValue(true)), true);
});

test('a hold button: its press, holdDone as it fires, and the release that matches', () => {
  const played: string[] = [];
  registerTouchSounds({ play: (cls: TouchClass, variant: TouchVariant) => played.push(`${cls}:${variant}`) });
  try {
    const hold = holdSounds('big');
    hold.down();
    hold.done();
    hold.done();
    hold.up();
    assert.deepEqual(played.splice(0), ['big:press', 'holdDone:press', 'holdDone:release'], 'fired once, released as holdDone');
    hold.down();
    hold.up();
    hold.up();
    assert.deepEqual(played.splice(0), ['big:press', 'big:release'], 'a tap: its own release, once');
    hold.down();
    hold.cancel();
    hold.up();
    hold.done();
    assert.deepEqual(played.splice(0), ['big:press'], 'taken away: nothing more');
    let size: TouchClass = 'small';
    const menu = holdSounds(() => size);
    menu.down();
    size = 'big';
    menu.up();
    assert.deepEqual(played.splice(0), ['small:press', 'big:release'], 'the class is read at each step');
  } finally {
    registerTouchSounds(null);
  }
});

/** Every distinct segment of a surface, in file order. */
function segments(map: SpriteMap): [number, number][] {
  const all = new Map<string, [number, number]>();
  for (const sprite of Object.values(map.classes)) {
    for (const variant of ['press', 'release'] as const) for (const [a, b] of sprite?.[variant]?.at ?? []) all.set(`${a}`, [a, b]);
  }
  return [...all.values()].sort((x, y) => x[0] - y[0]);
}

const ruleClasses = (rules: typeof PLAYER_TOUCH.rules) => rules.map((r) => r.cls).filter((c): c is TouchClass => typeof c === 'string');

test('the sprites cover every class the apps play', () => {
  const player: TouchClass[] = [...ruleClasses(PLAYER_TOUCH.rules), 'drawerOpen', 'drawerClose', 'switchOn', 'refused'];
  const console: TouchClass[] = [...ruleClasses(CONSOLE_TOUCH.rules), 'switchOn', 'switchOff', 'drawerOpen', 'drawerClose', 'chipAdd', 'holdDone', 'refused', 'big', 'small'];
  for (const cls of player) assert.ok(SPRITES.player.classes[cls], `player: ${cls}`);
  for (const cls of console) assert.ok(SPRITES.console.classes[cls], `console: ${cls}`);
  // The drawers' sounds are one variant each; the refused thud a press.
  assert.ok(SPRITES.player.classes.drawerOpen.release && SPRITES.player.classes.drawerClose.press && SPRITES.player.classes.refused.press);
  assert.ok(SPRITES.console.classes.drawerOpen.release && SPRITES.console.classes.drawerClose.press && SPRITES.console.classes.holdDone.press);
});

test('the sprites are what picks.json asks for, in files that fit them', () => {
  const picks = JSON.parse(fs.readFileSync(path.join(SOUNDS_DIR, 'picks.json'), 'utf8')) as {
    layout: { gapMs: number; bitrate: string };
    surfaces: Record<string, { gain: number; classes: Record<string, { press?: string; release?: string; rate: number[]; bend?: number[] }> }>;
  };
  const sprites: Record<string, SpriteMap> = SPRITES;
  assert.deepEqual(Object.keys(sprites).sort(), Object.keys(picks.surfaces).sort());
  for (const [surface, want] of Object.entries(picks.surfaces)) {
    const map = sprites[surface];
    assert.equal(map.gain, want.gain, `${surface}: gain`);
    assert.deepEqual(Object.keys(map.classes).sort(), Object.keys(want.classes).sort(), `${surface}: classes (run tools/prep/ui_sounds.py)`);
    for (const [cls, pick] of Object.entries(want.classes)) {
      const got = map.classes[cls as TouchClass];
      assert.equal(got?.press?.sound, pick.press, `${surface} ${cls} press`);
      assert.equal(got?.release?.sound, pick.release, `${surface} ${cls} release`);
      assert.deepEqual(got?.rate, pick.rate, `${surface} ${cls} rate`);
      assert.deepEqual(got?.bend, pick.bend, `${surface} ${cls} bend`);
    }
    // The samples never overlap, with the gap between them; the file is long enough for the last one.
    const spots = segments(map);
    for (let i = 1; i < spots.length; i++) assert.ok(spots[i][0] >= spots[i - 1][0] + spots[i - 1][1] + picks.layout.gapMs - 0.02, `${surface}: segment ${i}`);
    const bytes = fs.statSync(path.join(SOUNDS_DIR, `${surface}.mp3`)).size;
    const seconds = (bytes * 8) / (parseInt(picks.layout.bitrate, 10) * 1000);
    const [lastStart, lastLength] = spots[spots.length - 1];
    assert.ok((lastStart + lastLength) / 1000 <= seconds + 0.1, `${surface}.mp3 holds its last sample`);
    assert.ok(bytes < 300_000, `${surface}.mp3 stays small (${bytes} bytes)`);
  }
});

test('the MIT notice ships with the recordings', () => {
  const notice = fs.readFileSync(path.join(SOUNDS_DIR, 'LICENSE-button-sounds.txt'), 'utf8');
  assert.match(notice, /MIT License/);
  assert.match(notice, /Copyright \(c\) 2026-present Josh Comeau/);
  assert.match(notice, /Permission is hereby granted, free of charge/);
});
