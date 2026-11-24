// The player's own data: cards with their identities (icon and colour) and names, the edition wipe, the gameId
// reset, sounds.
import { test } from 'node:test';
import { CARD_MARKS, identityOf, markName, PICKER_ORDER } from '../../../../player/logic/marks-identity.ts';
import assert from 'node:assert/strict';
import {
  MemoryStorage,
  PlayerStorage,
  addCard,
  dismiss,
  emptyData,
  nextColor,
  noteEdition,
  noteGame,
  readData,
  removeCard,
  renameCard,
  setIdentity,
  setSounds,
  soundsOn,
  type PlayerData,
} from '../../../../player/logic/storage.ts';

const add = (data: PlayerData, ...ids: number[]): PlayerData =>
  ids.reduce((d, id) => {
    const r = addCard(d, id, 1000);
    assert.ok(r.ok, `add ${id}`);
    return r.data;
  }, data);

test('new cards take the card colours in order', () => {
  const data = add(emptyData('26'), 10, 20, 30);
  assert.deepEqual(
    data.cards.map((c) => c.color),
    [1, 2, 3],
  );
});

test('a removed card frees its colour for the next one', () => {
  let data = add(emptyData('26'), 10, 20, 30);
  data = removeCard(data, 20);
  data = add(data, 40);
  assert.deepEqual(
    data.cards.map((c) => [c.id, c.color]),
    [
      [10, 1],
      [30, 3],
      [40, 2],
    ],
  );
});

test('once all ten identities are used, they cycle; the first card is always corn', () => {
  const data = add(emptyData('26'), 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12);
  assert.deepEqual(
    data.cards.map((c) => c.color),
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 1, 2],
  );
  assert.equal(nextColor([]), 1);
  assert.equal(markName(data.cards[0].color), 'corn');
  assert.deepEqual(data.cards.slice(0, 10).map((c) => markName(c.color)), ['corn', 'shootingStar', 'bauble', 'tree', 'heart', 'crown', 'grapes', 'snowflake', 'topHat', 'poop']);
});

test('the player can pick a free icon when adding a card; a taken one falls back to the first free', () => {
  let d = emptyData('26');
  const first = addCard(d, 123, 0, 3);
  assert.ok(first.ok);
  d = first.ok ? first.data : d;
  assert.equal(markName(d.cards[0].color), 'bauble', 'the pick');
  const second = addCard(d, 57, 0, 3);
  assert.ok(second.ok);
  assert.equal(second.ok && second.card.color, 1, 'the bauble is taken: the first free one, corn');
});

test("a card's icon can change to a free one, never to another card's", () => {
  let d = emptyData('26');
  for (const id of [123, 57]) {
    const r = addCard(d, id, 0);
    if (r.ok) d = r.data;
  }
  assert.equal(setIdentity(d, 57, 1), d, 'corn belongs to card 123');
  assert.equal(setIdentity(d, 57, 10).cards[1].color, 10);
  assert.equal(setIdentity(d, 57, 11), d, 'no eleventh icon');
});

test('once every icon is in use, a new card may repeat any', () => {
  let d = emptyData('26');
  for (let id = 1; id <= 10; id++) {
    const r = addCard(d, id, 0);
    if (r.ok) d = r.data;
  }
  const eleventh = addCard(d, 11, 0, 4);
  assert.equal(eleventh.ok && eleventh.card.color, 4);
});

test('a card is added once, valid numbers only, up to 30', () => {
  let data = add(emptyData('26'), 5);
  assert.deepEqual(addCard(data, 5, 0), { ok: false, reason: 'duplicate' });
  assert.deepEqual(addCard(data, 0, 0), { ok: false, reason: 'invalid' });
  assert.deepEqual(addCard(data, 10000, 0), { ok: false, reason: 'invalid' });
  for (let id = 100; data.cards.length < 30; id++) data = add(data, id);
  assert.deepEqual(addCard(data, 999, 0), { ok: false, reason: 'full' });
});

test('names are optional, trimmed and short', () => {
  let data = add(emptyData('26'), 5);
  data = renameCard(data, 5, '  Àvia   Maria ');
  assert.equal(data.cards[0].name, 'Àvia Maria');
  data = renameCard(data, 5, '   ');
  assert.equal(data.cards[0].name, null);
  data = renameCard(data, 5, 'x'.repeat(50));
  assert.equal(data.cards[0].name?.length, 20);
});

test('saved data round-trips for the same edition', () => {
  const storage = new PlayerStorage(new MemoryStorage(), 'k');
  const data = renameCard(add(emptyData('26'), 123, 57), 123, 'Àvia');
  storage.save(data);
  const loaded = storage.load('26');
  assert.equal(loaded.outcome, 'kept');
  assert.deepEqual(loaded.data, data);
});

test("another edition's data is wiped on load", () => {
  const backing = new MemoryStorage();
  const storage = new PlayerStorage(backing, 'k');
  storage.save(add(emptyData('25'), 1, 2));
  const loaded = storage.load('26');
  assert.equal(loaded.outcome, 'otherEdition');
  assert.deepEqual(loaded.data.cards, []);
  assert.equal(JSON.parse(backing.getItem('k') ?? '{}').edition, '26', 'the wipe is saved');
});

test('unreadable data starts fresh and never throws', () => {
  assert.equal(readData('{not json', '26').outcome, 'corrupt');
  assert.equal(readData('{"v":99}', '26').outcome, 'corrupt');
  assert.equal(readData(null, '26').outcome, 'fresh');
  const broken = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('quota'); }, removeItem: () => {} };
  const storage = new PlayerStorage(broken, 'k');
  assert.equal(storage.load('26').outcome, 'fresh');
  assert.equal(storage.save(emptyData('26')), false);
});

test('stored cards are cleaned: bad ids and duplicates dropped, a missing colour assigned', () => {
  const raw = JSON.stringify({ v: 1, edition: '26', cards: [{ id: 5, color: 11 }, { id: 5, color: 1 }, { id: -1 }, { id: 7, color: 2, name: 'Jo' }], sounds: false });
  const { data } = readData(raw, '26');
  assert.deepEqual(
    data.cards.map((c) => [c.id, c.color, c.name]),
    [
      [5, 1, null],
      [7, 2, 'Jo'],
    ],
  );
  assert.equal(data.sounds, false);
});

test('a new gameId resets only the round view; a new edition wipes everything', () => {
  let data = dismiss(add(emptyData('26'), 5), 'celebration:3:line');
  data = noteGame(data, 'game-a');
  assert.deepEqual(data.dismissed, []);
  data = dismiss(data, 'celebration:1:line');
  assert.equal(noteGame(data, 'game-a'), data, 'same Game: unchanged');
  const next = noteGame(data, 'game-b');
  assert.deepEqual(next.dismissed, []);
  assert.deepEqual(next.cards, data.cards, 'cards survive a new Game');
  assert.equal(noteGame(data, null), data);
  const wiped = noteEdition(data, '27');
  assert.equal(wiped.wiped, true);
  assert.deepEqual(wiped.data.cards, []);
  assert.equal(noteEdition(data, '26').wiped, false);
});

test("the player's sound choice wins over Admin's default", () => {
  const data = emptyData('26');
  assert.equal(soundsOn(data, true), true);
  assert.equal(soundsOn(data, false), false);
  assert.equal(soundsOn(setSounds(data, true), false), true);
  assert.equal(soundsOn(setSounds(data, false), true), false);
});

test('the icon picker shows every icon once, chromatically, with white and black closing the rows', () => {
  assert.equal(PICKER_ORDER.length, CARD_MARKS.length);
  assert.deepEqual([...PICKER_ORDER].sort(), [...CARD_MARKS].sort());
  assert.deepEqual([PICKER_ORDER[4], PICKER_ORDER[9]], ['snowflake', 'topHat']);
  assert.equal(markName(identityOf('poop')), 'poop');
});
