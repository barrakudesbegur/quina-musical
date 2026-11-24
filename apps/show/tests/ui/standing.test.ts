// The Desgraciat round's rule, card by card: a card stands until any of its songs lands; the first such landing
// sank it; Back stands it up again.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { PlayerCard } from '../../../../packages/rules/marks.ts';
import { cardFall, fellAt, standingCards } from '../../../../packages/rules/standing.ts';

const card = (id: number, songs: number[]): PlayerCard => ({ id, type: 'normal', lines: [songs.slice(0, 4), songs.slice(4, 8), songs.slice(8, 12)] });
const a = card(1, [2, 17, 41, 69, 11, 15, 31, 64, 3, 55, 66, 68]);
const b = card(2, [5, 14, 64, 75, 15, 18, 60, 69, 2, 62, 16, 20]);
const lands = (...songs: number[]) => songs.map((songId, position) => ({ position, songId }));

test('a card stands while none of its songs has landed', () => {
  assert.equal(cardFall(a, []), null);
  assert.equal(cardFall(a, lands(25, 1, 7)), null);
  assert.deepEqual(standingCards([a, b], lands(25, 1, 7)), [a, b]);
});

test('the first landing of one of its songs sinks it; later ones do not move the fall', () => {
  assert.deepEqual(cardFall(a, lands(25, 31, 7, 69)), { songId: 31, position: 1 });
  assert.deepEqual(cardFall(b, lands(25, 31, 7, 69)), { songId: 69, position: 3 });
  assert.deepEqual(standingCards([a, b], lands(25, 31)), [b]);
});

test('landings out of order still find the earliest position', () => {
  assert.deepEqual(cardFall(a, [{ position: 8, songId: 2 }, { position: 3, songId: 3 }]), { songId: 3, position: 3 });
});

test('Back (the landing removed) stands the card up again', () => {
  const landed = lands(25, 31);
  assert.ok(cardFall(a, landed));
  assert.equal(cardFall(a, landed.slice(0, 1)), null);
});

test('which cards fell at one landing: only those it sank, not those already seated', () => {
  const landed = lands(25, 31, 69);
  assert.deepEqual(fellAt([a, b], landed, 1), [a]);
  assert.deepEqual(fellAt([a, b], landed, 2), [b], 'card a was already seated: 69 only adds a ✗ to it');
  assert.deepEqual(fellAt([a, b], lands(25, 69), 1), [a, b], 'one song can sink several cards');
  assert.deepEqual(fellAt([a, b], landed, 0), []);
});
