// The demo fixtures: the Desgraciat round's numbers are worked out from the printed cards (apps/cards/dist/cards.json),
// so the console, the stage and phones tell the same story. Every fixture is a well-formed snapshot.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { STANDING_LIST_MAX } from '@quina/protocol';
import { cardFace, parseCards } from '../../../../packages/ui/data/catalog.ts';
import {
  DESGRACIAT_COUNTS,
  DESGRACIAT_FALLEN_CARD,
  DESGRACIAT_LANDED,
  DESGRACIAT_LAST_CARD,
  DESGRACIAT_STANDING_23,
  DESGRACIAT_STANDING_26,
  FIXTURE_CARDS,
  FIXTURE_LANDED,
  FIXTURE_LANDED_LINE,
  FIXTURES,
  cardFinding,
} from '../../../../packages/ui/fixtures/states.ts';

const CARDS_JSON = new URL('../../../cards/dist/cards.json', import.meta.url);
const NOW = 1_800_000_000_000;

test('the Desgraciat fixtures follow the printed cards: #57 is the last of the normal cards 1–210 standing', () => {
  const { cards } = parseCards(JSON.parse(fs.readFileSync(CARDS_JSON, 'utf8')));
  // The fixtures' Desgraciat round plays side 1.
  const valid = [...cards.values()].filter((c) => c.type === 'normal' && c.id >= 1 && c.id <= 210).flatMap((c) => cardFace(c, 1) ?? []);
  assert.equal(valid.length, 210);
  const standingAfter = (k: number) => {
    const landed = new Set(DESGRACIAT_LANDED.slice(0, k));
    return valid.filter((c) => !c.lines.flat().some((id) => landed.has(id))).map((c) => c.id).sort((a, b) => a - b);
  };
  assert.deepEqual(DESGRACIAT_LANDED.map((_, i) => standingAfter(i + 1).length), DESGRACIAT_COUNTS);
  assert.deepEqual(standingAfter(11), DESGRACIAT_STANDING_26);
  assert.deepEqual(standingAfter(12), DESGRACIAT_STANDING_23);
  assert.deepEqual(standingAfter(DESGRACIAT_LANDED.length), [DESGRACIAT_LAST_CARD.cardId]);
  const face = (id: number) => valid.find((c) => c.id === id)?.lines.flat() ?? [];
  assert.deepEqual(face(DESGRACIAT_LAST_CARD.cardId), DESGRACIAT_LAST_CARD.songs);
  // #23's songs in card order, up to the first one that landed in the first 12.
  const fallen = face(DESGRACIAT_FALLEN_CARD.cardId);
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
  assert.equal(fallen.total, 12);
  assert.equal(fallen.cue, null, 'at its cue, not past it');
  assert.deepEqual(fallen.revealed.map((s) => s.landed), [false, false, false, false, false, false, true], 'it stops at the first landed song');
  assert.equal(fallen.revealed.at(-1)?.durationMs, 2500, 'the landed song plays its snippet');
  assert.ok(fallen.revealed.slice(0, -1).every((s) => s.durationMs === 550), 'a ✓ is a short knock');
  assert.equal(FIXTURES.checkFallen(NOW).state.claims[0].cueNext, true);
  const running = FIXTURES.checkStanding(NOW).state.check;
  assert.ok(running && running.auto && running.revealed.length === 5 && running.outcome === 'fallen');
  const valid = FIXTURES.checkStandingValid(NOW).state.check;
  assert.ok(valid && valid.outcome === 'complete' && valid.revealed.length === 12 && valid.revealed.every((s) => !s.landed));
  assert.equal(FIXTURES.celebrationStanding(NOW).state.celebration?.kind, 'standing');
});

test('the Check fixtures claim printed cards, and reveal them as the engine does', () => {
  const { cards } = parseCards(JSON.parse(fs.readFileSync(CARDS_JSON, 'utf8')));
  for (const [id, card] of Object.entries(FIXTURE_CARDS)) {
    assert.deepEqual(cards.get(Number(id)), card, `#${id}: its type and both sides' songs`);
  }
  const side1 = (id: number) => cardFace(FIXTURE_CARDS[id], 1)?.lines ?? [];
  const line57 = new Set(FIXTURE_LANDED);
  assert.deepEqual(side1(57)[2].map((id) => line57.has(id)), [true, true, true, false], "#57's third row misses «Elefants»");
  const line123 = new Set(FIXTURE_LANDED_LINE);
  assert.ok(side1(123)[0].every((id) => line123.has(id)), "#123's top row is complete once «Tots Som Súpers» lands");
});

test("a Check of the especial card reads the round's side (D226): side 1 in the Desgraciat round, side 2 in the Especial", () => {
  const [side1, side2] = FIXTURE_CARDS[508].sides.map((s) => s.lines);
  // Side 2's top row landed, and side 1's songs that aren't on side 2 too.
  const landed = new Set([...side2[0], ...side1.flat().filter((id) => !side2.flat().includes(id))]);
  const especial = cardFinding(508, 'line', landed, 'especial', 2);
  assert.deepEqual([especial.outcome, especial.row], ['complete', 0]);
  assert.deepEqual(especial.markedCard.map((s) => s.songId), side2.flat(), "the Especial round: side 2's 12 songs");
  const bingo = cardFinding(508, 'bingo', landed, 'especial', 2);
  assert.equal(bingo.outcome, 'incomplete', "side 1's landings don't fill side 2");
  const desgraciat = cardFinding(508, 'standing', new Set(side2.flat().filter((id) => !side1.flat().includes(id))), 'especial', 1);
  assert.equal(desgraciat.outcome, 'complete', 'the Desgraciat round: side 2 songs never sink side 1');
  assert.deepEqual(desgraciat.markedCard.map((s) => s.songId), side1.flat());
  assert.equal(cardFinding(508, 'line', landed, 'normal', 2).outcome, 'wrongType', 'a normal round on side 2 still rejects it');
});

test('the Check fixtures: nothing revealed, revealing, at the cue, past it, under review', () => {
  const at = (name: string) => FIXTURES[name](NOW).state;
  for (const name of ['checkStarted', 'check', 'checkAuto', 'checkValid', 'checkFailed', 'checkReview', 'checkResumed', 'checkTwo', 'checkCuePass', 'checkCueFail', 'checkCelebrateNext', 'checkWrongType', 'checkStanding', 'checkFallen', 'checkCueFallen', 'checkStandingValid']) {
    const s = at(name);
    assert.equal(s.scene, 'check', name);
    const check = s.check;
    assert.ok(check, name);
    const claim = s.claims.find((c) => c.claimId === check.claimId);
    assert.ok(claim, name);
    assert.ok(check.revealed.length <= check.total, name);
    assert.ok(claim.revealUntil === null || check.revealed.length <= claim.revealUntil + 1, `${name}: the reveals stop at the first ✗`);
    assert.equal(check.revealed.every((r, i) => i === 0 || r.atMs > check.revealed[i - 1].atMs), true, `${name}: in order`);
    assert.equal(claim.status, check.cue === 'pass' ? 'valid' : check.cue === 'fail' ? 'invalid' : check.reviewing ? 'reviewing' : 'checking', name);
  }
  assert.equal(at('checkStarted').check?.revealed.length, 0);
  assert.equal(at('checkValid').claims[0].cueNext, true, 'the next press is the cue');
  assert.equal(at('checkFailed').check?.revealed.at(-1)?.landed, false, 'the ✗ is the last reveal');
  assert.equal(at('checkWrongType').check?.total, 0);
  assert.equal(at('checkWrongType').claims[0].cueNext, true, 'a card of the wrong type: the first press is the cue');
  assert.deepEqual(at('checkCelebrateNext').celebrationNext, { claimId: 'cl-6', step: 2 });
  assert.equal(at('checkTwo').claims.length, 2);
  const resumed = at('checkResumed').check!;
  assert.ok(resumed.revealed.length === 3 && resumed.revealed.every((r) => r.atMs + r.durationMs < resumed.startAtMs), 'D121: back with 3 reveals from before it came on screen');
  assert.equal(at('checkResumed').claims[0].cueNext, false, '«Elefants» waits for a press');
});
