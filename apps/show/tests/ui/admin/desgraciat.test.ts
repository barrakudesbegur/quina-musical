// The Desgraciat round in Admin: the round editor's third kind (one per night), its one prize bundle (the last card
// standing's, the plan's `bingo`) with Line prizes moved there rather than lost, and the round and the win named right
// in the cheat sheet, the plan diff, the card types and the winners list.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultCardType } from '@quina/protocol';
import { checkGamePlan, type GamePlan, type RoundPlan } from '../../../../../packages/ui/plan.ts';
import { SAMPLE_PLAN } from '../../../../../packages/ui/fixtures/plan.ts';
import { blankPrize, desgraciatTaken, movedLinePrizes, withLineMoved, withRoundKind } from '../../../../admin/logic/plan-edit.ts';
import { cheatRound } from '../../../../admin/logic/cheatsheet.ts';
import { diffPlans } from '../../../../admin/logic/plan-diff.ts';
import { winnerRows } from '../../../../admin/logic/winners.ts';
import { S } from '../../../../admin/strings.ts';

const prize = (title: string, headline = false) => ({ ...blankPrize(headline), title });
const normal = (number: number): RoundPlan => ({ number, kind: 'normal', cardType: 'normal', line: [prize('Pernil', true), prize('Tassa')], bingo: [prize('Sopar', true), prize('Clauer')] });

test("a round made the Desgraciat one keeps its Line prizes in its one bundle, and plays its kind's default cards", () => {
  const round = normal(5);
  assert.equal(movedLinePrizes(round, 'desgraciat'), 2);
  assert.equal(movedLinePrizes(round, 'special'), 0);
  const d = withRoundKind(round, 'desgraciat');
  assert.equal(d.kind, 'desgraciat');
  assert.equal(d.cardType, defaultCardType('desgraciat'), 'its card type follows the kind (D70: the special cards)');
  assert.deepEqual(d.line, []);
  assert.deepEqual(d.bingo.map((p) => [p.title, p.headline]), [['Sopar', true], ['Pernil', true], ['Clauer', false], ['Tassa', false]], 'headline prizes first');
  assert.equal(movedLinePrizes(d, 'desgraciat'), 0, 'already Desgraciat: nothing moves');
  // A special round made Desgraciat: its default type becomes the Desgraciat's default.
  assert.equal(withRoundKind({ ...round, kind: 'special', cardType: 'especial' }, 'desgraciat').cardType, defaultCardType('desgraciat'));
  // A type picked by hand stays when the kind changes.
  assert.equal(withRoundKind({ ...round, cardType: 'daurat' }, 'desgraciat').cardType, 'daurat');
  // Back to normal: the prizes stay where they are now.
  assert.deepEqual(withRoundKind(d, 'normal').bingo.length, 4);
  // An imported plan with Line prizes in its Desgraciat round: they can be moved over.
  const stray = { ...d, line: [prize('Bufanda')] };
  assert.deepEqual(withLineMoved(stray).line, []);
  assert.equal(withLineMoved(stray).bingo.at(-1)?.title, 'Bufanda');
  assert.equal(withLineMoved(d), d, 'nothing to move');
  assert.equal(S.rounds.linesMoved(2), "La Quina Desgraciada no té línia: els seus 2 premis de línia ara són premis de l'últim dempeus.");
});

test('one Desgraciat round per night: the option is taken while another round has it, and checkGamePlan refuses two', () => {
  const rounds = SAMPLE_PLAN.rounds;
  assert.equal(desgraciatTaken(rounds, 0), true, 'round 5 is the sample plan Desgraciat round');
  assert.equal(desgraciatTaken(rounds, 4), false, 'its own round can keep it');
  // The Desgraciat round has no number to name it by.
  assert.equal(S.rounds.desgraciatTaken, "Desgraciada (ja n'hi ha una)");
  const two: GamePlan = { ...SAMPLE_PLAN, rounds: rounds.map((r) => (r.number === 2 ? withRoundKind(r, 'desgraciat') : r)) };
  const check = checkGamePlan(two);
  assert.equal(check.ok, false);
  assert.ok(!check.ok && check.errors.some((e) => e.startsWith('plan.rounds:')), 'the error the editor shows under the list');
  assert.equal(checkGamePlan(SAMPLE_PLAN).ok, true);
});

test("the cheat sheet: the Desgraciat round's one prize, the last card standing's, and no Line", () => {
  const r5 = cheatRound(SAMPLE_PLAN, SAMPLE_PLAN.rounds[4]);
  assert.equal(r5.desgraciat, true);
  assert.equal(r5.special, false);
  assert.deepEqual(r5.prizes.map((p) => [p.kind, p.label]), [['standing', "Premi de l'últim dempeus"]]);
  assert.deepEqual(r5.prizes[0].items.slice(0, 2).map((i) => [i.title, i.headline]), [['Pernil', true], ['Xocolata', false]], 'a whole hamper');
  assert.equal(r5.prizes[0].items.length, SAMPLE_PLAN.rounds[4].bingo.length);
  assert.deepEqual(cheatRound(SAMPLE_PLAN, SAMPLE_PLAN.rounds[0]).prizes.map((p) => p.kind), ['line', 'bingo']);
  assert.equal(r5.label, 'Quina Desgraciada', 'no number');
  assert.equal(cheatRound(SAMPLE_PLAN, SAMPLE_PLAN.rounds[5]).label, 'Quina 5', 'round 6, after it, is Quina 5');
});

test('the plan diff, the card types and the winners name the round and the win', () => {
  const before: GamePlan = { ...SAMPLE_PLAN, rounds: SAMPLE_PLAN.rounds.map((r) => (r.number === 5 ? normal(5) : r)) };
  const diff = diffPlans(before, SAMPLE_PLAN);
  assert.deepEqual(diff.rounds.kindChanged, [5]);
  assert.deepEqual(diff.prizes.filter((p) => p.round === 5).map((p) => p.kind).sort(), ['line', 'standing']);
  assert.equal(S.plan.cardRounds([1, 2, 3, 4, 5, 6], false, true), 'Juga a les quines 1, 2, 3, 4, 5 i 6 i la quina desgraciada');
  assert.deepEqual(S.night.kind, { line: 'Línia', bingo: 'Quina', standing: 'Últim cartró dempeus' });
  const rows = winnerRows([{ round: 5, kind: 'standing', cardId: 57, claimId: 'cl-13', winningSongId: 1, position: 21, atMs: 1, name: null, notes: null }], SAMPLE_PLAN);
  assert.equal(rows[0].prize, 'Pernil +18');
});
