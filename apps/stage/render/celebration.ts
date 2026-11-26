// The Celebration: "LÍNIA!" or "QUINA!" huge over the drum's victory lap (never the winning card numbers), the
// round's prize and sponsor, a flash, rays and the slow paper confetti raining (D185; ANIMATIONS.md `celebrate`). The
// Desgraciat round's last one standing gets «QUINA POTRA!» (D186, amending D62; board Projector-Desgraciat-Dempeus):
// the green title tilted, the orange «Quina Desgraciada» plate under it, the prize on paper, green rays and three ninos
// around it. The scene itself moves on to play (Line) or the Interval (Bingo, last standing) when the engine's scene
// changes.
import { STAGE } from '../config.ts';
import type { AnimDetail } from '../model/moments.ts';
import { runPaperConfetti } from '../../../packages/ui/motion/paper-confetti.ts';
import { STAGE_TEXT } from '../strings.ts';
import type { CelebrationView } from '../view.ts';
import { h, playAnim, setData, setHidden, setText } from './dom.ts';
import { PrizeBlock, stickerImage } from './parts.ts';
import { sceneRoot, type SceneEnv, type SceneRenderer } from './scene.ts';

export class CelebrationScene implements SceneRenderer<CelebrationView> {
  readonly root = sceneRoot('celebration');
  private readonly env: SceneEnv;
  /** Carries the `celebrate` hook (the scene root carries `scene-enter`). */
  private readonly stagePanel: HTMLElement;
  /** The paper rain (D185), on one canvas. */
  private readonly paper: HTMLCanvasElement;
  private stopPaper: (() => void) | null = null;
  private readonly shout: HTMLElement;
  /** «Quina Desgraciada», under «QUINA POTRA!». */
  private readonly roundPlate: HTMLElement;
  private readonly prize = new PrizeBlock('celebration__prize');
  /** The last one standing's ninos around the title (left out when the stage has no sticker for a spot). */
  private readonly stickers: HTMLImageElement[];
  private key: string | null = null;

  constructor(env: SceneEnv) {
    this.env = env;
    this.paper = h('canvas', { class: 'celebration__paper', attrs: { 'aria-hidden': 'true' } });
    this.shout = h('h1', 'shout');
    this.roundPlate = h('p', { class: 'celebration__round', hidden: true }, STAGE_TEXT.desgraciatRoundName);
    const spots = STAGE.finale.celebration.stickers;
    this.stickers = (['topLeft', 'topRight', 'bottomLeft'] as const).flatMap((spot) => {
      const img = stickerImage(spots[spot], spot, `celebration__sticker celebration__sticker--${spot}`);
      if (img) img.hidden = true;
      return img ? [img] : [];
    });
    this.stagePanel = h(
      'div',
      'celebration',
      h('div', { class: 'celebration__flash', attrs: { 'aria-hidden': 'true' } }),
      h('div', { class: 'celebration__rays', attrs: { 'aria-hidden': 'true' } }),
      this.paper,
      this.shout,
      this.roundPlate,
      this.prize.root,
      ...this.stickers,
    );
    this.stagePanel.dataset.testid = 'celebration';
    this.root.append(this.stagePanel);
  }

  render(body: CelebrationView): void {
    const standing = body.kind === 'standing';
    setData(this.stagePanel, 'kind', body.kind);
    const shout = STAGE_TEXT.shout[body.kind];
    setText(this.shout, shout ?? '');
    setHidden(this.shout, shout === null);
    setHidden(this.roundPlate, !standing);
    for (const sticker of this.stickers) setHidden(sticker, !standing);
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

  onAnim(detail: AnimDetail): void {
    if (detail.name === 'celebrate') playAnim(this.stagePanel, 'celebrate');
  }
}
