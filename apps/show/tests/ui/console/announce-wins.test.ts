// The menu's «Anunciar Línia i Quina als mòbils» switch (D289): reads `game.announceWins` (absent means on) and sends
// `setGame { announceWins }`, which the protocol accepts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkCommand, makeCommand } from '@quina/protocol';
import { ANNOUNCE_WINS_DEFAULT, announceWinsArgs, announceWinsNow } from '../../../../console/logic/announce-wins.ts';
import { S } from '../../../../console/strings.ts';

test('absent means on: an older journal, or no state yet', () => {
  assert.equal(ANNOUNCE_WINS_DEFAULT, true);
  assert.equal(announceWinsNow(null), true);
  assert.equal(announceWinsNow(undefined), true);
  assert.equal(announceWinsNow({}), true);
  assert.equal(announceWinsNow({ announceWins: true }), true);
  assert.equal(announceWinsNow({ announceWins: false }), false);
});

test('a press sends setGame { announceWins } with only that setting', () => {
  assert.deepEqual(announceWinsArgs(false), { announceWins: false });
  assert.deepEqual(announceWinsArgs(true), { announceWins: true });
  for (const on of [true, false]) assert.equal(checkCommand(makeCommand('setGame', announceWinsArgs(on))).ok, true);
});

test('the label and its note name both shouts', () => {
  assert.equal(S.menu.announceWins, 'Anunciar Línia i Quina als mòbils');
  assert.match(S.menu.announceWinsNote, /«LÍNIA!» o «QUINA!»/);
  assert.match(S.menu.announceWinsNote, /Apagat/);
});
