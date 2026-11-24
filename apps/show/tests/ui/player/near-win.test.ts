// The near-win cue on phones: no banner, just the missing song gently highlighted on that card's grid.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cardMarks, type PlayerCard } from '../../../../../packages/rules/marks.ts';
import { nearKeys, nearSongs } from '../../../../player/logic/near-win.ts';

const card: PlayerCard = { id: 123, type: 'normal', lines: [[2, 17, 41, 69], [11, 15, 31, 64], [3, 55, 66, 68]] };
const open = { lineConfirmed: false, ended: false };

test('a line 1 song away highlights that song', () => {
  assert.deepEqual([...nearSongs(card, cardMarks(card, [2, 17, 41]), open)], [69]);
});

test('two lines each 1 away highlight both songs', () => {
  assert.deepEqual([...nearSongs(card, cardMarks(card, [2, 17, 41, 11, 15, 31]), open)].sort((a, b) => a - b), [64, 69]);
});

test('once a Line is confirmed only the last song for the Quina is highlighted', () => {
  const all = card.lines.flat();
  const m = cardMarks(card, all.filter((id) => id !== 55));
  assert.deepEqual([...nearSongs(card, m, { lineConfirmed: true, ended: false })], [55]);
  assert.deepEqual([...nearSongs(card, cardMarks(card, [2, 17, 41]), { lineConfirmed: true, ended: false })], []);
});

test('a completed line shows plain marks: its song is marked, not highlighted', () => {
  assert.deepEqual([...nearSongs(card, cardMarks(card, [2, 17, 41, 69]), open)], []);
});

test('nothing is highlighted after the round, without marks, or for an unknown card', () => {
  const m = cardMarks(card, [2, 17, 41]);
  assert.equal(nearSongs(card, m, { lineConfirmed: false, ended: true }).size, 0);
  assert.equal(nearSongs(card, null, open).size, 0);
  assert.equal(nearSongs(null, m, open).size, 0);
});

test('the cue keys list every highlighted song per card, in card order', () => {
  assert.deepEqual(nearKeys([{ cardId: 123, near: new Set([69]) }, { cardId: 57, near: new Set([4, 9]) }]), ['123:69', '57:4', '57:9']);
});
