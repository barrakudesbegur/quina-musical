// The Desgraciat round on the console: the Dempeus tab (who is still standing, which cards just fell, the last one),
// the claim for the last card standing as the default action, the standing Check's marks and words, the Futur's
// countdown, and the round's name and prize in the console's other panels.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STANDING_LIST_MAX, type ShowState } from '@quina/protocol';
import { FIXTURES, DESGRACIAT_STANDING_23, DESGRACIAT_STANDING_26 } from '../../../../../packages/ui/fixtures/states.ts';
import { SAMPLE_PLAN } from '../../../../../packages/ui/fixtures/plan.ts';
import { flowOf, type AnyCommandName, type FlowState } from '../../../../../packages/ui/flow.ts';
import { roundIntroFields } from '../../../../../packages/ui/plan.ts';
import { resumeCommand } from '../../../../../packages/rules/resume.ts';
import { defaultAction, sendDefault, type DefaultActionInput } from '../../../../console/logic/default-action.ts';
import { canSend, controlsModel } from '../../../../console/logic/scene.ts';
import { checkProgress, sinkingSong, stepMark, suggestedVerdict } from '../../../../console/logic/check.ts';
import { claimKindsOf, defaultClaimKind, roundPrizes } from '../../../../console/logic/show-data.ts';
import {
  EMPTY_TAB_MEMORY,
  STANDING_GOLD_FROM,
  fallenBetween,
  helperTabAfter,
  helperTabsFor,
  standingChips,
  nextFellLast,
  standingFuture,
  standingSummary,
} from '../../../../console/logic/standing.ts';
import { S } from '../../../../console/strings.ts';

const NOW = 1_800_000_000_000;
const state = (name: string): ShowState => FIXTURES[name](NOW).state;

function input(s: FlowState | null): DefaultActionInput {
  const flow = flowOf(s);
  const controls = { state: s, flow, online: true };
  return { state: s, flow, nowMs: NOW, plan: SAMPLE_PLAN, nextEnabled: controlsModel(controls).next.enabled, can: (cmd: AnyCommandName) => canSend(cmd, controls) };
}

test('the Dempeus tab comes first in the Desgraciat round only', () => {
  assert.deepEqual(helperTabsFor('desgraciat'), ['standing', 'future', 'prizes', 'effects']);
  assert.deepEqual(helperTabsFor('normal'), ['future', 'prizes', 'effects']);
  assert.deepEqual(helperTabsFor(undefined), ['future', 'prizes', 'effects']);
});

test('Dempeus is selected as the round starts and when one card is left; otherwise the device keeps its choice', () => {
  const play = state('play');
  const many = state('desgraciat');
  // A new Desgraciat round (or the first snapshot of it on this device): Dempeus.
  let step = helperTabAfter('prizes', EMPTY_TAB_MEMORY, many);
  assert.equal(step.tab, 'standing');
  // The presenters pick another tab: it stays.
  step = helperTabAfter('effects', step.memory, many);
  assert.equal(step.tab, 'effects');
  // One card left: back to Dempeus, once (its "Comprovar #57" is the default action).
  const last = state('desgraciatLast');
  step = helperTabAfter('effects', step.memory, last);
  assert.equal(step.tab, 'standing');
  step = helperTabAfter('future', step.memory, last);
  assert.equal(step.tab, 'future');
  // Another round: Dempeus doesn't exist there, so Futur; a regular tab is kept.
  assert.equal(helperTabAfter('standing', step.memory, play).tab, 'future');
  assert.equal(helperTabAfter('prizes', step.memory, play).tab, 'prizes');
  assert.equal(helperTabAfter('prizes', EMPTY_TAB_MEMORY, null).tab, 'prizes');
});

test('the count "N dempeus de M cartrons": the bar above 60, the sorted cards from 60 down, gold from 3 down', () => {
  const many = standingSummary(state('desgraciat').standing, 210);
  assert.deepEqual(many, { count: 143, total: 210, seated: 67, share: 143 / 210, ids: null, last: null, gold: false, fellLast: [] });
  assert.equal(S.standing.countLabel(143, 210), '143 dempeus de 210 cartrons');
  assert.equal(S.standing.seated(67), '67 asseguts');
  assert.equal(S.standing.listLater, `Quan en quedin ${STANDING_LIST_MAX} o menys, hi veuràs els números.`);
  const few = standingSummary({ count: 3, cardIds: [204, 57, 12] }, 210);
  assert.deepEqual(few?.ids, [12, 57, 204]);
  assert.equal(few?.gold, true);
  assert.equal(STANDING_GOLD_FROM, 3);
  assert.equal(standingSummary({ count: 4, cardIds: [1, 2, 3, 4] }, 210)?.gold, false);
  const last = standingSummary(state('desgraciatLast').standing, 210);
  assert.equal(last?.last, 57);
  assert.equal(standingSummary({ count: 0, cardIds: [] }, 210)?.gold, false);
  assert.equal(standingSummary(null, 210), null, 'no cards in play');
  assert.equal(standingSummary({ count: 5, cardIds: [1, 2, 3, 4, 5] }, 0)?.total, null, 'an unknown total: no bar');
});

test('standing-fall: the cards missing from the new list fell; nothing to compare above 60 or across rounds', () => {
  assert.deepEqual(fallenBetween(DESGRACIAT_STANDING_26, DESGRACIAT_STANDING_23), [90, 194, 210]);
  assert.deepEqual(fallenBetween(null, DESGRACIAT_STANDING_23), [], 'the list just appeared (from 61 to 60)');
  assert.deepEqual(fallenBetween(DESGRACIAT_STANDING_26, null), []);
  assert.deepEqual(fallenBetween(DESGRACIAT_STANDING_26, DESGRACIAT_STANDING_23, false), [], 'a new round');
  assert.deepEqual(fallenBetween([1, 2], [1, 2, 3]), [], 'Back brings a card back: nothing fell');
  // The demo: 26 standing, then «Titanium» knocks out three.
  const few = FIXTURES.desgraciatFew(NOW);
  const later = few.events?.[0]?.event;
  assert.ok(later?.type === 'state');
  assert.deepEqual(fallenBetween(few.state.standing?.cardIds, later.standing?.cardIds), [90, 194, 210]);
  assert.equal(S.standing.drop(3, 'Titanium'), '−3 amb «Titanium»');
});

test('the chips: standing and just-fallen cards in card order, at most 20 fallen animated', () => {
  const chips = standingChips(DESGRACIAT_STANDING_23, [90, 194, 210], 20);
  assert.equal(chips.length, 26);
  assert.deepEqual(chips.filter((c) => c.fallen).map((c) => [c.cardId, c.order]), [[90, 0], [194, 1], [210, 2]]);
  assert.deepEqual(chips.map((c) => c.cardId), [...DESGRACIAT_STANDING_26]);
  // A landing that knocks out 30: 20 go red and leave, 10 vanish at once.
  const before = Array.from({ length: 40 }, (_, i) => i + 1);
  const after = before.slice(30);
  const fell = fallenBetween(before, after);
  const many = standingChips(after, fell, 20);
  assert.equal(many.filter((c) => c.fallen).length, 20);
  assert.equal(many.length, 30);
  assert.deepEqual(standingChips(after, [], 20).map((c) => c.fallen), after.map(() => false));
});

test('standing-last: "Comprovar #57" is the default action, sending the claim for the last card standing', () => {
  const action = defaultAction(input(state('desgraciatLast')));
  assert.deepEqual(action, { control: 'claimLast', command: { cmd: 'claim', args: { cardId: 57, kind: 'standing' } }, enabled: true });
  const sent: unknown[][] = [];
  const act = ((cmd: string, ...args: unknown[]) => (sent.push([cmd, ...args]), 'r1')) as Parameters<typeof sendDefault>[0];
  sendDefault(act, action);
  assert.deepEqual(sent, [['claim', { cardId: 57, kind: 'standing' }]]);
  assert.equal(S.standing.claimLast(57), 'Comprovar #57');
  // More than one standing: Següent, as in any round.
  assert.equal(defaultAction(input(state('desgraciat')))?.control, 'next');
  assert.equal(defaultAction(input(state('desgraciatFew')))?.control, 'next');
  // After the last card standing's Celebration, the Interval, as after a Bingo.
  assert.deepEqual(defaultAction(input(state('celebrationStanding'))), { control: 'interval', command: { cmd: 'interval' }, enabled: true });
});

test('the claim pad: no Line/Quina choice in the Desgraciat round, the claim is for the last card standing', () => {
  assert.deepEqual(claimKindsOf(state('desgraciat')), ['standing']);
  assert.equal(defaultClaimKind(state('desgraciat')), 'standing');
  assert.deepEqual(claimKindsOf(state('play')), ['line', 'bingo']);
  assert.equal(defaultClaimKind(state('play')), 'line');
});

test("a standing Check's rows: ✓ when the song hasn't sounded, ✗ for the one that sank the card; its result in words", () => {
  const fallen = state('checkFallen').check;
  assert.ok(fallen);
  const rows = checkProgress(fallen, NOW).steps;
  assert.deepEqual(rows.map((r) => stepMark(fallen.kind, r.landed)), ['ok', 'ok', 'ok', 'ok', 'ok', 'ok', 'bad']);
  assert.deepEqual(rows.map((r) => (r.landed ? S.check.landed : S.check.notLanded)).slice(-2), ['No ha sonat', 'Ha sonat']);
  assert.deepEqual(rows.map((r) => stepMark(fallen.kind, r.landed, 'fellLast')), ['ok', 'ok', 'ok', 'ok', 'ok', 'ok', 'last'], 'fell with the last song: its step passes');
  assert.equal(stepMark('line', true), 'ok');
  assert.equal(stepMark('bingo', false), 'bad');
  assert.equal(stepMark('standing', null), null);
  assert.equal(sinkingSong(fallen), 41);
  assert.equal(suggestedVerdict('fallen'), false);
  assert.equal(S.check.resultFallen('Limbo'), 'Resultat: «Limbo» ja ha sonat. Aquest cartró ha caigut.');
  assert.equal(S.check.resultComplete('standing'), "Resultat: no n'ha sonat cap. Aquest cartró és l'últim dempeus!");
  assert.equal(S.check.resultComplete('bingo'), 'Resultat: han sonat totes. Aquest cartró té quina!');
  assert.equal(S.check.completeSince(22, 'standing'), "l'únic dempeus des de la cançó 22");
  const valid = state('checkStandingValid').check;
  assert.ok(valid);
  assert.equal(sinkingSong(valid), null);
  assert.ok(checkProgress(valid, NOW).steps.every((r) => stepMark(valid.kind, r.landed) === 'ok'));
  assert.equal(defaultAction(input(state('checkStandingValid')))?.control, 'confirm');
  assert.equal(defaultAction(input(state('checkFallen')))?.control, 'reject');
});

test('Futur in the Desgraciat round: the songs until one card stands, and the count after each next song', () => {
  const many = state('desgraciat');
  const future = standingFuture(many.future, many.queue.position, many.standing);
  assert.deepEqual(future.ahead, { state: 'in', songs: 20 });
  assert.equal(future.curve.length, 20);
  assert.deepEqual(future.curve[0], { song: 1, standing: 122 });
  assert.deepEqual(future.curve.at(-1), { song: 20, standing: 1 });
  const last = state('desgraciatLast');
  assert.deepEqual(standingFuture(last.future, last.queue.position, last.standing), { ahead: { state: 'now' }, curve: [] });
  assert.deepEqual(standingFuture({ ...many.future!, lastStandingAt: null }, 1, many.standing).ahead, { state: 'never' });
  assert.deepEqual(standingFuture(null, 1, many.standing).ahead, { state: 'unknown', atLeast: null });
  assert.equal(S.future.curveBar(1, 122), 'Després de la següent cançó: 122 dempeus');
});

test('the round named, its intro and resume sending its kind, its one prize', () => {
  assert.deepEqual(roundIntroFields(SAMPLE_PLAN, 5), { number: 5, kind: 'desgraciat', cardType: 'normal' });
  assert.equal(S.interval.next(5, 8, true), 'Quina Desgraciada');
  assert.equal(S.interval.next(4, 8), 'Quina 4 de 8');
  assert.equal(resumeCommand({ round: 5, kind: 'desgraciat', shuffleSeed: 7, position: 3, lineConfirmedFrom: null, lastSongId: 11, shuffleAttempts: 1, cardType: 'normal' }).kind, 'desgraciat');
  const prizes = roundPrizes(SAMPLE_PLAN, 5);
  assert.ok(prizes.status === 'ok');
  assert.deepEqual(prizes.prizes.bundles.map((b) => [b.kind, b.prizes[0]?.title]), [['standing', 'Pernil']]);
  const normal = roundPrizes(SAMPLE_PLAN, 4);
  assert.ok(normal.status === 'ok');
  assert.deepEqual(normal.prizes.bundles.map((b) => b.kind), ['line', 'bingo']);
  assert.equal(S.prizes.ribbon.standing, 'Dempeus');
  assert.equal(S.cheatSheet.prizes(5, true), 'Premis de la Quina Desgraciada');
  assert.equal(S.cheatSheet.prizes(4), 'Premis de la Quina 4');
});

test("the shared win: the cards that sat with the last song show once one card or none stands, and get checked in turn", () => {
  const last = state('desgraciatLast');
  const withFell = { ...last.standing!, fellLast: [90, 12] };
  assert.deepEqual(standingSummary(withFell, 210)?.fellLast, [12, 90], 'one card standing: the group shows, sorted');
  assert.deepEqual(standingSummary({ count: 5, cardIds: [1, 2, 3, 4, 5], fellLast: [6] }, 210)?.fellLast, [], 'more standing: not yet');
  assert.deepEqual(standingSummary({ count: 1, cardIds: [57] }, 210)?.fellLast, [], 'an older engine without the field');
  const claims = [{ cardId: 12, round: 5 }, { cardId: 90, round: 4 }];
  assert.equal(nextFellLast([12, 90], claims, 5), 90, 'card 12 was already claimed this round');
  assert.equal(nextFellLast([12], claims, 5), null);
  // Nobody standing: the default action checks the next card that sat with the last song.
  const none = { ...last, standing: { count: 0, cardIds: [], fellLast: [12, 90] } } as ShowState;
  assert.deepEqual(defaultAction(input(none))?.command, { cmd: 'claim', args: { cardId: 12, kind: 'standing' } });
  // One card still standing in the engine (maybe unsold): it stays the default; the group is there to choose from.
  assert.deepEqual(defaultAction(input({ ...last, standing: withFell } as ShowState))?.command, { cmd: 'claim', args: { cardId: 57, kind: 'standing' } });
});
