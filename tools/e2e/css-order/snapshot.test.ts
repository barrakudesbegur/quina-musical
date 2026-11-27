// The CSS order check's pure parts: matching two pages' elements, and the minifier's spellings that compare equal.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { alignByKey, canonical, comparePages, type PageSnapshot } from './snapshot.ts';

test('elements pair up one to one, and around an element only one side has', () => {
  assert.deepEqual(alignByKey(['a', 'b', 'c'], ['a', 'b', 'c']), [[0, 0], [1, 1], [2, 2]]);
  assert.deepEqual(alignByKey(['a', 'x', 'b', 'c'], ['a', 'b', 'c']), [[0, 0], [2, 1], [3, 2]]);
  assert.deepEqual(alignByKey(['a', 'b'], ['a', 'y', 'b', 'z']), [[0, 0], [1, 2]]);
});

test("the minifier's spellings compare equal, a real change doesn't", () => {
  assert.equal(canonical('background-position', '0% 0%'), canonical('background-position', '0px 0px'));
  assert.equal(canonical('transform-origin', '0% 50%'), canonical('transform-origin', '0px 50%'));
  assert.notEqual(canonical('transform-origin', '50% 50%'), canonical('transform-origin', '0px 50%'));
  assert.equal(canonical('mask-image', 'linear-gradient(to right, red, blue)'), canonical('mask-image', 'linear-gradient(90deg, red, blue)'));
  assert.equal(canonical('stroke', 'color(srgb 1 1 1 / 0.5)'), 'rgba(255, 255, 255, 0.5)');
  assert.notEqual(canonical('color', 'rgb(255, 246, 229)'), canonical('color', 'rgb(23, 19, 43)'));
});

test('a comparison lists each differing property of the matched elements', () => {
  const page = (color: string, extra = false): PageSnapshot => ({
    name: 'p',
    url: '/p',
    sheets: [],
    fontErrors: [],
    table: ['block', color, 'flex'],
    elements: [
      { key: 'div.a', path: '', values: [0, 1] },
      ...(extra ? [{ key: 'span.x', path: 'div.a', values: [2, 1] }] : []),
      { key: 'button.b', path: 'div.a', values: [2, 1] },
    ],
  });
  const c = comparePages(page('rgb(0, 0, 0)'), page('rgb(255, 255, 255)', true), ['display', 'color']);
  assert.deepEqual(c.diffs.map((d) => `${d.key} ${d.prop}`), ['div.a color', 'button.b color']);
  assert.deepEqual(c.onlyB, ['span.x']);
});
