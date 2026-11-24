// The 3D drum from shuffle-test, driven by a solved trajectory replayed on the audible audio clock.
// The DOM structure, layout and blur come from shuffle-test/main.js; cards from shuffle-test/cards.js.
import { Flapper, FIXED_STEP } from './physics.ts';
import { positionAt, velocityAt, tickTimes, brakeSpin, brakeRest, glideSpin, coastSpin, landingBrake, type Solution, type Tick } from './solver.ts';
import { drumTick } from '../audio/synth/clicks.ts';
import { createAlbumCard, type Album } from './shuffle-cards.ts';

const CARD_GAP_RATIO = 0.08;
const MOTION_BLUR_MIN_PIXELS_PER_FRAME = 6;
const MOTION_BLUR_STRENGTH = 0.2;
const MIN_SECONDS_BETWEEN_TICKS = 0.022;
const TICK_LOOKAHEAD_SEC = 0.15;

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

  // A cancelled Spin brakes to a stop. With `card`, that card (the last counted song, which left the drum
  // at spin start) is put back exactly where the drum will stop, and selected.
  cancelSpin({ audible, card = null, select = false }: { audible: number; card?: DrumCard | null; select?: boolean }): void {
    const { position, velocity } = this.motionAt(audible);
    const n = this.cards.length;
    if (!n) return;
    let from = position - Math.floor(position / n) * n;
    let rest = brakeRest(from, velocity);
    if (card) {
      let insertAt: number;
      if (rest >= from) {
        if (rest > n) {
          from -= n;
          rest -= n;
        }
        insertAt = rest; // cards from here on shift up; the drum, behind it, does not move
      } else {
        if (rest < -1) {
          from += n;
          rest += n;
        }
        insertAt = rest + 1; // the drum, above it, shifts up with its cards
        from += 1;
        rest += 1;
      }
      this.cards.splice(insertAt, 0, card);
      this.rebuild();
    }
    const solution = brakeSpin({ cardCount: this.cards.length, fromPosition: from, velocity, restPosition: rest });
    this.clearSelection();
    this.spin = {
      solution, startCtx: audible, landAt: audible + solution.durationSec, targetId: select && card ? card.id : null,
      ticks: tickTimes(solution), audioTick: 0, visualTick: 0, lastTickCtx: -1, landed: false, quiet: !select, kind: 'brake',
    };
  }

  // Back: the drum turns back one card, opposite to its last Spin. `card` (the song before the undone one)
  // is put back next to the current card first, so that is where it stops.
  turnBack({ audible, card = null, select = false }: { audible: number; card?: DrumCard | null; select?: boolean }): void {
    const { position } = this.motionAt(audible);
    this.spin = null;
    const n = this.cards.length;
    if (!n) return;
    let from = (((Math.round(position) % n) + n) % n);
    const back = -this.lastDirection;
    if (card) {
      const insertAt = back < 0 ? from : from + 1;
      this.cards.splice(insertAt, 0, card);
      if (back < 0) from += 1;
      this.rebuild();
    }
    const solution = glideSpin({ cardCount: this.cards.length, fromIndex: from, delta: back, durationSec: 0.9 });
    this.clearSelection();
    this.spin = {
      solution, startCtx: audible, landAt: audible + 0.9, targetId: select && card ? card.id : null,
      ticks: tickTimes(solution), audioTick: 0, visualTick: 0, lastTickCtx: -1, landed: false, quiet: !select, kind: 'turn',
    };
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
  coast({ startCtx, targetId, durationSec, spinUpSec, gap, minSpeed, maxSpeed, periodSec }: {
    startCtx: number; targetId: number; durationSec: number; spinUpSec: number; gap: number; minSpeed: number; maxSpeed: number; periodSec: number;
  }): void {
    const targetIndex = this.indexOf(targetId);
    if (!this.cards.length || targetIndex < 0) return;
    this.clearSelection();
    this.lastDirection = 1;
    const solution = coastSpin({
      cardCount: this.cards.length, fromIndex: this.currentIndex, targetIndex, durationSec, spinUpSec, gap,
      minLaps: this.cards.length < 3 ? 0 : 1, minSpeed, maxSpeed, periodSec,
    });
    this.spin = {
      solution, startCtx, landAt: startCtx + durationSec, targetId: null,
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
