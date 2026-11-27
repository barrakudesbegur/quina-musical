// The controls family's pure logic (packages/ui/components: roving.ts, and the helpers the controls share).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextEnabled } from '../../../../../packages/ui/components/roving.ts';

const ITEMS = [{}, { disabled: true }, {}, {}];

test('roving: the arrows move to the next usable item and wrap round', () => {
  assert.equal(nextEnabled(ITEMS, 0, 'ArrowRight'), 2);
  assert.equal(nextEnabled(ITEMS, 0, 'ArrowDown'), 2);
  assert.equal(nextEnabled(ITEMS, 3, 'ArrowRight'), 0);
  assert.equal(nextEnabled(ITEMS, 2, 'ArrowLeft'), 0);
  assert.equal(nextEnabled(ITEMS, 0, 'ArrowUp'), 3);
});

test('roving: Home and End go to the first and last usable item', () => {
  assert.equal(nextEnabled([{ disabled: true }, {}, {}], 2, 'Home'), 1);
  assert.equal(nextEnabled([{}, {}, { disabled: true }], 0, 'End'), 1);
});

test('roving: other keys, an empty group or nothing else usable', () => {
  assert.equal(nextEnabled(ITEMS, 0, 'Enter'), null);
  assert.equal(nextEnabled([], 0, 'ArrowRight'), null);
  assert.equal(nextEnabled([{}, { disabled: true }], 0, 'ArrowRight'), 0);
});
