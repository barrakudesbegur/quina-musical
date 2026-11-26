// The decisions flagged for a person: accepted claims whose Check didn't pass, or whose card wasn't sold. Never
// refused (D65), only listed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { flaggedDecisions } from '../../src/domain/flags.ts';
import { JournalBuilder } from '../support/journal-builder.ts';

test('an accepted claim is flagged only when its Check did not pass', () => {
  const b = new JournalBuilder('g-flags').startRound().land(10);
  const passed = b.claim(12, 'line');
  b.decide(passed, 'valid', 'complete');
  const refused = b.claim(34, 'bingo');
  b.decide(refused, 'invalid', 'incomplete'); // rejected: nothing to flag
  const wrong = b.claim(56, 'bingo');
  b.decide(wrong, 'valid', 'incomplete'); // accepted although incomplete: flagged
  const older = b.claim(78, 'bingo');
  b.decide(older, 'valid'); // an older journal, no outcome: never flagged
  assert.deepEqual(
    flaggedDecisions(b.entries).map((f) => [f.cardId, f.kind, f.outcome]),
    [[56, 'bingo', 'incomplete']],
  );
});

test("the Desgraciat round: 'fallen' never passes; a journal from before D180 keeps its shared win ('fellLast' passed a standing claim)", () => {
  const b = new JournalBuilder('g-flags-standing').startRound('desgraciat').land(20);
  const shared = [b.claim(3, 'standing'), b.claim(7, 'standing')];
  for (const id of shared) b.decide(id, 'valid', 'fellLast');
  const fallen = b.claim(9, 'standing');
  b.decide(fallen, 'valid', 'fallen');
  assert.deepEqual(flaggedDecisions(b.entries).map((f) => [f.cardId, f.outcome]), [[9, 'fallen']]);
  // 'fellLast' passes only a standing claim.
  const line = new JournalBuilder('g-flags-line').startRound().land(5);
  const odd = line.claim(4, 'line');
  line.decide(odd, 'valid', 'fellLast');
  assert.equal(flaggedDecisions(line.entries).length, 1);
});

test('a win by hand from a Review (D121) on a card that does not pass is flagged, and says it was by hand', () => {
  const b = new JournalBuilder('g-flags-manual').startRound().land(10);
  const byHand = b.claim(21, 'bingo');
  b.review(byHand).decide(byHand, 'valid', 'incomplete', true);
  const lostByHand = b.claim(22, 'bingo');
  b.review(lostByHand).decide(lostByHand, 'invalid', 'complete', true); // a loss is never flagged
  assert.deepEqual(
    flaggedDecisions(b.entries).map((f) => [f.cardId, f.manual, f.reasons]),
    [[21, true, ['notPassing']]],
  );
});

test('a valid card that is not among the cards in play is flagged as not sold, from the cards set before it', () => {
  const b = new JournalBuilder('g-flags-sold').startRound().land(10);
  const early = b.claim(5, 'line');
  b.decide(early, 'valid', 'complete'); // no cards in play journalled yet: nothing to judge
  b.cards('1-100');
  const sold = b.claim(50, 'line');
  b.decide(sold, 'valid', 'complete');
  const unsold = b.claim(150, 'bingo');
  b.decide(unsold, 'valid', 'complete');
  const both = b.claim(160, 'bingo');
  b.review(both).decide(both, 'valid', 'incomplete', true);
  assert.deepEqual(
    flaggedDecisions(b.entries).map((f) => [f.cardId, f.reasons]),
    [
      [150, ['notSold']],
      [160, ['notPassing', 'notSold']],
    ],
  );
});
