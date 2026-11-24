// Clock times on every screen: 12-hour with am/pm, as the user asked ("10:14 pm", "12:35 am").
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clockParts, formatClock } from '../../../../packages/rules/time.ts';

const at = (h: number, m: number) => new Date(2026, 11, 19, h, m).getTime();

test('evening and after-midnight times read as pm and am', () => {
  assert.equal(formatClock(at(22, 14)), '10:14 pm');
  assert.equal(formatClock(at(0, 35)), '12:35 am');
  assert.equal(formatClock(at(1, 5)), '1:05 am');
});

test('noon is 12 pm and midnight is 12 am', () => {
  assert.equal(formatClock(at(12, 0)), '12:00 pm');
  assert.equal(formatClock(at(0, 0)), '12:00 am');
});

test('the parts let a screen draw the time big and the period small', () => {
  assert.deepEqual(clockParts(at(22, 14)), { time: '10:14', period: 'pm' });
  assert.equal(clockParts(null), null);
});

test('no time reads as a dash', () => {
  assert.equal(formatClock(null), '—');
  assert.equal(formatClock(undefined), '—');
});
