// The Desgraciat's finale on the console (logic/finale.ts): the claim slot growing, the finalists' pad checking each
// number privately, the engine's refusals coming back to the pad, the Dempeus tab as the stage, «Celebrem!» as A.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ShowState } from '@quina/protocol';
import { flowOf } from '../../../../../packages/ui/flow.ts';
import { DESGRACIAT_LANDED, FINALE_FINALISTS, FIXTURE_CARDS, FIXTURES } from '../../../../../packages/ui/fixtures/states.ts';
import type { CatalogCard } from '../../../../../packages/ui/data/catalog.ts';
import { CONSOLE } from '../../../../console/config.ts';
import {
  checkFinalist,
  finalePadAfterRefusal,
  finalePadCommand,
  finalePadEnter,
  finalePadKey,
  finalePadRemove,
  finalePadSet,
  finaleRefusal,
  finaleSize,
  finaleSlot,
  finaleTabView,
  openFinalePad,
  withoutFinalist,
  type FinaleCheckContext,
} from '../../../../console/logic/finale.ts';
import { defaultAction } from '../../../../console/logic/default-action.ts';
import { nowRing } from '../../../../console/logic/now-ring.ts';
import { S } from '../../../../console/strings.ts';

const NOW = 1_800_000_000_000;
const SIZES = CONSOLE.finale.sizes;
const LIMITS = { maxDigits: 4, max: 9999, maxFinalists: CONSOLE.finale.maxFinalists };
const at = (name: string): ShowState => FIXTURES[name](NOW).state;
const lastEvent = (name: string): ShowState => {
  const e = FIXTURES[name](NOW).events?.find((x) => x.afterMs === 1500)?.event;
  assert.ok(e?.type === 'state');
  return e;
};

test('«Final a l\'escenari» grows as fewer stand: usual above 20, grown from 20, the biggest from 10 (D167, D184)', () => {
  assert.deepEqual([143, 21, 20, 11, 10, 2].map((n) => finaleSize(n, SIZES)), ['normal', 'normal', 'medium', 'medium', 'large', 'large']);
  assert.deepEqual(finaleSlot(at('desgraciat'), SIZES), { kind: 'start', size: 'normal', standing: 143 });
  assert.deepEqual(finaleSlot(at('desgraciatEleven'), SIZES), { kind: 'start', size: 'medium', standing: 11 });
  assert.deepEqual(finaleSlot(at('desgraciatNine'), SIZES), { kind: 'start', size: 'large', standing: 9 });
  assert.deepEqual(finaleSlot(at('finale'), SIZES), { kind: 'add', enabled: true }, '«+ Finalista» once it is on');
  assert.deepEqual(finaleSlot(lastEvent('finaleWin'), SIZES), { kind: 'add', enabled: false }, 'nobody joins after the winner');
  assert.equal(finaleSlot(at('play'), SIZES), null, 'other rounds keep «Comprovar cartró»');
});

/** The round after 19 songs, with the cards the fixtures know. */
function context(patch: Partial<FinaleCheckContext> = {}): FinaleCheckContext {
  const s = at('desgraciatNine');
  const cards = new Map<number, CatalogCard>(Object.values(FIXTURE_CARDS).map((c) => [c.id, c]));
  return { cards, round: s.round, inPlay: new Set([23, 57, 123, 204, 508]), standing: s.standing?.cardIds ?? null, landed: new Set(DESGRACIAT_LANDED.slice(0, 19)), ...patch };
}

test('each number entered is checked privately: standing, fallen, not printed, not of this round (D168)', () => {
  const ctx = context();
  const standing = checkFinalist(57, [], ctx);
  assert.equal(standing.verdict, 'standing');
  assert.equal(standing.songs?.length, 12);
  assert.ok(standing.songs?.every((s) => !s.landed), '✓ on all 12');
  const fallen = checkFinalist(23, [], ctx);
  assert.equal(fallen.verdict, 'fallen');
  assert.ok(fallen.songs?.some((s) => s.landed), 'its ✗ shows which songs sounded');
  assert.equal(checkFinalist(9999, [], ctx).verdict, 'unknown');
  assert.equal(checkFinalist(508, [], ctx).verdict, 'notThisRound', 'an especial card in a normal-card round');
  assert.equal(checkFinalist(57, [], context({ inPlay: new Set([23]) })).verdict, 'notThisRound', 'not in play');
  assert.equal(checkFinalist(57, [57], ctx).verdict, 'duplicate');
  assert.equal(checkFinalist(57, [], context({ cards: null })).verdict, 'unchecked', 'no catalogue: the engine checks');
  // Above 60 standing the engine sends no list: the songs seen to land decide.
  assert.equal(checkFinalist(23, [], context({ standing: null })).verdict, 'fallen');
  assert.equal(checkFinalist(57, [], context({ standing: null })).verdict, 'standing');
});

test('the pad: ↵ adds a standing card, refuses the rest with its reason; «Començar final» needs 2', () => {
  const ctx = context();
  const check = (id: number, set: readonly number[]) => checkFinalist(id, set, ctx);
  const type = (pad: ReturnType<typeof openFinalePad>, n: number) => [...String(n)].reduce((p, d) => finalePadKey(p, d as '0', LIMITS), pad);
  let pad = openFinalePad('start');
  assert.equal(finalePadEnter(pad, LIMITS, check).outcome, 'empty');
  let step = finalePadEnter(type(pad, 57), LIMITS, check);
  assert.equal(step.outcome, 'added');
  pad = step.pad;
  assert.equal(finalePadCommand(pad, CONSOLE.finale.minFinalists), null, 'one is not a finale');
  step = finalePadEnter(type(pad, 23), LIMITS, check);
  assert.deepEqual([step.outcome, step.pad.refused, step.pad.digits], ['refused', 'fallen', '23'], 'it stays typed, in red');
  assert.equal(finalePadKey(step.pad, 'back', LIMITS).refused, null, 'editing clears the red');
  pad = finalePadEnter(type(finalePadKey(finalePadKey(step.pad, 'clear', LIMITS), 'clear', LIMITS), 204), LIMITS, (id, set) => ({ ...check(id, set), verdict: 'standing' })).pad;
  assert.deepEqual(finalePadSet(pad), [57, 204], 'in the order entered');
  assert.deepEqual(finalePadCommand(pad, 2), { cardIds: [57, 204] });
  assert.deepEqual(finalePadSet(finalePadRemove(pad, 57)), [204]);
  // During the finale, «+ Finalista»: the set keeps the finalists first, and needs one new number.
  const add = openFinalePad('add', [34, 56]);
  assert.equal(finalePadCommand(add, 2), null);
  assert.deepEqual(finalePadCommand({ ...add, added: [57] }, 2), { cardIds: [34, 56, 57] });
  assert.deepEqual(finalePadSet(finalePadRemove({ ...add, added: [57] }, 34)), [34, 56, 57], "the finale's own finalists leave through «Editar» only");
});

test("the engine's refusals of `finale` come back to the pad, privately, with the pad's reasons", () => {
  assert.deepEqual(finaleRefusal('invalid', 'already fallen: 23,88'), { refusal: 'fallen', cardIds: [23, 88] });
  assert.deepEqual(finaleRefusal('invalid', 'not a card of this round: 508'), { refusal: 'notThisRound', cardIds: [508] });
  assert.deepEqual(finaleRefusal('invalid', "a fallen finalist can't come back: 7"), { refusal: 'comeBack', cardIds: [7] });
  assert.deepEqual(finaleRefusal('unknownCard', '9999'), { refusal: 'unknown', cardIds: [9999] });
  assert.equal(finaleRefusal('invalid', 'a finale starts with two finalists or more'), null, 'anything else is a toast');
  assert.equal(finaleRefusal('wrongScene', null), null);
  const sent = { ...openFinalePad('start'), added: [57, 23, 204] };
  const back = finalePadAfterRefusal(sent, { refusal: 'fallen', cardIds: [23] });
  assert.deepEqual([back.added, back.digits, back.refused], [[57, 204], '23', 'fallen']);
  for (const r of ['fallen', 'unknown', 'notThisRound', 'comeBack'] as const) assert.ok(S.finale.refusal[r]);
  assert.equal(S.finale.refusal.fallen, 'Ja ha caigut');
  assert.equal(S.finale.refusal.unknown, 'Aquest número no existeix');
  assert.equal(S.finale.refusal.notThisRound, "No és d'aquesta quina");
});

test('the Dempeus tab as the stage: on stage, a fall shown until the Spin, «Salvats!», the winner', () => {
  const cards = new Map(Object.values(FIXTURE_CARDS).map((c) => [c.id, c]));
  const start = finaleTabView(at('finale').finale!, at('finale'), cards, false);
  assert.deepEqual([start.count, start.word, start.saved, start.fallenShown, start.winner], [8, 'onStage', false, false, null]);
  assert.deepEqual(start.spots.map((s) => s.cardId), [...FINALE_FINALISTS]);
  assert.deepEqual(finaleTabView(at('finale').finale!, at('finale'), cards, true).spots.map((s) => s.cardId), [...FINALE_FINALISTS].reverse(), '«Al revés»');
  const fallen = at('finaleFallen');
  const view = finaleTabView(fallen.finale!, fallen, cards, false);
  assert.deepEqual([view.count, view.word, view.fallenShown], [5, 'standing', true]);
  assert.deepEqual(view.spots.filter((s) => s.fate === 'fallen').map((s) => s.cardId), [99, 140, 184]);
  const spun = finaleTabView(fallen.finale!, { ...fallen, status: 'transition' }, cards, false);
  assert.equal(spun.spots.length, 5, 'the next Spin clears them');
  const win = lastEvent('finaleWin');
  assert.equal(finaleTabView(win.finale!, win, cards, false).winner, 57);
  assert.deepEqual(withoutFinalist(at('finale').finale!, 99), FINALE_FINALISTS.filter((id) => id !== 99));
});

test('«Salvats!» on the tab needs the cards: two left, the landing on both, until the next Spin', () => {
  const saved = lastEvent('finaleSaved');
  // The fixtures' catalogue lacks #56 and #81: no guess.
  assert.equal(finaleTabView(saved.finale!, saved, new Map(), false).saved, false);
  const songs = (id: number, extra: number[]): CatalogCard => ({ id, type: 'normal', sides: [{ side: 1, lines: [[36, ...extra.slice(0, 3)], extra.slice(3, 7), extra.slice(7, 11)] }] });
  const cards = new Map([[56, songs(56, [8, 48, 51, 71, 3, 15, 16, 46, 1, 67, 73])], [81, songs(81, [4, 5, 42, 44, 1, 22, 49, 58, 13, 31, 37])]]);
  assert.equal(finaleTabView(saved.finale!, saved, cards, false).saved, true);
  assert.equal(finaleTabView(saved.finale!, { ...saved, status: 'transition' }, cards, false).saved, false);
});

test('A stays «Següent» in the finale (D187) and becomes «Celebrem!» once one is left; the pad\'s A starts it', () => {
  const input = (state: ShowState, extra: Partial<Parameters<typeof defaultAction>[0]> = {}) =>
    defaultAction({ state, flow: flowOf(state), nowMs: NOW, plan: null, nextEnabled: true, can: () => true, ...extra });
  assert.equal(input(at('desgraciatNine'))?.control, 'next', 'A never opens the finale');
  assert.equal(input(at('finale'))?.control, 'next');
  const win = lastEvent('finaleWin');
  assert.deepEqual(input(win)?.command, { cmd: 'finaleCue' });
  assert.equal(input({ ...win, finale: { ...win.finale!, cued: true } })?.control, 'next');
  assert.equal(input(at('desgraciatNine'), { finalePad: { command: null } }), null);
  assert.deepEqual(input(at('desgraciatNine'), { finalePad: { command: { cardIds: [57, 81] } } })?.command, { cmd: 'finale', args: { cardIds: [57, 81] } });
  const ring = nowRing({ state: win, flow: flowOf(win), nowMs: NOW, lastSec: 3 });
  assert.deepEqual([ring.state, ring.cardId], ['finaleWinner', 57]);
  assert.equal(S.finale.ringWinner(57), 'Últim dempeus · #57');
});
