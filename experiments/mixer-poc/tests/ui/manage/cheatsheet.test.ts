// The cheat sheet's content model: prizes with sponsors per round, rules, the fixed parts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SAMPLE_PLAN } from '../../../ui/fixtures/plan.ts';
import { cheatRound, cheatSheetModel, type CheatSheetCopy } from '../../../manage/logic/cheatsheet.ts';
import { CHEAT_SHEET_COPY } from '../../../manage/strings.ts';

const COPY: CheatSheetCopy = { keys: [{ keys: '→', action: 'Següent' }], wiiReminder: 'Wii', checklist: ['Carregador'] };

test('every round with both prizes, their sponsors and the special flag', () => {
  const m = cheatSheetModel(SAMPLE_PLAN, COPY);
  assert.equal(m.title, 'Quina Musical');
  assert.equal(m.rounds.length, 8);
  const r1 = m.rounds[0];
  assert.equal(r1.label, 'Quina 1');
  assert.equal(r1.special, false);
  assert.deepEqual(r1.prizes.map((p) => [p.kind, p.label, p.title, p.sponsor]), [
    ['line', 'Premi de línia', '[Premi de línia 1]', '[Patrocinador 1]'],
    ['bingo', 'Premi de quina', '[Premi de quina 1]', '[Patrocinador 1]'],
  ]);
  assert.equal(m.rounds[6].special, true);
  assert.equal(m.hasSpecialRound, true);
  assert.deepEqual(m.claimRules, SAMPLE_PLAN.cheatSheet.claimRules);
  assert.deepEqual(m.specialRoundRules, SAMPLE_PLAN.cheatSheet.specialRoundRules);
  assert.equal(m.keys, COPY.keys);
});

test('a round without a prize says so with a null title', () => {
  const plan = structuredClone(SAMPLE_PLAN);
  plan.rounds[0].line = null;
  plan.rounds[0].bingo!.sponsorId = null;
  const r = cheatRound(plan, plan.rounds[0]);
  assert.equal(r.prizes[0].title, null);
  assert.equal(r.prizes[0].sponsor, null);
  assert.equal(r.prizes[1].sponsor, null);
});

test('special-round rules only when a special round is planned', () => {
  const plan = structuredClone(SAMPLE_PLAN);
  for (const r of plan.rounds) r.kind = 'normal';
  const m = cheatSheetModel(plan, COPY);
  assert.equal(m.hasSpecialRound, false);
  assert.deepEqual(m.specialRoundRules, []);
});

test('without a plan, only the fixed parts', () => {
  const m = cheatSheetModel(null, COPY);
  assert.equal(m.title, 'Quina Musical');
  assert.deepEqual(m.rounds, []);
  assert.deepEqual(m.checklist, ['Carregador']);
});

test("Admin's copy has the laptop keys, the Wii reminder and the whole setup checklist", () => {
  const keys = CHEAT_SHEET_COPY.keys.map((k) => k.keys).join(' ');
  for (const key of ['→', '←', 'Espai', 'S', 'M', 'Esc', '+', 'L', 'A', '0–4', 'D', 'H', '[']) assert.ok(keys.includes(key), `key ${key}`);
  assert.match(CHEAT_SHEET_COPY.wiiReminder, /portàtil/);
  assert.equal(CHEAT_SHEET_COPY.checklist.length, 6);
});
