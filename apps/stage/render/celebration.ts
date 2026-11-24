// The Celebration: "LÍNIA!" or "QUINA!" huge over the drum's victory lap, the winning card number(s), the
// round's prize and sponsor, a flash, rays and CSS confetti (ANIMATIONS.md `celebrate`). The scene itself
// moves on to play (Line) or the Interval (Bingo) when the engine's scene changes.
import { STAGE } from '../config.ts';
import { confettiPieces } from '../model/confetti.ts';
import type { AnimDetail } from '../model/moments.ts';
import { STAGE_TEXT } from '../strings.ts';
import type { CelebrationView } from '../view.ts';
import { h, playAnim, setData, setText } from './dom.ts';
import { PrizeBlock } from './parts.ts';
import { sceneRoot, type SceneEnv, type SceneRenderer } from './scene.ts';

export class CelebrationScene implements SceneRenderer<CelebrationView> {
  readonly root = sceneRoot('celebration');
  private readonly env: SceneEnv;
  /** Carries the `celebrate` hook (the scene root carries `scene-enter`). */
  private readonly stagePanel: HTMLElement;
  private readonly confetti: HTMLElement;
  private readonly shout: HTMLElement;
  private readonly prize = new PrizeBlock('celebration__prize');
  private key: string | null = null;

  constructor(env: SceneEnv) {
    this.env = env;
    this.confetti = h('div', { class: 'confetti', attrs: { 'aria-hidden': 'true' } });
    this.shout = h('h1', 'shout');
    this.stagePanel = h(
      'div',
      'celebration',
      h('div', { class: 'celebration__flash', attrs: { 'aria-hidden': 'true' } }),
      h('div', { class: 'celebration__rays', attrs: { 'aria-hidden': 'true' } }),
      this.confetti,
      this.shout,
      this.prize.root,
    );
    this.stagePanel.dataset.testid = 'celebration';
    this.root.append(this.stagePanel);
  }

  render(body: CelebrationView): void {
    setData(this.stagePanel, 'kind', body.kind);
    setText(this.shout, STAGE_TEXT.shout[body.kind]);
    this.prize.set(body.prize);
    if (body.key !== this.key) {
      this.key = body.key;
      this.buildConfetti(body.kind === 'bingo' ? STAGE.confetti.bingo : STAGE.confetti.line);
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
