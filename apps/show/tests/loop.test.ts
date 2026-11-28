// The phrase loop (plan/loop.ts): which phrase repeats, counted from the hook the song landed on.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { firstRepeatAt, lastBarsLoop, lastPhraseLoop, loopSeconds, nextPhraseLoop, runOutAt, stayLoop } from '../engine/src/plan/loop.ts';
import { usableHooks } from '../engine/src/plan/hooks.ts';
import { LOOP } from '../engine/src/config.ts';
import { OUT } from '../relay/repertoire.ts';
import type { Analysis } from '../engine/src/analysis.ts';

/** A steady song: a downbeat every 2 s for 60 bars (120 s). */
const analysis = { downbeats: Array.from({ length: 60 }, (_, k) => k * 2), source: { durationSec: 120 } } as unknown as Analysis;
/** It landed on its hook at bar 10, which sounded at context time 100. */
const song = { analysis, deck: { startCtx: 100, offset: 20 }, landedDownbeatIndex: 10 };

test('Suspense loops the 4-bar phrase that starts at the next boundary from the landed hook', () => {
  // At context 103 the song is at 23 s (bar 11.5): the next 4-bar boundary from bar 10 is bar 14.
  const loop = nextPhraseLoop(song, 103);
  assert.deepEqual(loop, { fromSec: 28, toSec: 36, fromIndex: 14, bars: 4 });
  assert.equal(firstRepeatAt(song.deck, loop), 116);
  assert.equal(loopSeconds(song.deck, loop), 8);
  assert.equal(nextPhraseLoop({ ...song, landedDownbeatIndex: null }, 103), null, 'no phrases without a landed hook');
  assert.equal(loopSeconds({ ...song.deck, rate: 1.04 }, loop), 8 / 1.04);
});

test('Aguanta loops the last full 8-bar phrase before the outro, else a 4-bar one', () => {
  // Phrases of 8 from bar 10: 2, 10, 18, 26, 34, 42, 50 (bars); the outro's last 8 s (from 112 s) stays out.
  assert.deepEqual(lastPhraseLoop(song, 100, 8), { fromSec: 84, toSec: 100, fromIndex: 42, bars: 8 });
  // Too close to the end for an 8-bar phrase that ends by 112 s: the last 4-bar one.
  assert.deepEqual(lastPhraseLoop(song, 175, 8), { fromSec: 100, toSec: 108, fromIndex: 50, bars: 4 });
  assert.equal(lastPhraseLoop(song, 190, 8), null, 'nothing left before the outro');
});

test("when no phrase fits, a song left playing loops its last 4 bars before the outro (D239)", () => {
  // No landed hook, so no phrases: the last 4 bars that end by 112 s are bars 52–56 (104–112 s).
  const noHook = { ...song, landedDownbeatIndex: null };
  assert.equal(lastPhraseLoop(noHook, 175, 8), null);
  assert.deepEqual(lastBarsLoop(noHook, 175, 8), { fromSec: 104, toSec: 112, fromIndex: 52, bars: 4 });
  // Already inside those 4 bars (at 109 s): they still end ahead, so the deck jumps back from 112 s.
  assert.deepEqual(lastBarsLoop(noHook, 189, 8), { fromSec: 104, toSec: 112, fromIndex: 52, bars: 4 });
  assert.equal(lastBarsLoop(noHook, 193, 8), null, 'past them: nothing ahead to loop');
});

test('a song left playing always loops: ahead, its last phrase or bars before the outro; too late, back from the next downbeat (D239)', () => {
  // Ahead: the same as lastPhraseLoop, then lastBarsLoop.
  assert.deepEqual(stayLoop(song, 100, 8), lastPhraseLoop(song, 100, 8));
  const noHook = { ...song, landedDownbeatIndex: null };
  assert.deepEqual(stayLoop(noHook, 175, 8), lastBarsLoop(noHook, 175, 8));
  // In the outro (context 193 = 113 s): the last 8-bar phrase before 112 s (84–100 s, bars 42–50), out on the next
  // downbeat (114 s, context 194) instead of running out.
  const late = stayLoop(song, 193, 8);
  assert.deepEqual(late, { fromSec: 84, toSec: 100, fromIndex: 42, bars: 8, outSec: 114 });
  assert.ok(late);
  assert.equal(firstRepeatAt(song.deck, late), 194);
  assert.equal(loopSeconds(song.deck, late), 16, 'every later pass is the whole phrase');
  // Without a landed hook: the last 4 bars before the outro.
  assert.deepEqual(stayLoop(noHook, 193, 8), { fromSec: 104, toSec: 112, fromIndex: 52, bars: 4, outSec: 114 });
  // Past the last downbeat (118 s, context 198.5 = 118.5 s): back at once.
  assert.deepEqual(stayLoop(song, 198.5, 8), { fromSec: 84, toSec: 100, fromIndex: 42, bars: 8, outSec: 118.5 });
  // No beat grid: nothing to loop.
  const gridless = { ...song, analysis: { downbeats: [0, 2, 4, 6], source: { durationSec: 120 } } as unknown as Analysis };
  assert.equal(stayLoop(gridless, 150, 8), null);
});

test("a Stay's tail is the longer of the outro and what follows the song's audible end; once the audio is dead it jumps back at once", () => {
  // The audio dies at 104 s: the loop ends by then (the 8-bar phrase 84–100 s), not by 112 s.
  const quiet = { ...song, audibleEndSec: 104 };
  assert.deepEqual(stayLoop(quiet, 100, 8), { fromSec: 84, toSec: 100, fromIndex: 42, bars: 8 });
  // At 106 s (context 186), past the audible end: back at once, no waiting for a downbeat in the silence.
  assert.deepEqual(stayLoop(quiet, 186, 8), { fromSec: 84, toSec: 100, fromIndex: 42, bars: 8, outSec: 106 });
  // In the outro before the audible end, the jump waits for the next downbeat, but never past the audible end.
  assert.equal(stayLoop({ ...song, audibleEndSec: 116 }, 193, 8)?.outSec, 114, 'the next downbeat (114 s)');
  assert.equal(stayLoop({ ...song, audibleEndSec: 115 }, 194.5, 8)?.outSec, 115, 'the audio dies before the next downbeat (116 s)');
});

test('a song that runs out hands over before its audio dies, never later than its margin before the file ends', () => {
  const deck = { startCtx: 100, offset: 20, rate: 1, endCtx: 200 }; // the file ends at 120 s, context 200
  assert.equal(runOutAt(deck, null, 2.5, 2), 197.5, 'no measured end: the file end less the margin');
  assert.equal(runOutAt(deck, 108, 2.5, 2), 186, 'its audio dies at 108 s (context 188): 2 s ahead');
  assert.equal(runOutAt(deck, 119.9, 2.5, 2), 197.5, 'the margin still applies');
  assert.equal(runOutAt({ ...deck, rate: 2 }, 108, 2.5, 2), 100 + (108 - 20) / 2 - 2);
});

// The 2026 repertoire's analyses (data/out, gitignored): every song, asked as late as 10 s before its end (where the
// forward search alone failed on 42 of the 135 on 28 Nov), still loops; so does every moment from 40 s down to 2.5 s.
const DIR_2026 = path.join(OUT, 'repertoires', '2026', 'analysis');
const HAS_2026 = fs.existsSync(DIR_2026);
test('every 2026 song loops however late it is left playing', { skip: HAS_2026 ? false : 'no prepared 2026 repertoire (data/out)' }, () => {
  const files = fs.readdirSync(DIR_2026).filter((f) => /^\d+\.json$/.test(f));
  assert.ok(files.length >= 100, `${files.length} analyses`);
  let forwardFailedAt10 = 0;
  for (const f of files) {
    const analysis = JSON.parse(fs.readFileSync(path.join(DIR_2026, f), 'utf8')) as Analysis;
    const duration = analysis.source.durationSec;
    for (const hook of usableHooks(analysis)) {
      const at = (left: number) => Math.max(duration - left, hook.downbeatSec) + LOOP.aheadSec + 0.05;
      const s = { analysis, deck: { startCtx: 0, offset: 0, rate: 1 }, landedDownbeatIndex: hook.downbeatIndex };
      if (!(lastPhraseLoop(s, at(10), LOOP.stayTailSec) ?? lastBarsLoop(s, at(10), LOOP.stayTailSec))) forwardFailedAt10++;
      for (let left = 40; left >= 2.5; left -= 0.5) {
        const after = at(left);
        const loop = stayLoop(s, after, LOOP.stayTailSec);
        assert.ok(loop, `${f} hook ${hook.id}: no loop ${left} s before the end`);
        const out = loop.outSec ?? loop.toSec;
        assert.ok(out >= after - 1e-9 && out <= duration, `${f}: jumps back at ${out} (asked at ${after})`);
        assert.ok(loop.toSec <= duration - LOOP.stayTailSec + 1e-9 && loop.fromSec < loop.toSec, `${f}: the phrase is before the outro`);
        if (loop.outSec != null) {
          // Out on the next downbeat, at most a bar on.
          const bar = analysis.downbeats[1] - analysis.downbeats[0];
          assert.ok(out - after < 4 * bar + 0.5, `${f}: waits ${out - after} s`);
        }
      }
    }
  }
  assert.ok(forwardFailedAt10 >= 40, `the forward search alone fails on ${forwardFailedAt10} hooks at 10 s (42 on 28 Nov)`);
});
