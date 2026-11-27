// The 3D drum from shuffle-test, driven by a solved trajectory replayed on the audible audio clock.
// The DOM structure, layout and blur come from shuffle-test/main.js; cards from shuffle-test/cards.js.
import { Flapper, FIXED_STEP } from './physics.ts';
import { positionAt, velocityAt, tickTimes, brakeSpin, brakeRest, glideSpin, coastSpin, hoverSpin, landingBrake, type Solution, type Tick } from './solver.ts';
import { drumTick } from '../audio/synth/clicks.ts';
import { createAlbumCard, type Album } from './shuffle-cards.ts';

const CARD_GAP_RATIO = 0.08;
const MOTION_BLUR_MIN_PIXELS_PER_FRAME = 6;
const MOTION_BLUR_STRENGTH = 0.2;
const MIN_SECONDS_BETWEEN_TICKS = 0.022;
const TICK_LOOKAHEAD_SEC = 0.15;
// drum-back (D249): a card that comes back (Back, a cancelled Spin or Suspense) goes to its own place in the round's
// drum order, and the drum moves onto it there with no speed-up and never more than half a lap.
/** A Back's turn onto the card: 0.9 s for one card, rising smoothly to 1.6 s for half a lap. */
const TURN_SEC: readonly [number, number] = [0.9, 1.6];
/** A cancel's glide onto the card, once its natural brake is nearly still: 0.8 s for one card, 1 s for half a lap. */
const GLIDE_SEC: readonly [number, number] = [0.8, 1];
/** Nearly still, in cards/s: a braking drum hands over to its glide at this speed, and a drum this slow just glides. */
const GLIDE_FROM_SPEED = 1;

const mod = (a: number, n: number): number => ((a % n) + n) % n;
/** The shortest move, in cards, from `from` onto card `to` of `n`: at most half a lap either way. */
const shortest = (to: number, from: number, n: number): number => {
  const d = mod(to - from, n);
  return d > n / 2 ? d - n : d;
};
/** A move's length in seconds: `one` for a card or less, rising evenly to `half` for half a lap of `n` cards. */
const moveSec = (delta: number, n: number, [one, half]: readonly [number, number]): number =>
  one + (half - one) * (n / 2 > 1 ? Math.min(1, Math.max(0, (Math.abs(delta) - 1) / (n / 2 - 1))) : 0);

/** At rest exactly on its last card (the sampled motion ends a float's width off it). */
const pinned = (s: Solution): Solution => ({ ...s, traveled: Math.round(s.fromIndex + s.traveled) - s.fromIndex });

/**
 * One cubic glide from the drum's motion (`from`, `velocity`) onto card `target` of `cardCount`, the shortest way,
 * at rest on it after `range`'s time for its length. From rest the speed rises and falls once; it's continuous
 * throughout (hoverSpin's arrival, with no hover after it).
 */
function glideOnto(cardCount: number, from: number, velocity: number, target: number, range: readonly [number, number]): Solution {
  const sec = moveSec(shortest(target, from, cardCount), cardCount, range);
  return pinned(hoverSpin({ cardCount, fromPosition: from, velocity, targetIndex: target, arriveSec: sec, durationSec: sec, sway: 0 }));
}

/** `first`'s samples before `at`, then all of `second` (which starts where `first` is at `at`), as one motion. */
function chained(first: Solution, at: number, second: Solution): Solution {
  const offset = second.fromIndex - first.fromIndex;
  const length = at + second.positions.length;
  const positions = new Float32Array(length);
  const velocities = new Float32Array(length);
  positions.set(first.positions.subarray(0, at));
  velocities.set(first.velocities.subarray(0, at));
  second.positions.forEach((x, j) => (positions[at + j] = offset + x));
  velocities.set(second.velocities, at);
  const cut = at * first.dt;
  const ticks = [...first.ticks.filter((tick) => tick.t <= cut + 1e-9), ...second.ticks.map((tick) => ({ ...tick, t: cut + tick.t }))];
  const traveled = offset + second.traveled;
  return { ...first, positions, velocities, ticks, lockTime: cut + second.lockTime, durationSec: cut + second.durationSec, traveled,
    direction: Math.sign(traveled) || first.direction };
}

/**
 * A moving drum's return onto card `target` (null: no card comes back) of `cardCount`, from (`from`, `velocity`):
 * it brakes naturally, as a cancel always did (brakeRest's 1.2–2.5 s in its own direction, no target), and once it's
 * nearly still glides the short way onto the card (`range`'s time). A drum nearly still already just glides.
 */
function returnOnto(cardCount: number, from: number, velocity: number, target: number | null, range: readonly [number, number]): Solution {
  if (target != null && Math.abs(velocity) <= GLIDE_FROM_SPEED) return glideOnto(cardCount, from, velocity, target, range);
  const rest = brakeRest(from, velocity);
  const brake = brakeSpin({ cardCount, fromPosition: from, velocity, restPosition: rest });
  if (target == null || mod(target - rest, cardCount) === 0) return pinned(brake); // it stops on the card
  const at = Math.max(0, brake.velocities.findIndex((v) => Math.abs(v) <= GLIDE_FROM_SPEED));
  const glide = glideOnto(cardCount, from + brake.positions[at], brake.velocities[at], target, range);
  return chained(brake, at, glide);
}

/** A card on the drum: a song and its cover. */
export interface DrumCard extends Album {
  id: number;
}

/** A Spin lands on its target; a brake (cancelled Spin) or a turn (Back) stops on a card. */
export type DrumMotionKind = 'spin' | 'brake' | 'turn' | 'coast';

/** The motion the drum is replaying, on the audio clock. */
export interface DrumSpin {
  solution: Solution;
  startCtx: number;
  landAt: number;
  /** The card selected when the motion stops, if any. */
  targetId: number | null;
  /** Border crossings, in replay seconds (tickTimes). */
  ticks: Tick[];
  /** The next tick to schedule as sound, and to draw as a flapper kick. */
  audioTick: number;
  visualTick: number;
  lastTickCtx: number;
  landed: boolean;
  /** No `onLand` call when it stops. */
  quiet?: boolean;
  kind: DrumMotionKind;
}

/** Where the last Spin really came to rest, for tests and debugging. */
export interface DrumLanding {
  targetId: number | null;
  restId: number | undefined;
  /** Cards between the wheel and its rest position at T. */
  offCenterAtT: number;
  /** How late the frame that saw T was. */
  frameLateMs: number;
}

export interface DrumViewOptions {
  drum: HTMLElement;
  viewport: HTMLElement;
  flapper: HTMLElement;
  reticle: HTMLElement;
  blurNode: SVGFEGaussianBlurElement;
  ctx: BaseAudioContext;
  /** Where the border clicks go; without it the drum is silent. */
  tickDestination?: (() => AudioNode) | null;
  reducedMotion: boolean;
  onLand?: (spin: DrumSpin) => void;
}

export class DrumView {
  drumEl: HTMLElement;
  viewport: HTMLElement;
  flapperEl: HTMLElement;
  reticle: HTMLElement;
  blurNode: SVGFEGaussianBlurElement;
  ctx: BaseAudioContext;
  tickDestination: (() => AudioNode) | null | undefined;
  reducedMotion: boolean;
  onLand: (spin: DrumSpin) => void;
  flapper: Flapper;
  cards: DrumCard[];
  restPosition: number;
  spin: DrumSpin | null;
  cardWidth: number;
  radius: number;
  stepDegrees: number;
  currentBlur: number;
  lastAudible: number | null;
  lastDirection: number;
  lastLanding?: DrumLanding;

  constructor({ drum, viewport, flapper, reticle, blurNode, ctx, tickDestination, reducedMotion, onLand = () => {} }: DrumViewOptions) {
    this.drumEl = drum;
    this.viewport = viewport;
    this.flapperEl = flapper;
    this.reticle = reticle;
    this.blurNode = blurNode;
    this.ctx = ctx;
    this.tickDestination = tickDestination;
    this.reducedMotion = reducedMotion;
    this.onLand = onLand;
    this.flapper = new Flapper();
    this.cards = [];
    this.restPosition = 0;
    this.spin = null;
    this.cardWidth = 0;
    this.radius = 0;
    this.stepDegrees = 0;
    this.currentBlur = 0;
    this.lastAudible = null;
    this.lastDirection = 1;
    window.addEventListener('resize', () => this.layout());
  }

  setCards(cards: DrumCard[], restIndex = 0): void {
    this.cards = cards;
    this.drumEl.replaceChildren(...cards.map((card, i) => createAlbumCard(card, i)));
    this.restPosition = restIndex;
    this.layout();
  }

  indexOf(id: number): number {
    return this.cards.findIndex((card) => card.id === id);
  }

  rebuild(): void {
    this.drumEl.replaceChildren(...this.cards.map((card, i) => createAlbumCard(card, i)));
    this.layout();
  }

  // The drawn card leaves the drum as the next Spin starts; the drum keeps resting where it was, which
  // is now the card after it.
  removeCard(id: number): void {
    const index = this.indexOf(id);
    if (index < 0 || this.spin) return;
    const n = this.cards.length;
    const local = (((Math.round(this.restPosition) % n) + n) % n);
    this.cards.splice(index, 1);
    const m = this.cards.length;
    this.restPosition = m ? (index < local ? local - 1 : local) % m : 0;
    this.clearSelection();
    this.rebuild();
  }

  // Finish any brake or turn at once (a new Spin is about to start from where it would have stopped).
  settle(): void {
    if (!this.spin) return;
    this.restPosition = this.spin.solution.fromIndex + this.spin.solution.traveled;
    if (this.spin.targetId != null && !this.spin.landed) this.select(this.spin.targetId);
    this.spin = null;
  }

  // Where the drum is and how fast it turns right now (cards, cards/s), from the audible clock.
  motionAt(audible: number): { position: number; velocity: number } {
    const spin = this.spin;
    if (!spin) return { position: this.restPosition, velocity: 0 };
    const t = audible - spin.startCtx;
    return { position: positionAt(spin.solution, t), velocity: velocityAt(spin.solution, t) };
  }

  // A cancelled Spin or Suspense (Back, Hold, a backed-out Suspense). `cards` is the engine's order with `targetId`
  // (the last counted song, off the drum since the Spin started) back at its own place in the round's drum order
  // (D237), as the phones have it. The drum brakes naturally, as a cancel always did, then glides the short way onto
  // the card (drum-back, D249). Without a target it just brakes where it would stop.
  cancelSpin({ audible, cards, targetId = null, select = false }: { audible: number; cards: DrumCard[]; targetId?: number | null; select?: boolean }): void {
    this.returnCard({ audible, cards, targetId, select, kind: 'brake' });
  }

  // Back: the landing before the undone one (`targetId`) comes back at its own place in `cards`, the engine's order
  // (the round's drum order, D237), and the drum turns the shortest way onto it, at most half a lap (drum-back, D249).
  // Usually it's the neighbouring card. A drum still moving brakes naturally first. Without a target (a Back to before
  // the first landing) it turns back one card, opposite to its last Spin, as it always did.
  turnBack({ audible, cards, targetId = null, select = false }: { audible: number; cards: DrumCard[]; targetId?: number | null; select?: boolean }): void {
    this.returnCard({ audible, cards, targetId, select, kind: 'turn' });
  }

  returnCard({ audible, cards, targetId, select, kind }: { audible: number; cards: DrumCard[]; targetId: number | null; select: boolean; kind: 'brake' | 'turn' }): void {
    const { position, velocity } = this.motionAt(audible);
    this.spin = null;
    if (!this.cards.length) {
      // An empty drum (its one card off for the Spin): nothing to move, the cards come back on the card.
      this.setCards(cards, Math.max(0, cards.findIndex((card) => card.id === targetId)));
      return this.restOnCard(audible, targetId, select, kind);
    }
    const from = this.reorder(cards, position);
    const m = this.cards.length;
    if (!m) return;
    const found = targetId == null ? -1 : this.indexOf(targetId);
    const target = found < 0 ? null : found;
    if (target != null && this.reducedMotion) {
      this.restPosition = target;
      return this.restOnCard(audible, targetId, select, kind);
    }
    // A Back from rest turns (TURN_SEC); a cancel, or a Back while the drum still moves, brakes and glides (GLIDE_SEC).
    const solution = kind === 'brake' || Math.abs(velocity) > GLIDE_FROM_SPEED
      ? returnOnto(m, from, velocity, target, GLIDE_SEC)
      : glideOnto(m, from, velocity, target ?? mod(Math.round(from) - this.lastDirection, m), TURN_SEC);
    this.play(solution, audible, target == null || !select ? null : targetId, kind);
  }

  // Reduced motion (or nothing to turn): the drum is on the card at once, landing there on the next frame.
  restOnCard(audible: number, targetId: number | null, select: boolean, kind: DrumMotionKind): void {
    const index = targetId == null ? -1 : this.indexOf(targetId);
    if (index < 0) return this.clearSelection();
    const still = glideSpin({ cardCount: this.cards.length, fromIndex: index, delta: 0, durationSec: FIXED_STEP });
    this.play(still, audible, select ? targetId : null, kind);
  }

  // Replay `solution` from `audible`; `targetId` is selected (and onLand called) when it stops.
  play(solution: Solution, audible: number, targetId: number | null, kind: DrumMotionKind): void {
    this.clearSelection();
    this.spin = {
      solution, startCtx: audible, landAt: audible + solution.durationSec, targetId,
      ticks: tickTimes(solution), audioTick: 0, visualTick: 0, lastTickCtx: -1, landed: false, quiet: targetId == null, kind,
    };
  }

  // The engine's order for the cards (`cards`), keeping the card under the pointer there: returns the pointer's
  // position among the new cards (the same card, the same fraction off it).
  reorder(cards: DrumCard[], position: number): number {
    const n = this.cards.length;
    const local = position - Math.floor(position / n) * n;
    const near = Math.round(local) % n;
    const id = this.cards[near]?.id;
    this.cards = cards;
    this.rebuild();
    const index = id == null ? -1 : this.indexOf(id);
    return (index < 0 ? Math.min(near, Math.max(0, cards.length - 1)) : index) + (local - Math.round(local));
  }

  layout(): void {
    const count = this.cards.length;
    if (!count) return;
    const first = this.drumEl.firstElementChild;
    if (!(first instanceof HTMLElement)) throw new Error('drum: the cards are not drawn');
    this.cardWidth = first.offsetWidth;
    this.stepDegrees = 360 / count;
    this.radius = Math.max(this.cardWidth, (this.cardWidth * (1 + CARD_GAP_RATIO)) / (2 * Math.tan(Math.PI / count)));
    this.drumEl.style.setProperty('--step', `${this.stepDegrees}deg`);
    this.drumEl.style.setProperty('--radius', `${this.radius}px`);
    this.draw(this.restPosition, 0);
  }

  clearSelection(): void {
    this.drumEl.classList.remove('has-selection');
    this.drumEl.querySelector('.is-selected')?.classList.remove('is-selected');
    delete this.reticle.dataset.state;
  }

  select(id: number): void {
    const index = this.indexOf(id);
    if (index < 0) return;
    this.reticle.dataset.state = 'locked';
    this.drumEl.classList.add('has-selection');
    this.drumEl.children[index]?.classList.add('is-selected');
  }

  startSpin({ solution, startCtx, landAt, targetId }: { solution: Solution; startCtx: number; landAt: number; targetId: number }): void {
    this.clearSelection();
    this.lastDirection = solution.direction || 1;
    this.spin = {
      solution,
      startCtx,
      landAt,
      targetId,
      ticks: tickTimes(solution),
      audioTick: 0,
      visualTick: 0,
      lastTickCtx: -1,
      landed: false,
      kind: 'spin',
    };
  }

  // Suspense: the drum coasts with slow ticks and near-stops, for as long as it may be held open.
  // Where it waits is a secure random card, unrelated to the target, so it gives nothing away.
  coast({ startCtx, durationSec, spinUpSec, amp1, period1, amp2, period2, random }: {
    startCtx: number; durationSec: number; spinUpSec: number; amp1: number; period1: number; amp2: number; period2: number; random: () => number;
  }): void {
    const n = this.cards.length;
    if (!n) return;
    this.clearSelection();
    this.lastDirection = 1;
    const solution = coastSpin({
      cardCount: n, fromIndex: this.currentIndex, stopIndex: Math.floor(random() * n), durationSec, spinUpSec,
      minLaps: n < 3 ? 0 : 1, amp1: Math.min(amp1, n / 3), period1, amp2: Math.min(amp2, n / 6), period2, phase2: random() * 2 * Math.PI,
    });
    this.spin = {
      solution, startCtx, landAt: startCtx + durationSec, targetId: null,
      ticks: tickTimes(solution), audioTick: 0, visualTick: 0, lastTickCtx: -1, landed: false, quiet: true, kind: 'coast',
    };
  }

  // Over a Suspense's loop: from wherever it is, swing to `targetId` (a pending song being teased) by `arriveAt`,
  // the shortest way, and hover around it until `until`. The release's brakeTo takes over from there.
  hoverTo({ audible, targetId, arriveAt, until }: { audible: number; targetId: number; arriveAt: number; until: number }): void {
    const n = this.cards.length;
    const targetIndex = this.indexOf(targetId);
    if (!n || targetIndex < 0) return;
    const { position, velocity } = this.motionAt(audible);
    const from = position - Math.floor(position / n) * n;
    const solution = hoverSpin({ cardCount: n, fromPosition: from, velocity, targetIndex, arriveSec: Math.max(0.4, arriveAt - audible), durationSec: Math.max(1, until - audible) });
    this.clearSelection();
    this.spin = {
      solution, startCtx: audible, landAt: until, targetId: null,
      ticks: tickTimes(solution), audioTick: 0, visualTick: 0, lastTickCtx: -1, landed: false, quiet: true, kind: 'coast',
    };
  }

  // A released Suspense: from the coast, brake onto `targetId` exactly at `landAt` (the landing).
  brakeTo({ audible, targetId, landAt }: { audible: number; targetId: number; landAt: number }): void {
    const n = this.cards.length;
    const targetIndex = this.indexOf(targetId);
    if (!n || targetIndex < 0) return;
    const { position, velocity } = this.motionAt(audible);
    const from = position - Math.floor(position / n) * n;
    const solution = landingBrake({ cardCount: n, fromPosition: from, velocity, targetIndex, durationSec: landAt - audible });
    this.spin = {
      solution, startCtx: audible, landAt, targetId,
      ticks: tickTimes(solution), audioTick: 0, visualTick: 0, lastTickCtx: -1, landed: false, kind: 'spin',
    };
  }

  // Called from the engine's 25 ms loop: schedule border clicks on the audio clock.
  scheduleTicks(now: number): void {
    const spin = this.spin;
    if (!spin || !this.tickDestination) return;
    const horizon = now + TICK_LOOKAHEAD_SEC;
    while (spin.audioTick < spin.ticks.length) {
      const tick = spin.ticks[spin.audioTick];
      const when = spin.startCtx + tick.t;
      if (when > horizon) break;
      spin.audioTick++;
      if (when < now - 0.01 || when - spin.lastTickCtx < MIN_SECONDS_BETWEEN_TICKS) continue;
      spin.lastTickCtx = when;
      drumTick(this.ctx, this.tickDestination(), when, tick.speed);
    }
  }

  // Called every animation frame with the audible context time.
  render(audible: number): void {
    const dt = this.lastAudible == null ? 0 : Math.min(0.1, Math.max(0, audible - this.lastAudible));
    this.lastAudible = audible;
    let position = this.restPosition;
    let velocity = 0;
    const spin = this.spin;
    if (spin) {
      const t = audible - spin.startCtx;
      position = positionAt(spin.solution, t);
      velocity = velocityAt(spin.solution, t);
      while (spin.visualTick < spin.ticks.length && spin.ticks[spin.visualTick].t <= t) {
        const tick = spin.ticks[spin.visualTick++];
        this.flapper.kick(tick.direction, tick.speed);
      }
      if (!spin.landed && audible >= spin.landAt) {
        spin.landed = true;
        if (spin.targetId != null) this.select(spin.targetId);
        if (spin.kind === 'spin') {
          const n = this.cards.length;
          const restIndex = (((Math.round(spin.solution.fromIndex + spin.solution.traveled) % n) + n) % n);
          // Where the wheel actually rests, how far from center it is at T, and how late this frame saw T.
          this.lastLanding = {
            targetId: spin.targetId,
            restId: this.cards[restIndex]?.id,
            offCenterAtT: Math.abs(positionAt(spin.solution, spin.landAt - spin.startCtx) - (spin.solution.fromIndex + spin.solution.traveled)),
            frameLateMs: (audible - spin.landAt) * 1000,
          };
        }
        if (!spin.quiet) this.onLand(spin);
      }
      if (spin.landed && t > spin.solution.positions.length * spin.solution.dt * spin.solution.scale) {
        this.restPosition = spin.solution.fromIndex + spin.solution.traveled;
        this.spin = null;
      }
    }
    for (let left = dt; left > 1e-6; left -= FIXED_STEP) this.flapper.step(Math.min(FIXED_STEP, left));
    this.draw(position, velocity);
  }

  draw(position: number, velocity: number): void {
    this.drumEl.style.transform = `translateZ(${-this.radius}px) rotateY(${-position * this.stepDegrees}deg)`;
    this.flapperEl.style.rotate = `${this.flapper.angle}deg`;
    const pixelsPerFrame = (Math.abs(velocity) * this.cardWidth) / 60;
    const isBlurred = !this.reducedMotion && pixelsPerFrame >= MOTION_BLUR_MIN_PIXELS_PER_FRAME;
    const deviation = isBlurred ? Math.round(pixelsPerFrame * MOTION_BLUR_STRENGTH) : 0;
    if (deviation !== this.currentBlur) {
      this.currentBlur = deviation;
      this.blurNode.setAttribute('stdDeviation', `${deviation} 0`);
      this.viewport.style.filter = deviation > 0 ? 'url(#motion-blur)' : '';
    }
  }

  // Panic: freeze where it is.
  freeze(audible: number): void {
    if (this.spin) this.restPosition = positionAt(this.spin.solution, audible - this.spin.startCtx);
    this.restPosition = Math.round(this.restPosition);
    this.spin = null;
  }

  get currentIndex(): number {
    const n = this.cards.length;
    return n ? (((Math.round(this.restPosition) % n) + n) % n) : 0;
  }
}
