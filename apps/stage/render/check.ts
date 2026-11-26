// The Check, paced by the presenters: a compact plate "CARTRÓ #57" and the card-type badge (a mini card in the type's
// colour and its name) over the card's covers, which float on the night background with their titles. The type is
// the first step: its badge gets ✓ (a card of the wrong type has nothing to reveal: its ✗ comes with the result). For
// a Line, the other rows dim. Each revealed song's cover gets a ring while its snippet plays, then its mark (✓ or ✗);
// a step back lifts the last mark off, and the snippet before it replays under its equaliser. Under review the
// slate-blue «Revisió manual» plaque slides down over the top of the card, and the marks stay as the room saw them.
// From the presenters' cue the result shows: a valid card's gold plaque; a failed card's huge red ✗ over red light
// beams with the fallen nino, and no text (the failed song keeps its ✗ in the row). A card of the wrong type shows a
// big card in its colour under the ✗. A Check discarded from its review fades out with the plate.
// The Desgraciat round's standing Check: a ✓ marks a song that has NOT sounded, and the Check stops on the first one
// that has (its ✗, grey cover). Fallen (`check-fallen`): the ✗ lands over the half of the card away from that song,
// whose tile is lifted above the scrim and pops; the sitting nino tumbles in beside the ✗ (the card sat down), and
// the songs never revealed fade to 10 %.
// Everything is read from the timestamps (`checkReveal`, `typeReveal`) and the pure rules in model/check.ts.
// Hooks on the Check's root (`data-testid="check"`): `data-revealed` (how many songs are revealed), `data-cue`
// (`pass` or `fail` once the cue has played), `data-reviewing` (under review), `data-discarded`.
import { STAGE } from '../config.ts';
import {
  checkReveal,
  firstMiss,
  gridKey,
  isFailed,
  plaqueSpot,
  resultX,
  stepMark,
  typeReveal,
  type CheckCell,
  type CheckVerdict,
  type CheckView,
  type StepState,
  type TypeState,
} from '../model/check.ts';
import type { AnimDetail } from '../model/moments.ts';
import { checkResultDetail, STAGE_TEXT } from '../strings.ts';
import type { CheckSceneView } from '../view.ts';
import { CoverArt, h, playAnim, setData, setHidden, setText, setVar } from './dom.ts';
import { MiniCard, stickerImage } from './parts.ts';
import { sceneRoot, type SceneRenderer } from './scene.ts';

interface CellNodes {
  root: HTMLElement;
  art: HTMLElement;
  mark: HTMLElement;
  cell: CheckCell;
  /** The mark it shows ('ok', 'bad'). */
  shownMark: string | null;
  /** The mark a step back just took off, for its lift-off. */
  liftedMark: string | null;
}

/** Bars of the "playing" badge (their heights are the theme's). */
const EQ_BARS = 4;

const SVG_NS = 'http://www.w3.org/2000/svg';

/** The review plaque's magnifier (ink outline under a paper lens, as on the board). */
function magnifier(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'check-review__icon');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  for (const [layer, tag, attrs] of [
    ['lens', 'circle', { cx: '10.5', cy: '10.5', r: '6' }],
    ['handle', 'path', { d: 'M15 15l5.5 5.5' }],
    ['shine', 'circle', { cx: '10.5', cy: '10.5', r: '6' }],
    ['grip', 'path', { d: 'M15 15l5.5 5.5' }],
  ] as const) {
    const el = document.createElementNS(SVG_NS, tag);
    el.setAttribute('class', `check-review__icon-${layer}`);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    svg.append(el);
  }
  return svg;
}

/** The failed Check's big ✗: one stroked cross drawn in layers (drop, ink, dark red, red, gloss); colours from stage.css. */
function bigCross(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'check-result__cross');
  svg.setAttribute('viewBox', '0 0 200 200');
  svg.setAttribute('aria-hidden', 'true');
  const cross = 'M46 46L154 154M154 46L46 154';
  for (const [layer, d] of [['drop', cross], ['ink', cross], ['edge', cross], ['face', cross], ['gloss', 'M52 49L74 71M148 49L134 63']] as const) {
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('class', `check-result__cross-${layer}`);
    path.setAttribute('d', d);
    svg.append(path);
  }
  return svg;
}

export class CheckScene implements SceneRenderer<CheckSceneView> {
  readonly root = sceneRoot('check');
  private readonly panel: HTMLElement;
  private readonly plate: HTMLElement;
  private readonly heading: HTMLElement;
  private readonly type: HTMLElement;
  private readonly typeCard = new MiniCard('check__type-card');
  private readonly typeName: HTMLElement;
  private readonly typeMark: HTMLElement;
  private readonly grid: HTMLElement;
  /** «Revisió manual»: the plaque over the top of the card while the Check is under review. */
  private readonly review: HTMLElement;
  private readonly result: HTMLElement;
  private readonly resultTitle: HTMLElement;
  /** A card of the wrong type: a big card in its colour, under the ✗. */
  private readonly bigCard = new MiniCard('check-result__card');
  /** The nino beside a failed Check's ✗; null while the stage has no sticker for it (STAGE.stickers). */
  private readonly sticker: HTMLImageElement | null;
  /** The sitting nino beside a fallen card's ✗ (the Desgraciat round), instead of the one above. */
  private readonly fallenSticker: HTMLImageElement | null;
  private check: CheckView | null = null;
  private cells: CellNodes[] = [];
  /** Cell nodes by step index. */
  private byStep = new Map<number, CellNodes>();
  /** What each step index shows now (its state and the result it was drawn with). */
  private shown: string[] = [];
  private typeShown: TypeState | null = null;
  private resultShown: CheckVerdict | null = null;
  /** `gridKey` of the drawn grid. */
  private gridShown = '';

  constructor() {
    this.heading = h('h1', 'check__heading');
    this.plate = h('div', 'check__plate', this.heading);
    // The failed Check's shake plays once: a scene shown again would otherwise restart it.
    this.plate.addEventListener('animationend', (e) => {
      if (e.target === this.plate) setData(this.plate, 'anim', null);
    });
    this.typeName = h('p', 'check__type-name');
    this.typeMark = h('span', { class: 'check__type-mark', attrs: { 'aria-hidden': 'true' } });
    this.type = h('div', { class: 'check__type', data: { state: 'pending' } }, this.typeCard.root, this.typeName, this.typeMark);
    this.grid = h('div', 'card-grid');
    this.resultTitle = h('p', 'check-result__title');
    this.sticker = stickerImage(STAGE.stickers.checkFailed, 'nino-espatxarrat', 'check-result__sticker');
    if (this.sticker) this.sticker.hidden = true;
    this.fallenSticker = stickerImage(STAGE.stickers.checkFallen, 'nino-sentat', 'check-result__sticker check-result__sticker--fallen');
    if (this.fallenSticker) this.fallenSticker.hidden = true;
    this.result = h(
      'div',
      { class: 'check-result', hidden: true, attrs: { role: 'status', 'aria-live': 'assertive' } },
      this.bigCard.root,
      bigCross(),
      this.sticker,
      this.fallenSticker,
      this.resultTitle,
    );
    this.review = h('div', { class: 'check-review', attrs: { role: 'status' } }, magnifier(), h('p', 'check-review__title', STAGE_TEXT.checkReview));
    const beams = h('div', { class: 'check__beams', attrs: { 'aria-hidden': 'true' } }, h('div', 'check__rays'), h('div', 'check__glow'));
    const scrim = h('div', { class: 'check__scrim', attrs: { 'aria-hidden': 'true' } });
    this.panel = h('div', { class: 'check', data: { testid: 'check' } }, h('header', 'check__head', this.plate, this.type), h('div', 'check__card', beams, this.grid, this.review, this.result), scrim);
    this.root.append(this.panel);
  }

  render(body: CheckSceneView): void {
    const check = body.check;
    const sameCheck = check.key === this.check?.key;
    const grid = gridKey(check.cells);
    this.check = check;
    this.setHooks(check);
    if (sameCheck) {
      // The same Check: a song revealed without the catalog, or the catalog arrived since: redraw the grid (no
      // entrance replayed). The type badge may have learnt its mark (a wrong type's, at the cue).
      if (grid !== this.gridShown) this.layOut(check, grid);
      setData(this.panel, 'wrongType', check.cardType?.ok === false ? 'true' : null);
      return;
    }
    setText(this.heading, STAGE_TEXT.checkPlate(check.cardId));
    this.setType(check);
    setData(this.panel, 'kind', check.kind);
    setData(this.panel, 'verdict', null);
    setData(this.panel, 'result', 'pending');
    setData(this.panel, 'wrongType', check.cardType?.ok === false ? 'true' : null);
    setData(this.plate, 'anim', null);
    setData(this.review, 'anim', null);
    setHidden(this.result, true);
    this.layOut(check, grid);
  }

  /** The hooks on the Check's root: how many songs are revealed, the cue, a review, a discard. */
  private setHooks(check: CheckView): void {
    setData(this.panel, 'revealed', String(check.steps.length));
    setData(this.panel, 'cue', check.verdict === null ? null : isFailed(check.verdict) ? 'fail' : 'pass');
    setData(this.panel, 'reviewing', check.reviewing ? 'true' : null);
    setData(this.panel, 'discarded', check.discarded ? 'true' : null);
  }

  /** The type badge: hidden for an unknown card; its mark comes in `tick`. */
  private setType(check: CheckView): void {
    const t = check.cardType;
    setHidden(this.type, t === null);
    this.typeShown = null;
    setData(this.type, 'state', 'pending');
    setText(this.typeMark, '');
    if (!t) return;
    this.typeCard.set(t.color, t.special);
    this.bigCard.set(t.color, t.special);
    setText(this.typeName, t.label);
    this.type.setAttribute('aria-label', STAGE_TEXT.checkType(t.label, null));
  }

  /** The grid and the result's spot; the next tick puts every mark and the result back. */
  private layOut(check: CheckView, grid: string): void {
    const spot = plaqueSpot(check);
    setData(this.panel, 'plaque', spot.over);
    setVar(this.panel, '--plaque-at', String(spot.at));
    this.placeResult(check);
    this.buildGrid(check);
    this.gridShown = grid;
    this.shown = [];
    this.resultShown = null;
  }

  private buildGrid(check: CheckView): void {
    const rows = [...new Set(check.cells.map((c) => c.row))].sort((a, b) => a - b);
    this.cells = [];
    this.byStep = new Map();
    let deal = 0;
    const rowEls = rows.map((row) => {
      const cells = check.cells.filter((c) => c.row === row).sort((a, b) => a.col - b.col);
      const rowEl = h('div', { class: 'card-grid__row', data: { row: String(row) } });
      if (check.row !== null && row !== check.row) rowEl.classList.add('is-dimmed');
      for (const cell of cells) {
        const cover = new CoverArt('card-grid__cover');
        cover.set(cell.songId);
        const mark = h('span', { class: 'card-grid__mark', attrs: { 'aria-hidden': 'true' } });
        const eq =
          cell.step === null
            ? null
            : h('span', { class: 'card-grid__eq', attrs: { 'aria-hidden': 'true' } }, ...Array.from({ length: EQ_BARS }, () => h('span', 'card-grid__eq-bar')));
        const art = h('div', 'card-grid__art', cover.root, mark, eq);
        const root = h('figure', { class: 'card-grid__cell', data: { state: cell.step === null ? 'idle' : 'pending' } }, art, h('figcaption', 'card-grid__title', cell.title ?? ''));
        // Not revealed (yet): a song after the one that sank a standing claim fades once the card falls.
        root.classList.add('is-unchecked');
        root.style.setProperty('--deal-index', String(deal++));
        const nodes: CellNodes = { root, art, mark, cell, shownMark: null, liftedMark: null };
        this.cells.push(nodes);
        if (cell.step !== null) this.byStep.set(cell.step, nodes);
        rowEl.append(root);
      }
      return rowEl;
    });
    setData(this.grid, 'rows', String(rows.length));
    this.grid.replaceChildren(...rowEls);
    setHidden(this.grid, rowEls.length === 0);
  }

  tick(nowMs: number): void {
    const check = this.check;
    if (!check) return;
    const type = typeReveal(check, nowMs, STAGE.checkTypeLeadMs);
    if (type !== this.typeShown) {
      this.typeShown = type;
      setData(this.type, 'state', type ?? 'pending');
      setText(this.typeMark, type === 'ok' ? STAGE_TEXT.mark.ok : type === 'wrong' ? STAGE_TEXT.mark.bad : '');
      if (check.cardType) this.type.setAttribute('aria-label', STAGE_TEXT.checkType(check.cardType.label, type === 'pending' || type === null ? null : type === 'ok'));
    }
    const reveal = checkReveal(check, nowMs, STAGE.checkMarkAt);
    for (const [i, nodes] of this.byStep) {
      // A step past the revealed ones (not revealed yet, or taken off by a step back) waits again.
      const state: StepState = reveal.steps[i] ?? 'pending';
      const key = `${state}:${reveal.result ?? ''}`;
      if (this.shown[i] !== key) {
        this.shown[i] = key;
        // The mark means "good for the claim" (in a standing Check, a song that hasn't sounded); the label says what
        // happened to the song.
        const mark = stepMark(check.kind, state);
        nodes.liftedMark = mark === null ? nodes.shownMark : null;
        nodes.shownMark = mark;
        setData(nodes.root, 'state', state);
        setData(nodes.root, 'mark', mark);
        setText(nodes.mark, mark ? STAGE_TEXT.mark[mark] : '');
        nodes.root.classList.toggle('is-unchecked', i >= reveal.steps.length);
        nodes.root.setAttribute('aria-label', `${nodes.cell.title ?? ''} ${state === 'landed' ? STAGE_TEXT.markLabel.landed : state === 'missed' ? STAGE_TEXT.markLabel.missed : ''}`.trim());
      }
      setData(nodes.root, 'replay', reveal.replaying === i ? 'true' : null);
    }
    const result = reveal.result;
    if (result !== this.resultShown) {
      this.resultShown = result;
      setData(this.panel, 'result', result ?? 'pending');
      this.showResult(check, result);
    }
  }

  /** Across the card, where the result lands: away from the song that sank a fallen card, else the middle. */
  private placeResult(check: CheckView): void {
    const x = resultX(check);
    setData(this.panel, 'side', x < 0.5 ? 'left' : x > 0.5 ? 'right' : null);
    setVar(this.panel, '--plaque-x', String(x));
  }

  /**
   * The verdict: a valid card's plaque, or a failed card's big ✗ with the nino (and no text on screen). A fallen
   * card's sinking song is lifted above the scrim (`data-lifted`), and the sitting nino replaces the squashed one.
   */
  private showResult(check: CheckView, result: CheckVerdict | null): void {
    const failed = result !== null && isFailed(result);
    const fallen = result === 'fallen';
    this.placeResult(check);
    setHidden(this.result, result === null);
    setData(this.panel, 'verdict', result);
    setData(this.result, 'result', result);
    if (this.sticker) setHidden(this.sticker, !failed || (fallen && this.fallenSticker !== null));
    if (this.fallenSticker) setHidden(this.fallenSticker, !fallen);
    const sticker = fallen && this.fallenSticker ? 'nino-sentat' : failed && this.sticker ? 'nino-espatxarrat' : null;
    setData(this.result, 'sticker', sticker);
    setHidden(this.bigCard.root, !(failed && check.cardType?.ok === false));
    setHidden(this.resultTitle, failed);
    const miss = firstMiss(check);
    const sank = fallen && miss ? (this.byStep.get(miss.step) ?? null) : null;
    for (const nodes of this.cells) setData(nodes.root, 'lifted', nodes === sank ? 'true' : null);
    if (!result) return;
    const title = STAGE_TEXT.checkResult[result];
    setText(this.resultTitle, title);
    const detail = checkResultDetail(result, miss?.title ?? null);
    this.result.setAttribute('aria-label', detail ? `${title}. ${detail}` : title);
  }

  /** A step back: the mark that was on the cover lifts off (a copy of it, as the cell already waits again). */
  private liftMark(nodes: CellNodes, mark: string): void {
    const ghost = h('span', { class: 'card-grid__mark card-grid__mark--lift', data: { mark }, attrs: { 'aria-hidden': 'true' } }, STAGE_TEXT.mark[mark as keyof typeof STAGE_TEXT.mark] ?? '');
    nodes.art.append(ghost);
    setTimeout(() => ghost.remove(), STAGE.checkUnrevealMs);
  }

  onAnim(detail: AnimDetail): void {
    if (detail.name === 'check-enter') playAnim(this.panel, 'check-enter');
    else if (detail.name === 'check-unreveal') {
      const nodes = this.byStep.get(detail.index);
      if (nodes) {
        playAnim(nodes.root, 'check-unreveal');
        if (nodes.liftedMark) this.liftMark(nodes, nodes.liftedMark);
        nodes.liftedMark = null;
      }
    } else if (detail.name === 'check-review') playAnim(this.review, 'check-review');
    else if (detail.name === 'check-type') playAnim(this.type, 'check-type');
    else if (detail.name === 'check-step' && (detail.state === 'landed' || detail.state === 'missed')) {
      const nodes = this.byStep.get(detail.index);
      if (nodes) playAnim(nodes.root, 'check-step');
    } else if (detail.name === 'check-result') {
      playAnim(this.result, 'check-result');
      if (isFailed(detail.result)) playAnim(this.plate, 'check-result');
    } else if (detail.name === 'check-fallen') {
      // The plate shakes, the ✗ slams in, the song that sank the card pops above the scrim, the nino tumbles in.
      playAnim(this.result, 'check-fallen');
      playAnim(this.plate, 'check-fallen');
      for (const nodes of this.cells) if (nodes.root.dataset.lifted === 'true') playAnim(nodes.root, 'check-fallen');
    }
  }
}
