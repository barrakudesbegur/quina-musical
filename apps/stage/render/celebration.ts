// The Celebration: "LÍNIA!" or "QUINA!" huge over the drum's victory lap (never the winning card numbers), the
// round's prize and sponsor (a Quina's only: a Line's shows none for now, D242), a flash, rays and the slow paper confetti
// raining (D185; ANIMATIONS.md `celebrate`). The
// Desgraciat round's last one standing gets «QUINA POTRA!» (D186, amending D62; board Projector-Desgraciat-Dempeus):
// the green title tilted, the gold «Quina del Desgraciat» plate under it, the prize on paper, green rays and three
// ninos around it. The scene itself moves on to play (Line) or the Interval (Bingo, last standing) when the engine's
// scene changes. The Heat garland comes along across the top in the `win` pattern: the party colours, a burst of light
// running along the string, flames when very hot (#84, D-t; ANIMATIONS.md `celebrate` ⑦).
import { STAGE } from '../config.ts';
import type { GarlandLook } from '../model/garland.ts';
import type { AnimDetail } from '../model/moments.ts';
import { runPaperConfetti } from '../../../packages/ui/motion/paper-confetti.ts';
import { STAGE_TEXT } from '../strings.ts';
import type { CelebrationView } from '../view.ts';
import { h, playAnim, setData, setHidden, setText } from './dom.ts';
import { Garland } from './garland.ts';
import { PrizeBlock, stickerImage } from './parts.ts';
import '../../../packages/ui/components/sticker.css';
import '../../../packages/ui/components/particles.css';
import { ninosFor } from '../../../packages/ui/concepts.ts';
import { setNino } from '../../../packages/ui/components/nino-dom.ts';
import { sceneRoot, type SceneEnv, type SceneRenderer } from './scene.ts';

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
  /** «Quina del Desgraciat», under «QUINA POTRA!». */
  private readonly roundPlate: HTMLElement;
  private readonly prize = new PrizeBlock('celebration__prize');
  /** The last one standing's ninos around the title (left out when the stage has no sticker for a spot). */
  private readonly stickers: HTMLImageElement[];
  private key: string | null = null;

  constructor(env: SceneEnv) {
    this.env = env;
    this.garland = new Garland(STAGE.garland, env.random);
    this.paper = h('canvas', { class: 'celebration__paper', attrs: { 'aria-hidden': 'true' } });
    this.shout = h('h1', 'shout');
    // G2's plate, gold: the round's name is always gold (U175 item 7; it was orange).
    this.roundPlate = h('p', { class: 'plate celebration__round', hidden: true, data: { color: 'gold' } }, STAGE_TEXT.desgraciatRoundName);
    const moment = STAGE.finale.celebration.stickers;
    this.stickers = (['topLeft', 'topRight', 'bottomLeft'] as const).flatMap((spot) => {
      const img = stickerImage(moment, `celebration__sticker celebration__sticker--${spot}`);
      if (img) img.hidden = true;
      return img ? [img] : [];
    });
    this.stagePanel = h(
      'div',
      'celebration',
      h('div', { class: 'celebration__flash', attrs: { 'aria-hidden': 'true' } }),
      this.rays,
      this.paper,
      this.shout,
      this.roundPlate,
      this.prize.root,
      ...this.stickers,
    );
    this.stagePanel.dataset.testid = 'celebration';
    this.root.append(this.stagePanel, this.garland.root);
  }

  render(body: CelebrationView): void {
    const standing = body.kind === 'standing';
    setData(this.stagePanel, 'kind', body.kind);
    setData(this.rays, 'color', body.kind === 'standing' ? 'live' : 'gold');
    const shout = STAGE_TEXT.shout[body.kind];
    setText(this.shout, shout ?? '');
    setHidden(this.shout, shout === null);
    setHidden(this.roundPlate, !standing);
    for (const sticker of this.stickers) setHidden(sticker, !standing);
    const moment = STAGE.finale.celebration.stickers;
    if (standing && moment) {
      // Three different ninos round the title, a different set each night's key (NINO_FOR.lastStanding).
      const poses = ninosFor(moment, seedOf(body.key), this.stickers.length);
      this.stickers.forEach((img, i) => setNino(img, { pose: poses[i % poses.length] }));
    }
    this.prize.set(body.prize);
    if (body.key !== this.key) {
      this.key = body.key;
      this.stopPaper?.();
      this.stopPaper = null;
      // None with reduced motion: the title and the prize appear.
      if (!this.env.reducedMotion()) {
        const rain = STAGE.confetti[body.kind];
        const paper = STAGE.paper;
        this.stopPaper = runPaperConfetti(
          this.paper,
          { count: rain.count, colors: paper.colors, origin: rain.origin, spread: rain.spread, fallShare: paper.fallShare, size: paper.size, random: this.env.random },
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
