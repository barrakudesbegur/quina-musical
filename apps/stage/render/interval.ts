// The Interval (a break, "Descans" on screen, D149): a big "Descans", a plate naming the next round ("Següent: Quina 4 de 8"), a large
// countdown (a ring emptying towards the guide end, the rough minutes inside it and the rough countdown in
// words under it; a guide only, since rounds start by hand), the meditating and the dancing ninos either
// side, and the sponsors' logos. No winning card numbers, no QR, and none of the next round's prizes (they
// are revealed at its intro).
import { formatClock } from '../../../packages/rules/time.ts';
import { STAGE } from '../config.ts';
import type { AnimDetail } from '../model/moments.ts';
import { ringLeft, roughCountdown, sameCountdown, type RoughCountdown } from '../model/timing.ts';
import { nextRoundLabel, priceLabel, STAGE_TEXT } from '../strings.ts';
import type { IntervalView } from '../view.ts';
import { h, playAnim, setData, setHidden, setText, setVar } from './dom.ts';
import { CountdownChip, MiniCard, SponsorList, stickerImage } from './parts.ts';
import { sceneRoot, type SceneRenderer } from './scene.ts';

const SVG_NS = 'http://www.w3.org/2000/svg';
/** The ring's radius in its 156-unit viewBox (as on the board). */
const RING_R = 56;

function circle(className: string, r: number): SVGCircleElement {
  const c = document.createElementNS(SVG_NS, 'circle');
  c.setAttribute('class', className);
  c.setAttribute('cx', '78');
  c.setAttribute('cy', '78');
  c.setAttribute('r', String(r));
  return c;
}

/** What the ring's face says: the rough minutes, "<1" under a minute, or the clock time when it's far off. */
function ringFace(at: RoughCountdown, clock: (ms: number) => string): { value: string; unit: string } {
  if (at.kind === 'minutes') return { value: String(at.minutes), unit: STAGE_TEXT.minutesUnit };
  if (at.kind === 'soon') return { value: STAGE_TEXT.ringSoon, unit: STAGE_TEXT.minutesUnit };
  return { value: clock(at.atMs), unit: '' };
}

/** The Interval's countdown: a ring that empties linearly towards the guide end, with the minutes inside. */
class CountdownRing {
  readonly root: HTMLElement;
  private readonly fill: SVGCircleElement;
  private readonly face: HTMLElement;
  private readonly value: HTMLElement;
  private readonly unit: HTMLElement;
  private last: RoughCountdown | null = null;

  constructor() {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'ring__svg');
    svg.setAttribute('viewBox', '0 0 156 156');
    this.fill = circle('ring__fill', RING_R);
    this.fill.setAttribute('pathLength', '1');
    svg.append(circle('ring__plate', 72), circle('ring__track', RING_R), this.fill, circle('ring__hub', 44));
    this.value = h('span', 'ring__value');
    this.unit = h('span', 'ring__unit');
    this.face = h('span', 'ring__face', this.value, this.unit);
    this.root = h('div', { class: 'ring', attrs: { 'aria-hidden': 'true' } }, svg, this.face);
  }

  update(at: RoughCountdown | null, left: number | null, clock: (ms: number) => string): void {
    setHidden(this.root, at === null);
    if (left !== null) setVar(this.root, '--ring-left', String(left));
    if (!at || sameCountdown(at, this.last)) return;
    this.last = at;
    const face = ringFace(at, clock);
    setText(this.value, face.value);
    setText(this.unit, face.unit);
    setHidden(this.unit, !face.unit);
    setData(this.face, 'long', face.value.length > 2 ? 'true' : null);
  }

  /** `interval-rotate`: the number ticks when it changes. */
  tickAnim(): void {
    playAnim(this.face, 'interval-rotate');
  }
}

export class IntervalScene implements SceneRenderer<IntervalView> {
  readonly root = sceneRoot('interval');
  private readonly title: HTMLElement;
  private readonly plate: HTMLElement;
  private readonly ring = new CountdownRing();
  private readonly words = new CountdownChip('back');
  private readonly sponsors = new SponsorList(null, 'sponsors--strip interval__sponsors', true);
  /** The coming round's card and price (`price-tag`, U5). */
  private readonly price = new MiniCard('interval__price-card');
  private readonly priceText: HTMLElement;
  private readonly priceTag: HTMLElement;
  private body: IntervalView | null = null;

  constructor() {
    this.root.dataset.testid = 'interval';
    this.title = h('h1', { class: 'interval__title', data: { anim: 'idle' } }, STAGE_TEXT.intervalTitle);
    this.plate = h('p', 'interval__plate');
    this.priceText = h('span', 'interval__price-text');
    this.priceTag = h('p', { class: 'interval__price', hidden: true, data: { testid: 'interval-price' } }, this.price.root, this.priceText);
    this.words.root.classList.add('interval__words');
    this.words.root.setAttribute('role', 'timer');
    const left = stickerImage(STAGE.stickers.intervalLeft, 'nino-meditant', 'interval__nino interval__nino--left');
    const right = stickerImage(STAGE.stickers.intervalRight, 'nino-sardana', 'interval__nino interval__nino--right');
    for (const s of [left, right]) if (s) setData(s, 'anim', 'idle');
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
    setText(this.plate, nextRoundLabel(body.nextRound, body.roundsTotal));
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
