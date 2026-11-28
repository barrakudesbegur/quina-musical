// The plan's versions (domain/plan-versions.ts): what a save's `x-quina-plan-base` header may say.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePlanBase } from '../../src/domain/plan-versions.ts';

test('a base is a savedAtMs or "none"; anything else, or nothing, is no base', () => {
  assert.equal(parsePlanBase('1795895028865'), 1795895028865);
  assert.equal(parsePlanBase(' 0 '), 0, 'a plan stored before versions were kept');
  assert.equal(parsePlanBase('none'), null);
  for (const bad of [null, '', 'latest', '-1', '1.5', '1e3', 'None', '12345678901234567']) assert.equal(parsePlanBase(bad), undefined, String(bad));
});
