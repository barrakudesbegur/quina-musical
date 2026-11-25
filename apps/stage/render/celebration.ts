// The Celebration: "LÍNIA!" or "QUINA!" huge over the drum's victory lap (never the winning card numbers), the
// round's prize and sponsor, a flash, rays and CSS confetti (ANIMATIONS.md `celebrate`). The Desgraciat round's last
// card standing gets no title (the user, U6): the Bingo's gold flash, double confetti and prize, and the hands-up nino
// bouncing in. The scene itself moves on to play (Line) or the Interval (Bingo, last standing) when the engine's
// scene changes.
import { STAGE } from '../config.ts';
import { confettiPieces } from '../model/confetti.ts';
import type { AnimDetail } from '../model/moments.ts';
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
  private readonly confetti: HTMLElement;
  private readonly shout: HTMLElement;
  private readonly prize = new PrizeBlock('celebration__prize');
  /** The hands-up nino, for the last card standing (null while the stage has no sticker for it). */
  private readonly standUp: HTMLImageElement | null;
  private key: string | null = null;

  constructor(env: SceneEnv) {
    this.env = env;
    this.confetti = h('div', { class: 'confetti', attrs: { 'aria-hidden': 'true' } });
    this.shout = h('h1', 'shout');
    this.standUp = stickerImage(STAGE.stickers.standUp, 'nino-mans-adalt', 'celebration__sticker');
    if (this.standUp) this.standUp.hidden = true;
    this.stagePanel = h(
      'div',
      'celebration',
      h('div', { class: 'celebration__flash', attrs: { 'aria-hidden': 'true' } }),
      h('div', { class: 'celebration__rays', attrs: { 'aria-hidden': 'true' } }),
      this.confetti,
      this.shout,
      this.prize.root,
      this.standUp,
    );
    this.stagePanel.dataset.testid = 'celebration';
    this.root.append(this.stagePanel);
  }

  render(body: CelebrationView): void {
    setData(this.stagePanel, 'kind', body.kind);
    const shout = STAGE_TEXT.shout[body.kind];
    setText(this.shout, shout ?? '');
    setHidden(this.shout, shout === null);
    if (this.standUp) setHidden(this.standUp, body.kind !== 'standing');
    this.prize.set(body.prize);
    if (body.key !== this.key) {
      this.key = body.key;
      // The last card standing ends its round like a Bingo, so it gets the Bingo's confetti.
      this.buildConfetti(body.kind === 'line' ? STAGE.confetti.line : STAGE.confetti.bingo);
    }
  }

  private buildConfetti(bursts: readonly number[]): void {
    const pieces = this.env.reducedMotion() ? [] : confettiPieces(bursts, STAGE.confetti.tones, this.env.random);
    this.confetti.replaceChildren(
      ...pieces.map((p) => {
        const piece = h('span', { class: 'confetti__piece', data: { tone: String(p.tone), burst: String(p.burst) } });
        piece.style.setProperty('--x', p.x.toFixed(3));
        piece.style.setProperty('--delay', p.delay.toFixed(3));
        piece.style.setProperty('--drift', p.drift.toFixed(3));
        piece.style.setProperty('--turn', p.turn.toFixed(3));
        piece.style.setProperty('--size', p.size.toFixed(3));
        return piece;
      }),
    );
  }

  tick(): void {}

  onAnim(detail: AnimDetail): void {
    if (detail.name === 'celebrate') playAnim(this.stagePanel, 'celebrate');
  }
}
