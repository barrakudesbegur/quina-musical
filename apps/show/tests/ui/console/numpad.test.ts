// The Claim number pad.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { padKeyFromKeyboard, padPress, padValue, type PadKey } from '../../../../console/logic/numpad.ts';

const limits = { maxDigits: 4, max: 9999 };
const type = (keys: PadKey[]) => keys.reduce((d, k) => padPress(d, k, limits), '');

test('typing digits, backspace and clear', () => {
  assert.equal(type(['1', '2', '3']), '123');
  assert.equal(type(['1', '2', 'back']), '1');
  assert.equal(type(['1', '2', 'clear', '7']), '7');
  assert.equal(type(['back']), '');
});

test('no leading zero, at most 4 digits', () => {
  assert.equal(type(['0', '0', '5']), '5');
  assert.equal(type(['1', '0', '0', '0', '9']), '1000');
});

test('the value is a card number 1..9999, else null', () => {
  assert.equal(padValue('', limits), null);
  assert.equal(padValue('57', limits), 57);
  assert.equal(padValue('9999', limits), 9999);
  assert.equal(padValue('0', limits), null);
  assert.equal(padValue('12a', limits), null);
  assert.equal(padValue('500', { maxDigits: 4, max: 400 }), null);
});

test('physical keys map onto the pad', () => {
  assert.equal(padKeyFromKeyboard('7'), '7');
  assert.equal(padKeyFromKeyboard('Backspace'), 'back');
  assert.equal(padKeyFromKeyboard('Delete'), 'clear');
  assert.equal(padKeyFromKeyboard('Enter'), null);
  assert.equal(padKeyFromKeyboard('a'), null);
});
