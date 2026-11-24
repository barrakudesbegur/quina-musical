// Before the Game: the edition's name, a preview of the night (each card type that plays, in its colour, with
// its price and its rounds: one band per type, so it's plain that one card is only for the Quina Especial), a
// rough countdown to the planned start, the player app's QR as large as possible (no text; the sitting nino
// on its corner) and the sponsors' logos. No how-to-play text: the presenters explain.
import { STAGE } from '../config.ts';
import type { NightCardType } from '../model/night.ts';
import type { BeforeView, StageView } from '../view.ts';
import { priceLabel, STAGE_TEXT } from '../strings.ts';
import { h, setData, setHidden, setText } from './dom.ts';
import { CountdownChip, MiniCard, SponsorList, starIcon, stickerImage } from './parts.ts';
import { QrBlock } from './qr.ts';
import { sceneRoot, type SceneRenderer } from './scene.ts';

/** One card type's band: its card and price tag, its name, and the rounds it plays. */
function typeBand(t: NightCardType): HTMLElement {
  const card = new MiniCard('night__card');
  card.set(t.color, t.special);
  const price = priceLabel(t.priceCents);
  const art = h('div', 'night__art', card.root, price ? h('p', 'night__price', price) : null);
  const rounds = t.regularRounds.length
    ? h(
        'div',
        { class: 'night__rounds', attrs: { 'aria-label': STAGE_TEXT.roundsLabel(t.regularRounds), style: `--balls: ${t.regularRounds.length}` } },
        h('span', { class: 'night__word', attrs: { 'aria-hidden': 'true' } }, STAGE_TEXT.roundsWord),
        ...t.regularRounds.map((n) => h('span', { class: 'night__ball', attrs: { 'aria-hidden': 'true' } }, String(n))),
      )
    : null;
  const special = t.special ? h('p', 'night__pill', starIcon('night__pill-icon'), STAGE_TEXT.specialRoundName) : null;
  const band = h(
    'li',
    { class: 'night__band', data: { type: t.type, special: String(t.special) }, attrs: { 'aria-label': STAGE_TEXT.priceOf(t.label, price) } },
    art,
    h('div', 'night__info', h('p', 'night__name', t.label), rounds, special),
  );
  band.style.setProperty('--type-color', t.color);
  return band;
}

export class BeforeScene implements SceneRenderer<BeforeView> {
  readonly root = sceneRoot('before');
  private readonly title: HTMLElement;
  private readonly night: HTMLElement;
  private readonly countdown = new CountdownChip('start');
  private readonly qr = new QrBlock('before__qr');
  private readonly sponsors = new SponsorList(null, 'sponsors--strip before__sponsors');
  private body: BeforeView | null = null;
  private nightKey = '';

  constructor() {
    this.title = h('h1', { class: 'before__title', data: { anim: 'idle' } });
    this.night = h('ul', { class: 'night', hidden: true });
    this.countdown.root.classList.add('before__countdown');
    const sticker = stickerImage(STAGE.stickers.before, 'nino-sentat', 'before__sticker');
    if (sticker) setData(sticker, 'anim', 'idle');
    this.root.append(
      this.title,
      h('div', 'before__main', h('div', 'before__night', this.night, this.countdown.root), h('div', 'before__qr-spot', this.qr.root, sticker)),
      this.sponsors.root,
    );
  }

  render(body: BeforeView, view: StageView): void {
    this.body = body;
    setText(this.title, view.title);
    const key = JSON.stringify(body.cardTypes);
    if (key !== this.nightKey) {
      this.nightKey = key;
      this.night.replaceChildren(...body.cardTypes.map(typeBand));
      setHidden(this.night, body.cardTypes.length === 0);
    }
    this.qr.set(body.link);
    this.sponsors.set(body.sponsors);
  }

  tick(nowMs: number): void {
    this.countdown.update(this.body?.startAtMs ?? null, nowMs);
  }
}
