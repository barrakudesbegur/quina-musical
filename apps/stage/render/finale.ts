// The Desgraciat's finale on stage, inside the play scene (board Projector-Desgraciat-Final ①–⑥; ANIMATIONS.md › The
// finale on stage › Projector): a floor under the title, one nino per finalist with its spotlight cone and number plate,
// in ascending order. Fates follow the show's clock (a fall shows from its landing, `fateAt`); the moments play the
// motion: `finale-enter` (ninos pop in), `finale-fall` (the ✗ stamps), `finale-clear` (the fallen leave, the rest close
// up and grow), `finale-back`, `finale-win` (the party nino steps forward, gold) and `finale-safe` («Salvats!»: two
// jumps, the ribbon, the light born from it, the phones' two spotlights and the slow paper confetti).
import { STAGE } from '../config.ts';
import { fateAt, finaleLayout, type FinaleNino, type FinaleView } from '../model/finale.ts';
import type { AnimDetail } from '../model/moments.ts';
import { runPaperConfetti } from '../../../packages/ui/motion/paper-confetti.ts';
import { ninoUrl } from '../../../packages/ui/ninos.ts';
import '../../../packages/ui/components/particles.css';
import { STAGE_TEXT } from '../strings.ts';
import { h, playAnim, setData, setHidden, setVar } from './dom.ts';
import type { SceneEnv } from './scene.ts';

/** One finalist's spot: cone, gold rays (a winner's), pool, the nino (in a hop wrapper), the plate and its ✗. */
class NinoSlot {
  readonly root: HTMLElement;
  readonly body: HTMLElement;
  private readonly img: HTMLImageElement;
  private readonly plate: HTMLElement;
  private src = '';

  constructor(number: number) {
    this.img = h('img', { class: 'finale__nino', attrs: { alt: '', decoding: 'async', draggable: 'false' } });
    this.plate = h('p', 'finale__plate', STAGE_TEXT.finalist(number));
    this.body = h(
      'div',
      'finale__body',
      h('div', 'finale__pool'),
      h('div', 'finale__hop', this.img),
      h('div', 'finale__label', this.plate, h('span', { class: 'finale__cross', attrs: { 'aria-hidden': 'true' } })),
    );
    this.root = h('li', { class: 'finale__slot', data: { number: String(number), fate: 'up' } }, h('div', { class: 'ds-rays finale__rays', data: { color: 'gold' } }), h('div', 'finale__cone'), this.body);
  }

  set(nino: FinaleNino, x: number, index: number): void {
    setVar(this.root, '--x', `${x}px`);
    setVar(this.root, '--i', String(index));
    setVar(this.root, '--hue', `${nino.hue}deg`);
    setData(this.root, 'pose', nino.pose);
  }

  /** The fate on screen now; the winner wears the party nino. */
  show(fate: FinaleNino['fate'], pose: FinaleNino['pose']): void {
    setData(this.root, 'fate', fate);
    const src = ninoUrl(fate === 'win' ? STAGE.finale.winner : pose);
    if (src !== this.src) {
      this.src = src;
      this.img.src = src;
    }
  }
}

export class FinaleStage {
  readonly root: HTMLElement;
  private readonly env: SceneEnv;
  private readonly row: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly slots = new Map<number, NinoSlot>();
  private view: FinaleView | null = null;
  private stopConfetti: (() => void) | null = null;
  private safeTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(env: SceneEnv) {
    this.env = env;
    this.row = h('ol', 'finale__row');
    this.canvas = h('canvas', { class: 'finale__confetti', attrs: { 'aria-hidden': 'true' } });
    const beam = (side: string) => h('div', `finale__beam finale__beam--${side}`);
    this.root = h(
      'div',
      { class: 'finale', hidden: true, data: { testid: 'finale' } },
      h('div', { class: 'finale__light', attrs: { 'aria-hidden': 'true' } }, h('div', { class: 'ds-rays finale__light-rays', data: { color: 'live' } }), h('div', 'finale__glow')),
      h('div', { class: 'finale__beams', attrs: { 'aria-hidden': 'true' } }, beam('left'), beam('right')),
      h('div', { class: 'finale__floor', attrs: { 'aria-hidden': 'true' } }),
      this.row,
      h('p', { class: 'finale__ribbon', attrs: { 'aria-hidden': 'true' } }, h('span', 'finale__ribbon-text', STAGE_TEXT.saved)),
      this.canvas,
    );
  }

  render(view: FinaleView | null): void {
    this.view = view;
    setHidden(this.root, view === null);
    if (!view) {
      this.stop();
      for (const slot of this.slots.values()) slot.root.remove();
      this.slots.clear();
      return;
    }
    const layout = finaleLayout(view.ninos.length);
    setVar(this.row, '--s', String(layout.scale));
    const keep = new Set(view.ninos.map((n) => n.number));
    // The fallen leave (`finale-clear`) before the rest close up: the move waits for them.
    let leaving = false;
    for (const [number, slot] of this.slots) {
      if (keep.has(number)) continue;
      this.slots.delete(number);
      leaving = true;
      this.leave(slot);
    }
    setData(this.row, 'shift', leaving ? 'clear' : null);
    view.ninos.forEach((nino, i) => {
      let slot = this.slots.get(nino.number);
      if (!slot) {
        slot = new NinoSlot(nino.number);
        this.slots.set(nino.number, slot);
      }
      slot.set(nino, layout.xs[i], i);
      // Row order is the DOM order, so reading order follows the stage.
      if (this.row.children[i] !== slot.root) this.row.insertBefore(slot.root, this.row.children[i] ?? null);
    });
  }

  private leave(slot: NinoSlot): void {
    slot.root.classList.add('is-leaving');
    const remove = () => slot.root.remove();
    if (this.env.reducedMotion()) remove();
    else setTimeout(remove, 600);
  }

  /** The fates follow the clock: a fall or a win shows from its landing time. */
  tick(nowMs: number): void {
    for (const nino of this.view?.ninos ?? []) this.slots.get(nino.number)?.show(fateAt(nino, nowMs), nino.pose);
  }

  onAnim(detail: AnimDetail): void {
    switch (detail.name) {
      case 'finale-enter':
      case 'finale-fall':
      case 'finale-back':
        detail.numbers.forEach((n, order) => {
          const slot = this.slots.get(n);
          if (!slot) return;
          // The ninos entering together pop in one after another, in row order.
          setVar(slot.root, '--enter-i', String(order));
          playAnim(slot.root, detail.name);
        });
        break;
      case 'finale-win': {
        const slot = this.slots.get(detail.number);
        if (slot) playAnim(slot.root, 'finale-win');
        break;
      }
      case 'finale-safe': {
        playAnim(this.root, 'finale-safe');
        this.confetti();
        // Once the confetti has fallen, the spotlights stop sweeping out of sight.
        if (this.safeTimer) clearTimeout(this.safeTimer);
        const root = this.root;
        this.safeTimer = setTimeout(() => setData(root, 'anim', null), STAGE.finale.confetti.durationMs);
        break;
      }
      default:
        break;
    }
  }

  /** «Salvats!»'s slow paper confetti from the ribbon (D185), on one canvas; none with reduced motion. */
  private confetti(): void {
    this.stop();
    if (this.env.reducedMotion()) return;
    const c = STAGE.finale.confetti;
    const paper = STAGE.paper;
    this.stopConfetti = runPaperConfetti(
      this.canvas,
      { count: c.count, colors: paper.colors, origin: c.origin, spread: c.spread, fallShare: paper.fallShare, size: paper.size, random: this.env.random },
      c.durationMs,
      paper.outline,
    );
  }

  private stop(): void {
    this.stopConfetti?.();
    this.stopConfetti = null;
  }
}

