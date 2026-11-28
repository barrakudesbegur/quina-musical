// The Celebration: "LÍNIA!" or "QUINA!" huge and tilted over the drum's victory lap (never the winning card numbers),
// the round's name on its gold plate under it (U175 item 7), no prize (none on the projector for now, D311), a flash,
// rays, the slow paper confetti raining (D185) and four ninos bouncing in at the corners (ANIMATIONS.md `celebrate`;
// board Projector-Linia). The Desgraciat round's last one standing gets «QUINA POTRA!» (D186, amending D62; board
// Projector-Desgraciat-Potra): the green title, the gold «Quina del Desgraciat» plate under it, green rays and three
// ninos around it. Each kind's ninos come from its own pool
// (`STAGE.stickers.celebration`). The scene itself moves on to play (Line) or the Interval (Bingo, last standing) when the engine's
// scene changes. The Heat garland comes along across the top in the `win` pattern: the party colours, a burst of light
// running along the string, flames when very hot (#84, D-t; ANIMATIONS.md `celebrate` ⑦).
import { STAGE } from '../config.ts';
import type { GarlandLook } from '../model/garland.ts';
import type { AnimDetail } from '../model/moments.ts';
import { runPaperConfetti } from '../../../packages/ui/motion/paper-confetti.ts';
import { paperCount } from '../model/layout.ts';
import { STAGE_TEXT } from '../strings.ts';
import type { WinKind } from '../../../packages/ui/flow.ts';
import type { CelebrationView } from '../view.ts';
import { h, playAnim, setData, setHidden, setText } from './dom.ts';
import { Garland } from './garland.ts';
import { stickerImage } from './parts.ts';
import '../../../packages/ui/components/sticker.css';
import '../../../packages/ui/components/particles.css';
import { ninosFor } from '../../../packages/ui/concepts.ts';
import { setNino } from '../../../packages/ui/components/nino-dom.ts';
import { sceneRoot, type SceneEnv, type SceneRenderer } from './scene.ts';

/** The corners the ninos stand in, by kind («QUINA POTRA!»'s three, as its board draws them; its prize took the bottom
 * right, none on the projector for now, D311; its layout waits on D310's board). */
const SPOTS = ['topLeft', 'topRight', 'bottomLeft', 'bottomRight'] as const;
const SPOTS_OF: Record<WinKind, readonly (typeof SPOTS)[number][]> = {
  line: SPOTS,
  bingo: SPOTS,
  standing: ['topLeft', 'topRight', 'bottomLeft'],
};

/** A small number from a string key, the same for the same key. */
function seedOf(key: string): number {
  let n = 0;
  for (const ch of key) n = (n * 31 + ch.charCodeAt(0)) % 9973;
  return n;
}

export class CelebrationScene implements SceneRenderer<CelebrationView> {
  readonly root = sceneRoot('celebration');
  private readonly env: SceneEnv;
  /** Carries the `celebrate` hook (the scene root carries `scene-enter`). */
  private readonly stagePanel: HTMLElement;
  private readonly garland: Garland;
  /** The paper rain (D185), on one canvas. */
  private readonly paper: HTMLCanvasElement;
  private stopPaper: (() => void) | null = null;
  /** G3's rays: gold, the Desgraciat's last one standing in live green. */
  private readonly rays = h('div', { class: 'ds-rays celebration__rays', data: { color: 'gold' }, attrs: { 'aria-hidden': 'true' } });
  private readonly shout: HTMLElement;
  /** The round's name under the shout: «QUINA 3», «QUINA DEL DESGRACIAT». */
  private readonly roundPlate: HTMLElement;
  /** The ninos at the corners, one per spot, each shown when its kind stands there and has a pool. */
  private readonly stickers: HTMLImageElement[];
  private key: string | null = null;

  constructor(env: SceneEnv) {
    this.env = env;
    this.garland = new Garland(STAGE.garland, env.random);
    this.paper = h('canvas', { class: 'celebration__paper', attrs: { 'aria-hidden': 'true' } });
    this.shout = h('h1', 'shout');
    // G2's plate, gold: the round's name is always gold (U175 item 7; it was orange).
    this.roundPlate = h('p', { class: 'plate celebration__round', data: { color: 'gold' } });
    this.stickers = SPOTS.map((spot) => {
      const img = stickerImage('lineCelebration', `celebration__sticker celebration__sticker--${spot}`) as HTMLImageElement;
      img.dataset.spot = spot;
      img.hidden = true;
      return img;
    });
    this.stagePanel = h(
      'div',
      'celebration',
      h('div', { class: 'celebration__flash', attrs: { 'aria-hidden': 'true' } }),
      this.rays,
      this.paper,
      this.shout,
      this.roundPlate,
      ...this.stickers,
    );
    this.stagePanel.dataset.testid = 'celebration';
    this.root.append(this.stagePanel, this.garland.root);
  }

  render(body: CelebrationView): void {
    setData(this.stagePanel, 'kind', body.kind);
    setData(this.rays, 'color', body.kind === 'standing' ? 'live' : 'gold');
    const shout = STAGE_TEXT.shout[body.kind];
    setText(this.shout, shout ?? '');
    setHidden(this.shout, shout === null);
    setText(this.roundPlate, body.round.label);
    // The kind's ninos at its corners, different ones each Celebration (its key); none without a pool.
    const moment = STAGE.stickers.celebration[body.kind];
    const spots = moment ? this.stickers.filter((img) => SPOTS_OF[body.kind].includes(img.dataset.spot as (typeof SPOTS)[number])) : [];
    const poses = moment ? ninosFor(moment, seedOf(body.key), spots.length) : [];
    for (const img of this.stickers) {
      const i = spots.indexOf(img);
      setHidden(img, i < 0 || i >= poses.length);
      if (i >= 0 && i < poses.length) setNino(img, { pose: poses[i] });
    }
    if (body.key !== this.key) {
      this.key = body.key;
      this.stopPaper?.();
      this.stopPaper = null;
      // None with reduced motion: the title appears.
      if (!this.env.reducedMotion()) {
        const rain = STAGE.confetti[body.kind];
        const paper = STAGE.paper;
        this.stopPaper = runPaperConfetti(
          this.paper,
          { count: paperCount(rain.count, this.paper.clientWidth, STAGE.box.width), colors: paper.colors, origin: rain.origin, spread: rain.spread, fallShare: paper.fallShare, size: paper.size, random: this.env.random },
          rain.durationMs,
          paper.outline,
        );
      }
    }
  }

  tick(): void {}

  /** The Heat's look in the `win` pattern (the controller paints it with the Heat, `garlandLook(…, 'win')`). */
  paintHeat(look: GarlandLook): void {
    this.garland.paint(look);
  }

  onAnim(detail: AnimDetail): void {
    if (detail.name === 'celebrate') playAnim(this.stagePanel, 'celebrate');
  }
}
