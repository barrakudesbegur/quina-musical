// Ara's Historial | Cartrons switch: Cartrons by default for a player who follows cards, Historial when there are
// none, the player's choice remembered on the device (PlayerData, version 1), and this visit's view after adding a
// card on top.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ARA_VIEWS, TAB_IDS, araViewFor } from '../../../../player/logic/tabs.ts';
import { MemoryStorage, PlayerStorage, addCard, emptyData, readData, setAraView } from '../../../../player/logic/storage.ts';

test('three tabs: Ara, Premis and Horari', () => {
  assert.deepEqual([...TAB_IDS], ['ara', 'premis', 'horari']);
  assert.deepEqual([...ARA_VIEWS], ['historial', 'cartrons']);
});

test('the default view: Cartrons for a player who follows cards, Historial when there are none', () => {
  assert.equal(araViewFor({ session: null, saved: null, cardCount: 0 }), 'historial');
  assert.equal(araViewFor({ session: null, saved: null, cardCount: 1 }), 'cartrons');
  assert.equal(araViewFor({ session: null, saved: null, cardCount: 12 }), 'cartrons');
});

test("the player's choice wins over the default, and this visit's view over both", () => {
  assert.equal(araViewFor({ session: null, saved: 'historial', cardCount: 3 }), 'historial');
  assert.equal(araViewFor({ session: null, saved: 'cartrons', cardCount: 0 }), 'cartrons', 'an explicit choice stays, even with no cards');
  assert.equal(araViewFor({ session: 'cartrons', saved: 'historial', cardCount: 1 }), 'cartrons', 'a card just added shows the cards');
});

test('the choice is remembered on the device, in the versioned player data', () => {
  const backing = new MemoryStorage();
  const storage = new PlayerStorage(backing, 'k');
  const added = addCard(emptyData('26'), 123, 1000);
  assert.ok(added.ok);
  assert.equal(added.data.araView, null, 'no choice until the switch is tapped');
  const chosen = setAraView(added.data, 'historial');
  assert.equal(setAraView(chosen, 'historial'), chosen, 'unchanged: the same object');
  storage.save(chosen);
  const loaded = storage.load('26');
  assert.equal(loaded.outcome, 'kept');
  assert.equal(loaded.data.araView, 'historial');
  assert.deepEqual(loaded.data.cards.map((c) => c.id), [123], 'the cards are kept alongside');
  assert.equal(araViewFor({ session: null, saved: loaded.data.araView, cardCount: loaded.data.cards.length }), 'historial');
});

test('older data (version 1, no choice yet) and junk read as no choice; the cards stay', () => {
  const older = readData(JSON.stringify({ v: 1, edition: '26', cards: [{ id: 5, color: 1 }], sounds: null }), '26');
  assert.equal(older.outcome, 'kept');
  assert.equal(older.data.araView, null);
  assert.deepEqual(older.data.cards.map((c) => c.id), [5]);
  assert.equal(readData(JSON.stringify({ v: 1, edition: '26', cards: [], araView: 'premis' }), '26').data.araView, null);
});
