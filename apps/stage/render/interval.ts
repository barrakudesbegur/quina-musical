// The Interval: the next round's name, its prizes in rotation (`interval-rotate`, every 8 s), a rough
// countdown (a guide: rounds start by hand), "Quina 4 de 12", the last round's winning card numbers, sponsor
// thanks in rotation, and the player app's QR.
import { STAGE } from '../config.ts';
import type { AnimDetail } from '../model/moments.ts';
import { rotationIndex } from '../model/timing.ts';
import { STAGE_TEXT } from '../strings.ts';
import type { IntervalView } from '../view.ts';
import { h, playAnim, setData, setHidden, setText } from './dom.ts';
import { CountdownChip, PrizeBlock, RoundTitle } from './parts.ts';
import { QrBlock } from './qr.ts';
import { sceneRoot, type SceneRenderer } from './scene.ts';

export class IntervalScene implements SceneRenderer<IntervalView> {
  readonly root = sceneRoot('interval');
  private readonly title = new RoundTitle('h1', 'interval__title');
  private readonly of: HTMLElement;
  private readonly countdown = new CountdownChip('back');
  private readonly rotator: HTMLElement;
  private readonly prize = new PrizeBlock('interval__prize');
  private readonly qr = new QrBlock();
  private readonly winners: HTMLElement;
  private readonly winnersTitle: HTMLElement;
  private readonly winnersList: HTMLElement;
  private readonly thanks: HTMLElement;
  private body: IntervalView | null = null;
  private prizeIndex = -1;
  private sponsorIndex = -1;

  constructor() {
    this.root.dataset.testid = 'interval';
    setData(this.title.root, 'anim', 'idle');
    this.of = h('p', 'interval__of');
    this.rotator = h('div', 'interval__rotator', this.prize.root);
    this.winnersTitle = h('h2', 'interval__winners-title');
    this.winnersList = h('ul', 'interval__winners-list');
    this.winners = h('section', { class: 'interval__winners', hidden: true }, this.winnersTitle, this.winnersList);
    this.thanks = h('p', { class: 'interval__thanks', hidden: true });
    this.root.append(
      h('header', 'interval__head', this.title.root, this.of, this.countdown.root),
      h('div', 'interval__main', this.rotator, this.qr.root),
      h('footer', 'interval__foot', this.winners, this.thanks),
    );
  }

  render(body: IntervalView): void {
    const changedRound = this.body?.nextRound.number !== body.nextRound.number;
    this.body = body;
    this.title.set(body.nextRound, STAGE_TEXT.nextRound);
    setText(this.of, body.roundsTotal ? STAGE_TEXT.roundOf(body.nextRound.number, body.roundsTotal) : '');
    setHidden(this.of, !body.roundsTotal);
    this.qr.set(body.link);
    setText(this.winnersTitle, STAGE_TEXT.lastWinners(body.lastRound));
    const lines = (['line', 'bingo'] as const)
      .map((kind) => ({ kind, ids: body.lastWinners.filter((w) => w.kind === kind).map((w) => w.cardId) }))
      .filter((l) => l.ids.length > 0);
    this.winnersList.replaceChildren(...lines.map((l) => h('li', { class: 'interval__winner', data: { kind: l.kind } }, STAGE_TEXT.winnerLine(l.kind, l.ids))));
    setHidden(this.winners, lines.length === 0);
    if (changedRound) {
      this.prizeIndex = -1;
      this.sponsorIndex = -1;
    }
  }

  tick(nowMs: number): void {
    const body = this.body;
    if (!body) return;
    const p = rotationIndex(nowMs, body.sinceMs, STAGE.prizeRotationMs, body.prizes.length);
    if (p !== this.prizeIndex) {
      this.prizeIndex = p;
      this.prize.set(body.prizes[p] ?? null);
    }
    const s = rotationIndex(nowMs, body.sinceMs, STAGE.sponsorRotationMs, body.sponsors.length);
    if (s !== this.sponsorIndex) {
      this.sponsorIndex = s;
      const sponsor = body.sponsors[s];
      setHidden(this.thanks, !sponsor);
      setText(this.thanks, sponsor ? STAGE_TEXT.sponsorThanks(sponsor.label) : '');
    }
    this.countdown.update(body.guideEndMs, nowMs, true);
  }

  onAnim(detail: AnimDetail): void {
    if (detail.name === 'interval-rotate') playAnim(this.rotator, 'interval-rotate');
  }
}
