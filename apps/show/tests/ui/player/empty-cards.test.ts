// The home's empty state (D290, logic/empty-cards.ts): «Afegir cartrons» and its two buttons show on a phone with no
// cards, always on Cartrons and on Historial only while it has no song to list; never with a card, even one resting.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { showsEmptyCards } from '../../../../player/logic/empty-cards.ts';
import { drawerOrigin, pushDrawer, type Drawer } from '../../../../player/logic/drawers.ts';
import { araViewFor } from '../../../../player/logic/tabs.ts';

test('Cartrons with no cards shows it, whatever Historial holds', () => {
  assert.equal(showsEmptyCards('cartrons', 0, 0), true);
  assert.equal(showsEmptyCards('cartrons', 0, 12), true);
});

test('Historial shows it only while no song is listed (before the night, before the first Landing)', () => {
  assert.equal(showsEmptyCards('historial', 0, 0), true);
  assert.equal(showsEmptyCards('historial', 0, 1), false, 'the songs keep the view; the call waits on Cartrons');
});

test('a phone with a card is never empty, even when every card sits out this round', () => {
  for (const view of ['historial', 'cartrons'] as const) {
    assert.equal(showsEmptyCards(view, 1, 0), false);
    assert.equal(showsEmptyCards(view, 3, 0), false);
  }
});

test('a first open lands on Historial, which shows it before anything has sounded', () => {
  const view = araViewFor({ session: null, saved: null, cardCount: 0 });
  assert.equal(showsEmptyCards(view, 0, 0), true);
});

test('«Escanejar el QR» opens the pad with the camera over it, from the bottom; «Escriure el número» the plain pad', () => {
  const scan: Drawer = { kind: 'pad', scan: true };
  assert.equal(drawerOrigin(scan, false), 'bottom');
  assert.deepEqual(pushDrawer([], scan), [scan]);
  assert.deepEqual(pushDrawer([], { kind: 'pad' }), [{ kind: 'pad' }]);
});
