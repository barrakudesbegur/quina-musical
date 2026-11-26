// Building blocks shared by the scenes: a prize, the sponsors, a round title, a song tile, a countdown, a
// mini card and a nino sticker. Each owns its DOM nodes and updates them from view data only.
import type { RoundView, PrizeView, SponsorView } from '../view.ts';
import type { StageSong } from '../model/songs.ts';
import { STAGE } from '../config.ts';
import { roughCountdown, sameCountdown, type RoughCountdown } from '../model/timing.ts';
import { formatClock } from '../../../packages/rules/time.ts';
import { imageSources } from '../../../packages/ui/data/media.ts';
import { STAGE_TEXT, type CountdownContext } from '../strings.ts';
import { CoverArt, h, playAnim, setData, setHidden, setText, setVar } from './dom.ts';
import { sponsorPage } from '../model/sponsors.ts';

/** The round's name (RoundView's): "Quina 4", "Quina Especial" or "Quina Desgraciada". */
export class RoundTitle {
  readonly root: HTMLElement;
  private readonly name: HTMLElement;

  constructor(tag: 'h1' | 'h2' | 'p', extraClass = '') {
    this.name = h('span', 'round-title__name');
    this.root = h(tag, `round-title ${extraClass}`.trim(), this.name);
  }

  set(round: RoundView | null): void {
    setHidden(this.root, round === null);
    if (!round) return;
    setText(this.name, round.label);
    setData(this.root, 'special', round.special ? 'true' : null);
    setData(this.root, 'desgraciat', round.desgraciat ? 'true' : null);
  }
}

/** A prize: its kind ("Premi de línia"), its title, and "Gentilesa de …". Hidden without a prize. */
export class PrizeBlock {
  readonly root: HTMLElement;
  private readonly kind: HTMLElement;
  private readonly title: HTMLElement;
  private readonly detail: HTMLElement;
  private readonly sponsor: HTMLElement;
  private readonly more: HTMLElement;

  constructor(extraClass = '') {
    this.kind = h('p', 'prize__kind');
    this.title = h('p', 'prize__title');
    this.detail = h('p', 'prize__detail');
    this.sponsor = h('p', 'prize__sponsor');
    this.more = h('p', 'prize__more');
    this.root = h('article', { class: `prize ${extraClass}`.trim(), hidden: true }, this.kind, this.title, this.detail, this.sponsor, this.more);
  }

  set(prize: PrizeView | null): void {
    setHidden(this.root, prize === null);
    if (!prize) return;
    setData(this.root, 'kind', prize.kind);
    setText(this.kind, STAGE_TEXT.prize[prize.kind]);
    setText(this.title, prize.title);
    setText(this.detail, prize.detail ?? '');
    setHidden(this.detail, !prize.detail);
    setText(this.sponsor, prize.sponsor ? STAGE_TEXT.sponsoredBy(prize.sponsor) : '');
    setHidden(this.sponsor, !prize.sponsor);
    setText(this.more, prize.more ? STAGE_TEXT.morePrizes(prize.more) : '');
    setHidden(this.more, !prize.more);
  }
}

/** The sponsors, as logos when there are some, else as names. Hidden without sponsors. */
export class SponsorList {
  readonly root: HTMLElement;
  private readonly list: HTMLUListElement;
  private key = '';
  private sponsors: readonly SponsorView[] = [];
  /** The page shown (`paged` strips), or -1 before the first. */
  private page = -1;

  /**
   * `paged`: one row at a time, turning the page every STAGE.sponsorPageMs (`sponsor-pages`: before the Game and in
   * the Interval); otherwise every sponsor at once (the closing credits, which roll).
   */
  private readonly paged: boolean;

  constructor(title: string | null, extraClass = '', paged = false) {
    this.paged = paged;
    this.list = h('ul', { class: 'sponsors__list', data: paged ? { anim: 'sponsor-pages' } : {} });
    this.root = h('section', { class: `sponsors ${extraClass}`.trim(), hidden: true }, title ? h('h2', 'sponsors__title', title) : null, this.list);
  }

  set(sponsors: readonly SponsorView[], nowMs = 0): void {
    setHidden(this.root, sponsors.length === 0);
    const key = sponsors.map((s) => `${s.label}|${s.logo ?? ''}`).join('\n');
    if (key === this.key) return;
    this.key = key;
    this.sponsors = sponsors;
    this.page = -1;
    if (this.paged) this.tick(nowMs);
    else this.show(sponsors);
  }

  /** A paged strip turns its page when the clock says so; the swap fades through the hook's CSS. */
  tick(nowMs: number): void {
    if (!this.paged || !this.sponsors.length) return;
    const page = sponsorPage(this.sponsors, STAGE.sponsorsPerPage, nowMs, STAGE.sponsorPageMs);
    if (page.index === this.page) return;
    const first = this.page === -1;
    this.page = page.index;
    this.show(page.items);
    setData(this.list, 'pages', String(page.pages));
    if (!first) playAnim(this.list, 'sponsor-pages');
  }

  private show(sponsors: readonly SponsorView[]): void {
    this.list.replaceChildren(
      ...sponsors.map((s) => {
        const logo = s.logo ? logoPicture(s.logo, s.label) : null;
        return h('li', 'sponsors__item', logo ?? h('span', 'sponsors__name', s.label));
      }),
    );
  }
}

/** A sponsor's logo: its JPEG XL where the browser reads it, else the PNG (packages/ui/data/media.ts). */
function logoPicture(path: string, label: string): HTMLElement {
  const { jxl, src } = imageSources(path);
  return h(
    'picture',
    'sponsors__picture',
    jxl ? h('source', { attrs: { type: 'image/jxl', srcset: jxl } }) : null,
    h('img', { class: 'sponsors__logo', attrs: { src, alt: label } }),
  );
}

/** A landed song: cover, title and artist. */
export class SongTile {
  readonly root: HTMLElement;
  private readonly cover = new CoverArt('song-tile__cover');
  private readonly title: HTMLElement;
  private readonly artist: HTMLElement;

  constructor(tag: 'li' | 'div' = 'li') {
    this.title = h('p', 'song-tile__title');
    this.artist = h('p', 'song-tile__artist');
    this.root = h(tag, { class: 'song-tile', hidden: true }, this.cover.root, h('div', 'song-tile__text', this.title, this.artist));
  }

  set(song: StageSong | null): void {
    setHidden(this.root, song === null);
    this.cover.set(song?.songId ?? null);
    setText(this.title, song?.title ?? '');
    setText(this.artist, song?.artist ?? '');
  }
}

/** A rough countdown in words ("Comencem a les 10:00 pm", "Tornem d'aquí a uns 2 minuts"). */
export class CountdownChip {
  readonly root: HTMLElement;
  private last: RoughCountdown | null = null;
  private readonly context: CountdownContext;

  constructor(context: CountdownContext) {
    this.context = context;
    this.root = h('p', { class: 'countdown', hidden: true });
  }

  update(targetMs: number | null, nowMs: number): void {
    const next = roughCountdown(targetMs, nowMs, STAGE.countdown);
    if (sameCountdown(next, this.last)) return;
    this.last = next;
    setHidden(this.root, next === null);
    if (!next) return;
    const ctx = this.context;
    setText(
      this.root,
      next.kind === 'soon' ? STAGE_TEXT.countdown.soon(ctx) : next.kind === 'at' ? STAGE_TEXT.countdown.at(ctx, formatClock(next.atMs)) : STAGE_TEXT.countdown.minutes(ctx, next.minutes),
    );
  }
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/** The Quina Especial's star (a five-pointed star in gold, with an ink outline; colours from stage.css). */
export function starIcon(className: string): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', `star-icon ${className}`.trim());
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', 'M12 2.5l2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17.1l-5.9 3.2 1.3-6.5L2.5 9.3l6.6-.8z');
  svg.append(path);
  return svg;
}

/** The Quina Desgraciada's sad face: two eyes and a frown in ink, on a paper disc (colours from stage.css). */
export function sadIcon(className: string): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', `sad-icon ${className}`.trim());
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const face = document.createElementNS(SVG_NS, 'circle');
  face.setAttribute('class', 'sad-icon__face');
  face.setAttribute('cx', '12');
  face.setAttribute('cy', '12');
  face.setAttribute('r', '10.5');
  const features = document.createElementNS(SVG_NS, 'path');
  features.setAttribute('class', 'sad-icon__ink');
  features.setAttribute('d', 'M8.5 8.5v2.2M15.5 8.5v2.2M7.5 17.5c1.3-2.2 2.8-3.1 4.5-3.1s3.2.9 4.5 3.1');
  svg.append(face, features);
  return svg;
}

/**
 * A printed card in miniature: a title bar over its 3 × 4 grid, in the card type's colour (`--type-color`),
 * with the star when it plays the Quina Especial. Decorative: the type's name is said next to it.
 */
export class MiniCard {
  readonly root: HTMLElement;
  private readonly star: SVGSVGElement;

  constructor(extraClass = '') {
    this.star = starIcon('mini-card__star');
    this.root = h(
      'div',
      { class: `mini-card ${extraClass}`.trim(), attrs: { 'aria-hidden': 'true' } },
      h('div', 'mini-card__bar'),
      h('div', 'mini-card__grid', ...Array.from({ length: 12 }, () => h('span', 'mini-card__cell'))),
      this.star,
    );
  }

  set(color: string, special: boolean): void {
    setVar(this.root, '--type-color', color);
    this.star.style.display = special ? '' : 'none';
  }
}

/** A nino sticker (game-style, with its white border), or null when the stage has none for this spot. */
export function stickerImage(url: string | null, name: string, extraClass: string): HTMLImageElement | null {
  return url ? h('img', { class: `sticker ${extraClass}`.trim(), data: { sticker: name }, attrs: { src: url, alt: '', decoding: 'async', draggable: 'false' } }) : null;
}
