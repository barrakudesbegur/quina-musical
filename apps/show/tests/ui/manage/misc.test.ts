// Admin's smaller pure modules: routes, the command log, Winners rows, exports, player-app settings.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SAMPLE_PLAN } from '../../../ui/fixtures/plan.ts';
import { baseState } from '../../../ui/fixtures/states.ts';
import { routeFromHash } from '../../../manage/logic/route.ts';
import { applyRejection, lastCommand, recordCommand, type CommandRecord } from '../../../manage/logic/command-log.ts';
import { editDiffers, editOf, winnerInfoFields, winnerRows } from '../../../manage/logic/winners.ts';
import { exportFileName, fullExport } from '../../../manage/logic/exports.ts';
import { DEFAULT_PLAYER_SETTINGS, readPlayerSettings } from '../../../manage/logic/player-settings.ts';

test('routes come from the hash, unknown ones fall back to setup', () => {
  assert.equal(routeFromHash('#xuleta'), 'xuleta');
  assert.equal(routeFromHash('#/nit'), 'nit');
  assert.equal(routeFromHash(''), 'preparacio');
  assert.equal(routeFromHash('#res'), 'preparacio');
});

const rec = (reqId: string | null, cmd: string, subject: string | null = null): CommandRecord => ({ reqId, cmd, subject, atMs: 1, status: reqId ? 'sent' : 'offline', reason: null, detail: null });

test('the command log marks rejections by reqId and finds the latest per command and subject', () => {
  let log = recordCommand([], rec('r-1', 'winnerInfo', 'cl-1'));
  log = recordCommand(log, rec('r-2', 'winnerInfo', 'cl-2'));
  log = recordCommand(log, rec(null, 'endGame'));
  log = applyRejection(log, { reqId: 'r-1', reason: 'unknownCommand', detail: 'x' });
  assert.equal(lastCommand(log, 'winnerInfo', 'cl-1')?.status, 'rejected');
  assert.equal(lastCommand(log, 'winnerInfo', 'cl-1')?.reason, 'unknownCommand');
  assert.equal(lastCommand(log, 'winnerInfo')?.subject, 'cl-2');
  assert.equal(lastCommand(log, 'endGame')?.status, 'offline');
  assert.deepEqual(applyRejection(log, { reqId: 'nope', reason: 'busy' }), log);
  assert.equal(recordCommand(log, rec('r-9', 'x'), 2).length, 2);
});

test('Winners are listed by round, Line first, with the planned prize', () => {
  const winners = [...baseState(0).winners].reverse();
  const rows = winnerRows(winners, SAMPLE_PLAN);
  assert.deepEqual(rows.map((r) => [r.winner.round, r.winner.kind]), [[1, 'line'], [1, 'bingo'], [2, 'line'], [2, 'bingo']]);
  assert.equal(rows[0].prize, '[Premi de línia 1]');
  assert.equal(winnerRows(winners, null)[0].prize, null);
});

test('a Winner edit differs only when the trimmed text does', () => {
  const w = { name: 'Marta', notes: null };
  assert.equal(editDiffers(w, editOf(w)), false);
  assert.equal(editDiffers(w, { name: ' Marta ', notes: '' }), false);
  assert.equal(editDiffers(w, { name: 'Marta', notes: 'Barra' }), true);
  assert.deepEqual(winnerInfoFields('cl-1', { name: ' Joan ', notes: '' }), { claimId: 'cl-1', name: 'Joan', notes: '' });
});

test('the full export carries the plan and the night, and is marked private', () => {
  const s = baseState(0);
  const out = fullExport(SAMPLE_PLAN, s.cards, s.winners, 123);
  assert.equal(out.private, true);
  assert.equal(out.plan, SAMPLE_PLAN);
  assert.equal(out.game?.winners.length, 4);
  assert.equal(out.game?.cardsInPlay, s.cards.inPlay);
  assert.equal(fullExport(SAMPLE_PLAN, null, null, 1).game, null);
  assert.equal(exportFileName('26', 'pla', 0), 'quina-26-pla.json');
  assert.match(exportFileName('26', 'complet', new Date(2026, 11, 26, 23, 5).getTime()), /^quina-26-complet-20261226-2305\.json$/);
});

test('player settings fall back to the defaults field by field', () => {
  assert.deepEqual(readPlayerSettings(null), DEFAULT_PLAYER_SETTINGS);
  assert.deepEqual(readPlayerSettings({ soundsOnByDefault: false, banner: 7 }), { soundsOnByDefault: false, banner: '' });
  assert.equal(readPlayerSettings({ banner: 'x'.repeat(500) }).banner.length, 140);
});
