// The paced Check on the console (D107–D126): the card marked in private from the start, where the reveals stop, the
// big button's press (the step it expects), «Enrere», «Revisió manual», «Seguides», and the Review's confirmations.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FIXTURES } from '../../../../../packages/ui/fixtures/states.ts';
import { flowOf } from '../../../../../packages/ui/flow.ts';
import { readPrintedCardTypes } from '../../../../../packages/ui/data/card-types.ts';
import {
  batchWinners,
  canToggleAuto,
  checkBackCommand,
  checkCells,
  checkPress,
  checkReviewCommand,
  checkState,
  checkVerdict,
  claimOf,
  nextReveal,
  replayedAfterBack,
  reviewNeedsConfirm,
  stepBackOnScreen,
  stepMark,
  typeChip,
} from '../../../../console/logic/check.ts';
import { S } from '../../../../console/strings.ts';

const NOW = 1_800_000_000_000;
const flowAt = (name: string) => flowOf(FIXTURES[name](NOW).state);
function onScreen(name: string) {
  const flow = flowAt(name);
  assert.ok(flow.check, name);
  return { flow, check: flow.check, claim: claimOf(flow, flow.check) };
}

test("the card in private: every song's mark from the start, full once revealed, «Següent», the songs never revealed", () => {
  const { check, claim } = onScreen('check');
  const cells = checkCells(check, claim, NOW);
  assert.equal(cells.length, 12);
  const row = cells.filter((c) => c.inCheck);
  assert.deepEqual(row.map((c) => c.songId), [2, 62, 16, 20], "#57's third row");
  assert.ok(row.every((c) => c.row === 2));
  assert.deepEqual(row.map((c) => c.mark), ['ok', 'ok', 'ok', 'bad'], 'the presenters know «Elefants» fails before it is revealed');
  assert.deepEqual(row.map((c) => c.revealed), [true, false, false, false], 'the room sees a mark once its snippet ends');
  assert.deepEqual(row.map((c) => c.playing), [false, true, false, false], '«Aserejé» is playing');
  assert.deepEqual(checkCells(check, claim, NOW + 5000).filter((c) => c.inCheck).map((c) => c.revealed), [true, true, false, false]);
  assert.deepEqual(row.map((c) => c.next), [false, false, true, false]);
  assert.ok(cells.filter((c) => !c.inCheck).every((c) => c.mark === null), "a Line's other rows carry no mark");

  const twoFail = onScreen('checkCelebrateNext');
  const cells204 = checkCells(twoFail.check, twoFail.claim, NOW).filter((c) => c.inCheck);
  assert.deepEqual(cells204.map((c) => c.skipped), [false, true, true, true], "#204 fails at its first song: the rest won't be revealed");
  assert.ok(cells204.every((c) => !c.next), 'after the cue nothing is next');
  assert.deepEqual(checkCells(onScreen('checkWrongType').check, onScreen('checkWrongType').claim, NOW), [], 'a card of another type: no songs');
});

test("D121: a review back on screen after another card's Check: its earlier reveals full marks, none «playing»", () => {
  const { check, claim } = onScreen('checkResumed');
  const row = () => checkCells(check, claim, NOW).filter((c) => c.inCheck);
  assert.deepEqual(row().map((c) => c.revealed), [true, true, true, false]);
  assert.deepEqual(row().map((c) => c.playing), [false, false, false, false]);
  assert.deepEqual(row().map((c) => c.next), [false, false, false, true], '«Elefants» is next');
  // Even when the last one was revealed a second before the Check came back, its snippet "still playing" by the clock.
  const recent = { ...check, revealed: check.revealed.map((r, i, all) => ({ ...r, atMs: check.startAtMs - 1000 - (all.length - 1 - i) * 3400 })) };
  const cells = checkCells(recent, claim, check.startAtMs).filter((c) => c.inCheck);
  assert.deepEqual(cells.map((c) => [c.revealed, c.playing]), [[true, false], [true, false], [true, false], [false, false]]);
  assert.deepEqual(checkPress(flowAt('checkResumed')), { cmd: 'checkNext', args: { claimId: 'cl-5', step: 3 } }, 'the next press reveals the 4th');
  // A reveal after it came back plays as usual.
  const pressed = { ...check, revealed: [...check.revealed, { songId: 20, landed: false, atMs: NOW + 100, durationMs: 1200 }] };
  assert.deepEqual(checkCells(pressed, claim, NOW + 500).filter((c) => c.inCheck).map((c) => c.playing), [false, false, false, true]);
  // A step back from before its review: no «Enrere: torna a sonar…» now; one made since it came back does show.
  assert.equal(stepBackOnScreen(check, { claimId: 'cl-5', index: 3, atMs: check.startAtMs - 60_000 }), false);
  assert.equal(stepBackOnScreen(check, { claimId: 'cl-5', index: 3, atMs: check.startAtMs + 1 }), true);
  assert.equal(stepBackOnScreen(check, { claimId: 'cl-6', index: 3, atMs: check.startAtMs + 1 }), false, 'another card');
});

test('the verdict, in private: complete, the song that fails it (its place in the reveals), the wrong type', () => {
  const at = (name: string) => {
    const { check, claim } = onScreen(name);
    return checkVerdict(check, claim);
  };
  assert.deepEqual(at('check'), { kind: 'missing', win: 'line', position: 4, songId: 20 });
  assert.deepEqual(at('checkValid'), { kind: 'complete', win: 'line', row: 0 });
  assert.deepEqual(at('checkWrongType'), { kind: 'wrongType', cardType: 'especial' });
  assert.equal(S.check.verdict.missing(4, 'Elefants'), 'Falla a la 4a: «Elefants»');
  assert.equal(S.check.verdict.complete('line', 1), 'Té línia: la fila 2 és completa');
  assert.equal(S.check.verdict.wrongType('especial', 'normal'), 'Tipus erroni: és un cartró especial, i aquesta quina juga els normals');
});

test('the stages: revealing, in a row, at the cue (pass or fail, last or not), past it, the shared Celebration, review', () => {
  assert.deepEqual(checkState(flowAt('checkStarted')), { stage: 'reveal', pass: false, more: false });
  assert.deepEqual(checkState(flowAt('check')), { stage: 'reveal', pass: false, more: true });
  assert.equal(checkState(flowAt('checkAuto'))?.stage, 'auto');
  assert.deepEqual(checkState(flowAt('checkValid')), { stage: 'cue', pass: true, more: false }, '«Celebrem!»');
  assert.deepEqual(checkState(flowAt('checkTwo')), { stage: 'cue', pass: true, more: true }, '«Vàlid · següent», no fanfare');
  assert.deepEqual(checkState(flowAt('checkFailed')), { stage: 'cue', pass: false, more: false }, '«Fallada»');
  assert.deepEqual(checkState(flowAt('checkWrongType')), { stage: 'cue', pass: false, more: false }, 'nothing to reveal: the first press is the cue');
  assert.deepEqual(checkState(flowAt('checkCuePass')), { stage: 'cued', pass: true, more: true }, 'the next card comes by itself');
  assert.equal(checkState(flowAt('checkCelebrateNext'))?.stage, 'celebrateNext');
  assert.equal(checkState(flowAt('checkReview'))?.stage, 'review');
  assert.equal(checkState(flowAt('play')), null);
});

test('the big button sends the step it expects: a reveal, the cue, the shared Celebration; it stops «Seguides»', () => {
  assert.deepEqual(checkPress(flowAt('checkStarted')), { cmd: 'checkNext', args: { claimId: 'cl-5', step: 0 } });
  assert.deepEqual(checkPress(flowAt('check')), { cmd: 'checkNext', args: { claimId: 'cl-5', step: 2 } });
  assert.deepEqual(checkPress(flowAt('checkFailed')), { cmd: 'checkNext', args: { claimId: 'cl-5', step: 4 } }, 'the cue: the revealed count');
  assert.deepEqual(checkPress(flowAt('checkWrongType')), { cmd: 'checkNext', args: { claimId: 'cl-8', step: 0 } });
  assert.deepEqual(checkPress(flowAt('checkCelebrateNext')), { cmd: 'checkNext', args: { claimId: 'cl-6', step: 2 } }, 'exactly celebrationNext');
  assert.deepEqual(checkPress(flowAt('checkAuto')), { cmd: 'checkAuto', args: { on: false } });
  assert.equal(checkPress(flowAt('checkReview')), null, 'under review A does nothing (D135)');
  assert.equal(checkPress(flowAt('checkCuePass')), null, 'between cards: nothing to press');
});

test('«Enrere» takes the last revealed mark off, only while revealing; «Revisió manual» before the cue', () => {
  assert.deepEqual(checkBackCommand(onScreen('check').check), { claimId: 'cl-5', step: 1 });
  assert.equal(checkBackCommand(onScreen('checkStarted').check), null, 'nothing revealed');
  assert.equal(checkBackCommand(onScreen('checkReview').check), null, 'not under review (D134)');
  assert.equal(checkBackCommand(onScreen('checkCuePass').check), null, 'not after the cue');
  assert.deepEqual(checkBackCommand(onScreen('checkFailed').check), { claimId: 'cl-5', step: 3 }, 'at the cue, before it plays');
  assert.deepEqual(checkReviewCommand(onScreen('checkFailed').check), { claimId: 'cl-5' });
  assert.equal(checkReviewCommand(onScreen('checkReview').check), null);
  assert.equal(checkReviewCommand(onScreen('checkCueFail').check), null, 'after its cue');
  const { check, claim } = onScreen('check');
  assert.equal(replayedAfterBack(check, claim, 2), 62, 'back to 2: «Aserejé» plays again');
  assert.equal(replayedAfterBack(check, claim, 0), null, 'back to none: the music from before');
});

test('«Seguides» switches while there are songs to reveal; «Ara destapes» counts up to where the reveals stop', () => {
  assert.equal(canToggleAuto(onScreen('check').check), true);
  assert.equal(canToggleAuto(onScreen('checkWrongType').check), false, 'nothing to reveal');
  assert.equal(canToggleAuto(onScreen('checkReview').check), false);
  assert.equal(canToggleAuto(onScreen('checkCueFail').check), false);
  assert.deepEqual(nextReveal(onScreen('check').check, onScreen('check').claim), { songId: 16, at: 3, of: 4 });
  const standing = onScreen('checkStanding');
  assert.deepEqual(nextReveal(standing.check, standing.claim), { songId: 17, at: 6, of: 7 }, 'a standing card stops at the song that sank it');
  assert.equal(nextReveal(onScreen('checkFailed').check, onScreen('checkFailed').claim), null, 'all revealed');
});

test('the shared Celebration names the cards that passed; a decision by hand against the card asks first', () => {
  assert.deepEqual(batchWinners(flowAt('checkCelebrateNext')), [123]);
  assert.equal(S.check.big.celebrateFor([123]), 'el #123 ha guanyat · prem quan acabeu de parlar');
  const failing = onScreen('checkReview').check;
  assert.equal(reviewNeedsConfirm('win', failing), true, 'winning a card that fails');
  assert.equal(reviewNeedsConfirm('lose', failing), false);
  const passing = onScreen('checkValid').check;
  assert.equal(reviewNeedsConfirm('lose', passing), true, 'losing a card that passes');
  assert.equal(reviewNeedsConfirm('win', passing), false);
});

test("marks mean «good for the claim»; the type chip names the printed type and the side checked (D163)", () => {
  assert.equal(stepMark('line', true), 'ok');
  assert.equal(stepMark('line', false), 'bad');
  assert.equal(stepMark('standing', false), 'ok');
  assert.equal(stepMark('standing', true), 'bad');
  const types = readPrintedCardTypes([
    { type: 'normal', name: 'Cartró normal', shortName: 'Normal', color: '#cfe8ff', title: '', priceCents: null, sides: [{ side: 1, pool: '1', label: '1–5' }, { side: 2, pool: '2', label: '6–10' }] },
    { type: 'especial', name: 'Cartró especial', shortName: 'Especial', color: '#ffd9e8', title: '', priceCents: null, sides: [{ side: 1, pool: '1' }] },
  ]) ?? [];
  assert.deepEqual(typeChip('especial', types, null), { name: 'Especial', label: 'Especial', color: '#ffd9e8', special: true });
  assert.deepEqual(typeChip('normal', types, null, 1), { name: 'Normal', label: 'Normal 1–5', color: '#cfe8ff', special: false });
  assert.equal(typeChip('normal', types, null, 2)?.label, 'Normal 6–10');
  assert.equal(typeChip('especial', types, null, 2)?.label, 'Especial', 'one side: just its name');
  assert.equal(typeChip(null, types, null), null);
});
