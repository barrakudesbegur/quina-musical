// The Check: a slim ribbon "Comprovant el cartró N…" and the card's grid filling the rest of the screen. For a
// Line, the other rows dim. Each step's tile gets a ring while its snippet plays, then its mark (✓ or ✗); the
// result banner shows from `endAtMs`. Everything is read from the step timestamps (`checkReveal`).
import { STAGE } from '../config.ts';
import { checkReveal, type CheckCell, type CheckView, type StepState } from '../model/check.ts';
import type { AnimDetail } from '../model/moments.ts';
import { STAGE_TEXT } from '../strings.ts';
import type { CheckSceneView } from '../view.ts';
import { CoverArt, h, playAnim, setData, setHidden, setText } from './dom.ts';
import { sceneRoot, type SceneRenderer } from './scene.ts';

interface CellNodes {
  root: HTMLElement;
  mark: HTMLElement;
  cell: CheckCell;
}

export class CheckScene implements SceneRenderer<CheckSceneView> {
  readonly root = sceneRoot('check');
  private readonly panel: HTMLElement;
  private readonly ribbon: HTMLElement;
  private readonly grid: HTMLElement;
  private readonly result: HTMLElement;
  private check: CheckView | null = null;
  private cells: CellNodes[] = [];
  /** Cell nodes by step index. */
  private byStep = new Map<number, CellNodes>();
  private shown: StepState[] = [];
  private resultShown: string | null = null;

  constructor() {
    this.ribbon = h('h1', 'check__ribbon');
    this.grid = h('div', 'card-grid');
    this.result = h('p', { class: 'check-result', hidden: true, attrs: { 'aria-live': 'assertive' } });
    this.panel = h('div', 'check', this.ribbon, this.grid, this.result);
    this.root.append(this.panel);
  }

  render(body: CheckSceneView): void {
    const check = body.check;
    if (check.key === this.check?.key) {
      this.check = check;
      return;
    }
    this.check = check;
    setText(this.ribbon, STAGE_TEXT.checking(check.cardId));
    setData(this.panel, 'kind', check.kind);
    setData(this.panel, 'verdict', null);
    this.buildGrid(check);
    this.shown = [];
    this.resultShown = null;
    setHidden(this.result, true);
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
        const root = h('figure', { class: 'card-grid__cell', data: { state: cell.step === null ? 'idle' : 'pending' } }, cover.root, mark, h('figcaption', 'card-grid__title', cell.title ?? ''));
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
      setHidden(this.result, result === null);
      setData(this.panel, 'verdict', result);
      setData(this.result, 'result', result);
      if (result) setText(this.result, STAGE_TEXT.checkResult[result]);
    }
  }

  onAnim(detail: AnimDetail): void {
    if (detail.name === 'check-enter') playAnim(this.panel, 'check-enter');
    else if (detail.name === 'check-step' && (detail.state === 'landed' || detail.state === 'missed')) {
      const nodes = this.byStep.get(detail.index);
      if (nodes) playAnim(nodes.root, 'check-step');
    } else if (detail.name === 'check-result') playAnim(this.result, 'check-result');
  }
}
