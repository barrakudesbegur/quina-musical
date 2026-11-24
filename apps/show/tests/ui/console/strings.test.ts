// Every reason, sound and command the protocol knows has its own Catalan text.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REJECT_REASONS, SOUND_NAMES } from '@quina/protocol';
import { CONSOLE_COMMANDS } from '../../../../console/config.ts';
import { S, commandText, reasonText, soundText, holdReasonText } from '../../../../console/strings.ts';

test('every rejection reason has a message', () => {
  for (const reason of REJECT_REASONS) assert.ok(S.reasons[reason], `missing reason ${reason}`);
  assert.equal(reasonText('somethingNew'), S.reasonFallback);
});

test('every sound has a label', () => {
  for (const name of SOUND_NAMES) assert.ok(S.sounds.names[name], `missing sound ${name}`);
  assert.equal(soundText('tada'), 'Tatxan!');
});

test('every command the console sends has a label; others fall back', () => {
  for (const cmd of CONSOLE_COMMANDS) assert.ok(S.commands[cmd], `missing command ${cmd}`);
  assert.equal(commandText('overrideNextRecipe'), S.commandFallback);
  assert.equal(commandText('next'), 'Següent');
  assert.equal(commandText(null), S.commandFallback);
});

test('every hold reason has a text, with a fallback', () => {
  for (const reason of ['hold', 'back', 'cancel', 'end', 'music', 'claim', 'checkFailed'] as const) assert.ok(S.hold.reasons[reason], `missing ${reason}`);
  assert.equal(holdReasonText('hold'), S.hold.reasons.hold);
  assert.equal(holdReasonText('mystery'), S.hold.reasonFallback);
});
