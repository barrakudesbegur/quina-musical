// Cards in play preview: counts per printed type, unknown numbers, compact ranges, and typed errors.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RANGES_MAX_LENGTH, formatRanges, previewCardRanges, sameCards } from '../../../../admin/logic/cards-preview.ts';

/** Cards 1–10 normal, 11–15 special, 16 desgraciat (as apps/cards types them). */
const TYPES = new Map<number, string>([
  ...Array.from({ length: 10 }, (_, i) => [i + 1, 'normal'] as const),
  ...Array.from({ length: 5 }, (_, i) => [i + 11, 'especial'] as const),
  [16, 'desgraciat'],
]);

test('formatRanges compacts sorted ids', () => {
  assert.equal(formatRanges([]), '');
  assert.equal(formatRanges([4]), '4');
  assert.equal(formatRanges([1, 2, 3, 7, 9, 10]), '1-3, 7, 9-10');
});

test('a preview counts the cards of each printed type and flags unknown numbers', () => {
  const p = previewCardRanges('1-3, 12 – 13; 20, 21 5, 16', TYPES);
  assert.equal(p.ok, true);
  assert.equal(p.error, null);
  assert.equal(p.count, 9);
  assert.equal(p.ranges, '1-3, 5, 12-13, 16, 20-21');
  assert.deepEqual(p.types, {
    byType: [{ type: 'normal', count: 4 }, { type: 'especial', count: 2 }, { type: 'desgraciat', count: 1 }],
    unknownRanges: '20-21',
    unknownCount: 2,
  });
});

test('without cards.json the types are unknown, not zero', () => {
  const p = previewCardRanges('1-5', null);
  assert.equal(p.ok, true);
  assert.equal(p.count, 5);
  assert.equal(p.types, null);
});

test('an empty text is a valid, empty preview (it clears the cards in play)', () => {
  const p = previewCardRanges('   ', TYPES);
  assert.equal(p.ok, true);
  assert.equal(p.count, 0);
  assert.equal(p.ranges, '');
});

test('junk and huge ranges come back as typed errors, never thrown', () => {
  const junk = previewCardRanges('1-10, 12a', TYPES);
  assert.equal(junk.ok, false);
  assert.deepEqual(junk.error, { kind: 'token', token: '12a' });
  const huge = previewCardRanges('1-200000', TYPES);
  assert.equal(huge.ok, false);
  assert.equal(huge.error?.kind, 'tooLarge');
});

test('ranges longer than the protocol allows are refused', () => {
  // Every other number: no two are contiguous, so the compact form stays long.
  const text = Array.from({ length: 800 }, (_, i) => String(i * 2 + 1)).join(',');
  const p = previewCardRanges(text, null);
  assert.ok(p.ranges.length > RANGES_MAX_LENGTH);
  assert.equal(p.ok, false);
  assert.equal(p.error?.kind, 'tooLong');
});

test('sameCards compares the cards named, not the text', () => {
  assert.equal(sameCards('1-3, 5', '5,3,2,1'), true);
  assert.equal(sameCards('1-3', '1-4'), false);
  assert.equal(sameCards('1-3', 'junk'), false);
  assert.equal(sameCards('', ''), true);
});
