// After the Game: thanks, then the credits (`credits`): the sponsors, rolling slowly upward when they don't
// fit (static under reduced motion). No winning card numbers (the user's review): people only care when it's
// their own card, and their phone tells them.
import { STAGE } from '../config.ts';
import { creditsRollMs } from '../model/layout.ts';
import { STAGE_TEXT } from '../strings.ts';
import type { AfterView } from '../view.ts';
import { h, setData, setVar } from './dom.ts';
import { SponsorList } from './parts.ts';
import { sceneRoot, type SceneEnv, type SceneRenderer } from './scene.ts';

export class AfterScene implements SceneRenderer<AfterView> {
  readonly root = sceneRoot('after');
  private readonly env: SceneEnv;
  private readonly credits: HTMLElement;
  private readonly roll: HTMLElement;
  private readonly sponsors = new SponsorList(STAGE_TEXT.sponsorsTitle, 'after__sponsors');
  private key = '';
  private measured = false;

  constructor(env: SceneEnv) {
    this.env = env;
    this.roll = h('div', 'credits__roll', this.sponsors.root);
    this.credits = h('div', 'credits', this.roll);
    this.root.append(h('h1', { class: 'after__title', data: { anim: 'idle' } }, STAGE_TEXT.thanks), this.credits);
  }

  render(body: AfterView): void {
    const key = JSON.stringify(body);
    if (key === this.key) return;
    this.key = key;
    this.sponsors.set(body.sponsors);
    this.measured = false;
  }

  /** Measure once the credits are on screen (after the Game: no landing to protect), then roll if needed. */
  tick(): void {
    if (this.measured || this.root.hidden) return;
    this.measured = true;
    const rollMs = this.env.reducedMotion() ? 0 : creditsRollMs(this.roll.offsetHeight, this.credits.clientHeight, STAGE.creditsPxPerSec);
    setVar(this.credits, '--credits-ms', `${rollMs}ms`);
    setVar(this.credits, '--credits-from', `${this.credits.clientHeight}px`);
    setVar(this.credits, '--credits-to', `${-this.roll.offsetHeight}px`);
    setData(this.credits, 'anim', rollMs > 0 ? 'credits' : null);
  }
}
