// The Desgraciat's finale on the projector (apps/stage/model/finale.ts and its moments): the finalists on stage in
// ascending order, a fall shown from its landing time, the fallen gone at the next Spin, «Salvats!» from the printed
// cards, the row's layout, and the moments named as in ANIMATIONS.md › The finale on stage.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { flowOf, type FlowState } from '../../../../../packages/ui/flow.ts';
import { FIXTURES } from '../../../../../packages/ui/fixtures/states.ts';
import { SAMPLE_PLAN } from '../../../../../packages/ui/fixtures/plan.ts';
import { parseCards, type Catalog } from '../../../../../packages/ui/data/catalog.ts';
import { stageView, type LiveNotes } from '../../../../stage/view.ts';
import { fateAt, finaleLayout, finaleView } from '../../../../stage/model/finale.ts';
import { diffMoments, momentsOf, type AnimDetail, type MomentInputs } from '../../../../stage/model/moments.ts';

const NOW = 1_800_000_000_000;
const CATALOG: Catalog = { ...parseCards(JSON.parse(fs.readFileSync(new URL('../../../../cards/dist/cards.json', import.meta.url), 'utf8'))), cardTypes: null };
const inputs = (nowMs: number): MomentInputs => ({ nowMs, heat: null, linkLost: false, checkMarkAt: 'end', checkTypeLeadMs: 900, countdown: { clockAboveMin: 90, fineBelowMin: 10, coarseStepMin: 5 } });
const viewOf = (state: FlowState, notes: LiveNotes = { landed: [], spin: null }) => stageView(state, flowOf(state), SAMPLE_PLAN, CATALOG, notes);
const finaleOf = (state: FlowState) => {
  const body = viewOf(state).body;
  return body.scene === 'play' ? body.finale : null;
};
/** The live demo's state after `index` of its events. */
const after = (name: string, index: number): FlowState => {
  const e = FIXTURES[name](NOW).events?.[index]?.event;
  assert.ok(e?.type === 'state', `${name} event ${index}`);
  return e as FlowState;
};
const finaleNames = (a: AnimDetail[]) => a.filter((x) => x.name.startsWith('finale-'));

test('the row: fewer ninos stand bigger and further apart (D184), centred, and more than eight fit', () => {
  assert.deepEqual(finaleLayout(8), { xs: [125, 295, 465, 635, 805, 975, 1145, 1315], scale: 1 });
  assert.deepEqual(finaleLayout(2), { xs: [370, 1070], scale: 1.3 });
  assert.equal(finaleLayout(5).scale, 1.15);
  assert.deepEqual(finaleLayout(5).xs, [240, 480, 720, 960, 1200]);
  const twenty = finaleLayout(20);
  assert.equal(twenty.scale, 0.4);
  assert.ok(twenty.xs[0] >= 40 && twenty.xs[19] <= 1400, 'inside the box');
  assert.deepEqual(finaleLayout(1), { xs: [720], scale: 1.3 });
});

test('the finalists on stage: ascending, each with their own look, none outside the finale', () => {
  assert.equal(finaleOf(FIXTURES.desgraciatFew(NOW).state), null);
  const f = finaleOf(FIXTURES.finale(NOW).state);
  assert.ok(f);
  assert.deepEqual(f.ninos.map((n) => n.number), [34, 56, 57, 72, 81, 99, 140, 184]);
  assert.ok(f.ninos.every((n) => n.fate === 'up' && n.sinceMs === null));
  assert.equal(new Set(f.ninos.map((n) => `${n.pose}${n.hue}`)).size, 8);
  assert.equal(f.savedAtMs, null);
});

test('a fall shows from its landing time; the fallen leave once the next Spin starts', () => {
  const landed = after('finaleFall', 0);
  const f = finaleOf(landed);
  assert.ok(f);
  const down = f.ninos.filter((n) => n.fate === 'down');
  assert.deepEqual(down.map((n) => n.number), [99, 140, 184]);
  assert.ok(down.every((n) => fateAt(n, NOW + 1499) === 'up' && fateAt(n, NOW + 1500) === 'down'), 'never before the landing');
  assert.deepEqual(finaleOf(after('finaleFall', 1))?.ninos.map((n) => n.number), [34, 56, 57, 72, 81], 'the Spin cleared them');
});

test('«Salvats!» is worked out from the printed cards, and only the moment comes out', () => {
  const saved = after('finaleSaved', 0);
  const f = finaleOf(saved);
  assert.ok(f);
  assert.equal(f.savedAtMs, NOW + 1500);
  assert.deepEqual(f.ninos.map((n) => [n.number, n.fate]), [[56, 'up'], [81, 'up']]);
  // Without the printed cards the projector can't tell, and never guesses.
  assert.equal(finaleView(saved, null, false)?.savedAtMs, null);
  assert.equal(finaleOf(FIXTURES.finaleSaved(NOW).state)?.savedAtMs, null, 'the landing before it took three out');
});

test('the winner: the party nino with the last landing\'s fallen beside them', () => {
  const f = finaleOf(after('finaleWin', 0));
  assert.ok(f);
  assert.deepEqual(f.ninos.map((n) => [n.number, n.fate]), [[34, 'down'], [56, 'down'], [57, 'win'], [72, 'down'], [81, 'down']]);
  assert.equal(f.ninos.find((n) => n.fate === 'win')?.sinceMs, NOW + 1500);
});

test('the moments: enter, fall at the landing, clear at the Spin, safe, win; a late join replays none', () => {
  const at = (state: FlowState, nowMs: number) => momentsOf(viewOf(state), inputs(nowMs));
  const before = at(FIXTURES.desgraciatFew(NOW).state, NOW);
  const start = at(FIXTURES.finale(NOW).state, NOW);
  assert.deepEqual(finaleNames(diffMoments(before, start)), [{ name: 'finale-enter', numbers: [34, 56, 57, 72, 81, 99, 140, 184] }]);
  assert.deepEqual(finaleNames(diffMoments(null, start)), [], 'mounting enters the scene only');

  const fall0 = at(FIXTURES.finaleFall(NOW).state, NOW);
  const early = at(after('finaleFall', 0), NOW + 1400);
  assert.deepEqual(finaleNames(diffMoments(fall0, early)), [], 'nothing before the landing');
  const landed = at(after('finaleFall', 0), NOW + 1500);
  assert.deepEqual(finaleNames(diffMoments(early, landed)), [{ name: 'finale-fall', numbers: [99, 140, 184] }]);
  const spin = at(after('finaleFall', 1), NOW + 6000);
  assert.deepEqual(finaleNames(diffMoments(landed, spin)), [{ name: 'finale-clear', numbers: [99, 140, 184] }]);
  assert.deepEqual(finaleNames(diffMoments(landed, early)), [{ name: 'finale-back', numbers: [99, 140, 184] }], 'Enrere brings them back');

  const saved0 = at(FIXTURES.finaleSaved(NOW).state, NOW + 1000);
  const saved = at(after('finaleSaved', 0), NOW + 1500);
  assert.deepEqual(finaleNames(diffMoments(saved0, saved)), [{ name: 'finale-clear', numbers: [34, 57, 72] }, { name: 'finale-safe' }]);
  assert.deepEqual(finaleNames(diffMoments(saved, at(after('finaleSaved', 0), NOW + 3000))), [], 'once');

  const win0 = at(FIXTURES.finaleWin(NOW).state, NOW + 1000);
  const win = at(after('finaleWin', 0), NOW + 1500);
  // (The demo has no Spin between its two landings: the previous landing's fallen leave with this one.)
  assert.deepEqual(finaleNames(diffMoments(win0, win)), [
    { name: 'finale-fall', numbers: [34, 56, 72, 81] },
    { name: 'finale-clear', numbers: [99, 140, 184] },
    { name: 'finale-win', number: 57 },
  ]);
});
