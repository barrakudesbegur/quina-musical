// In play: the drum owns the screen (its band is the top ~60 %, edge to edge). Under it, the current song's
// big title, then the last 3 songs in one row. "Quina N" and the Heat garland stay small at the edges.
// No QR or URL here. A song is named only from its landing time (`visibleSongs`). In the Desgraciat's finale the drum's
// band is smaller and the last-3 row gives way to the finalists' stage (render/finale.ts).
import { STAGE } from '../config.ts';
import type { GarlandLook } from '../model/garland.ts';
import type { AnimDetail } from '../model/moments.ts';
import { breathPeriodMs, motionAt, type MotionPhase } from '../model/motion.ts';
import { songsKey, visibleSongs, type StageSong } from '../model/songs.ts';
import { STAGE_TEXT } from '../strings.ts';
import type { PlayView, StageView } from '../view.ts';
import { h, playAnim, setData, setHidden, setText, setVar } from './dom.ts';
import { Garland } from './garland.ts';
import { FinaleStage } from './finale.ts';
import { RoundTitle, SongTile } from './parts.ts';
import { sceneRoot, type SceneEnv, type SceneRenderer } from './scene.ts';

export class PlayScene implements SceneRenderer<PlayView> {
  readonly root = sceneRoot('play');
  private readonly round = new RoundTitle('p', 'play__round');
  private readonly garland: Garland;
  private readonly now: HTMLElement;
  private readonly title: HTMLElement;
  private readonly artist: HTMLElement;
  private readonly suspense: HTMLElement;
  private readonly recent: HTMLElement;
  private readonly tiles: SongTile[];
  private readonly finale: FinaleStage;
  /** The drum's band (test hook `drum`, with the landed song's id). */
  private band!: HTMLElement;
  private songs: StageSong[] = [];
  private body: PlayView | null = null;
  private shownKey: string | null = null;
  private motion: MotionPhase = 'idle';
  private breathMs = 0;

  constructor(env: SceneEnv) {
    this.garland = new Garland(STAGE.garlandLights, env.random);
    this.title = h('p', 'play__title');
    this.artist = h('p', 'play__artist');
    this.now = h('div', { class: 'play__now', attrs: { 'aria-live': 'polite' } }, this.title, this.artist);
    this.suspense = h('p', { class: 'play__suspense', hidden: true, attrs: { 'aria-hidden': 'true' } }, STAGE_TEXT.suspense);
    this.tiles = Array.from({ length: STAGE.recentSongs }, () => new SongTile('li'));
    this.recent = h('ol', 'play__recent', ...this.tiles.map((t) => t.root));
    const band = h('div', { class: 'play__band', data: { testid: 'drum', landedId: '' } }, this.now, this.suspense);
    this.band = band;
    this.finale = new FinaleStage(env);
    this.root.append(this.finale.root, this.garland.root, this.round.root, band, this.recent);
  }

  render(body: PlayView, view: StageView): void {
    this.body = body;
    this.songs = view.songs;
    this.round.set(body.round);
    setData(this.root, 'finale', body.finale ? 'on' : null);
    this.finale.render(body.finale);
  }

  tick(nowMs: number): void {
    const visible = visibleSongs(this.songs, nowMs, STAGE.recentSongs);
    const key = songsKey(visible);
    if (key !== this.shownKey) {
      this.shownKey = key;
      const current = visible[0] ?? null;
      setData(this.band, 'landedId', current ? String(current.songId) : '');
      setText(this.title, current?.title ?? '');
      setText(this.artist, current?.artist ?? '');
      setHidden(this.now, current === null);
      this.tiles.forEach((tile, i) => tile.set(visible[i] ?? null));
    }
    this.setMotion(motionAt(this.body?.motion ?? null, nowMs), nowMs);
    this.finale.tick(nowMs);
  }

  /** `spin` dims the title; `suspense` swaps it for a breathing "?"; idle brings it back. */
  private setMotion(motion: MotionPhase, nowMs: number): void {
    if (motion === 'suspense') {
      // Quantised to 100 ms: changing the animation's duration restarts its cycle.
      const ms = Math.round(breathPeriodMs(this.body?.motion ?? null, nowMs, STAGE.suspenseBreath) / 100) * 100;
      if (ms !== this.breathMs) {
        this.breathMs = ms;
        setVar(this.suspense, '--breath-ms', `${ms}ms`);
      }
    }
    if (motion === this.motion) return;
    this.motion = motion;
    setData(this.root, 'motion', motion);
    setHidden(this.suspense, motion !== 'suspense');
    if (motion === 'spin') setData(this.now, 'anim', 'spin');
    else if (motion === 'suspense') {
      setData(this.now, 'anim', 'spin');
      setData(this.suspense, 'anim', 'suspense');
    } else if (this.now.dataset.anim === 'spin') setData(this.now, 'anim', null);
  }

  paintHeat(look: GarlandLook): void {
    this.garland.paint(look);
  }

  onAnim(detail: AnimDetail): void {
    if (detail.name === 'landing') {
      playAnim(this.now, 'landing');
      playAnim(this.recent, 'landing');
    } else if (detail.name === 'heat') {
      playAnim(this.garland.root, 'heat');
    } else {
      this.finale.onAnim(detail);
    }
  }
}
