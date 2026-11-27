// The drum's physics, shared by the projector (apps/show/engine › wheel/drum.ts) and the phones (apps/player ›
// logic/drum.ts) so both turn the same drum (D237, §8 Y1). Moved here unchanged from apps/show/engine/src/wheel/
// shuffle-physics.ts (27 Nov), which re-exports it: shuffle-test's physics.js with its logic unchanged, typed and as an
// ES module. Pure.

const TAU = Math.PI * 2;
export const FIXED_STEP = 1 / 240;
const REFERENCE_CARD_COUNT = 36;
const SECONDS_AT_REST_BEFORE_STOP = 0.35;
const MAX_OFF_CENTER_AT_REST = 0.3;
const TEETER_NUDGE_SPEED = 0.6;

// Ranges are in cards per second.
const TOP_SPEED_RANGE: readonly [number, number] = [20, 40];
const CALM_TOP_SPEED_RANGE: readonly [number, number] = [8, 16];
// A slower wheel must glide longer, so it still travels more than one lap.
const CALM_DRAG_SCALE = 0.5;
const DETENT_DAMPING_FADES_OUT_AT_SPEED = 4;

const noop = () => {};
const mod = (value: number, divisor: number) => ((value % divisor) + divisor) % divisor;

function secureRandom(): number {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  return buffer[0] / 2 ** 32;
}

/** A wobble of the drag (rate in rad/s, phase in rad); each spin draws a slow one and a fast one. */
export interface Wobble {
  rate: number;
  phase: number;
}

/** The random spin `launch()` draws. */
export interface WheelSpin {
  direction: number;
  topSpeed: number;
  pushSeconds: number;
  drag: number;
  friction: number;
  detent: number;
  detentDamping: number;
  roughness: number;
  slowWobble: Wobble;
  fastWobble: Wobble;
}

export type WheelPhase = 'idle' | 'pushing' | 'coasting';

export interface WheelOptions {
  cardCount: number;
  random?: () => number;
  isCalm?: boolean;
  /** A card border passed: speed in cards/s, direction ±1. */
  onTick?: (speed: number, direction: number) => void;
  onStop?: (cardIndex: number) => void;
}

/**
 * A wheel of cards with a soft detent at every card (like a magnet or a
 * spring-loaded click), bearing friction and air drag. Position is measured
 * in cards: whole numbers are card centers, half numbers are the borders.
 */
export class WheelPhysics {
  cardCount: number;
  random: () => number;
  isCalm: boolean;
  onTick: (speed: number, direction: number) => void;
  onStop: (cardIndex: number) => void;
  position: number;
  velocity: number;
  phase: WheelPhase;
  phaseTime: number;
  elapsed: number;
  restTime: number;
  /** Null until the first `launch()`. */
  spin: WheelSpin | null;

  constructor({ cardCount, random = secureRandom, isCalm = false, onTick = noop, onStop = noop }: WheelOptions) {
    this.cardCount = cardCount;
    this.random = random;
    this.isCalm = isCalm;
    this.onTick = onTick;
    this.onStop = onStop;
    this.position = 0;
    this.velocity = 0;
    this.phase = 'idle';
    this.phaseTime = 0;
    this.elapsed = 0;
    this.restTime = 0;
    this.spin = null;
  }

  get isSpinning(): boolean {
    return this.phase !== 'idle';
  }

  get cardIndex(): number {
    return mod(Math.round(this.position), this.cardCount);
  }

  launch(): void {
    const pick = (min: number, max: number) => min + (max - min) * this.random();
    // Larger wheels need proportionally more travel, otherwise some cards could never win.
    const speedScale = Math.max(1, this.cardCount / REFERENCE_CARD_COUNT);
    const [minSpeed, maxSpeed] = this.isCalm ? CALM_TOP_SPEED_RANGE : TOP_SPEED_RANGE;
    const dragScale = this.isCalm ? CALM_DRAG_SCALE : 1;

    this.spin = {
      direction: this.random() < 0.5 ? -1 : 1,
      topSpeed: pick(minSpeed, maxSpeed) * speedScale,
      pushSeconds: pick(0.35, 0.9),
      drag: pick(0.3, 0.6) * dragScale,
      friction: pick(0.35, 1.1),
      detent: pick(6, 15),
      detentDamping: pick(2.5, 5),
      roughness: pick(0.1, 0.35),
      slowWobble: { rate: pick(1.5, 3), phase: pick(0, TAU) },
      fastWobble: { rate: pick(4, 7), phase: pick(0, TAU) },
    };
    this.phase = 'pushing';
    this.phaseTime = 0;
    this.elapsed = 0;
    this.restTime = 0;
    this.velocity = 0;
    this.position = mod(this.position, this.cardCount);
  }

  step(dt: number): void {
    if (this.phase === 'idle') return;

    const previousSlot = Math.floor(this.position + 0.5);
    this.elapsed += dt;
    if (this.phase === 'pushing') {
      this.stepPush(dt);
    } else {
      this.stepCoast(dt);
    }
    const currentSlot = Math.floor(this.position + 0.5);

    if (currentSlot !== previousSlot) {
      this.onTick(Math.abs(this.velocity), Math.sign(currentSlot - previousSlot));
    }
  }

  // A push that starts and ends gently, like a hand giving the wheel a shove.
  stepPush(dt: number): void {
    const { direction, topSpeed, pushSeconds } = this.launched();
    const progress = Math.min(1, this.phaseTime / pushSeconds);
    const envelope = Math.sin(Math.PI * progress) ** 2;
    const acceleration = direction * ((2 * topSpeed) / pushSeconds) * envelope;

    this.velocity += acceleration * dt;
    this.position += this.velocity * dt;
    this.phaseTime += dt;

    if (this.phaseTime >= pushSeconds) this.phase = 'coasting';
  }

  stepCoast(dt: number): void {
    const { drag, friction, detent, detentDamping, roughness, slowWobble, fastWobble } = this.launched();
    const wobble =
      0.6 * Math.sin(slowWobble.rate * this.elapsed + slowWobble.phase) +
      0.4 * Math.sin(fastWobble.rate * this.elapsed + fastWobble.phase);
    // Damping that only acts at low speed, so the last card settles instead of rattling.
    const lowSpeedFactor = Math.max(0, 1 - Math.abs(this.velocity) / DETENT_DAMPING_FADES_OUT_AT_SPEED);
    const currentDrag = drag * (1 + roughness * wobble) + detentDamping * lowSpeedFactor;
    const detentAcceleration = -detent * Math.sin(TAU * this.position);

    let nextVelocity = this.velocity + (detentAcceleration - currentDrag * this.velocity) * dt;
    const frictionLoss = friction * dt;
    nextVelocity = Math.abs(nextVelocity) <= frictionLoss ? 0 : nextVelocity - Math.sign(nextVelocity) * frictionLoss;

    this.velocity = nextVelocity;
    this.position += this.velocity * dt;

    const isHeldByFriction = this.velocity === 0 && Math.abs(detentAcceleration) <= friction;
    this.restTime = isHeldByFriction ? this.restTime + dt : 0;
    if (this.restTime >= SECONDS_AT_REST_BEFORE_STOP) this.settle();
  }

  settle(): void {
    const offCenter = Math.abs(this.position - Math.round(this.position));

    // Balanced exactly on a border between two cards: a tiny tremor tips it over.
    if (offCenter > MAX_OFF_CENTER_AT_REST) {
      this.velocity = (this.random() < 0.5 ? -1 : 1) * TEETER_NUDGE_SPEED;
      this.restTime = 0;
      return;
    }

    this.phase = 'idle';
    this.velocity = 0;
    this.onStop(this.cardIndex);
  }

  // The spin being stepped: only a launched wheel moves (step() returns while idle).
  private launched(): WheelSpin {
    if (!this.spin) throw new Error('WheelPhysics: launch() before stepping');
    return this.spin;
  }
}

/** The pointer that gets knocked aside by each card border and springs back. */
export class Flapper {
  angle: number;
  velocity: number;

  constructor() {
    this.angle = 0;
    this.velocity = 0;
  }

  get isAtRest(): boolean {
    return Math.abs(this.angle) < 0.05 && Math.abs(this.velocity) < 1;
  }

  kick(direction: number, cardsPerSecond: number): void {
    const strength = Math.min(900, 300 + 35 * cardsPerSecond);
    this.velocity += direction * strength;
  }

  step(dt: number): void {
    const stiffness = 3200;
    const damping = 20;
    const maxAngle = 28;

    this.velocity += (-stiffness * this.angle - damping * this.velocity) * dt;
    this.angle = Math.max(-maxAngle, Math.min(maxAngle, this.angle + this.velocity * dt));
  }
}
