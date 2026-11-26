// The automatic voice cues (D198, D202–D204) and the drum roll held on the D-pad (D203). A presenter's press (roundIntro,
// endGame) plays its cue at once, over the music it leads into, dipped until it ends; the timed cues (the doors' countdown, the Descans)
// wait for a quiet moment and are dropped after VOICE.maxWaitSec; the voices can be switched off and skipped.
import { dataTest as test } from './support/data.ts';
import assert from 'node:assert/strict';
import { VOICE_CUES, checkGamePlan, replayJournal, type GamePlan, type JournalEntry } from '@quina/protocol';
import { DRUMROLL, VOICE } from '../engine/src/config.ts';
import type { Effect, EffectOf } from '../engine/src/show/show.ts';
import { setup, type Harness } from './support/harness.ts';

const voices = (out: readonly Effect[]) => out.filter((e): e is EffectOf<'voice'> => e.type === 'voice');
const journalOf = (log: readonly Effect[]): JournalEntry[] => log.flatMap((e) => (e.type === 'journal' ? [e.entry] : []));

function plan(over: Partial<GamePlan['schedule']> = {}, kinds = ['normal', 'normal', 'normal', 'normal', 'normal', 'desgraciat', 'normal', 'special']): GamePlan {
  const checked = checkGamePlan({
    v: 3, edition: '26', title: 'Q', prizeReveal: 'perRound', sponsors: [],
    rounds: kinds.map((kind, i) => ({ number: i + 1, kind, line: [], bingo: [] })),
    schedule: { startAtMs: null, roundMinutes: 25, intervalMinutes: 3, ...over }, cheatSheet: { claimRules: [], specialRoundRules: [] },
  });
  assert.ok(checked.ok, checked.ok ? '' : checked.errors.join('; '));
  return checked.plan;
}

function show(): Harness {
  const h = setup({ seed: 2, settings: { autoAdvance: false, voicesOn: true } });
  h.send('unlock');
  return h;
}

test("a round's start: its fanfare and voice, by its Quina number, over its intro music; with the voices off, the music alone", () => {
  const h = show();
  h.show.setPlan(plan());
  const out = h.send('roundIntro', { number: 7, kind: 'normal' });
  assert.deepEqual(voices(out).map((v) => [v.action, v.cue, v.lead]), [['play', 'round-6', 'fanfare']], 'the plan\'s round 7 is Quina 6');
  assert.ok(out.some((e) => e.type === 'introMusic'), 'the intro music under it (the runtime dips it until the voice ends)');
  assert.deepEqual(h.show.snapshot().voice && [h.show.snapshot().voice?.cue, h.show.snapshot().voice?.durationMs], ['round-6', null]);
  // The runtime tells how long its fanfare and voice last, as it starts them.
  h.show.voiceStarted('round-6', h.clock.t + 0.25, 3.4);
  assert.equal(h.show.snapshot().voice?.durationMs, 3400);
  h.show.voiceEnded('round-6');
  assert.equal(h.show.snapshot().voice, null);
  for (const [number, kind, cue] of [[6, 'desgraciat', 'round-desgraciat'], [8, 'special', 'round-especial']] as const) {
    const g = show();
    assert.deepEqual(voices(g.send('roundIntro', { number, kind })).map((v) => v.cue), [cue]);
  }
  // Skipped: the music starts at once.
  const k = show();
  k.send('roundIntro', { number: 1, kind: 'normal' });
  const skip = k.send('voiceSkip');
  assert.deepEqual(voices(skip).map((v) => v.action), ['stop']);
  assert.equal(k.show.snapshot().voice, null);
  // Off for the night: journaled, and the music at once.
  h.send('setGame', { voicesOn: false });
  const o = show();
  o.send('setGame', { voicesOn: false });
  const off = o.send('roundIntro', { number: 2, kind: 'normal' });
  assert.deepEqual(voices(off), []);
  assert.ok(off.some((e) => e.type === 'introMusic'));
  assert.deepEqual(replayJournal(journalOf(h.log)), h.show.record());
  assert.equal(h.show.record().settings?.voicesOn, false);
});

test('a cue whose end never comes (a missing file) ends by itself; the end of the night: the goodbye over the end set', () => {
  const h = show();
  h.send('roundIntro', { number: 1, kind: 'normal' });
  h.advance(VOICE.maxCueSec + VOICE.leadSec + 0.1);
  assert.equal(h.show.snapshot().voice, null);
  const out = h.send('endGame');
  assert.deepEqual(voices(out).map((v) => [v.cue, v.lead]), [['goodbye', 'chime']]);
  assert.equal(out.find((e): e is EffectOf<'intervalMusic'> => e.type === 'intervalMusic')?.set, 'end', 'under it, the end set');
});

test("the doors' countdown from the plan's start: each cue once, waiting while the presenters talk, dropped when too late", () => {
  const h = show();
  const nowMs = h.env.nowMs();
  h.show.setPlan(plan({ startAtMs: nowMs + 60 * 60_000 + 5_000, doorsAtMs: nowMs - 1000 }));
  assert.deepEqual(h.show.snapshot().voiceNext, { cue: 'doors-60', atMs: nowMs + 5_000 });
  const first = h.advance(6);
  assert.deepEqual(voices(first).map((v) => [v.cue, v.lead]), [['doors-60', 'chime']]);
  h.show.voiceEnded('doors-60');
  assert.equal(h.show.snapshot().voiceNext?.cue, 'doors-45');
  // At 45 minutes the throw song is on at the doors: the cue waits, and plays once it stops.
  h.advance(15 * 60 - 3);
  h.send('throw');
  const waiting = h.advance(10);
  assert.deepEqual(voices(waiting), [], 'not over the throw song');
  assert.equal(h.show.snapshot().voiceNext?.cue, 'doors-45', 'shown as waiting');
  h.send('throw');
  assert.deepEqual(voices(h.advance(1)).map((v) => v.cue), ['doors-45']);
  h.show.voiceEnded('doors-45');
  // At 30 minutes, kept waiting past VOICE.maxWaitSec: dropped, never late.
  h.advance(15 * 60 - 12);
  h.send('throw', { restart: true });
  h.advance(VOICE.maxWaitSec + 5);
  h.send('throw');
  assert.deepEqual(voices(h.advance(2)), [], 'too late: dropped');
  assert.equal(h.show.snapshot().voiceNext?.cue, 'doors-15');
  // Once the round's under way, the countdown is over.
  h.send('next');
  h.until(() => h.show.status === 'playing');
  assert.equal(h.show.snapshot().voiceNext, null);
});

test('"Tornem en dos minuts" two minutes before a Descans ends, only in a break with a planned Throw', () => {
  const h = show();
  h.show.setPlan(plan({ throws: [{ afterRound: 1, minutes: 10 }] }));
  // The break after round 1: a 10-minute Descans (as the Celebration hands over to the Interval).
  h.show.scene = 'interval';
  h.show.interval = h.show.intervalFrom(h.env.nowMs());
  const interval = h.show.interval;
  assert.ok(interval);
  assert.equal(interval.guideEndMs - interval.sinceMs, 10 * 60_000);
  assert.equal(h.show.snapshot().voiceNext?.cue, 'descans-2min');
  const out = h.advance((interval.guideEndMs - h.env.nowMs()) / 1000 - VOICE.descansWarnSec + 0.5);
  assert.deepEqual(voices(out).map((v) => v.cue), ['descans-2min']);
  // A plain Interval has none.
  const g = show();
  g.show.setPlan(plan());
  g.show.scene = 'interval';
  g.show.interval = g.show.intervalFrom(g.env.nowMs());
  assert.equal(g.show.snapshot().voiceNext, null);
});

test('the drum roll (D203): on the playing song\'s beat while held; let go after 2 s it lands on a beat, sooner it fades', () => {
  const h = show();
  h.send('next');
  h.until(() => h.show.status === 'playing');
  const start = h.send('padHold', { effect: 'drumroll', on: true, intensity: 0.2 }).find((e): e is EffectOf<'padHold'> => e.type === 'padHold');
  assert.ok(start?.action === 'start' && start.grid && start.grid.beatSec > 0.2 && start.grid.beatSec < 1.2, `a beat of ${start?.grid?.beatSec}`);
  assert.deepEqual(h.show.snapshot().padHold && [h.show.snapshot().padHold?.effect, h.show.snapshot().padHold?.intensity], ['drumroll', 0.2]);
  assert.equal(h.send('padHold', { effect: 'drumroll', on: true, intensity: 0.8 }).find((e) => e.type === 'padHold')?.action, 'intensity');
  h.advance(DRUMROLL.landAfterSec + 0.1);
  const land = h.send('padHold', { effect: 'drumroll', on: false }).find((e): e is EffectOf<'padHold'> => e.type === 'padHold');
  assert.ok(land?.action === 'release' && land.land === true);
  const beats = (land.at - start.grid!.t0) / start.grid!.beatSec;
  assert.ok(Math.abs(beats - Math.round(beats)) < 1e-6 && land.at >= h.clock.t, 'on a beat, not before now');
  // A short hold fades out at once.
  h.send('padHold', { effect: 'drumroll', on: true });
  h.advance(0.5);
  const short = h.send('padHold', { effect: 'drumroll', on: false }).find((e): e is EffectOf<'padHold'> => e.type === 'padHold');
  assert.deepEqual([short?.land, short?.at], [false, h.clock.t]);
  assert.equal(h.show.snapshot().padHold, null);
  // Pausa lets it go without the hit, and stops a voice cue.
  h.send('padHold', { effect: 'drumroll', on: true });
  h.advance(3);
  const pause = h.send('pause', { on: true });
  assert.equal(pause.find((e): e is EffectOf<'padHold'> => e.type === 'padHold')?.land, false);
  assert.deepEqual(h.send('padHold', { effect: 'drumroll', on: true }).flatMap((e) => (e.type === 'reject' ? [e.reason] : [])), ['wrongScene'], 'not during Pausa');
});

test("the cue names match tools/prep/voices.py's lines", async () => {
  const fs = await import('node:fs');
  const py = fs.readFileSync(new URL('../../../tools/prep/voices.py', import.meta.url), 'utf8');
  const names = [...py.matchAll(/^ {4}"([a-z0-9-]+)": "/gm)].map((m) => m[1]);
  const rounds = Array.from({ length: 10 }, (_, i) => `round-${i + 1}`);
  assert.deepEqual([...rounds, ...names].sort(), [...VOICE_CUES].sort());
});
