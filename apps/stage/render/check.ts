// The Check: an orange ribbon with notched tails, "Comprovant el cartró N…" and the kind's pill, over the
// card's covers floating on the night background with their titles (no boxes). For a Line, the other rows dim.
// Each step's cover gets a ring while its snippet plays, then its mark (✓ or ✗); the result plaque shows from
// `endAtMs`. A failed Check turns the ribbon slate ("Cartró N") and its plaque names the first song that
// didn't sound. Everything is read from the step timestamps (`checkReveal`) and the pure rules in model/check.ts.
import { STAGE } from '../config.ts';
import { checkReveal, firstMiss, gridKey, isFailed, plaqueSpot, type CheckCell, type CheckVerdict, type CheckView, type StepState } from '../model/check.ts';
import type { AnimDetail } from '../model/moments.ts';
import { checkKindLabel, checkResultDetail, STAGE_TEXT } from '../strings.ts';
import type { CheckSceneView } from '../view.ts';
import { CoverArt, h, playAnim, setData, setHidden, setText, setVar } from './dom.ts';
import { sceneRoot, type SceneRenderer } from './scene.ts';

interface CellNodes {
  root: HTMLElement;
  mark: HTMLElement;
  cell: CheckCell;
}

/** Bars of the "playing" badge (their heights are the theme's). */
const EQ_BARS = 4;

export class CheckScene implements SceneRenderer<CheckSceneView> {
  readonly root = sceneRoot('check');
  private readonly panel: HTMLElement;
  private readonly ribbon: HTMLElement;
  private readonly heading: HTMLElement;
  private readonly pill: HTMLElement;
  private readonly grid: HTMLElement;
  private readonly result: HTMLElement;
  private readonly resultTitle: HTMLElement;
  private readonly resultDetail: HTMLElement;
  /** The nino on a failed Check's plaque; null while the stage has no sticker for it (STAGE.stickers). */
  private readonly sticker: HTMLImageElement | null;
  private check: CheckView | null = null;
  private cells: CellNodes[] = [];
  /** Cell nodes by step index. */
  private byStep = new Map<number, CellNodes>();
  private shown: StepState[] = [];
  private resultShown: CheckVerdict | null = null;
  /** `gridKey` of the drawn grid. */
  private gridShown = '';

  constructor() {
    this.heading = h('h1', 'check__heading');
    this.pill = h('span', 'check__pill');
    this.ribbon = h('header', 'check__ribbon', h('div', 'check__band', this.heading, this.pill));
    // The failed Check's shake plays once: a scene shown again would otherwise restart it.
    this.ribbon.addEventListener('animationend', (e) => {
      if (e.target === this.ribbon) setData(this.ribbon, 'anim', null);
    });
    this.grid = h('div', 'card-grid');
    this.resultTitle = h('p', 'check-result__title');
    this.resultDetail = h('p', 'check-result__detail');
    const stickerUrl = STAGE.stickers.checkFailed;
    this.sticker = stickerUrl
      ? h('img', { class: 'check-result__sticker', data: { sticker: 'nino-espatxarrat' }, attrs: { src: stickerUrl, alt: '', decoding: 'async', draggable: 'false' }, hidden: true })
      : null;
    this.result = h(
      'div',
      { class: 'check-result', hidden: true, attrs: { role: 'status', 'aria-live': 'assertive' } },
      this.sticker,
      this.resultTitle,
      this.resultDetail,
    );
    const scrim = h('div', { class: 'check__scrim', attrs: { 'aria-hidden': 'true' } });
    this.panel = h('div', 'check', this.ribbon, h('div', 'check__card', this.grid, this.result), scrim);
    this.root.append(this.panel);
  }

  render(body: CheckSceneView): void {
    const check = body.check;
    const sameCheck = check.key === this.check?.key;
    const grid = gridKey(check.cells);
    this.check = check;
    if (sameCheck) {
      // The same Check, but the catalog may have arrived since: redraw the grid (no entrance replayed).
      if (grid !== this.gridShown) this.layOut(check, grid);
      return;
    }
    setText(this.heading, STAGE_TEXT.checking(check.cardId));
    setText(this.pill, checkKindLabel(check.kind, check.row));
    setData(this.panel, 'kind', check.kind);
    setData(this.panel, 'verdict', null);
    setData(this.ribbon, 'anim', null);
    setHidden(this.result, true);
    this.layOut(check, grid);
  }

  /** The grid and the plaque's spot; the next tick puts every mark and the result back. */
  private layOut(check: CheckView, grid: string): void {
    const spot = plaqueSpot(check);
    setData(this.panel, 'plaque', spot.over);
    setVar(this.panel, '--plaque-at', String(spot.at));
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
        root.style.setProperty('--deal-index', String(deal++));
        const nodes = { root, mark, cell };
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
    const reveal = checkReveal(check, nowMs, STAGE.checkMarkAt);
    reveal.steps.forEach((state, i) => {
      if (this.shown[i] === state) return;
      this.shown[i] = state;
      const nodes = this.byStep.get(i);
      if (!nodes) return;
      setData(nodes.root, 'state', state);
      setText(nodes.mark, state === 'landed' ? STAGE_TEXT.mark.landed : state === 'missed' ? STAGE_TEXT.mark.missed : '');
      nodes.root.setAttribute('aria-label', `${nodes.cell.title ?? ''} ${state === 'landed' ? STAGE_TEXT.markLabel.landed : state === 'missed' ? STAGE_TEXT.markLabel.missed : ''}`.trim());
    });
    const result = reveal.result;
    if (result !== this.resultShown) {
      this.resultShown = result;
      this.showResult(check, result);
    }
  }

  /** The verdict: a failed one turns the ribbon slate and names the missing song; a valid one keeps it. */
  private showResult(check: CheckView, result: CheckVerdict | null): void {
    const failed = result !== null && isFailed(result);
    setHidden(this.result, result === null);
    setData(this.panel, 'verdict', result);
    setData(this.result, 'result', result);
    setText(this.heading, failed ? STAGE_TEXT.checkedCard(check.cardId) : STAGE_TEXT.checking(check.cardId));
    if (this.sticker) setHidden(this.sticker, !failed);
    setData(this.result, 'sticker', failed && this.sticker ? 'nino-espatxarrat' : null);
    if (!result) return;
    setText(this.resultTitle, STAGE_TEXT.checkResult[result]);
    const detail = checkResultDetail(result, firstMiss(check)?.title ?? null);
    setText(this.resultDetail, detail ?? '');
    setHidden(this.resultDetail, detail === null);
  }

  onAnim(detail: AnimDetail): void {
    if (detail.name === 'check-enter') playAnim(this.panel, 'check-enter');
    else if (detail.name === 'check-step' && (detail.state === 'landed' || detail.state === 'missed')) {
      const nodes = this.byStep.get(detail.index);
      if (nodes) playAnim(nodes.root, 'check-step');
    } else if (detail.name === 'check-result') {
      playAnim(this.result, 'check-result');
      if (isFailed(detail.result)) playAnim(this.ribbon, 'check-result');
    }
  }
}
