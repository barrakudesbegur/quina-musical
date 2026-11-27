// The garland shared by the phones and the projector (packages/ui/motion/garland.ts; ANIMATIONS.md "The garland's
// lights", D-t): its shape, which pattern plays for a Heat and a mood, and each bulb's part in it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  GARLAND_FLASHES_PER_CYCLE,
  GARLAND_PERIOD_MS,
  PARTY_COLORS,
  garlandBulbs,
  garlandLayout,
  garlandLights,
  heatLevel,
  type GarlandMood,
} from '../../../../packages/ui/motion/garland.ts';

const seq = (values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length];
};

test('the layout hangs evenly spaced bulbs from the wire, tilted with it', () => {
  const layout = garlandLayout({ width: 1440, swags: 4, bulbs: 34, top: 12, sag: 62 });
  assert.equal(layout.lights.length, 34);
  assert.ok(layout.wire.startsWith('M0 12Q'));
  assert.equal(layout.wire.match(/Q/g)?.length, 4);
  for (const light of layout.lights) {
    assert.ok(light.x > 0 && light.x < 1);
    assert.ok(light.y >= 12 && light.y <= 12 + 62);
    assert.ok(Math.abs(light.angle) < 45);
  }
  // Left of a swag's lowest point the wire goes down, so the bulb tilts one way; right of it, the other.
  assert.ok(layout.lights[0].angle > 0);
  assert.ok(layout.lights[6].angle < 0);
});

test('Heat levels: cold, warm, hot, very hot', () => {
  assert.deepEqual([0, 0.24, 0.25, 0.49, 0.5, 0.74, 0.75, 1].map(heatLevel), ['cold', 'cold', 'warm', 'warm', 'hot', 'hot', 'fire', 'fire']);
});

test('live, the pattern follows the Heat level, and only very hot has flames', () => {
  const at = (h: number) => garlandLights(h, 'live');
  assert.deepEqual([0.1, 0.3, 0.6, 0.9].map((h) => at(h).pattern), ['breathe', 'wave', 'chase', 'fire']);
  assert.deepEqual([0.1, 0.3, 0.6, 0.9].map((h) => at(h).fire), [false, false, false, true]);
  assert.ok([0.1, 0.3, 0.6, 0.9].every((h) => at(h).palette === 'heat'));
  assert.equal(at(0.6).periodMs, GARLAND_PERIOD_MS.chase);
  // Out of range or not a number: clamped, never a crash.
  assert.equal(at(7).pattern, 'fire');
  assert.equal(at(-1).pattern, 'breathe');
  assert.equal(at(Number.NaN).pattern, 'breathe');
});

test('the moods: idle is calm, off is dark, party and win take the party colours and keep the Heat in pace and flames', () => {
  assert.deepEqual(garlandLights(0.9, 'idle'), { level: 'fire', pattern: 'breathe', periodMs: GARLAND_PERIOD_MS.idle, palette: 'heat', fire: false });
  assert.deepEqual(garlandLights(0.9, 'off'), { level: 'fire', pattern: 'none', periodMs: 0, palette: 'heat', fire: false });
  const party = [0.1, 0.3, 0.6, 0.9].map((h) => garlandLights(h, 'party'));
  assert.ok(party.every((p) => p.pattern === 'party' && p.palette === 'party'));
  assert.deepEqual(
    party.map((p) => p.periodMs),
    [2400, 1800, 1400, 1100],
    'hotter is faster',
  );
  assert.deepEqual(
    party.map((p) => p.fire),
    [false, false, false, true],
  );
  const win = garlandLights(0.95, 'win');
  assert.deepEqual([win.pattern, win.palette, win.fire], ['win', 'party', true]);
  assert.equal(garlandLights(0.2, 'win').fire, false);
});

test('no pattern flashes more than three times a second (WCAG 2.3.1)', () => {
  const moods: GarlandMood[] = ['live', 'idle', 'off', 'party', 'win'];
  for (const mood of moods) {
    for (const h of [0, 0.3, 0.6, 0.8, 1]) {
      const lights = garlandLights(h, mood);
      if (lights.pattern === 'none') continue;
      const perSecond = (GARLAND_FLASHES_PER_CYCLE[lights.pattern] * 1000) / lights.periodMs;
      assert.ok(perSecond <= 3, `${mood} at ${h}: ${perSecond} flashes/s`);
      assert.ok(perSecond <= 1, `${mood} at ${h}: kept under one a second`);
    }
  }
});

test('each bulb gets its step, its seed, a party colour in order, and flames on every n-th bulb', () => {
  const phone = garlandBulbs(13, 3, seq([0.25, 0.5, 0.123456]));
  assert.equal(phone.length, 13);
  assert.deepEqual(
    phone.map((b) => b.step),
    [0, 1, 2, 0, 1, 2, 0, 1, 2, 0, 1, 2, 0],
  );
  assert.deepEqual(
    phone.slice(0, 3).map((b) => b.seed),
    [0.25, 0.5, 0.123],
  );
  assert.deepEqual(
    phone.slice(0, 7).map((b) => b.party),
    [...PARTY_COLORS, PARTY_COLORS[0]],
  );
  assert.deepEqual(
    phone.filter((b) => b.flame).map((b) => b.index),
    [1, 4, 7, 10],
    'four flames on a phone, both ends clear',
  );
  const stage = garlandBulbs(34, 2, () => 0.5);
  assert.equal(stage.filter((b) => b.flame).length, 17);
  assert.equal(stage[0].flame, false);
  assert.ok(garlandBulbs(3, 1, () => 2).every((b) => b.flame && b.seed === 1), 'every bulb, seed clamped');
});
