// The add-card QR scan (D141): a scanned QR is this year's card (its number fills the pad in) or anything else.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readCardQr } from '../../../../player/logic/qr.ts';

test("a QR of this year's card gives its number", () => {
  assert.deepEqual(readCardQr('https://quina.barrakudesbegur.org/26/123', '26'), { kind: 'card', cardId: 123 });
  assert.deepEqual(readCardQr('  https://quina.barrakudesbegur.org/26/7/ ', '26'), { kind: 'card', cardId: 7 }, 'spaces and a trailing slash');
});

test("any other QR is not one of this year's cards", () => {
  for (const text of [
    'https://quina.barrakudesbegur.org/25/123', // last year's card
    'https://quina.barrakudesbegur.org/26/', // the app, no card
    'https://quina.barrakudesbegur.org/26/0', // not a card number
    'https://quina.barrakudesbegur.org/26/99999',
    'https://example.com/menu',
    'WIFI:S:bar;T:WPA;P:secret;;',
    'just text',
    '',
  ]) {
    assert.deepEqual(readCardQr(text, '26'), { kind: 'other' }, text);
  }
});
