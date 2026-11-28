// Building blocks shared by the scenes: a prize, the sponsors, a round title, a song tile, a countdown, a
// mini card and a nino sticker. Each owns its DOM nodes and updates them from view data only.
import { miniCardElement } from '../../../packages/ui/components/mini-card.ts';
import { songTileElement } from '../../../packages/ui/components/song-tile.ts';
import type { RoundView, PrizeView, SponsorView } from '../view.ts';
import type { StageSong } from '../model/songs.ts';
import { STAGE } from '../config.ts';
import { roughCountdown, sameCountdown, type RoughCountdown } from '../model/timing.ts';
import { clockParts } from '../../../packages/rules/time.ts';
import { imageSources } from '../../../packages/ui/data/media.ts';
import { STAGE_TEXT, type CountdownContext } from '../strings.ts';
import { prizeCardText } from '../../../packages/ui/recipes/prizes.ts';
import { h, playAnim, setData, setHidden, setText, setVar } from './dom.ts';
import { loopRepeats, panTiming, sponsorPage, stripRows } from '../model/sponsors.ts';
import { logoTileElement } from '../../../packages/ui/components/sponsors-dom.ts';
import { ninoFor, type NinoMoment } from '../../../packages/ui/concepts.ts';
import { ninoElement, setNino } from '../../../packages/ui/components/nino-dom.ts';
import { LINE_ICONS, pathOf } from '../../../packages/ui/icons/line.ts';

/** The round's name (RoundView's): "Quina 4", "Quina Especial" or "Quina del Desgraciat". */
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

/**
 * A headline prize: the design system's PrizeCard (C2, D-p) built in plain DOM, with its CSS and its words from the
 * same recipe (packages/ui/recipes: paper-card.css, prizes.css, prizes.ts): the kind as the chip, the prize's name
 * big, its detail, «Gentilesa de …», «i 3 premis més». Hidden without a prize.
 */
export class PrizeBlock {
  readonly root: HTMLElement;
  private readonly chip: HTMLElement;
  private readonly title: HTMLElement;
  private readonly detail: HTMLElement;
  private readonly sponsor: HTMLElement;
  private readonly more: HTMLElement;

  constructor(extraClass = '') {
    this.chip = h('span', 'paper-card__ribbon');
    this.title = h('p', 'prize-card__title');
    this.detail = h('p', 'prize-card__detail');
    this.sponsor = h('p', 'prize-card__sponsor');
    this.more = h('p', 'prize-card__more');
    const part = h('div', 'paper-card__part', this.title, this.detail, this.sponsor, this.more);
    this.root = h('article', { class: `paper-card prize-card ${extraClass}`.trim(), data: { layout: 'hero' }, hidden: true }, this.chip, h('div', 'paper-card__paper', part));
  }

  set(prize: PrizeView | null): void {
    setHidden(this.root, prize === null);
    if (!prize) return;
    const text = prizeCardText({ kind: prize.kind, headline: [{ title: prize.title, detail: prize.detail, sponsor: prize.sponsor }], more: prize.more });
    setData(this.root, 'kind', prize.kind);
    this.root.setAttribute('aria-label', text.chip);
    setText(this.chip, text.chip);
    setData(this.chip, 'color', text.color);
    setText(this.title, text.title);
    setText(this.detail, text.detail ?? '');
    setHidden(this.detail, !text.detail);
    setText(this.sponsor, text.sponsor ?? '');
    setHidden(this.sponsor, !text.sponsor);
    setText(this.more, text.more ?? '');
    setHidden(this.more, !text.more);
  }
}

/** The sponsors, as logos when there are some, else as names, all at once (the closing credits, which roll). Hidden
 * without sponsors. Before the Game and in the Interval the strip is SponsorStrip. */
export class SponsorList {
  readonly root: HTMLElement;
  private readonly list: HTMLUListElement;
  private key = '';

  constructor(title: string | null, extraClass = '') {
    this.list = h('ul', 'sponsors__list');
    this.root = h('section', { class: `sponsors ${extraClass}`.trim(), hidden: true }, title ? h('h2', 'sponsors__title', title) : null, this.list);
  }

  set(sponsors: readonly SponsorView[]): void {
    setHidden(this.root, sponsors.length === 0);
    const key = sponsors.map((s) => `${s.label}|${s.logo ?? ''}`).join('\n');
    if (key === this.key) return;
    this.key = key;
    this.list.replaceChildren(
      ...sponsors.map((s) => {
        const logo = s.logo ? logoPicture(s.logo, s.label) : null;
        return h('li', 'sponsors__item', logo ?? h('span', 'sponsors__name', s.label));
      }),
    );
  }
}

/**
 * G4 · SponsorStrip before the Game and in the Break (27 Nov, the user's canvas comments #88 and S4, D-v): big logo tiles
 * (packages/ui/components/sponsors.css) in one row, or `STAGE.sponsorStrip.rows` rows, each panning slowly without end so
 * every sponsor shows, from a random point of its loop each time the scene shows (`sponsor-pan`). A row whose list is
 * narrower than the strip repeats it until one loop fills the strip, so no gap ever shows. With reduced motion it stands
 * still and turns its page every `pageMs` instead (`sponsor-pages`), from a random page. The loop's copies are
 * decorative: only each row's first copy carries the names.
 */
export class SponsorStrip {
  readonly root: HTMLElement;
  private readonly reduced = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  private readonly rows: number;
  private tracks: HTMLUListElement[] = [];
  /** The sponsors on each row (pan mode), and how many times its loop repeats them. */
  private rowLists: (readonly SponsorView[])[] = [];
  private repeats: number[] = [];
  private key = '';
  private sponsors: readonly SponsorView[] = [];
  private page = -1;
  /** Where the pages start (reduced motion), a random page's worth of time. */
  private pageOffsetMs = 0;
  private lastTickMs = Number.NEGATIVE_INFINITY;

  /** `rows`: how many rows (default `STAGE.sponsorStrip.rows`). */
  constructor(extraClass = '', options: { rows?: number } = {}) {
    this.rows = Math.max(1, Math.floor(options.rows ?? STAGE.sponsorStrip.rows));
    this.root = h('section', { class: `sponsor-strip ${extraClass}`.trim(), hidden: true, data: { mode: 'pan' } });
    this.reduced?.addEventListener('change', () => this.redraw(0));
  }

  set(sponsors: readonly SponsorView[], nowMs = 0): void {
    setHidden(this.root, sponsors.length === 0);
    const key = sponsors.map((s) => `${s.label}|${s.logo ?? ''}`).join('\n');
    if (key === this.key) return;
    this.key = key;
    this.sponsors = sponsors;
    this.redraw(nowMs);
  }

  /**
   * Every frame while the scene is on screen. After a gap (the scene shows again) each loop starts from a new random
   * point. Under reduced motion the page turns when the clock says so; the swap crossfades.
   */
  tick(nowMs: number): void {
    const shownAgain = nowMs - this.lastTickMs > 1000;
    this.lastTickMs = nowMs;
    if (shownAgain && this.sponsors.length) this.startAnywhere();
    if (this.root.dataset.mode !== 'pages' || !this.sponsors.length) return;
    const { perPage, pageMs } = STAGE.sponsorStrip;
    const page = sponsorPage(this.sponsors, perPage * this.rows, nowMs + this.pageOffsetMs, pageMs);
    if (page.index === this.page) return;
    const first = this.page === -1;
    this.page = page.index;
    this.setTracks(stripRows(page.items, this.rows).map((row) => row.map((s) => tile(s, false))));
    if (!first) for (const track of this.tracks) playAnim(track, 'sponsor-pages');
  }

  private redraw(nowMs: number): void {
    const pan = !this.reduced?.matches;
    setData(this.root, 'mode', pan ? 'pan' : 'pages');
    this.page = -1;
    if (!pan) {
      this.rowLists = [];
      this.startAnywhere();
      this.tick(nowMs);
      return;
    }
    this.rowLists = stripRows(this.sponsors, this.rows);
    this.repeats = this.rowLists.map(() => 1);
    this.setTracks(this.rowLists.map((row) => loopTiles(row, 1)));
    // Measured once laid out (startAnywhere); a scene that isn't showing yet measures again when it shows.
    requestAnimationFrame(() => this.startAnywhere());
  }

  /** As many tracks as rows, each holding its tiles. */
  private setTracks(rows: HTMLElement[][]): void {
    this.tracks = rows.map((tiles, i) => {
      const track = this.tracks[i] ?? h('ul', 'sponsor-strip__track');
      track.replaceChildren(...tiles);
      return track;
    });
    this.root.replaceChildren(...this.tracks);
  }

  /**
   * A random point of each row's loop (or a random page). Measures each row first: one list is the track's width over
   * its copies (each tile carries its gap), and a row narrower than the strip is redrawn with more repeats.
   */
  private startAnywhere(): void {
    const { perPage, pageMs, pxPerSec, tileStepPx } = STAGE.sponsorStrip;
    if (this.root.dataset.mode === 'pages') {
      this.pageOffsetMs = Math.floor(Math.random() * Math.ceil(this.sponsors.length / (perPage * this.rows))) * pageMs;
      this.page = -1;
      return;
    }
    const viewPx = this.root.clientWidth;
    this.rowLists.forEach((row, i) => {
      const track = this.tracks[i];
      if (!track) return;
      const listPx = track.scrollWidth / (2 * this.repeats[i]) || row.length * tileStepPx;
      const times = viewPx > 0 ? loopRepeats(listPx, viewPx) : this.repeats[i];
      if (times !== this.repeats[i]) {
        this.repeats[i] = times;
        track.replaceChildren(...loopTiles(row, times));
      }
      const { durationS, delayS } = panTiming(listPx * times, pxPerSec, Math.random());
      setVar(track, '--pan-duration', `${durationS.toFixed(2)}s`);
      setVar(track, '--pan-delay', `${delayS.toFixed(2)}s`);
    });
  }
}

/** A row's track: its list `times` times (one loop), drawn twice so the pan by one loop is seamless. */
function loopTiles(row: readonly SponsorView[], times: number): HTMLElement[] {
  return Array.from({ length: 2 * times }, (_, k) => row.map((s) => tile(s, k > 0))).flat();
}

/** One sponsor's tile in the strip; the loop's second copy is hidden from assistive tech. */
function tile(s: SponsorView, copy: boolean): HTMLElement {
  return h('li', copy ? { attrs: { 'aria-hidden': 'true' } } : {}, logoTileElement({ name: s.label, logo: s.logo }));
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

/** A landed song: cover, title and artist, as the design system's SongTile `tile` (D5, the projector's last three). */
export class SongTile {
  readonly root: HTMLElement;
  private readonly tile: ReturnType<typeof songTileElement>;

  constructor(tag: 'li' | 'div' = 'li') {
    this.tile = songTileElement({ layout: 'tile', tag, fallback: 'empty' });
    this.root = this.tile.root;
  }

  set(song: StageSong | null): void {
    this.tile.set(song);
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
    const clock = next.kind === 'at' ? clockParts(next.atMs) : null;
    if (clock) {
      // Londrina's capitals leave the clock's am/pm as it is (D114): its own `.unit`.
      this.root.replaceChildren(`${STAGE_TEXT.countdown.at(ctx, clock.time)} `, h('span', 'unit', clock.period));
      return;
    }
    setText(this.root, next.kind === 'soon' ? STAGE_TEXT.countdown.soon(ctx) : next.kind === 'at' ? STAGE_TEXT.countdown.at(ctx, '—') : STAGE_TEXT.countdown.minutes(ctx, next.minutes));
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

/** The Quina del Desgraciat's sad face: the icon registry's `sad-face`, two eyes and a frown in ink with no circle
 *  round them (D23; colours from stage.css). */
export function sadIcon(className: string): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', `sad-icon ${className}`.trim());
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const features = document.createElementNS(SVG_NS, 'path');
  features.setAttribute('class', 'sad-icon__ink');
  features.setAttribute('d', LINE_ICONS['sad-face'].map(pathOf).join(''));
  svg.append(features);
  return svg;
}

/**
 * A printed card in miniature: a title bar over its 3 × 4 grid, in the card type's colour (`--type-color`),
 * with the star when it plays the Quina Especial. Decorative: the type's name is said next to it.
 */
/** The card-type drawing (D3): the design system's MiniCard (packages/ui/components/mini-card.ts). */
export class MiniCard {
  readonly root: HTMLElement;
  private readonly card: ReturnType<typeof miniCardElement>;

  constructor(extraClass = '') {
    this.card = miniCardElement(extraClass);
    this.root = this.card.root;
  }

  set(color: string, special: boolean): void {
    this.card.set(color, special);
  }
}

/**
 * A nino sticker (F1, packages/ui/components/nino-dom.ts) from a moment's pool (NINO_FOR), or null when the stage has
 * none for this spot. It starts on the pool's first pose; `pickSticker` changes it per occurrence.
 */
export function stickerImage(moment: NinoMoment | null, extraClass: string): HTMLImageElement | null {
  return moment ? ninoElement({ pose: ninoFor(moment, 0) }, `sticker ${extraClass}`) : null;
}

/** The moment's nino for this occurrence (a card number, a round number), so the same one doesn't always come back. */
export function pickSticker(img: HTMLImageElement | null, moment: NinoMoment | null, seed: number): void {
  if (img && moment) setNino(img, { pose: ninoFor(moment, seed) });
}
