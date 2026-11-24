// The cloud's Games for plan B: parsing is defensive, and only the current Game carries a resume point.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseGames } from '../../../../admin/data/cloud-games.ts';

test('games parse defensively, keeping the resume point only when it is complete', () => {
  const games = parseGames({
    games: [
      { gameId: 'g2', seq: 40, firstAtMs: 1, lastAtMs: 2, rounds: 3, current: true, resumePoint: { round: 3, kind: 'normal', shuffleSeed: 7, shuffleAttempts: 0, position: 17, lastSongId: 41, lineConfirmedFrom: null, text: 'x' } },
      { gameId: 'g1', seq: 10, rounds: 1, current: false, resumePoint: null },
      { nope: true },
      'junk',
    ],
  });
  assert.equal(games.length, 2);
  assert.equal(games[0].current, true);
  assert.equal(games[0].resumePoint?.lastSongId, 41);
  assert.equal(games[1].resumePoint, null);
  assert.deepEqual(parseGames(null), []);
});
