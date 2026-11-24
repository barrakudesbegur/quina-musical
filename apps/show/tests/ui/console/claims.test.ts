// The claimed cards' queue: order, warnings, "complete since song N", what each row offers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FIXTURES } from '../../../ui/fixtures/states.ts';
import { summarizeClaims } from '../../../console/logic/claims.ts';
import type { ClaimInfo } from '../../../ui/flow.ts';

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
  ...over,
});

test('the fixture: the checking claim is current, the queued one is flagged unsold', () => {
  const s = FIXTURES.check(NOW).state;
  const summary = summarizeClaims(s.claims ?? [], s.check ?? null);
  assert.deepEqual(summary.items.map((c) => [c.cardId, c.current, c.notSold, c.canCheck]), [
    [57, true, false, true],
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
  const [view] = summarizeClaims([claim({ completeSince: 33, outcome: 'complete', status: 'checked' })], null).items;
  assert.equal(view.completeSinceSong, 34);
  const [none] = summarizeClaims([claim({ completeSince: null })], null).items;
  assert.equal(none.completeSinceSong, null);
});

test('decided claims are counted and can no longer be checked', () => {
  const summary = summarizeClaims(
    [claim({ claimId: 'a', status: 'valid' }), claim({ claimId: 'b', status: 'invalid' }), claim({ claimId: 'c', status: 'checked' })],
    null,
  );
  assert.equal(summary.valid, 1);
  assert.equal(summary.invalid, 1);
  assert.equal(summary.open, 1);
  assert.equal(summary.allDecided, false);
  assert.deepEqual(summary.items.map((c) => c.canCheck), [false, false, true]);
  assert.equal(summarizeClaims([claim({ status: 'valid' })], null).allDecided, true);
  assert.equal(summarizeClaims([], null).allDecided, false);
});
