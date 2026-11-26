// "Afegir cartró"'s smart keypad (logic/pad.ts): typing, which digits can still lead to a printed card, when "Desar"
// saves, a number the player already has, and when leaving asks first.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leaveNeedsConfirm, padCatalog, padRules, padValue } from '../../../../player/logic/pad.ts';

/** A small printed run: cards 1–360, plus 4120 (a four-digit one). */
const CATALOG = padCatalog([...Array.from({ length: 360 }, (_, i) => i + 1), 4120]);
const digits = (typed: string, own: number[] = [], catalog = CATALOG) => [...padRules(typed, own, catalog).digits].sort().join('');

test('typing: digits only, no leading zero, at most four digits', () => {
  assert.equal(padValue('', '0'), '');
  assert.equal(padValue('12', '3'), '123');
  assert.equal(padValue('1234', '5'), '1234');
  assert.equal(padValue('123', 'back'), '12');
  assert.equal(padValue('', 'back'), '');
  assert.equal(padValue('12', 'x'), '12');
});

test('a digit works only if the number it makes starts a printed card\'s number', () => {
  assert.equal(digits(''), '123456789', 'every card starts with 1–9, never 0');
  assert.equal(digits('36'), '0', 'the board: 36 leads only to 360');
  assert.equal(digits('35'), '0123456789', '350–359 are all printed');
  assert.equal(digits('360'), '', 'nothing printed past 360');
  assert.equal(digits('41'), '2', '412 (and on to 4120)');
  assert.equal(digits('412'), '0');
  assert.equal(digits('4120'), '', 'four digits is the longest number');
  assert.equal(digits('37'), '', 'no printed card goes on from 37');
});

test('before the catalogue has loaded, any digit that keeps a possible card number works', () => {
  assert.equal(digits('', [], null), '123456789', 'still no leading zero');
  assert.equal(digits('36', [], null), '0123456789');
  assert.equal(digits('9999', [], null), '', 'four digits at most');
  const rules = padRules('777', [], null);
  assert.equal(rules.canSave, true, 'Desar trusts the number until the catalogue says otherwise');
});

test('Desar lights up only for a printed card the player doesn\'t have yet', () => {
  assert.equal(padRules('', [], CATALOG).canSave, false, 'nothing typed');
  assert.equal(padRules('36', [], CATALOG).canSave, true);
  assert.equal(padRules('361', [], CATALOG).canSave, false, 'not a printed card');
  assert.equal(padRules('412', [], CATALOG).canSave, false, 'only the start of 4120');
  assert.equal(padRules('4120', [], CATALOG).canSave, true);
  assert.equal(padRules('57', [123, 57, 412], CATALOG).canSave, false, 'already one of the player\'s cards');
});

test('a number the player already has shows whose it is, and its digits keep working', () => {
  const rules = padRules('57', [123, 57, 412], CATALOG);
  assert.equal(rules.owned, 57);
  assert.equal(padRules('5', [123, 57, 412], CATALOG).owned, null, 'only the whole number counts');
  assert.equal(digits('1', [1]), '0123456789', 'owning #1 must not block #12 or #123');
  assert.equal(padRules('12', [1], CATALOG).canSave, true);
});

test('the delete key works once something is typed', () => {
  assert.equal(padRules('', [], CATALOG).canDelete, false);
  assert.equal(padRules('3', [], CATALOG).canDelete, true);
});

test('leaving asks first only when a number has been typed', () => {
  assert.equal(leaveNeedsConfirm(''), false);
  assert.equal(leaveNeedsConfirm('1'), true);
  assert.equal(leaveNeedsConfirm(padValue('12', 'back')), true);
  assert.equal(leaveNeedsConfirm(padValue('1', 'back')), false, 'typed and deleted again: nothing to lose');
});
