// The one press-and-hold gesture of LongPressButton (A2) and TwoLevelButton (A3) (components-v2.md: "merge their
// pointer and key code into one primitive"). It turns a finger, the mouse, Enter or Space and a bare click (assistive
// technology) into the pure machines' events (long-press.ts, two-level.ts), ticks them on animation frames while
// pressed, and lets go when the press is taken away: the pointer cancelled, the button blurred or disabled, the page
// hidden. The component owns what each step does (its command, its sounds); this owns only the timing.
//
// Use, in a component's script: `const hold = new HoldGesture({ … })`, then on its <button>:
// `{...hold.handlers} {@attach hold.attach}`; read `hold.state` and `hold.progress` in the markup.

/** What the machines take: the finger (or key) down and up, a cancelled press, and the clock's ticks. */
export type HoldEvent = { type: 'down' | 'up' | 'cancel' | 'tick'; atMs: number };

export interface HoldGestureOptions<S> {
  /** The machine's resting state. */
  idle: S;
  /** One step of the machine: the component runs its side effects here and returns the new state. */
  step(state: S, event: HoldEvent): S;
  /** How far the press is, 0..1, for the fill. */
  progress(state: S, nowMs: number): number;
  /** When the machine needs its next tick: every frame while pressed, at a time (a hint's end), or never. */
  next(state: S): 'frame' | number | null;
  /** A finger is down on it now. */
  pressing(state: S): boolean;
  /** The control can be used now; a press that loses it is cancelled. */
  usable(): boolean;
}

const isPressKey = (e: KeyboardEvent) => e.key === 'Enter' || e.key === ' ';
const now = () => performance.now();

export class HoldGesture<S> {
  state: S = $state() as S;
  progress = $state(0);
  #o: HoldGestureOptions<S>;
  #frame = 0;
  #timer: ReturnType<typeof setTimeout> | undefined;

  constructor(options: HoldGestureOptions<S>) {
    this.#o = options;
    this.state = options.idle;
    // Disabled mid-press (the scene changed): drop the press.
    $effect(() => {
      if (!options.usable() && options.pressing(this.state)) this.feed({ type: 'cancel', atMs: now() });
    });
  }

  feed(event: HoldEvent): void {
    this.state = this.#o.step(this.state, event);
    this.progress = this.#o.progress(this.state, event.atMs);
    cancelAnimationFrame(this.#frame);
    clearTimeout(this.#timer);
    const next = this.#o.next(this.state);
    if (next === 'frame') this.#frame = requestAnimationFrame(() => this.feed({ type: 'tick', atMs: now() }));
    else if (next !== null) this.#timer = setTimeout(() => this.feed({ type: 'tick', atMs: now() }), Math.max(0, next - event.atMs));
  }

  readonly handlers = {
    onpointerdown: (e: PointerEvent): void => {
      if (e.button !== 0 || !this.#o.usable()) return;
      try {
        // Keep getting this finger's events when it slides off the button.
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {
        // No such active pointer (synthetic events): the press still counts.
      }
      this.feed({ type: 'down', atMs: now() });
    },
    onpointerup: (): void => this.feed({ type: 'up', atMs: now() }),
    onpointercancel: (): void => this.feed({ type: 'cancel', atMs: now() }),
    onkeydown: (e: KeyboardEvent): void => {
      if (!isPressKey(e)) return;
      e.preventDefault();
      if (!e.repeat && this.#o.usable()) this.feed({ type: 'down', atMs: now() });
    },
    onkeyup: (e: KeyboardEvent): void => {
      if (!isPressKey(e)) return;
      e.preventDefault();
      this.feed({ type: 'up', atMs: now() });
    },
    // Assistive technology may activate the button with a bare click (no pointer or key events): a tap.
    onclick: (e: MouseEvent): void => {
      if (e.detail !== 0 || this.#o.pressing(this.state) || !this.#o.usable()) return;
      this.feed({ type: 'down', atMs: now() });
      this.feed({ type: 'up', atMs: now() });
    },
    onblur: (): void => this.feed({ type: 'cancel', atMs: now() }),
    oncontextmenu: (e: Event): void => e.preventDefault(),
  };

  /** On the <button>: a hidden page lets go (never a Suspens held by a finger that's gone); unmounting stops it. */
  readonly attach = (node: HTMLElement): (() => void) => {
    const doc = node.ownerDocument;
    const onvisibilitychange = () => {
      if (doc.hidden) this.feed({ type: 'cancel', atMs: now() });
    };
    doc.addEventListener('visibilitychange', onvisibilitychange);
    return () => {
      doc.removeEventListener('visibilitychange', onvisibilitychange);
      if (this.#o.pressing(this.state)) this.feed({ type: 'cancel', atMs: now() });
      cancelAnimationFrame(this.#frame);
      clearTimeout(this.#timer);
    };
  };
}
