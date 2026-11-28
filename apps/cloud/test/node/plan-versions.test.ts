// The plan's versions (domain/plan-versions.ts): what a save's `x-quina-plan-base` header may say, and a replaced plan's entry.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { historyItem, parsePlanBase } from '../../src/domain/plan-versions.ts';

test('a base is a savedAtMs or "none"; anything else, or nothing, is no base', () => {
  assert.equal(parsePlanBase('1795895028865'), 1795895028865);
  assert.equal(parsePlanBase(' 0 '), 0, 'a plan stored before versions were kept');
  assert.equal(parsePlanBase('none'), null);
  for (const bad of [null, '', 'latest', '-1', '1.5', '1e3', 'None', '12345678901234567']) assert.equal(parsePlanBase(bad), undefined, String(bad));
});

test("a replaced plan's list entry: when, its size, and what it was; a broken one lists with nulls", () => {
  const body = JSON.stringify({ title: 'Quina Quina! 3', rounds: [{}, {}], sponsors: [{}] });
  assert.deepEqual(historyItem(10, 20, body), { savedAtMs: 10, replacedAtMs: 20, bytes: new TextEncoder().encode(body).byteLength, title: 'Quina Quina! 3', rounds: 2, sponsors: 1 });
  assert.deepEqual(historyItem(1, 2, '{half'), { savedAtMs: 1, replacedAtMs: 2, bytes: 5, title: null, rounds: null, sponsors: null });
  assert.equal(historyItem(1, 2, '"é"').bytes, 4, 'bytes, not characters');
});
