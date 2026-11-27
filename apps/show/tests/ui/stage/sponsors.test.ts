// The sponsor strip's pages (`sponsor-pages`): one full row at a time, cycling, so every sponsor is mentioned.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { panTiming, sponsorPage } from '../../../../stage/model/sponsors.ts';

const list = Array.from({ length: 19 }, (_, i) => i + 1);

test('a list that fits one row has a single page', () => {
  assert.deepEqual(sponsorPage(list.slice(0, 8), 8, 123_456, 8000), { index: 0, pages: 1, items: list.slice(0, 8) });
});

test('more sponsors turn the page every pageMs; the last page fills up from the first', () => {
  assert.deepEqual(sponsorPage(list, 8, 0, 8000).items, [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual(sponsorPage(list, 8, 8000, 8000).items, [9, 10, 11, 12, 13, 14, 15, 16]);
  assert.deepEqual(sponsorPage(list, 8, 16_000, 8000), { index: 2, pages: 3, items: [17, 18, 19, 1, 2, 3, 4, 5] });
  assert.equal(sponsorPage(list, 8, 24_000, 8000).index, 0, 'and round again');
  const seen = new Set([0, 1, 2].flatMap((p) => sponsorPage(list, 8, p * 8000, 8000).items));
  assert.equal(seen.size, list.length, 'every sponsor shows in one cycle');
});

test('the pan takes one list length at its speed, from a random point of the loop', () => {
  assert.deepEqual(panTiming(55 * 264, 60, 0), { durationS: 242, delayS: -0 });
  assert.deepEqual(panTiming(1200, 60, 0.5), { durationS: 20, delayS: -10 });
  assert.ok(panTiming(1200, 60, 1).delayS > -20, 'never a whole loop: the same as none');
  assert.equal(panTiming(0, 60, 0.3).durationS, 1, 'an empty strip never divides by zero');
});
