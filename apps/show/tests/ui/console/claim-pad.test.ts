// The claim pad (D110, D126): chips with «+ Candidat», a number no printed card has refused in private, the claim
// «Comprovar» sends, and the engine's `unknownCard` rejection marking the chips it names.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addTyped, openPad, padAfterUnknown, padClaim, padKey, removeChip, type ClaimPadRules, type ClaimPadState } from '../../../../console/logic/claim-pad.ts';
import { S } from '../../../../console/strings.ts';

const PRINTED = new Set([57, 123, 204]);
const rules: ClaimPadRules = { maxDigits: 4, max: 9999, maxCards: 3, known: (id) => PRINTED.has(id) };
const noCatalogue: ClaimPadRules = { ...rules, known: () => null };
const type = (pad: ClaimPadState, digits: string, r = rules) => [...digits].reduce((p, d) => padKey(p, d as '0', r), pad);

test('«+ Candidat» turns the typed number into a chip and empties the field; a repeat or nothing typed adds nothing', () => {
  let pad = type(openPad('line'), '57');
  ({ pad } = addTyped(pad, rules));
  assert.deepEqual(pad.chips, [{ cardId: 57, unknown: false }]);
  assert.equal(pad.digits, '');
  assert.equal(addTyped(pad, rules).outcome, 'empty');
  const again = addTyped(type(pad, '57'), rules);
  assert.equal(again.outcome, 'duplicate');
  assert.equal(again.pad.chips.length, 1);
  assert.equal(again.pad.digits, '');
});

test('a number no printed card has is refused here: it stays typed, in red, until it is edited (D126)', () => {
  const refused = addTyped(type(openPad('line'), '1204'), rules);
  assert.equal(refused.outcome, 'unknown');
  assert.equal(refused.pad.refused, true);
  assert.equal(refused.pad.digits, '1204', 'kept, to be corrected');
  assert.equal(padClaim(refused.pad, rules), null, 'nothing reaches the engine');
  assert.equal(padKey(refused.pad, 'back', rules).refused, false, 'editing clears the red');
  assert.equal(addTyped(type(openPad('line'), '1204', noCatalogue), noCatalogue).outcome, 'added', 'without the catalogue the engine checks');
});

test('«Comprovar» claims the chips, then the number still typed, in order; one card is `cardId`', () => {
  let pad = type(openPad('bingo'), '204');
  ({ pad } = addTyped(pad, rules));
  pad = type(pad, '57');
  assert.deepEqual(padClaim(pad, rules), { cardIds: [204, 57], kind: 'bingo' });
  assert.deepEqual(padClaim(type(openPad('line'), '123'), rules), { cardId: 123, kind: 'line' });
  assert.equal(padClaim(openPad('line'), rules), null);
  assert.equal(padClaim(type(pad, '9'), rules), null, '579 is no printed card');
  assert.deepEqual(padClaim(removeChip(pad, 204), rules), { cardId: 57, kind: 'bingo' });
});

test('at most the claim command\'s cards: the pad is full', () => {
  let pad = openPad('line');
  for (const n of ['57', '123', '204']) ({ pad } = addTyped(type(pad, n), rules));
  assert.equal(pad.chips.length, 3);
  assert.equal(addTyped(type(pad, '1', noCatalogue), noCatalogue).outcome, 'full');
});

test("the engine's unknownCard rejection brings the claim back, the numbers it names marked, and «Comprovar» waits", () => {
  const back = padAfterUnknown({ cardIds: [57, 999, 1204], kind: 'bingo' }, '999,1204', 'line');
  assert.deepEqual(back.chips, [
    { cardId: 57, unknown: false },
    { cardId: 999, unknown: true },
    { cardId: 1204, unknown: true },
  ]);
  assert.equal(back.kind, 'bingo');
  assert.equal(padClaim(back, noCatalogue), null, 'until the marked chips are removed');
  assert.deepEqual(padClaim(removeChip(removeChip(back, 999), 1204), noCatalogue), { cardId: 57, kind: 'bingo' });
  assert.deepEqual(padAfterUnknown({ cardId: 5000 }, null, 'line').chips, [{ cardId: 5000, unknown: false }], 'no detail: nothing marked');
});

test('the pad says what «Comprovar» claims', () => {
  assert.equal(S.numpad.submit([]), 'Comprovar');
  assert.equal(S.numpad.submit([57]), 'Comprovar el #57');
  assert.equal(S.numpad.submit([57, 204]), 'Comprovar 2 cartrons');
  assert.equal(S.numpad.submitNote('line', [57, 204]), 'Línia · #57 i #204');
});
