// Building blocks shared by the scenes: a prize, the sponsors, a round title, a song tile, a countdown.
// Each owns its DOM nodes and updates them from view data only.
import type { RoundView, PrizeView, SponsorView } from '../view.ts';
import type { StageSong } from '../model/songs.ts';
import { STAGE } from '../config.ts';
import { roughCountdown, sameCountdown, type RoughCountdown } from '../model/timing.ts';
import { formatClock } from '../../ui/rules/time.ts';
import { STAGE_TEXT, type CountdownContext } from '../strings.ts';
import { CoverArt, h, playAnim, setData, setHidden, setText } from './dom.ts';

/** "Quina 4", plus the special-round badge. */
export class RoundTitle {
  readonly root: HTMLElement;
  private readonly name: HTMLElement;
  private readonly badge: HTMLElement;

  constructor(tag: 'h1' | 'h2' | 'p', extraClass = '') {
    this.name = h('span', 'round-title__name');
    this.badge = h('span', { class: 'round-title__special', hidden: true }, STAGE_TEXT.specialRound);
    this.root = h(tag, `round-title ${extraClass}`.trim(), this.name, this.badge);
  }

  set(round: RoundView | null, label: (n: number) => string = STAGE_TEXT.round): void {
    setHidden(this.root, round === null);
    if (!round) return;
    setText(this.name, label(round.number));
    setHidden(this.badge, !round.special);
    setData(this.root, 'special', round.special ? 'true' : null);
  }
}

/** A prize: its kind ("Premi de línia"), its title, and "Gentilesa de …". Hidden without a prize. */
export class PrizeBlock {
  readonly root: HTMLElement;
  private readonly kind: HTMLElement;
  private readonly title: HTMLElement;
  private readonly detail: HTMLElement;
  private readonly sponsor: HTMLElement;

  constructor(extraClass = '') {
    this.kind = h('p', 'prize__kind');
    this.title = h('p', 'prize__title');
    this.detail = h('p', 'prize__detail');
    this.sponsor = h('p', 'prize__sponsor');
    this.root = h('article', { class: `prize ${extraClass}`.trim(), hidden: true }, this.kind, this.title, this.detail, this.sponsor);
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
  }
}

/** The sponsors, as logos when there are some, else as names. Hidden without sponsors. */
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
        const logo = s.logo ? h('img', { class: 'sponsors__logo', attrs: { src: s.logo, alt: s.label } }) : null;
        return h('li', 'sponsors__item', logo ?? h('span', 'sponsors__name', s.label));
      }),
    );
  }
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

/** A rough countdown chip; it plays `interval-rotate` when its text changes (once a minute at most). */
export class CountdownChip {
  readonly root: HTMLElement;
  private last: RoughCountdown | null = null;
  private readonly context: CountdownContext;

  constructor(context: CountdownContext) {
    this.context = context;
    this.root = h('p', { class: 'countdown', hidden: true });
  }

  update(targetMs: number | null, nowMs: number, animate: boolean): void {
    const next = roughCountdown(targetMs, nowMs, STAGE.countdown);
    if (sameCountdown(next, this.last)) return;
    const had = this.last !== null;
    this.last = next;
    setHidden(this.root, next === null);
    if (!next) return;
    const ctx = this.context;
    setText(
      this.root,
      next.kind === 'soon' ? STAGE_TEXT.countdown.soon(ctx) : next.kind === 'at' ? STAGE_TEXT.countdown.at(ctx, formatClock(next.atMs)) : STAGE_TEXT.countdown.minutes(ctx, next.minutes),
    );
    if (animate && had) playAnim(this.root, 'interval-rotate');
  }
}
