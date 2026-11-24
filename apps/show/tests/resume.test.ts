// Plan B: resuming a round by hand (`resumeAt`) on a show page with no journal. The seeded Shuffle rebuilds the
// exact Queue from the state's `resume` token; anything that doesn't match is refused, never resumed wrongly.
import test from 'node:test';
import assert from 'node:assert/strict';
import { extendJournal, emptyRecord, formatResumeToken, makeCommand, parseResumeToken, parseSeedCode, replayJournal, seedCode } from '@quina/protocol';
import type { CommandFields, JournalEntry, ResumeToken } from '@quina/protocol';
import type { Effect } from '../engine/src/show/show.ts';
import { setup, allCards, type Harness } from './support/harness.ts';

const journalOf = (effects: readonly Effect[]): JournalEntry[] => effects.flatMap((e) => (e.type === 'journal' ? [e.entry] : []));
const rejections = (effects: readonly Effect[]) => effects.flatMap((e) => (e.type === 'reject' ? [`${e.reason}${e.detail ? `: ${e.detail}` : ''}`] : []));
const CARDS = '1-150';

/** A show that played `songs` songs (and confirmed a Line after `lineAfter`, if given). */
function played(songs: number, { seed = 5, lineAfter }: { seed?: number; lineAfter?: number } = {}) {
  const h = setup({ seed, cards: allCards, cardsInPlay: CARDS, settings: { autoAdvance: false } });
  h.send('unlock');
  for (let i = 0; i < songs; i++) {
    const position = h.show.position;
    h.send('next');
    h.until(() => h.show.position === position + 1 && h.show.status === 'playing');
    if (lineAfter === i) h.send('confirmLine');
  }
  return h;
}
const tokenOf = (h: Harness): ResumeToken => {
  const token = h.show.snapshot().resume;
  assert.ok(token, 'the state carries a resume token');
  return token;
};
const fieldsOf = ({ text: _text, ...point }: ResumeToken): CommandFields['resumeAt'] => point;

test('seed codes and resume tokens survive paper: 7 characters, forgiving O/0 and I/L/1, every field round-trips', () => {
  for (const seed of [0, 1, 31, 32, 0xdeadbeef, 0xffffffff, 123456789]) {
    const code = seedCode(seed);
    assert.equal(code.length, 7);
    assert.equal(parseSeedCode(code), seed);
    assert.equal(parseSeedCode(code.toLowerCase()), seed);
  }
  assert.equal(parseSeedCode('0000001'), parseSeedCode('OOOOOOI'));
  assert.equal(parseSeedCode('000000L'), 1);
  assert.equal(parseSeedCode('ABC'), null);
  for (const point of [
    { round: 3, kind: 'normal' as const, shuffleSeed: 0xc0ffee, shuffleAttempts: 0, position: 17, lastSongId: 41, lineConfirmedFrom: 12 },
    { round: 1, kind: 'special' as const, shuffleSeed: 7, shuffleAttempts: 4, position: -1, lastSongId: null, lineConfirmedFrom: null },
  ]) {
    const text = formatResumeToken(point);
    assert.deepEqual(parseResumeToken(text), point, text);
    assert.deepEqual(parseResumeToken(` ${text.toLowerCase()} `), point, 'any case, spaces ignored');
  }
  assert.equal(parseResumeToken('Q3N-NOTASEED-17'), null);
  assert.equal(parseResumeToken('hello'), null);
});

test('a fresh show page resumes the round exactly from the token: same Queue, position, Line; then plays on', () => {
  const a = played(6, { lineAfter: 3 });
  const token = tokenOf(a);
  assert.equal(token.position, 5);
  assert.equal(token.lastSongId, a.show.queue[5]);
  assert.equal(token.lineConfirmedFrom, 4);
  assert.deepEqual(parseResumeToken(token.text), fieldsOf(token));

  // The replacement laptop: another seed (so its own first Shuffle differs), the same cards in play, still locked.
  const b = setup({ seed: 99, cards: allCards, cardsInPlay: CARDS, settings: { autoAdvance: false }, epochMs: 1_700_000_000_000 + 7_200_000 });
  assert.notDeepEqual(b.show.queue, a.show.queue);
  const out = b.dispatch(makeCommand('resumeAt', fieldsOf(token)));
  assert.deepEqual(rejections(out), []);
  assert.deepEqual(b.show.queue, a.show.queue, 'the same Queue, rebuilt from the seed');
  assert.equal(b.show.position, 5);
  assert.deepEqual(b.show.landings.map((l) => l.songId), a.show.queue.slice(0, 6));
  assert.equal(b.show.round.number, a.show.round.number);
  assert.equal(b.show.round.lineConfirmed, true);
  assert.equal(b.show.scene, 'play');
  assert.deepEqual(tokenOf(b).text, token.text, 'its own token says the same');
  const resumed = out.find((e) => e.type === 'drumReset');
  assert.ok(resumed && resumed.type === 'drumReset' && resumed.selectId === token.lastSongId, 'the drum shows the last counted song');

  // Its journal replays to its own record, at every split point.
  const entries = journalOf(b.log);
  assert.ok(entries.some((e) => e.kind === 'round.resumed'));
  assert.deepEqual(replayJournal(entries), b.show.record());
  for (let k = 0; k <= entries.length; k++) assert.deepEqual(extendJournal(replayJournal(entries.slice(0, k), b.show.gameId), entries.slice(k)), replayJournal(entries));
  assert.deepEqual(extendJournal(emptyRecord(b.show.gameId), entries), b.show.record());

  // Play goes on with the next song in the Queue.
  b.send('unlock');
  b.send('next');
  b.until(() => b.show.position === 6 && b.show.status === 'playing');
  assert.equal(b.show.current?.songId, a.show.queue[6]);
});

test('a Queue that does not match the token is refused, never resumed', () => {
  const a = played(4);
  const token = fieldsOf(tokenOf(a));
  const fresh = (cardsInPlay = CARDS) => setup({ seed: 77, cards: allCards, cardsInPlay, settings: { autoAdvance: false } });
  const refused = (h: Harness, fields: CommandFields['resumeAt']) => {
    const queue = [...h.show.queue];
    const reasons = rejections(h.dispatch(makeCommand('resumeAt', fields)));
    assert.equal(reasons.length, 1);
    assert.match(reasons[0], /^cannotResume/);
    assert.deepEqual(h.show.queue, queue, 'nothing changed');
    return reasons[0];
  };
  assert.match(refused(fresh(), { ...token, shuffleSeed: (token.shuffleSeed + 1) >>> 0 }), /song .* is not at position/);
  assert.match(refused(fresh(), { ...token, position: token.position + 1 }), /song .* is not at position/);
  assert.match(refused(fresh(), { ...token, position: 500, lastSongId: null }), /past the Queue/);
  assert.match(refused(fresh(), { ...token, shuffleAttempts: (token.shuffleAttempts ?? 0) + 3 }), /draw/);
  assert.match(refused(fresh(), { ...token, lineConfirmedFrom: token.position + 5 }), /Line/);
  // Other cards in play: the seed's draws may differ, and the token's song check catches it.
  const other = fresh('1-40');
  const reasons = rejections(other.dispatch(makeCommand('resumeAt', token)));
  if (reasons.length) assert.match(reasons[0], /^cannotResume/);
  else assert.deepEqual(other.show.queue, a.show.queue, 'accepted only when it really is the same Queue');
});

test('resumeAt is plan B for a page with nothing going on: not during play, a Spin or a Check', () => {
  const a = played(3);
  const token = fieldsOf(tokenOf(a));
  // `a` itself is in play: a resume there would throw the round away.
  assert.deepEqual(rejections(a.dispatch(makeCommand('resumeAt', token))).map((r) => r.split(':')[0]), ['wrongScene']);
  a.send('next');
  assert.deepEqual(rejections(a.dispatch(makeCommand('resumeAt', token))).map((r) => r.split(':')[0]), ['wrongScene']);
  // A fixed test Queue has no token (its "seed" would not rebuild it).
  const fixed = setup({ seed: 1, settings: { autoAdvance: false } });
  fixed.show.fixedQueue = [3, 17, 45];
  fixed.send('newRound', { number: 1 });
  assert.equal(fixed.show.snapshot().resume, null);
});
