// The home screen's Historial | Cartrons swipe and the drum's collapse (ANIMATIONS.md `home-swipe`, `drum-collapse`,
// `add-card-float`; the user's phone test, 27 Nov). Pure: the gesture's decisions and, for each frame of a swipe, where
// the shared parts above the two views stand, so the end of a swipe lands exactly on the coming view's own layout.
//
// The views lie side by side: `pos` 0 is Historial, 1 Cartrons. The page scrolls vertically (the browser's, never ours),
// and each view keeps its own scroll position for the visit. While a swipe runs the page doesn't scroll: the leaving view
// stays where it is, the coming one is drawn at its own scroll position, and the garland and header, the drum and the
// switch go from the leaving view's place (and look) to the coming view's with the swipe's progress `q` (0 → 1).

import { ARA_VIEWS, type AraView } from './tabs.ts';

export interface SwipeOptions {
  /** Px of movement that decide a drag's axis (as the drum's tug). */
  slopPx: number;
  /** Past either end the views resist: they move this share of the drag… */
  rubber: number;
  /** …and at most this far. */
  rubberMaxPx: number;
  /** A release faster than this (px/ms) is a flick. */
  flickPxPerMs: number;
  /** The finger's speed is measured over its last moves within this window. */
  velocityWindowMs: number;
  /** A settle carries the finger's speed (`--ease-out` starts at 4× its average speed), within these bounds. */
  settleMinMs: number;
  settleMaxMs: number;
  /** The slower speed a settle assumes when the finger had stopped. */
  settleFloorPxPerMs: number;
  /** A tap on the switch (or ← →) slides over this long. */
  tapMs: number;
  /** Reduced motion: a swipe this share of the width (or a flick) changes the view on release. */
  reducedShare: number;
}

export const SWIPE: SwipeOptions = {
  slopPx: 8,
  rubber: 1 / 3,
  rubberMaxPx: 24,
  flickPxPerMs: 0.3,
  velocityWindowMs: 80,
  settleMinMs: 180,
  settleMaxMs: 360,
  settleFloorPxPerMs: 1,
  tapMs: 320,
  reducedShare: 0.25,
};

/** A view's place on the track. */
export const viewPos = (view: AraView): number => ARA_VIEWS.indexOf(view);
export const otherView = (view: AraView): AraView => (view === 'historial' ? 'cartrons' : 'historial');

/** Which way a drag goes once past the slop: 'x' swipes the views, 'y' is the page's scroll (never both). */
export function swipeAxis(dx: number, dy: number, o: Pick<SwipeOptions, 'slopPx'> = SWIPE): 'x' | 'y' | null {
  if (Math.hypot(dx, dy) < o.slopPx) return null;
  return Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
}

/**
 * The track's position for a drag of `dx` px that started at `startPos`: 1:1 within the two views, and past either end
 * a rubber band (a third of the drag, at most `rubberMaxPx`). A drag to the left (dx < 0) moves towards Cartrons.
 */
export function dragPos(startPos: number, dx: number, width: number, o: SwipeOptions = SWIPE): number {
  const raw = startPos - dx / width;
  const over = raw < 0 ? raw : raw > 1 ? raw - 1 : 0;
  if (over === 0) return raw;
  const px = Math.min(Math.abs(over) * width * o.rubber, o.rubberMaxPx);
  return (over < 0 ? 0 : 1) + (Math.sign(over) * px) / width;
}

export interface Sample {
  /** ms */
  t: number;
  /** px */
  x: number;
}

/** The finger's horizontal speed (px/ms, positive to the right) over its last `velocityWindowMs`. */
export function releaseVelocity(samples: readonly Sample[], o: Pick<SwipeOptions, 'velocityWindowMs'> = SWIPE): number {
  const last = samples.at(-1);
  if (!last) return 0;
  const first = samples.find((s) => last.t - s.t <= o.velocityWindowMs) ?? last;
  const dt = last.t - first.t;
  return dt > 0 ? (last.x - first.x) / dt : 0;
}

/**
 * Where a swipe that started on `from` settles when the finger lets go at `pos` with `velocity` (px/ms, positive to the
 * right): flicked towards the other view, or let go past half the way without a flick back, it goes on; else back.
 */
export function releaseTarget(from: AraView, pos: number, velocity: number, o: Pick<SwipeOptions, 'flickPxPerMs'> = SWIPE): AraView {
  const to = otherView(from);
  // Positive when moving towards the other view: Cartrons lies to the right, so the finger moves left to reach it.
  const towards = viewPos(to) > viewPos(from) ? -velocity : velocity;
  const progress = Math.abs(pos - viewPos(from));
  if (towards > o.flickPxPerMs) return to;
  if (towards < -o.flickPxPerMs) return from;
  return progress > 0.5 ? to : from;
}

/** Reduced motion: no follow, so only a clear swipe (a quarter of the width, or a flick) changes the view. */
export function reducedTarget(from: AraView, dx: number, width: number, velocity: number, o: SwipeOptions = SWIPE): AraView {
  const to = otherView(from);
  const sign = viewPos(to) > viewPos(from) ? -1 : 1;
  const along = sign * dx;
  const fast = sign * velocity > o.flickPxPerMs;
  return along > width * o.reducedShare || (along > o.slopPx && fast) ? to : from;
}

/** How long the settle lasts: the distance left at the finger's speed (`--ease-out` starts at 4× its average). */
export function settleMs(distancePx: number, speedPxPerMs: number, o: SwipeOptions = SWIPE): number {
  const speed = Math.max(Math.abs(speedPxPerMs), o.settleFloorPxPerMs);
  return Math.round(Math.min(o.settleMaxMs, Math.max(o.settleMinMs, (4 * Math.abs(distancePx)) / speed)));
}

/** A cubic Bézier timing function (the tokens' `--ease-out` is `cubic-bezier(0.2, 0.8, 0.2, 1)`). */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): (t: number) => number {
  const bx = (t: number) => 3 * x1 * t * (1 - t) ** 2 + 3 * x2 * t ** 2 * (1 - t) + t ** 3;
  const by = (t: number) => 3 * y1 * t * (1 - t) ** 2 + 3 * y2 * t ** 2 * (1 - t) + t ** 3;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (bx(mid) < x) lo = mid;
      else hi = mid;
    }
    return by((lo + hi) / 2);
  };
}

export const easeOut = cubicBezier(0.2, 0.8, 0.2, 1);

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * How collapsed the drum is: 0 full, 1 the compact strip. Historial collapses it over `range` px of scroll once it has
 * reached the top (`stickAt`); Cartrons always shows the strip. Only the drum collapses (other scenes stay as they are).
 */
export function collapseOf(view: AraView, scroll: number, g: { drum: boolean; stickAt: number; range: number }): number {
  if (!g.drum) return 0;
  if (view === 'cartrons') return 1;
  return g.range > 0 ? clamp01((scroll - g.stickAt) / g.range) : 1;
}

/** The page's geometry at a swipe's start, read once (px; `y` values in the viewport at the scroll `scroll`). */
export interface HomeGeometry {
  /** The page's scroll now (the leaving view's). */
  scroll: number;
  /** The coming view's saved scroll (clamped below). */
  savedScroll: number;
  /** The window's height and the page's height now. */
  viewport: number;
  pageHeight: number;
  /** The status strips' height (the drum sticks under them). */
  alerts: number;
  /** The garland and header: their top in the viewport now, and their height. */
  headTop: number;
  headHeight: number;
  /** The home's top in the viewport now (the drum box's place before it sticks). */
  homeTop: number;
  /** The drum's box: its height in each look (full, strip); `drum` when the top shows the drum (it sticks). */
  drum: boolean;
  fullHeight: number;
  stripHeight: number;
  /** The gap between the box and the switch. */
  gap: number;
  /** The switch's height. */
  switchHeight: number;
  /** The two views' heights. */
  leavingHeight: number;
  comingHeight: number;
}

export interface SwipePlan {
  from: AraView;
  to: AraView;
  /** The coming view's scroll, clamped to what its page allows. */
  toScroll: number;
  /** The drum's collapse in each view. */
  fromCollapse: number;
  toCollapse: number;
  /** The coming view's vertical offset once in place (from the leaving view's top). */
  comingY: number;
  /** The switch shows at the start (the leaving view rides with it) and at the end (the coming one rides with it). */
  switchShown: [boolean, boolean];
  /** Each shared part's place in each view (viewport y; parts gone above the screen are clamped just above it). */
  head: [number, number];
  box: [number, number];
  switchY: [number, number];
  /** Their actual place now (a part's translate is its interpolated place minus this). */
  now: { head: number; box: number; switchY: number };
}

/**
 * The drum's box with the Check's ribbon hanging under it (ANIMATIONS.md `check`, 28 Nov evening): both looks grow by
 * the ribbon's room (its height and margins), so the collapse's range stays the drum's own, the switch waits under the
 * ribbon, and the content starts under it once the strip has stuck. With no ribbon (`room` 0) the heights are the
 * drum's.
 */
export function boxWithRibbon(fullHeight: number, stripHeight: number, room: number): { fullHeight: number; stripHeight: number } {
  return { fullHeight: fullHeight + room, stripHeight: stripHeight + room };
}

/** The box's height in a view (the strip's on Cartrons when the drum shows; other scenes look alike in both). */
const boxHeight = (view: AraView, g: HomeGeometry) => (g.drum && view === 'cartrons' ? g.stripHeight : g.fullHeight);

/** Everything a swipe from `from` needs, computed once at its start. */
export function planSwipe(from: AraView, g: HomeGeometry): SwipePlan {
  const to = otherView(from);
  const homeDoc = g.homeTop + g.scroll;
  const headDoc = g.headTop + g.scroll;
  const rFrom = boxHeight(from, g) + g.gap;
  const rTo = boxHeight(to, g) + g.gap;
  const pageTo = g.pageHeight + (rTo - rFrom) + (g.comingHeight - g.leavingHeight);
  const toScroll = Math.max(0, Math.min(g.savedScroll, pageTo - g.viewport));
  const stick = { drum: g.drum, stickAt: homeDoc - g.alerts, range: g.fullHeight - g.stripHeight };
  // Parts that have scrolled away wait just above the screen (or just under the strip), so they come back from there.
  const headAt = (scroll: number) => Math.max(headDoc - scroll, -g.headHeight - 8);
  const boxAt = (scroll: number) => (g.drum ? Math.max(g.alerts, homeDoc - scroll) : Math.max(homeDoc - scroll, -g.fullHeight - 8));
  const hideSwitch = g.drum ? g.alerts + g.stripHeight - g.switchHeight : -g.switchHeight - 8;
  const switchAt = (r: number, scroll: number) => Math.max(homeDoc + r - scroll, hideSwitch);
  return {
    from,
    to,
    toScroll,
    fromCollapse: collapseOf(from, g.scroll, stick),
    toCollapse: collapseOf(to, toScroll, stick),
    comingY: rTo - toScroll - (rFrom - g.scroll),
    head: [headAt(g.scroll), headAt(toScroll)],
    box: [boxAt(g.scroll), boxAt(toScroll)],
    switchY: [switchAt(rFrom, g.scroll), switchAt(rTo, toScroll)],
    switchShown: [homeDoc + rFrom - g.scroll >= hideSwitch, homeDoc + rTo - toScroll >= hideSwitch],
    now: { head: headDoc - g.scroll, box: g.drum ? Math.max(g.alerts, homeDoc - g.scroll) : homeDoc - g.scroll, switchY: homeDoc + rFrom - g.scroll },
  };
}

export interface SwipeFrame {
  /** The track's position (0 Historial, 1 Cartrons; past the ends while it resists). */
  pos: number;
  /** The switch's indicator (0 → 1, never past the ends). */
  indicator: number;
  /** Cartrons' share of the screen, for the floating «+ Cartró». */
  cartrons: number;
  /** The drum's collapse. */
  collapse: number;
  /** Vertical translates (px) of the shared parts and of the two views. A view rides with the switch while the switch
   *  shows (the drum growing pushes them down, collapsing pulls them up), so the switch never runs over a view's top;
   *  a view whose switch has scrolled away keeps still. */
  head: number;
  box: number;
  switchY: number;
  leavingY: number;
  comingY: number;
}

/** One frame of a swipe at track position `pos`. */
export function swipeFrame(plan: SwipePlan, pos: number): SwipeFrame {
  const start = viewPos(plan.from);
  const q = clamp01(Math.abs(pos - start));
  const towards = Math.sign(viewPos(plan.to) - start) === Math.sign(pos - start) ? q : 0;
  // The switch's travel so far, and what it has left.
  const moved = lerp(plan.switchY[0], plan.switchY[1], towards) - plan.switchY[0];
  const left = plan.switchY[1] - plan.switchY[0] - moved;
  return {
    pos,
    indicator: clamp01(pos),
    cartrons: clamp01(pos),
    collapse: lerp(plan.fromCollapse, plan.toCollapse, towards),
    head: lerp(plan.head[0], plan.head[1], towards) - plan.now.head,
    box: lerp(plan.box[0], plan.box[1], towards) - plan.now.box,
    switchY: lerp(plan.switchY[0], plan.switchY[1], towards) - plan.now.switchY,
    leavingY: plan.switchShown[0] ? moved : 0,
    comingY: plan.comingY - (plan.switchShown[1] ? left : 0),
  };
}

// ---- the card holding the playing song (`card-hint`) --------------------------------------------------------------

export type HintSide = 'up' | 'down';

/**
 * Which way the card is, or null when it shows: `top`/`bottom` are the card's edges in the screen, `from`/`to` the band
 * the home shows clear (under the stuck strip, above the corners). A card counts as shown once a quarter of the band or
 * of the card is in it.
 */
export function hintSide(cards: readonly { top: number; bottom: number }[], from: number, to: number): HintSide | null {
  if (!cards.length) return null;
  const need = (c: { top: number; bottom: number }) => Math.min((to - from) / 4, (c.bottom - c.top) / 4);
  if (cards.some((c) => Math.min(c.bottom, to) - Math.max(c.top, from) >= need(c))) return null;
  return cards[0].bottom <= from ? 'up' : 'down';
}
