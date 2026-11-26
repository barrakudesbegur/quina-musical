// The claimed cards' strip: order, warnings, "complete since song N", which ones can be checked by hand.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FIXTURES } from '../../../../../packages/ui/fixtures/states.ts';
import { summarizeClaims } from '../../../../console/logic/claims.ts';
import type { ClaimInfo } from '../../../../../packages/ui/flow.ts';

const NOW = 1_800_000_000_000;

const claim = (over: Partial<ClaimInfo>): ClaimInfo => ({
  claimId: 'cl-1',
  round: 3,
  cardId: 1,
  kind: 'line',
  atMs: NOW,
  position: 20,
  status: 'queued',
  outcome: null,
  completeSince: null,
  warnings: [],
  markedCard: [],
  revealUntil: null,
  cueNext: false,
  ...over,
});

test('the fixture: the checking claim is current, the queued one is flagged unsold and can be checked by hand', () => {
  const s = FIXTURES.check(NOW).state;
  const summary = summarizeClaims(s.claims ?? [], s.check ?? null);
  assert.deepEqual(summary.items.map((c) => [c.cardId, c.current, c.notSold, c.canCheck]), [
    [57, true, false, false],
    [204, false, true, true],
  ]);
  assert.equal(summary.open, 2);
  assert.equal(summary.allDecided, false);
});

test('claims are listed oldest first: the first to claim wins', () => {
  const summary = summarizeClaims([claim({ claimId: 'b', atMs: NOW + 5, cardId: 2 }), claim({ claimId: 'a', atMs: NOW, cardId: 1 })], null);
  assert.deepEqual(summary.items.map((c) => c.cardId), [1, 2]);
});

test('"complete since song N" is the 1-based song number', () => {
  const [view] = summarizeClaims([claim({ completeSince: 33, outcome: 'complete', status: 'checking' })], null).items;
  assert.equal(view.completeSinceSong, 34);
  const [none] = summarizeClaims([claim({ completeSince: null })], null).items;
  assert.equal(none.completeSinceSong, null);
});

test('settled claims (valid, invalid, discarded) are counted; only a queued one can be checked by hand', () => {
  const summary = summarizeClaims(
    [
      claim({ claimId: 'a', status: 'valid' }),
      claim({ claimId: 'b', status: 'invalid' }),
      claim({ claimId: 'c', status: 'discarded' }),
      claim({ claimId: 'd', status: 'reviewing' }),
      claim({ claimId: 'e', status: 'queued' }),
    ],
    null,
  );
  assert.equal(summary.valid, 1);
  assert.equal(summary.invalid, 1);
  assert.equal(summary.open, 2);
  assert.equal(summary.allDecided, false);
  assert.deepEqual(summary.items.map((c) => c.canCheck), [false, false, false, false, true]);
  assert.equal(summarizeClaims([claim({ status: 'discarded' })], null).allDecided, true);
  assert.equal(summarizeClaims([claim({ status: 'valid' })], null).allDecided, true);
  assert.equal(summarizeClaims([], null).allDecided, false);
});

test('"claimed at song N": the 1-based number of the last counted song', () => {
  const [view] = summarizeClaims([claim({ position: 23 })], null).items;
  assert.equal(view.claimedAtSong, 24);
});
