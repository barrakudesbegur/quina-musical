// Before the Game: "Quina Musical", how to play in 3 lines, the player app's QR, the sponsors and a rough
// countdown to the planned start.
import type { BeforeView, StageView } from '../view.ts';
import { STAGE_TEXT } from '../strings.ts';
import { h, setData, setText } from './dom.ts';
import { CountdownChip, SponsorList } from './parts.ts';
import { QrBlock } from './qr.ts';
import { sceneRoot, type SceneRenderer } from './scene.ts';

export class BeforeScene implements SceneRenderer<BeforeView> {
  readonly root = sceneRoot('before');
  private readonly title: HTMLElement;
  private readonly countdown = new CountdownChip('start');
  private readonly qr = new QrBlock();
  private readonly sponsors = new SponsorList(STAGE_TEXT.sponsorsTitle, 'before__sponsors');
  private body: BeforeView | null = null;

  constructor() {
    this.title = h('h1', { class: 'before__title', data: { anim: 'idle' } });
    const howTo = h(
      'section',
      'how-to',
      h('h2', 'how-to__title', STAGE_TEXT.howToPlayTitle),
      h('ol', 'how-to__steps', ...STAGE_TEXT.howToPlay.map((line) => h('li', 'how-to__step', line))),
    );
    this.root.append(h('header', 'before__head', this.title, this.countdown.root), h('div', 'before__main', howTo, this.qr.root), this.sponsors.root);
  }

  render(body: BeforeView, view: StageView): void {
    this.body = body;
    setText(this.title, view.title);
    setData(this.title, 'anim', 'idle');
    this.qr.set(body.link);
    this.sponsors.set(body.sponsors);
  }

  tick(nowMs: number): void {
    this.countdown.update(this.body?.startAtMs ?? null, nowMs, false);
  }
}
