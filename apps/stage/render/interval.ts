// The Interval (a break, "Descans" on screen, D149): a big "Descans", a plate naming the next round ("Següent: Quina 4 de 8"), a large
// countdown (a ring emptying towards the guide end, the rough minutes inside it and the rough countdown in
// words under it; a guide only, since rounds start by hand), the meditating and the dancing ninos either
// side, and the sponsors' logos. No winning card numbers, no QR, and none of the next round's prizes (they
// are revealed at its intro).
import { formatClock } from '../../../packages/rules/time.ts';
import { STAGE } from '../config.ts';
import type { AnimDetail } from '../model/moments.ts';
import { ringLeft, roughCountdown, sameCountdown, type RoughCountdown } from '../model/timing.ts';
import { priceLabel, STAGE_TEXT } from '../strings.ts';
import type { IntervalView } from '../view.ts';
import { h, playAnim, setData, setHidden, setText } from './dom.ts';
import { CountdownChip, MiniCard, SponsorStrip, stickerImage } from './parts.ts';
import { ninosFor } from '../../../packages/ui/concepts.ts';
import '../../../packages/ui/components/sticker.css';
import '../../../packages/ui/components/price-tag.css';
import { setNino } from '../../../packages/ui/components/nino-dom.ts';
import { RingElement } from '../../../packages/ui/components/ring-dom.ts';
import { sceneRoot, type SceneRenderer } from './scene.ts';

/** What the ring's face says: the rough minutes, "<1" under a minute, or the clock time when it's far off. */
function ringFace(at: RoughCountdown, clock: (ms: number) => string): { value: string; unit: string } {
  if (at.kind === 'minutes') return { value: String(at.minutes), unit: STAGE_TEXT.minutesUnit };
  if (at.kind === 'soon') return { value: STAGE_TEXT.ringSoon, unit: STAGE_TEXT.minutesUnit };
  return { value: clock(at.atMs), unit: '' };
}

/** The Interval's countdown: the generic Ring (E1), framed, in cyan, emptying linearly towards the guide end, with the
 * minutes inside (packages/ui/components/ring-dom.ts). Decorative: the words under it say the same. */
class CountdownRing {
  private readonly ring = new RingElement('cyan', 'interval__ring');
  readonly root = this.ring.root;
  private last: RoughCountdown | null = null;

  constructor() {
    this.root.setAttribute('aria-hidden', 'true');
  }

  update(at: RoughCountdown | null, left: number | null, clock: (ms: number) => string): void {
    setHidden(this.root, at === null);
    if (left !== null) this.ring.setProgress(left);
    if (!at || sameCountdown(at, this.last)) return;
    this.last = at;
    const face = ringFace(at, clock);
    this.ring.setValue(face.value, face.unit);
  }

  /** `interval-rotate`: the number ticks when it changes. */
  tickAnim(): void {
    playAnim(this.ring.face, 'interval-rotate');
  }
}

export class IntervalScene implements SceneRenderer<IntervalView> {
  readonly root = sceneRoot('interval');
  private readonly title: HTMLElement;
  private readonly plate: HTMLElement;
  private readonly ring = new CountdownRing();
  private readonly words = new CountdownChip('back');
  private readonly sponsors = new SponsorStrip('interval__sponsors');
  /** The coming round's card and price (`price-tag`, U5). */
  private readonly price = new MiniCard('interval__price-card');
  private readonly priceText: HTMLElement;
  private readonly priceTag: HTMLElement;
  private body: IntervalView | null = null;
  /** The two ninos either side of the countdown: a different pair for each Break (NINO_FOR.break, by the coming round). */
  private readonly ninos: (HTMLImageElement | null)[];

  constructor() {
    this.root.dataset.testid = 'interval';
    this.title = h('h1', { class: 'interval__title', data: { anim: 'idle' } }, STAGE_TEXT.intervalTitle);
    this.plate = h('p', { class: 'plate interval__plate', data: { color: 'gold' } });
    this.priceText = h('span', 'interval__price-text');
    this.priceTag = h('p', { class: 'price-tag interval__price', hidden: true, data: { testid: 'interval-price', variant: 'line', color: 'gold' } }, this.price.root, this.priceText);
    this.words.root.classList.add('interval__words');
    this.words.root.setAttribute('role', 'timer');
    const left = stickerImage(STAGE.stickers.interval, 'interval__nino interval__nino--left');
    const right = stickerImage(STAGE.stickers.interval, 'interval__nino interval__nino--right');
    this.ninos = [left, right];
    for (const s of this.ninos) if (s) setData(s, 'anim', 'idle');
    this.root.append(
      this.title,
      this.plate,
      this.priceTag,
      h('div', 'interval__main', left, h('section', 'interval__countdown', this.ring.root, this.words.root), right),
      this.sponsors.root,
    );
  }

  render(body: IntervalView): void {
    this.body = body;
    const moment = STAGE.stickers.interval;
    if (moment) {
      const pair = ninosFor(moment, body.nextRound.number * 2, 2);
      this.ninos.forEach((img, i) => img && setNino(img, { pose: pair[i % pair.length] }));
    }
    setText(this.plate, body.plate);
    setData(this.plate, 'special', body.nextRound.special ? 'true' : null);
    setHidden(this.priceTag, body.price === null);
    if (body.price) {
      this.price.set(body.price.color, body.nextRound.special);
      setText(this.priceText, STAGE_TEXT.priceFor(priceLabel(body.price.cents) ?? ''));
      this.priceTag.setAttribute('aria-label', STAGE_TEXT.priceOf(body.price.label, priceLabel(body.price.cents)));
    }
    this.sponsors.set(body.sponsors);
  }

  tick(nowMs: number): void {
    const body = this.body;
    if (!body) return;
    const at = roughCountdown(body.guideEndMs, nowMs, STAGE.countdown);
    this.ring.update(at, ringLeft(body.sinceMs, body.guideEndMs, nowMs), formatClock);
    this.words.update(body.guideEndMs, nowMs);
    this.sponsors.tick(nowMs);
  }

  onAnim(detail: AnimDetail): void {
    if (detail.name === 'interval-rotate') this.ring.tickAnim();
  }
}
