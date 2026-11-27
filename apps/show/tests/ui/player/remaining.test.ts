// The header's count (#72). (The near-win highlight is gone: §8 Y1.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cardMarks, type PlayerCard } from '../../../../../packages/rules/marks.ts';
import { remainingSongs } from '../../../../player/logic/remaining.ts';

const card: PlayerCard = { id: 123, type: 'normal', lines: [[2, 17, 41, 69], [11, 15, 31, 64], [3, 55, 66, 68]] };
const open = { lineConfirmed: false, ended: false };

test('the remaining-songs pill (#72) counts only where songs are counted', () => {
  const m = cardMarks(card, [2, 17, 41]);
  assert.equal(remainingSongs(card, m, open), 1);
  assert.equal(remainingSongs(card, m, { lineConfirmed: true, ended: false }), 9);
  assert.equal(remainingSongs(card, m, { ...open, ended: true }), null, 'not after the round');
  assert.equal(remainingSongs(card, m, { ...open, kind: 'desgraciat' }), null, 'the Desgraciat round shows DEMPEUS / ASSEGUT instead');
  assert.equal(remainingSongs(card, null, open), null, 'a card that does not play');
});
