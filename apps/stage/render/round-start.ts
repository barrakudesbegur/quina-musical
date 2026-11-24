// Round start: "Quina N" with its Line and Quina prizes while the presenters announce them; then the Shuffle
// (ANIMATIONS.md `shuffle`): every cover appears in a grid, the grid jiggles, the covers fly into the drum
// one by one in a random VISUAL order (never the Queue's: the stage doesn't know it), and the drum settles.
// The phases come from the engine's window on the show clock, so a late join starts mid-Shuffle.
import { STAGE } from '../config.ts';
import { coverFlights, shuffleLayout, shufflePhaseAt, shuffleSequence, type Flight, type ShufflePhase } from '../model/shuffle.ts';
import { STAGE_TEXT } from '../strings.ts';
import type { AnimDetail } from '../model/moments.ts';
import type { RoundStartView } from '../view.ts';
import { CoverArt, h, playAnim, setData, setHidden, setVar } from './dom.ts';
import { PrizeBlock, RoundTitle } from './parts.ts';
import { sceneRoot, type SceneEnv, type SceneRenderer } from './scene.ts';

/** The phases in which the grid covers the screen. */
const GRID_PHASES: ReadonlySet<ShufflePhase> = new Set(['appear', 'jiggle', 'fly']);

export class RoundStartScene implements SceneRenderer<RoundStartView> {
  readonly root = sceneRoot('roundStart');
  private readonly env: SceneEnv;
  private readonly intro: HTMLElement;
  private readonly title = new RoundTitle('h1', 'round-start__title');
  private readonly special: HTMLElement;
  private readonly prizes = [new PrizeBlock('round-start__prize'), new PrizeBlock('round-start__prize')];
  private readonly grid: HTMLElement;
  private readonly caption: HTMLElement;
  private body: RoundStartView | null = null;
  private shuffleKey: string | null = null;
  private tiles: HTMLElement[] = [];
  private flights: Flight[] = [];
  private phase: ShufflePhase | null = null;
  private launched = false;

  constructor(env: SceneEnv) {
    this.env = env;
    this.special = h('p', { class: 'round-start__rule', hidden: true }, STAGE_TEXT.specialRule);
    this.intro = h('div', 'round-start__intro', this.title.root, this.special, h('div', 'round-start__prizes', ...this.prizes.map((p) => p.root)));
    this.grid = h('div', { class: 'shuffle', hidden: true, attrs: { 'aria-hidden': 'true' } });
    this.caption = h('p', { class: 'shuffle__caption', hidden: true }, STAGE_TEXT.shuffling);
    this.root.append(this.intro, this.grid, this.caption);
  }

  render(body: RoundStartView): void {
    this.body = body;
    this.title.set(body.round);
    setHidden(this.special, !body.round?.special);
    this.prizes.forEach((block, i) => block.set(body.prizes[i] ?? null));
    const key = body.shuffle?.key ?? null;
    if (key !== this.shuffleKey) {
      this.shuffleKey = key;
      this.buildGrid(body);
    }
  }

  /** One tile per cover (by song id), with its flight to the drum's centre and its slot in the random order. */
  private buildGrid(body: RoundStartView): void {
    this.launched = false;
    this.phase = null;
    const shuffle = body.shuffle;
    if (!shuffle) {
      this.tiles = [];
      this.flights = [];
      this.grid.replaceChildren();
      return;
    }
    const ids: (number | null)[] = body.tiles.length ? body.tiles : Array.from({ length: STAGE.shuffle.fallbackTiles }, () => null);
    const band = STAGE.drumBand;
    const target = { x: STAGE.box.width / 2, y: band.top + band.height / 2 };
    const layout = shuffleLayout(ids.length, STAGE.shuffle.area, target);
    this.flights = coverFlights(shuffle, shuffleSequence(ids.length, this.env.random), STAGE.shuffle.perCoverMs);
    setVar(this.grid, '--appear-ms', `${Math.round(shuffle.jiggleAtMs - shuffle.startAtMs)}ms`);
    this.tiles = layout.map((t, i) => {
      const cover = new CoverArt('shuffle__cover');
      cover.set(ids[i]);
      const tile = h('div', 'shuffle__tile', h('div', 'shuffle__lift', h('div', 'shuffle__spin', cover.root)));
      tile.style.setProperty('--x', `${t.x}px`);
      tile.style.setProperty('--y', `${t.y}px`);
      tile.style.setProperty('--size', `${t.size}px`);
      tile.style.setProperty('--dx', `${t.dx}px`);
      tile.style.setProperty('--dy', `${t.dy}px`);
      tile.style.setProperty('--turn', `${Math.round((this.env.random() * 2 - 1) * 540)}deg`);
      tile.style.setProperty('--seed', this.env.random().toFixed(3));
      return tile;
    });
    this.grid.replaceChildren(...this.tiles);
  }

  tick(nowMs: number): void {
    const shuffle = this.body?.shuffle ?? null;
    const phase = shuffle ? shufflePhaseAt(shuffle, nowMs) : null;
    if (phase !== this.phase) {
      this.phase = phase;
      setData(this.root, 'phase', phase);
      setData(this.grid, 'phase', phase);
      const gridUp = phase !== null && GRID_PHASES.has(phase);
      setHidden(this.grid, !gridUp);
      setHidden(this.caption, !gridUp);
      setHidden(this.intro, gridUp);
    }
    if (phase === 'fly' && !this.launched) this.launch(nowMs);
  }

  /** Send every tile on its flight, timed from now (a late start begins mid-flight: negative delays). */
  private launch(nowMs: number): void {
    this.launched = true;
    const reduced = this.env.reducedMotion();
    this.tiles.forEach((tile, i) => {
      const f = this.flights[i];
      if (!f) return;
      tile.style.setProperty('--fly-delay', `${Math.round(f.startMs - nowMs)}ms`);
      tile.style.setProperty('--fly-ms', `${reduced ? 0 : f.durationMs}ms`);
    });
    void this.grid.offsetWidth;
    for (const tile of this.tiles) tile.classList.add('is-flying');
  }

  onAnim(detail: AnimDetail): void {
    if (detail.name === 'shuffle' && detail.phase === 'appear') playAnim(this.grid, 'shuffle');
  }
}
