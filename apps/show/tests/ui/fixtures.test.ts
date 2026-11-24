// The demo fixtures: the Desgraciat round's numbers are worked out from the printed cards (apps/cards/dist/cards.json),
// so the console, the stage and phones tell the same story. Every fixture is a well-formed snapshot.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { STANDING_LIST_MAX } from '@quina/protocol';
import { parseCards } from '../../../../packages/ui/data/catalog.ts';
import {
  DESGRACIAT_COUNTS,
  DESGRACIAT_FALLEN_CARD,
  DESGRACIAT_LANDED,
  DESGRACIAT_LAST_CARD,
  DESGRACIAT_STANDING_23,
  DESGRACIAT_STANDING_26,
  FIXTURES,
} from '../../../../packages/ui/fixtures/states.ts';

const CARDS_JSON = new URL('../../../cards/dist/cards.json', import.meta.url);
const NOW = 1_800_000_000_000;

test('the Desgraciat fixtures follow the printed cards: #57 is the last of the normal cards 1–210 standing', () => {
  const { cards } = parseCards(JSON.parse(fs.readFileSync(CARDS_JSON, 'utf8')));
  const valid = [...cards.values()].filter((c) => c.type === 'normal' && c.id >= 1 && c.id <= 210);
  assert.equal(valid.length, 210);
  const standingAfter = (k: number) => {
    const landed = new Set(DESGRACIAT_LANDED.slice(0, k));
    return valid.filter((c) => !c.lines.flat().some((id) => landed.has(id))).map((c) => c.id).sort((a, b) => a - b);
  };
  assert.deepEqual(DESGRACIAT_LANDED.map((_, i) => standingAfter(i + 1).length), DESGRACIAT_COUNTS);
  assert.deepEqual(standingAfter(11), DESGRACIAT_STANDING_26);
  assert.deepEqual(standingAfter(12), DESGRACIAT_STANDING_23);
  assert.deepEqual(standingAfter(DESGRACIAT_LANDED.length), [DESGRACIAT_LAST_CARD.cardId]);
  assert.deepEqual(cards.get(DESGRACIAT_LAST_CARD.cardId)?.lines.flat(), DESGRACIAT_LAST_CARD.songs);
  // #23's songs in card order, up to the first one that landed in the first 12.
  const fallen = cards.get(DESGRACIAT_FALLEN_CARD.cardId)?.lines.flat() ?? [];
  const landed12 = new Set(DESGRACIAT_LANDED.slice(0, 12));
  const sank = fallen.findIndex((id) => landed12.has(id));
  assert.deepEqual(fallen.slice(0, sank + 1), DESGRACIAT_FALLEN_CARD.songs);
  assert.equal(fallen[sank], DESGRACIAT_FALLEN_CARD.sankBy);
});

test('the Desgraciat fixtures: the standing list only from 60 down, and the Checks as the engine schedules them', () => {
  for (const name of ['desgraciat', 'desgraciatFew', 'desgraciatLast', 'checkStanding', 'checkFallen', 'checkStandingValid', 'celebrationStanding']) {
    const { state, events } = FIXTURES[name](NOW);
    assert.equal(state.round.kind, 'desgraciat', name);
    assert.equal(state.cards.climbingTo, 'standing', name);
    const standing = state.standing;
    assert.ok(standing, name);
    assert.equal(standing.cardIds === null, standing.count > STANDING_LIST_MAX, name);
    if (standing.cardIds) assert.equal(standing.cardIds.length, standing.count, name);
    for (const e of events ?? []) if (e.event.type === 'state') assert.ok(e.event.standing, name);
  }
  assert.equal(FIXTURES.desgraciat(NOW).state.standing?.count, 143);
  assert.equal(FIXTURES.desgraciatLast(NOW).state.autoAtMs, null, 'auto-advance never takes out the last card');
  const few = FIXTURES.desgraciatFew(NOW);
  const later = few.events?.[0]?.event;
  assert.equal(few.state.standing?.count, 26);
  assert.ok(later?.type === 'state' && later.standing?.count === 23);

  const fallen = FIXTURES.checkFallen(NOW).state.check;
  assert.ok(fallen);
  assert.equal(fallen.outcome, 'fallen');
  assert.equal(fallen.kind, 'standing');
  assert.equal(fallen.row, null);
  assert.ok(fallen.endAtMs < NOW, 'over');
  assert.deepEqual(fallen.steps.map((s) => s.landed), [false, false, false, false, false, false, true], 'it stops at the first landed song');
  assert.equal(fallen.steps.at(-1)?.durationMs, 2500, 'the landed song plays its snippet');
  assert.ok(fallen.steps.slice(0, -1).every((s) => s.durationMs === 550), 'a ✓ is a short knock');
  const running = FIXTURES.checkStanding(NOW).state.check;
  assert.ok(running && running.startAtMs > NOW && running.outcome === 'fallen');
  const valid = FIXTURES.checkStandingValid(NOW).state.check;
  assert.ok(valid && valid.outcome === 'complete' && valid.steps.length === 12 && valid.steps.every((s) => !s.landed) && valid.endAtMs < NOW);
  assert.equal(FIXTURES.celebrationStanding(NOW).state.celebration?.kind, 'standing');
});
