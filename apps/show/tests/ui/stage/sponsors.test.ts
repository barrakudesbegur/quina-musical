// The sponsor strip (`sponsor-pan`, `sponsor-pages`): its rows, its seamless loop, its pages.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loopRepeats, panTiming, sponsorPage, stripRows } from '../../../../stage/model/sponsors.ts';

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

test('rows (S4): the list split in order, as evenly as it goes, never an empty row', () => {
  assert.deepEqual(stripRows(list, 1), [list]);
  assert.deepEqual(stripRows(list, 2), [list.slice(0, 10), list.slice(10)]);
  assert.deepEqual(stripRows(list, 3).map((r) => r.length), [7, 6, 6]);
  assert.deepEqual(stripRows([1, 2], 3), [[1], [2]], 'a short list fills fewer rows');
  assert.deepEqual(stripRows([], 2), []);
  assert.deepEqual(stripRows(list, 0), [list], 'at least one row');
});

test('a list narrower than the strip repeats until one loop fills it, so no gap ever shows (S4)', () => {
  assert.equal(loopRepeats(55 * 264, 1440), 1, 'a real night: one list is far wider than the strip');
  assert.equal(loopRepeats(3 * 264, 1440), 2);
  assert.equal(loopRepeats(264, 1440), 6);
  assert.equal(loopRepeats(1440, 1440), 1);
  assert.equal(loopRepeats(0, 1440), 1, 'not measured yet');
  assert.equal(loopRepeats(800, 0), 1, 'a hidden strip');
});
