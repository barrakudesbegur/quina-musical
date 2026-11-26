// The player app's drawers (D73, D87): the stack over the home screen, where each one comes from, when a drag closes
// one, and moving a card in Ajustos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OPENABLE, depthOf, dragCloses, drawerOrigin, drawersOnCelebration, isOpenable, popDrawer, pushDrawer, type Drawer } from '../../../../player/logic/drawers.ts';
import { addCard, emptyData, moveCard } from '../../../../player/logic/storage.ts';

test('drawers stack: a round\'s prizes over Horari, back to Horari, then home', () => {
  let stack: Drawer[] = [];
  stack = pushDrawer(stack, { kind: 'horari' });
  stack = pushDrawer(stack, { kind: 'premis', round: 2 });
  assert.deepEqual(stack, [{ kind: 'horari' }, { kind: 'premis', round: 2 }]);
  assert.deepEqual([depthOf(stack, 0), depthOf(stack, 1)], [1, 0], 'Horari lies one under');
  assert.deepEqual(pushDrawer(stack, { kind: 'premis', round: 2 }), stack, 'the same drawer on top stays as it is');
  assert.deepEqual(pushDrawer(stack, { kind: 'premis', round: 3 }).length, 3, 'another round stacks');
  stack = popDrawer(stack);
  assert.deepEqual(stack, [{ kind: 'horari' }]);
  assert.deepEqual(popDrawer(popDrawer(stack)), [], 'closing with nothing open is harmless');
});

test('Premis grows out of the bottom-left corner, Horari the bottom-right; the rest, and stacked ones, slide up', () => {
  assert.equal(drawerOrigin({ kind: 'premis' }, false), 'left');
  assert.equal(drawerOrigin({ kind: 'horari' }, false), 'right');
  assert.equal(drawerOrigin({ kind: 'premis', round: 2 }, true), 'bottom', "a round's prizes over Horari");
  for (const d of [{ kind: 'ajustos' }, { kind: 'pad' }, { kind: 'wipe' }, { kind: 'anyPassat' }] as Drawer[]) assert.equal(drawerOrigin(d, false), 'bottom');
  assert.equal(drawerOrigin({ kind: 'rename', cardId: 1 }, true), 'bottom');
});

test('a drag closes the drawer past 30 % of its height or on a downward flick; otherwise it springs back', () => {
  assert.equal(dragCloses(200, 600, 0.1), true, 'a third of the way');
  assert.equal(dragCloses(150, 600, 0.1), false);
  assert.equal(dragCloses(40, 600, 0.8), true, 'a flick');
  assert.equal(dragCloses(0, 600, 2), false, 'not moved');
  assert.equal(dragCloses(40, 600, -0.8), false, 'flicked back up');
});

test('the review links open Premis, Horari, Ajustos or the pad', () => {
  assert.deepEqual([...OPENABLE], ['premis', 'horari', 'ajustos', 'pad']);
  assert.equal(isOpenable('ajustos'), true);
  assert.equal(isOpenable('menu'), false);
});

test('moving a card in Ajustos changes the order the home screen shows', () => {
  let data = emptyData('26');
  for (const id of [123, 57, 412]) {
    const r = addCard(data, id, 0);
    if (r.ok) data = r.data;
  }
  assert.deepEqual(moveCard(data, 412, 0).cards.map((c) => c.id), [412, 123, 57]);
  assert.deepEqual(moveCard(data, 123, 2).cards.map((c) => c.id), [57, 412, 123]);
  assert.deepEqual(moveCard(data, 123, 9).cards.map((c) => c.id), [57, 412, 123], 'clamped to the end');
  assert.deepEqual(moveCard(data, 57, -3).cards.map((c) => c.id), [57, 123, 412], 'clamped to the start');
  assert.equal(moveCard(data, 57, 1), data, 'already there: unchanged');
  assert.equal(moveCard(data, 999, 0), data, 'not a saved card');
  assert.deepEqual(moveCard(data, 412, 0).cards.find((c) => c.id === 412)?.color, data.cards[2].color, 'its icon stays');
});

test('a Celebration closes Premis, Horari and Ajustos, but not the add-card pad while a number is typed (D90)', () => {
  assert.deepEqual(drawersOnCelebration([{ kind: 'horari' }, { kind: 'premis', round: 2 }], false), [], 'a round\'s prizes over Horari');
  assert.deepEqual(drawersOnCelebration([{ kind: 'ajustos' }, { kind: 'rename', cardId: 123 }], true), [], 'not typing in the pad: everything closes');
  assert.deepEqual(drawersOnCelebration([{ kind: 'pad' }], false), [], 'the pad with nothing typed');
  assert.deepEqual(drawersOnCelebration([{ kind: 'ajustos' }, { kind: 'pad' }], true), [{ kind: 'ajustos' }, { kind: 'pad' }], 'typing: the pad stays, with what is under it');
  assert.deepEqual(drawersOnCelebration([], true), []);
});
