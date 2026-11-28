// A stopped audio clock (D284): the runtime's pure detector (audio/stall.ts) and the engine's private `audioStalled`.
import test from 'node:test';
import assert from 'node:assert/strict';
import type { JournalEntry, ShowState } from '@quina/protocol';
import { AudioStallDetector } from '../engine/src/audio/stall.ts';
import { AUDIO_WATCHDOG } from '../engine/src/config.ts';
import type { Effect } from '../engine/src/show/show.ts';
import { setup } from './support/harness.ts';

/** Feeds a detector one sample a second, the audio clock advancing `rates[i]` of each second; returns each verdict. */
function feed(detector: AudioStallDetector, rates: readonly number[], { running = (): boolean => true, start = { wallMs: 5000, audioSec: 3 } }: { running?: () => boolean; start?: { wallMs: number; audioSec: number } } = {}) {
  let { wallMs, audioSec } = start;
  const out = [detector.sample(wallMs, audioSec, running())];
  for (const rate of rates) {
    wallMs += 1000;
    audioSec += rate;
    out.push(detector.sample(wallMs, audioSec, running()));
  }
  return out;
}

test('D284: a clock advancing with wall time is never stalled', () => {
  const verdicts = feed(new AudioStallDetector(AUDIO_WATCHDOG), Array(30).fill(1));
  assert.ok(verdicts.every((v) => v === null));
  // A late timer (3 s between samples) with the clock keeping up is fine too.
  const d = new AudioStallDetector(AUDIO_WATCHDOG);
  d.sample(0, 0, true);
  assert.equal(d.sample(3000, 3, true), null);
});

test('D284: a clock moving 0.005 s in 2 s while running is stalled after 2 s, since its first slow second', () => {
  const d = new AudioStallDetector(AUDIO_WATCHDOG);
  const verdicts = feed(d, [1, 1, 0.0025, 0.0025, 0.0025, 0.0025]);
  // Samples at 5000, 6000, 7000 (good), 8000 (slow from 7000), 9000: slow for 2 s → stalled since 7000.
  assert.deepEqual(verdicts, [null, null, null, null, 7000, 7000, 7000]);
  assert.ok(d.lastRatio != null && d.lastRatio < AUDIO_WATCHDOG.stallRatio);
});

test('D284: the stall clears only after 2 s at ≥ 90 % of wall time; a limping clock keeps it', () => {
  const d = new AudioStallDetector(AUDIO_WATCHDOG);
  feed(d, [0, 0, 0]);
  assert.equal(d.stalledSince, 5000);
  // 60 %: no longer slow, but not good either: still stalled.
  let wallMs = 8000;
  let audioSec = 3;
  const step = (rate: number) => d.sample((wallMs += 1000), (audioSec += rate), true);
  assert.equal(step(0.6), 5000);
  assert.equal(step(0.6), 5000);
  assert.equal(step(1), 5000); // one good second
  assert.equal(step(0.6), 5000); // broken: starts over
  assert.equal(step(1), 5000);
  assert.equal(step(1), null); // two good seconds in a row
  // A new stall later has its own start.
  step(0);
  step(0);
  assert.equal(d.stalledSince, wallMs - 2000);
});

test('D284: a suspended context is never stalled, and its samples start over when it runs', () => {
  const d = new AudioStallDetector(AUDIO_WATCHDOG);
  // Before the start button: suspended, the clock at 0.
  assert.ok(feed(d, Array(10).fill(0), { running: () => false }).every((v) => v === null));
  // Stalled, then suspended on purpose: the alert clears.
  const s = new AudioStallDetector(AUDIO_WATCHDOG);
  feed(s, [0, 0, 0]);
  assert.equal(s.stalledSince, 5000);
  assert.equal(s.sample(9000, 3, false), null);
  // Running again from where it was suspended: the suspended time doesn't count as slow.
  assert.equal(s.sample(60_000, 3, true), null);
  assert.equal(s.sample(61_000, 4, true), null);
});

test('D284: a hiccup shorter than 2 s is ignored', () => {
  // One stopped second between good ones, several times: never stalled.
  const verdicts = feed(new AudioStallDetector(AUDIO_WATCHDOG), [1, 0, 1, 0.1, 1, 0, 2, 1]);
  assert.ok(verdicts.every((v) => v === null));
});

const states = (effects: readonly Effect[]): ShowState[] =>
  effects.flatMap((e) => (e.type === 'emit' && e.message.type === 'state' ? [e.message as ShowState] : []));
const journalOf = (effects: readonly Effect[]): JournalEntry[] => effects.flatMap((e) => (e.type === 'journal' ? [e.entry] : []));

test('D284: the engine carries audioStalled in its private state: set, then cleared, emitted on change, never journaled', () => {
  const h = setup();
  h.send('unlock');
  assert.equal(h.show.snapshot().audioStalled, null);
  const at = 1_700_000_123_000;
  const set = h.show.audioStalled(at);
  assert.deepEqual(states(set).map((s) => s.audioStalled), [{ sinceMs: at }]);
  assert.deepEqual(journalOf(set), []);
  assert.deepEqual(h.show.snapshot().audioStalled, { sinceMs: at });
  // The same report again: nothing new to say.
  assert.deepEqual(states(h.show.audioStalled(at)), []);
  // It stays on in later states (ticks, commands) until cleared.
  h.advance(1);
  assert.deepEqual(states(h.send('getState')).at(-1)?.audioStalled, { sinceMs: at });
  const cleared = h.show.audioStalled(null);
  assert.deepEqual(states(cleared).map((s) => s.audioStalled), [null]);
  assert.deepEqual(journalOf(cleared), []);
  assert.equal(h.show.snapshot().audioStalled, null);
  assert.deepEqual(states(h.show.audioStalled(null)), []);
});
