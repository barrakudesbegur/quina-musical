// The collapsed cards (§8 Y2, option A, approved 28 Nov): when Cartrons shows tiles, when a tile shows «LÍNIA!» or
// «QUINA!», the Quina's stripes, the presenters' setting, and where the scribble goes (apps/player/logic/collapsed.ts).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cardMarks, type PlayerCard } from '../../../../../packages/rules/marks.ts';
import type { PublicState, PublicWinner } from '../../../../player/feed/public.ts';
import {
  announceWinsOf,
  bigCardOf,
  peekTarget,
  quinaUnclaimed,
  scribbleSlot,
  showsTiles,
  teachStep,
  type WinRound,
} from '../../../../player/logic/collapsed.ts';

const card: PlayerCard = { id: 123, type: 'normal', lines: [[2, 17, 41, 69], [11, 15, 31, 64], [3, 55, 66, 68]] };
const round: WinRound = { number: 3, kind: 'normal', lineConfirmed: false, ended: false };
const none: PublicWinner[] = [];
const big = (landed: number[], over: Partial<Parameters<typeof bigCardOf>[0]> = {}) =>
  bigCardOf({ card, marks: cardMarks(card, landed), round, latest: landed.at(-1) ?? null, winners: none, announce: true, ...over });

test('tiles: two or more playing cards collapse, one shows in full; never in the Desgraciat round', () => {
  assert.equal(showsTiles(0, 'normal'), false);
  assert.equal(showsTiles(1, 'normal'), false, 'one card: the full card, as before');
  assert.equal(showsTiles(2, 'normal'), true);
  assert.equal(showsTiles(7, 'special'), true);
  assert.equal(showsTiles(3, null), true, 'before any round');
  assert.equal(showsTiles(3, 'desgraciat'), false);
});

test('the presenters’ setting: absent means on', () => {
  const state = {} as PublicState;
  assert.equal(announceWinsOf(null), true);
  assert.equal(announceWinsOf(state), true);
  assert.equal(announceWinsOf({ ...state, announceWins: false } as PublicState), false);
  assert.equal(announceWinsOf({ ...state, announceWins: true } as PublicState), true);
});

test('«LÍNIA!»: the landing that completes a row, until the next landing', () => {
  assert.equal(big([2, 17, 41]), null, 'a row 1 song away');
  assert.equal(big([2, 17, 41, 69]), 'line', 'the landing completes the top row');
  assert.equal(big([2, 17, 41, 69, 50]), null, 'the winning song has passed');
  assert.equal(big([2, 17, 41, 69, 11]), null, 'a later landing on the card that completes nothing');
  assert.equal(big([2, 17, 69, 11, 15, 31, 64, 41]), 'line', 'a landing that completes a row, whichever row was first');
});

test('«LÍNIA!» goes at the Line’s validation, whoever won it, and stays away after it', () => {
  assert.equal(big([2, 17, 41, 69], { round: { ...round, lineConfirmed: true } }), null);
});

test('«QUINA!»: the landing that completes the card, until the next landing or the validation', () => {
  const all = card.lines.flat();
  assert.equal(big(all), 'quina');
  assert.equal(big(all, { round: { ...round, lineConfirmed: true } }), 'quina', 'after a Line too');
  assert.equal(big([...all, 50]), null, 'the winning song has passed');
  assert.equal(big(all, { winners: [{ round: 3, kind: 'bingo', cardIds: [123] }] }), null, 'validated');
  assert.equal(big(all, { winners: [{ round: 2, kind: 'bingo', cardIds: [9] }] }), 'quina', 'another round’s Quina');
  assert.equal(big(all, { round: { ...round, ended: true } }), null, 'the round is over');
});

test('nothing announced: the setting off, the Desgraciat round, a card that does not play', () => {
  const all = card.lines.flat();
  assert.equal(big(all, { announce: false }), null);
  assert.equal(big([2, 17, 41, 69], { announce: false }), null);
  assert.equal(big(all, { round: { ...round, kind: 'desgraciat' } }), null);
  assert.equal(big(all, { marks: null }), null);
});

test('the Quina’s stripes stay after the song passes, until the Quina is validated', () => {
  const marks = cardMarks(card, [...card.lines.flat(), 50]);
  assert.equal(quinaUnclaimed({ marks, round, winners: none, announce: true }), true);
  assert.equal(quinaUnclaimed({ marks, round, winners: [{ round: 3, kind: 'bingo', cardIds: [123] }], announce: true }), false);
  assert.equal(quinaUnclaimed({ marks, round: { ...round, ended: true }, winners: none, announce: true }), false);
  assert.equal(quinaUnclaimed({ marks, round, winners: none, announce: false }), false, 'the setting off');
  assert.equal(quinaUnclaimed({ marks: cardMarks(card, [2, 17, 41, 69]), round, winners: none, announce: true }), false, 'a Line only');
});

test('the scribble: the empty cell, under the grid, or above the first row', () => {
  assert.equal(scribbleSlot(3, 0, 120), 'cell', 'odd: the empty last cell');
  assert.equal(scribbleSlot(2, 300, 120), 'under', 'even with room under the grid');
  assert.equal(scribbleSlot(4, 120, 120), 'under');
  assert.equal(scribbleSlot(4, 80, 120), 'above', 'even without room');
  assert.equal(scribbleSlot(5, 999, 120), 'above', 'more than 4: no room beside or under');
  assert.equal(scribbleSlot(6, 999, 120), 'above');
});

test('teaching: the peek once (waiting while the home is covered), then the scribble until a tile is tapped', () => {
  const base = { taught: null, tiles: true, shown: true, busy: false, reduced: false } as const;
  assert.equal(teachStep(base), 'peek');
  assert.equal(teachStep({ ...base, busy: true }), null, 'a drawer, a Celebration or a Check: it waits');
  assert.equal(teachStep({ ...base, shown: false }), null, 'Historial shows: it waits');
  assert.equal(teachStep({ ...base, reduced: true }), 'scribble', 'reduced motion: no peek');
  assert.equal(teachStep({ ...base, taught: 'peeked' }), 'scribble');
  assert.equal(teachStep({ ...base, taught: 'peeked', busy: true }), 'scribble');
  assert.equal(teachStep({ ...base, taught: 'tapped' }), null);
  assert.equal(teachStep({ ...base, tiles: false }), null, 'no tiles');
});

test('the peek opens the card just added, else the first tile', () => {
  assert.equal(peekTarget([123, 57], 57), 57);
  assert.equal(peekTarget([123, 57], 412), 123, 'a resting card');
  assert.equal(peekTarget([123, 57], null), 123);
  assert.equal(peekTarget([], null), null);
});
