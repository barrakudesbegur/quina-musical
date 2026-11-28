// D114: a clock time's am/pm keeps its case under Londrina's capitals; the phone wraps it in `.unit`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clockTextParts } from '../../../../player/logic/clock-text.ts';

test("each clock time's am/pm is its own part, held to its time by a no-break space", () => {
  assert.deepEqual(clockTextParts('Comencem cap a les 10:00 pm (4:59)'), [
    { text: 'Comencem cap a les 10:00\u00a0', unit: false },
    { text: 'pm', unit: true },
    { text: ' (4:59)', unit: false },
  ]);
  assert.deepEqual(clockTextParts('3:03 am'), [
    { text: '3:03\u00a0', unit: false },
    { text: 'am', unit: true },
  ]);
});

test('no clock time, no unit: words that happen to hold am or pm stay whole', () => {
  assert.deepEqual(clockTextParts('Comença d’aquí a uns 4:59'), [{ text: 'Comença d’aquí a uns 4:59', unit: false }]);
  assert.deepEqual(clockTextParts('Campana pmt am'), [{ text: 'Campana pmt am', unit: false }]);
  assert.deepEqual(clockTextParts(''), [{ text: '', unit: false }]);
});
