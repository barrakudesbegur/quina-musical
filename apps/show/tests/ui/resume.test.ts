// Plan B on the console: reading a resume code, the command it sends, which code the device keeps.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatResumeToken, type ResumeToken } from '@quina/protocol';
import { nextSavedCode, readResume, resumeCommand, resumeSummary } from '../../../../packages/rules/resume.ts';

const token: ResumeToken = {
  round: 3,
  kind: 'normal',
  shuffleSeed: 123456789,
  shuffleAttempts: 2,
  position: 17,
  lastSongId: 41,
  lineConfirmedFrom: 12,
  text: '',
};
token.text = formatResumeToken(token);

test('a code typed with spaces and lower case reads back to the same point', () => {
  const draft = readResume(` ${token.text.toLowerCase().replace(/-/g, ' - ')} `);
  assert.equal(draft.error, null);
  assert.equal(draft.text, token.text);
  assert.deepEqual(draft.point && resumeCommand(draft.point), {
    round: 3, kind: 'normal', shuffleSeed: 123456789, position: 17, lineConfirmedFrom: 12, lastSongId: 41, shuffleAttempts: 2, cardType: 'normal',
  });
});

test("a code carries the round's card type to resumeAt", () => {
  const text = formatResumeToken({ ...token, cardType: 'desgraciat' });
  assert.equal(resumeCommand(readResume(text).point!).cardType, 'desgraciat');
  assert.equal(resumeCommand(readResume(formatResumeToken({ ...token, kind: 'special' })).point!).cardType, 'especial', "no T part: the kind's default");
});

test('empty and malformed codes are told apart', () => {
  assert.equal(readResume('   ').error, 'empty');
  assert.equal(readResume('Q3N-NOPE').error, 'invalid');
});

test('the device keeps the latest code, and a snapshot without one changes nothing', () => {
  assert.equal(nextSavedCode(null, token), token.text);
  assert.equal(nextSavedCode('Q2N-0000000-5', null), 'Q2N-0000000-5');
  assert.equal(nextSavedCode('Q2N-0000000-5', undefined), 'Q2N-0000000-5');
});

test('the preview counts songs from 1', () => {
  const point = readResume(token.text).point!;
  assert.deepEqual(resumeSummary(point), { round: 3, special: false, counted: 18, lastSongId: 41, lineFromSong: 13 });
  const fresh = readResume('Q1E-0000000--1').point!;
  assert.deepEqual(resumeSummary(fresh), { round: 1, special: true, counted: 0, lastSongId: null, lineFromSong: null });
});
