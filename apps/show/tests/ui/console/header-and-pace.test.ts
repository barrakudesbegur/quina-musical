// The header's Heat bar with its Phase zones, its chips and Drift; the Pace panel's recommended preset and the
// Schedule recovery notice; Parlem and Aguanta.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PACE_PRESETS_SEC, type PaceInfo, type ShowState } from '@quina/protocol';
import { DEFAULT_PACE_SEC, HEAT_BANDS } from '../../../../console/logic/engine-rules.ts';
import { activeHoldMode, holdPress } from '../../../../console/logic/hold-modes.ts';
import { recommendedPreset, recoveryNotice } from '../../../../console/logic/pace-panel.ts';
import { phaseZones, zoneColumns, zoneMarks } from '../../../../console/logic/phase-zones.ts';
import { driftTone, headerChips, linksOf } from '../../../../console/logic/status.ts';
import { S } from '../../../../console/strings.ts';

test('the Phase zones come from the engine’s Heat bands: each Phase starts where its band does', () => {
  const zones = phaseZones(HEAT_BANDS);
  assert.ok(zones, 'the engine’s bands climb with the Phase');
  assert.deepEqual(
    zones.map((z) => [z.phase, z.start, z.end]),
    [
      ['early', 0, 0.3],
      ['mid', 0.3, 0.55],
      ['late', 0.55, 0.8],
      ['final', 0.8, 1],
    ],
  );
  assert.deepEqual(zoneMarks(zones), [0.3, 0.55, 0.8]);
  assert.equal(zoneColumns(zones), '30fr 25fr 25fr 20fr');
});

test('bands that don’t climb with the Phase give no zones (the bar then names the Phase only)', () => {
  const ok = { early: [0, 0.3], mid: [0.3, 0.55], late: [0.55, 0.8], final: [0.8, 1] } as const;
  assert.equal(phaseZones({ ...ok, mid: [0.2, 0.55] }), null, 'overlapping');
  assert.equal(phaseZones({ ...ok, late: [0.25, 0.5] }), null, 'out of order');
  assert.equal(phaseZones({ ...ok, final: [0.8, 1.2] }), null, 'outside 0..1');
  assert.ok(phaseZones({ ...ok, late: [0.6, 0.8] }), 'a gap between bands is fine');
});

test('the recommended preset is the engine’s default Pace, the same in every round (a repeat’s slot, D174)', () => {
  assert.equal(recommendedPreset(DEFAULT_PACE_SEC, PACE_PRESETS_SEC), 14);
  assert.equal(recommendedPreset(DEFAULT_PACE_SEC, [11, 18]), null, 'not a preset: no badge');
});

const pace = (over: Partial<PaceInfo>): PaceInfo => ({ sec: 14, firstPlaySec: 22, locked: false, nudge: 1, slotSec: 14, spinSec: 7, ...over });

test('the recovery notice: how much shorter or longer each song is, from the nudge', () => {
  // Running late: nudge 0.93 squeezes a 14 s slot to 13.02 s, about 1 s less per song.
  assert.deepEqual(recoveryNotice(pace({ nudge: 0.93, slotSec: 13.02 })), { direction: 'faster', seconds: 1 });
  // Ahead: nudge 1.2 stretches 14 s to 16.8 s.
  assert.deepEqual(recoveryNotice(pace({ nudge: 1.2, slotSec: 16.8 })), { direction: 'slower', seconds: 3 });
  // Under half a second still says so, in words.
  assert.deepEqual(recoveryNotice(pace({ nudge: 0.98, slotSec: 13.72 })), { direction: 'faster', seconds: 0 });
  assert.equal(recoveryNotice(pace({})), null, 'no nudge');
  assert.equal(recoveryNotice(pace({ nudge: 0.9, slotSec: 12.6, locked: true })), null, 'locked');
  assert.equal(recoveryNotice(pace({ nudge: 0.93, slotSec: 13.02 }), false), null, 'before the night: no round to recover');
  assert.equal(S.pace.recovery({ direction: 'faster', seconds: 1 }), "Recuperant l'horari: cada cançó dura 1 s menys.");
  assert.equal(S.pace.recovery({ direction: 'slower', seconds: 0 }), 'Anem avançats: cada cançó dura una mica més.');
});

test('header chips: LAN is up only when the laptop’s relay and its show page both answer', () => {
  assert.deepEqual(headerChips(linksOf(true, true)), { cloud: 'unknown', lan: 'up', feed: 'unknown', wii: 'unknown' });
  assert.equal(headerChips(linksOf(true, false)).lan, 'down', 'the show page is closed');
  assert.equal(headerChips(linksOf(false, false)).lan, 'down');
});

test('the Drift chip’s tone agrees with its words', () => {
  assert.equal(driftTone(120), 'late');
  assert.equal(driftTone(-180), 'early');
  assert.equal(driftTone(10), 'onTime', "under 30 s reads as «a l'hora»");
  assert.equal(driftTone(null), 'onTime');
  assert.equal(driftTone(Number.NaN), 'onTime');
});

type HoldState = Pick<ShowState, 'status' | 'hold'>;
const holding = (extra: Record<string, unknown> = {}): HoldState => ({
  status: 'hold',
  hold: { sinceMs: 0, reason: 'hold', holdMusic: false, ...extra },
});

test('the active hold mode: none, Parlem (ducked, or an engine without `ducked`), Aguanta', () => {
  assert.equal(activeHoldMode(null), null);
  assert.equal(activeHoldMode({ status: 'playing', hold: null }), null);
  assert.equal(activeHoldMode(holding()), 'talk');
  assert.equal(activeHoldMode(holding({ ducked: true })), 'talk');
  assert.equal(activeHoldMode(holding({ ducked: false })), 'stay');
});

test("the show flow's own Hold is no Parlem (whats-left 2.3): a round's intro, the Interval, the end; a Celebration's only when on (D117)", () => {
  // The engine holds the round (status hold, ducked) under the scene's own music in these scenes.
  const flowHold = (scene: ShowState['scene'], parlem?: boolean) => ({
    ...holding({ ducked: true, reason: scene === 'celebration' ? 'claim' : 'music' }),
    scene,
    celebration: parlem === undefined ? null : { kind: 'line', round: 1, cardIds: [5], winningSongId: 9, sinceMs: 0, music: 'winningSong', parlem },
  }) as Pick<ShowState, 'status' | 'hold' | 'scene' | 'celebration'>;
  for (const scene of ['roundStart', 'interval', 'after'] as const) assert.equal(activeHoldMode(flowHold(scene)), null, scene);
  assert.equal(activeHoldMode(flowHold('celebration', false)), null);
  assert.equal(activeHoldMode(flowHold('celebration', true)), 'talk');
  assert.equal(activeHoldMode(flowHold('play')), 'talk', "a round's Parlem");
  assert.equal(activeHoldMode(flowHold('check')), 'talk', "a Claim's Hold (game-rules: the presenters stop new songs)");
  // Parlem's tap in a Celebration then turns its own Parlem on, and off.
  assert.deepEqual(holdPress('talk', activeHoldMode(flowHold('celebration', false))), { on: true, duck: true });
  assert.deepEqual(holdPress('talk', activeHoldMode(flowHold('celebration', true))), { on: false });
});

test('Parlem and Aguanta: each enters its mode, the active one releases, the other switches in place', () => {
  assert.deepEqual(holdPress('talk', null), { on: true, duck: true });
  assert.deepEqual(holdPress('stay', null), { on: true, duck: false });
  assert.deepEqual(holdPress('talk', 'talk'), { on: false }, 'pressing the active one releases');
  assert.deepEqual(holdPress('stay', 'stay'), { on: false });
  assert.deepEqual(holdPress('stay', 'talk'), { on: true, duck: false }, 'Parlem → Aguanta without releasing');
  assert.deepEqual(holdPress('talk', 'stay'), { on: true, duck: true });
});
