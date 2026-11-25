// The decisions flagged for a person: accepted claims whose Check didn't pass. Never refused (D65), only listed.
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

test("the Desgraciat round: 'fellLast' passes a standing claim (the shared win); 'fallen' never does", () => {
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
