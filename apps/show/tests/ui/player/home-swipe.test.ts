// The home's Historial | Cartrons swipe and the drum's collapse (ANIMATIONS.md `home-swipe`, `drum-collapse`): one axis
// per gesture, the rubber band, the release, and a swipe's frames landing exactly on the coming view's own layout.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SWIPE,
  collapseOf,
  dragPos,
  easeOut,
  planSwipe,
  reducedTarget,
  releaseTarget,
  releaseVelocity,
  settleMs,
  swipeAxis,
  swipeFrame,
  type HomeGeometry,
} from '../../../../player/logic/home-swipe.ts';

test('one axis per gesture: the first 8 px decide, sideways swipes, up or down scrolls', () => {
  assert.equal(swipeAxis(3, 4), null, 'inside the slop: undecided');
  assert.equal(swipeAxis(9, 2), 'x');
  assert.equal(swipeAxis(-9, -5), 'x');
  assert.equal(swipeAxis(4, 9), 'y');
  assert.equal(swipeAxis(6, -6.1), 'y', 'a diagonal leans to the scroll');
});

test('the views follow the finger 1:1, and resist past either end (a third, at most 24 px)', () => {
  assert.equal(dragPos(0, -195, 390), 0.5, 'half a width to the left: halfway to Cartrons');
  assert.equal(dragPos(1, 390, 390), 0, 'a whole width to the right from Cartrons: Historial');
  const past = dragPos(0, 30, 390);
  assert.ok(past < 0 && Math.abs(past * 390 + 10) < 1e-9, 'Historial pulled right: a third of the drag');
  assert.ok(Math.abs(dragPos(0, 600, 390) * 390 + SWIPE.rubberMaxPx) < 1e-9, 'never past 24 px');
  assert.ok(Math.abs((dragPos(1, -600, 390) - 1) * 390 - SWIPE.rubberMaxPx) < 1e-9, 'the same past Cartrons');
});

test("the finger's speed: over its last 80 ms", () => {
  const samples = [
    { t: 0, x: 300 },
    { t: 100, x: 290 },
    { t: 140, x: 250 },
    { t: 180, x: 210 },
  ];
  assert.equal(releaseVelocity(samples), -1, '80 px left in the last 80 ms');
  assert.equal(releaseVelocity([]), 0);
  assert.equal(releaseVelocity([{ t: 5, x: 1 }]), 0);
});

test('the release: a flick goes on (or back), otherwise past half the way', () => {
  assert.equal(releaseTarget('historial', 0.2, -0.5), 'cartrons', 'flicked left towards Cartrons');
  assert.equal(releaseTarget('historial', 0.7, 0.5), 'historial', 'flicked back');
  assert.equal(releaseTarget('historial', 0.6, 0), 'cartrons', 'let go past half');
  assert.equal(releaseTarget('historial', 0.4, -0.1), 'historial', 'short of half, no flick');
  assert.equal(releaseTarget('cartrons', 0.8, 0.5), 'historial', 'from Cartrons, flicked right');
  assert.equal(releaseTarget('cartrons', 0.3, 0), 'historial', 'from Cartrons, past half');
});

test('reduced motion: only a clear swipe (a quarter of the width, or a flick) changes the view', () => {
  assert.equal(reducedTarget('historial', -120, 390, 0), 'cartrons');
  assert.equal(reducedTarget('historial', -60, 390, 0), 'historial');
  assert.equal(reducedTarget('historial', -30, 390, -0.6), 'cartrons', 'a flick');
  assert.equal(reducedTarget('historial', 120, 390, 0), 'historial', 'the wrong way');
  assert.equal(reducedTarget('cartrons', 120, 390, 0), 'historial');
});

test("the settle carries the finger's speed, within 180–360 ms", () => {
  assert.equal(settleMs(195, 2), 360, 'a long way: the longest settle');
  assert.equal(settleMs(40, 2), SWIPE.settleMinMs, 'a short way: the shortest settle');
  assert.equal(settleMs(100, 0), SWIPE.settleMaxMs, 'a finger that had stopped: the slow floor');
  assert.equal(settleMs(120, 2), 240);
});

test('--ease-out: starts fast, ends at 1', () => {
  assert.equal(easeOut(0), 0);
  assert.equal(easeOut(1), 1);
  assert.ok(easeOut(0.1) > 0.25, 'well ahead early on');
  assert.ok(easeOut(0.5) > 0.85 && easeOut(0.5) < 1);
});

test('the drum collapses over the height difference once it reaches the top; Cartrons is always the strip', () => {
  const g = { drum: true, stickAt: 100, range: 150 };
  assert.equal(collapseOf('historial', 0, g), 0);
  assert.equal(collapseOf('historial', 100, g), 0, 'the header has just gone: still full');
  assert.equal(collapseOf('historial', 175, g), 0.5);
  assert.equal(collapseOf('historial', 900, g), 1);
  assert.equal(collapseOf('cartrons', 0, g), 1);
  assert.equal(collapseOf('cartrons', 0, { ...g, drum: false }), 0, 'no drum (before the night, a break): nothing collapses');
});

/** A phone at 390 × 844 scrolled to `scroll`: garland + header 110 px, the home from 122 px, the full drum 232, the strip 82. */
function phone(over: Partial<HomeGeometry> = {}): HomeGeometry {
  const scroll = over.scroll ?? 0;
  return {
    scroll,
    savedScroll: 0,
    viewport: 844,
    pageHeight: 2400,
    alerts: 0,
    headTop: -scroll,
    headHeight: 110,
    homeTop: 122 - scroll,
    drum: true,
    fullHeight: 232,
    stripHeight: 82,
    gap: 16,
    switchHeight: 62,
    leavingHeight: 1300,
    comingHeight: 1500,
    ...over,
  };
}

/** Where the coming view's parts would sit if it were laid out at its own scroll: what the swipe must end on. */
function laidOut(to: 'historial' | 'cartrons', g: HomeGeometry, scroll: number) {
  const homeDoc = g.homeTop + g.scroll;
  const box = to === 'cartrons' ? g.stripHeight : g.fullHeight;
  return {
    head: g.headTop + g.scroll - scroll,
    box: Math.max(g.alerts, homeDoc - scroll),
    switchY: homeDoc + box + g.gap - scroll,
    view: homeDoc + box + g.gap + g.switchHeight + g.gap - scroll,
  };
}

/** The leaving view's top now (it doesn't move while the coming one slides in). */
const leavingTop = (g: HomeGeometry, box: number) => g.homeTop + box + g.gap + g.switchHeight + g.gap;

test('a swipe from the top of Historial to the top of Cartrons: the drum collapses with it and everything lands in place', () => {
  const g = phone();
  const plan = planSwipe('historial', g);
  assert.equal(plan.toScroll, 0);
  const start = swipeFrame(plan, 0);
  assert.deepEqual([start.head, start.box, start.switchY, start.collapse], [0, 0, 0, 0], 'nothing moves at the start');
  const end = swipeFrame(plan, 1);
  const target = laidOut('cartrons', g, 0);
  assert.equal(end.collapse, 1);
  assert.equal(plan.now.switchY + end.switchY, target.switchY, 'the switch rises under the strip');
  assert.equal(leavingTop(g, g.fullHeight) + end.comingY, target.view, 'the cards slide in at their own place');
  assert.equal(swipeFrame(plan, 0.5).collapse, 0.5, 'halfway: half collapsed');
  const half = swipeFrame(plan, 0.5);
  assert.equal(half.leavingY, half.switchY, 'Historial rises with the switch as the drum collapses');
  assert.equal(leavingTop(g, g.fullHeight) + half.comingY, plan.now.switchY + half.switchY + g.switchHeight + g.gap, 'and the cards come in right under it');
  assert.equal(end.leavingY, end.switchY);
});

test('both views scrolled down (both compact): nothing above the views moves', () => {
  const g = phone({ scroll: 700, savedScroll: 400 });
  const plan = planSwipe('historial', g);
  assert.equal(plan.fromCollapse, 1);
  assert.equal(plan.toCollapse, 1);
  for (const pos of [0, 0.3, 0.7, 1]) {
    const f = swipeFrame(plan, pos);
    assert.equal(f.collapse, 1, 'the drum stays the strip');
    assert.equal(f.box, 0, 'the strip stays stuck');
    assert.equal(f.leavingY, 0, 'the leaving cards keep still');
  }
  assert.equal(leavingTop(g, g.fullHeight) + plan.comingY, laidOut('cartrons', g, 400).view, 'Cartrons slides in where it was left');
});

test('back to the top of Historial from deep in Cartrons: the header and the full drum come back down', () => {
  const g = phone({ scroll: 600, savedScroll: 0, leavingHeight: 1500, comingHeight: 1300 });
  const plan = planSwipe('cartrons', g);
  const end = swipeFrame(plan, 0);
  const target = laidOut('historial', g, 0);
  assert.equal(end.collapse, 0, 'full again');
  assert.equal(plan.now.box + end.box, target.box, 'the drum back under the header');
  assert.equal(plan.now.head + end.head, target.head, 'the header back on screen');
  assert.equal(plan.now.switchY + end.switchY, target.switchY, 'the switch under the full drum');
  assert.equal(leavingTop(g, g.stripHeight) + plan.comingY, target.view, 'Historial back at its top');
});

test("the coming view's saved scroll is clamped to what its page allows", () => {
  const g = phone({ savedScroll: 5000, leavingHeight: 1300, comingHeight: 400 });
  const plan = planSwipe('historial', g);
  const pageTo = g.pageHeight + (g.stripHeight - g.fullHeight) + (400 - 1300);
  assert.equal(plan.toScroll, pageTo - g.viewport);
  assert.equal(planSwipe('historial', phone({ savedScroll: 5000, pageHeight: 600 })).toScroll, 0, 'a page shorter than the screen: the top');
});

test('a scene without the drum (before the night, the break): the top is the same on both, only the scroll differs', () => {
  const g = phone({ drum: false, fullHeight: 300, stripHeight: 300, savedScroll: 200 });
  const plan = planSwipe('historial', g);
  assert.equal(plan.fromCollapse, 0);
  assert.equal(plan.toCollapse, 0);
  const end = swipeFrame(plan, 1);
  assert.equal(plan.now.head + end.head, -g.headHeight - 8, 'the header scrolls away (and waits just above the screen)');
  assert.equal(plan.now.switchY + swipeFrame(plan, 0.5).switchY, g.homeTop + 300 + 16 - 100, 'halfway, the switch is halfway between its two places');
});

test('the indicator and the floating «+ Cartró» follow the track, never past the ends', () => {
  const plan = planSwipe('historial', phone());
  assert.equal(swipeFrame(plan, -0.05).indicator, 0);
  assert.equal(swipeFrame(plan, 0.4).indicator, 0.4);
  assert.equal(swipeFrame(plan, 1.05).cartrons, 1);
  assert.equal(swipeFrame(plan, -0.05).collapse, 0, 'pulled the wrong way: the drum stays');
});
