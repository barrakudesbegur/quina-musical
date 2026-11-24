// The phones' public Heat (`heat.sample`): sent a random 4–15 s after a landing, never at it, from the round's
// seeded randomness, and only with cards in play.
import { dataTest as test } from './support/data.ts';
import assert from 'node:assert/strict';
import type { EventOf } from '@quina/protocol';
import { FLOW } from '../engine/src/config.ts';
import { setup, allCards } from './support/harness.ts';

/** Play `landings` songs on auto-advance; every heat sample with the audio clock it was sent at, and the landings. */
function run(seed: number, cardsInPlay: string, landings = 12) {
  const h = setup({ seed, cards: allCards, cardsInPlay, settings: { pace: 11, autoAdvanceFinal: true } });
  h.send('unlock');
  h.send('next');
  const samples: { sentAt: number; event: EventOf<'heat.sample'> }[] = [];
  const landed: number[] = [];
  for (let n = 0; n < 200 * 40 && landed.length < landings; n++) {
    h.clock.t += 0.025;
    for (const e of h.show.tick()) {
      if (e.type !== 'emit') continue;
      if (e.message.type === 'heat.sample') samples.push({ sentAt: h.env.toEpochMs(h.clock.t), event: e.message });
      if (e.message.type === 'transition.landed') landed.push(e.message.atMs);
    }
  }
  assert.equal(landed.length, landings, 'the songs landed');
  // The last landing's sample (sent during a 25 ms tick of `advance`: its exact time is not checked).
  for (const e of h.advance(FLOW.heatSample.maxDelaySec + 1)) {
    if (e.type === 'emit' && e.message.type === 'heat.sample') samples.push({ sentAt: Infinity, event: e.message });
  }
  return { samples, landed };
}

test('a Heat sample comes 4–15 s after a landing, never at one, and is sent at its fromMs', () => {
  const { samples, landed } = run(5, '1-200');
  assert.ok(samples.length >= 3, `${samples.length} samples`);
  for (const { sentAt, event } of samples) {
    assert.ok(!landed.some((atMs) => Math.abs(atMs - event.fromMs) < 1), `a sample at a landing (${event.fromMs})`);
    const after = landed.filter((atMs) => atMs < event.fromMs).at(-1);
    assert.ok(after != null);
    const delay = event.fromMs - after;
    assert.ok(delay >= FLOW.heatSample.minDelaySec * 1000 - 1 && delay <= FLOW.heatSample.maxDelaySec * 1000 + 1, `${delay} ms after its landing`);
    assert.ok(event.value >= 0 && event.value <= 1);
    assert.ok(event.toMs > event.fromMs && event.toMs - event.fromMs <= 40_000);
    if (Number.isFinite(sentAt)) assert.ok(sentAt >= event.fromMs - 1 && sentAt < event.fromMs + 30, 'sent at its fromMs');
  }
});

test('Heat samples are deterministic for a seed', () => {
  const a = run(9, '1-150').samples.map((s) => s.event);
  const b = run(9, '1-150').samples.map((s) => s.event);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, run(10, '1-150').samples.map((s) => s.event));
});

test('no Heat samples without cards in play; Back drops one not sent yet', () => {
  assert.deepEqual(run(5, '', 4).samples, []);
  const h = setup({ seed: 2, cards: allCards, cardsInPlay: '1-200', settings: { autoAdvance: false } });
  h.send('unlock');
  h.send('next');
  h.until(() => h.show.status === 'playing');
  assert.ok(h.show.heatSample, 'one is due');
  h.send('back');
  assert.equal(h.show.heatSample, null);
  const later = h.advance(FLOW.heatSample.maxDelaySec + 1);
  assert.ok(!later.some((e) => e.type === 'emit' && e.message.type === 'heat.sample'));
});
