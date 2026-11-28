// The projector stage: the audience screen's scenes, mounted on any element. It listens to the show (the show
// page's own Bus, or a ShowClient), keeps the latest snapshot, turns it into a privacy-safe view
// (`stageView`) and draws that view with one small renderer per scene. Clock-driven moments (landings, Check
// steps, the Shuffle, Heat) are computed on every frame from the show's timestamps (`momentsOf`), set
// `data-anim` hooks and are announced as `quina:anim` events on the root, for a theme script.
//
// Read-only: the stage never sends a command. Layout: a 1440×1080 reference box scaled to fit (pillarboxed at
// 16:10 and 16:9), with the drum's band stretched to the full screen width. In the show page the band is left open so
// the real drum shows through; standalone, a labelled placeholder stands in for it.
import type { ShowState } from '@quina/protocol';
import type { Bus } from '../show/engine/src/net/bus.ts';
import type { ShowClient } from '../../packages/ui/client/show-client.ts';
import { flowOf, type ShowScene } from '../../packages/ui/flow.ts';
import { loadCatalog, type Catalog } from '../../packages/ui/data/catalog.ts';
import { loadPlanForPage, planStoreForPage, type PlanStore } from '../../packages/ui/data/plan-store.ts';
import type { GamePlan } from '../../packages/ui/plan.ts';
import type { HeatSample } from '../../packages/rules/heat.ts';
import { keepScreenOn } from '../../packages/ui/client/wake-lock.ts';
import '../../packages/ui/tokens.css';
import '../../packages/ui/components/paper-card.css';
import '../../packages/ui/recipes/prizes.css';
import './stage.css';
import { STAGE } from './config.ts';
import { activeHeatSample, garlandLook, heatDisplay } from './model/garland.ts';
import { bandOnScreen, boxBleed, fitBox } from './model/layout.ts';
import { diffMoments, momentsOf, type AnimDetail, type Moments } from './model/moments.ts';
import { pruneSpinNote, type SpinNote } from './model/motion.ts';
import { NO_CHECK_MEMORY, rememberCheck, type CheckMemory } from './model/check.ts';
import { drumShown } from './model/scene.ts';
import { shufflePhaseAt } from './model/shuffle.ts';
import { noteOf, pruneNotes, undoNotes, type LandedNote } from './model/songs.ts';
import { linkLost, nearLanding, parseCssTime } from './model/timing.ts';
import { busSource, clientSource, type LinkState, type StageEvent, type StageSource } from './source.ts';
import { STAGE_TEXT } from './strings.ts';
import { stageView, type AfterView, type BeforeView, type StageView } from './view.ts';
import { h, playAnim, setData, setHidden, setVar } from './render/dom.ts';
import { ninoFor } from '../../packages/ui/concepts.ts';
import { ninoElement } from '../../packages/ui/components/nino-dom.ts';
import type { SceneEnv, SceneRenderer } from './render/scene.ts';
import { AfterScene } from './render/after.ts';
import { BeforeScene } from './render/before.ts';
import { CelebrationScene } from './render/celebration.ts';
import { CheckScene } from './render/check.ts';
import { IntervalScene } from './render/interval.ts';
import { PlayScene } from './render/play.ts';
import { RoundStartScene } from './render/round-start.ts';

/** Where the stage's events come from: the show page's Bus, or a ShowClient (relay or demo). */
export type StageInput = { bus: Bus<unknown> } | { client: ShowClient };

export interface StageOptions {
  /** Where the Game plan lives (prizes, sponsors, schedule). Default: this browser's local store. */
  planStore?: PlanStore;
  /** cards.json (card grids, titles, the Shuffle's covers). Default: `/cards/cards.json`. */
  catalogUrl?: string;
  /** Random source for purely visual choices. Default: crypto-backed. */
  random?: () => number;
}

export interface StageHandle {
  readonly root: HTMLElement;
  /** The drum's band, the whole width of the screen. In the show page, place the drum over its rect. */
  readonly drumSlot: HTMLElement;
  /** The scene on screen. */
  readonly scene: ShowScene;
  destroy(): void;
}

/** The `quina:anim` event's detail (see ANIMATIONS.md). */
export type { AnimDetail } from './model/moments.ts';
export const ANIM_EVENT = 'quina:anim';
/** Fired on the root when the layout changes: `detail.band` is the drum band's rect on screen. */
export const LAYOUT_EVENT = 'quina:layout';

/** Mount the projector stage on `root`. With `{ bus }` it overlays the show page; with `{ client }` it stands alone. */
export function mountStage(root: HTMLElement, input: StageInput, options: StageOptions = {}): StageHandle {
  const overlay = 'bus' in input;
  const source = overlay ? busSource(input.bus) : clientSource(input.client);
  return new Stage(root, source, overlay ? 'overlay' : 'standalone', options).handle;
}

function secureRandom(): number {
  const word = new Uint32Array(1);
  crypto.getRandomValues(word);
  return word[0] / 2 ** 32;
}

interface Renderers {
  before: SceneRenderer<BeforeView>;
  roundStart: RoundStartScene;
  play: PlayScene;
  check: CheckScene;
  celebration: CelebrationScene;
  interval: IntervalScene;
  after: SceneRenderer<AfterView>;
}

class Stage {
  readonly handle: StageHandle;
  private readonly root: HTMLElement;
  private readonly source: StageSource;
  private readonly mode: 'overlay' | 'standalone';
  private readonly random: () => number;
  private readonly box: HTMLElement;
  private readonly slot: HTMLElement;
  private readonly pause: HTMLElement;
  private readonly link: HTMLElement;
  private readonly scenes: Renderers;
  /** The engine's Heat samples (`heat.sample`), newest last: the same ones the phones ease through. */
  private heatSamples: HeatSample[] = [];
  private readonly planStore: PlanStore;
  private readonly cleanups: (() => void)[] = [];
  private readonly motionQuery: MediaQueryList | null;
  private state: ShowState | null;
  private landed: LandedNote[] = [];
  private spin: SpinNote | null = null;
  /** The Check between snapshots (the last one on screen, a review's start, a step back). */
  private checkMemory: CheckMemory = NO_CHECK_MEMORY;
  private plan: GamePlan | null;
  private catalog: Catalog | null = null;
  private view: StageView;
  private active: ShowScene | null = null;
  private moments: Moments | null = null;
  private linkDownSinceMs: number | null = null;
  private lastHeatPaint = Number.NEGATIVE_INFINITY;
  /** The drum's band in the box: smaller and higher during the Desgraciat's finale (`finale-enter`). */
  private band: { readonly top: number; readonly height: number } = STAGE.drumBand;
  private bandTimer: ReturnType<typeof setTimeout> | null = null;
  private leaveMs = 480;
  private frame = 0;
  private destroyed = false;

  constructor(root: HTMLElement, source: StageSource, mode: 'overlay' | 'standalone', options: StageOptions) {
    this.root = root;
    this.source = source;
    this.mode = mode;
    this.random = options.random ?? secureRandom;
    this.motionQuery = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
    this.planStore = options.planStore ?? planStoreForPage();
    this.plan = loadPlanForPage(this.planStore);
    this.state = source.latest();
    this.checkMemory = rememberCheck(NO_CHECK_MEMORY, this.state?.check);

    const env: SceneEnv = { random: this.random, reducedMotion: () => this.reducedMotion };
    this.scenes = {
      before: new BeforeScene(),
      roundStart: new RoundStartScene(env),
      play: new PlayScene(env),
      check: new CheckScene(),
      celebration: new CelebrationScene(env),
      interval: new IntervalScene(),
      after: new AfterScene(env),
    };

    // Layers: backdrop (everything but the drum's band) · the band · its cover · the scaled box · the link dot.
    this.slot = h('div', { class: 'stage__drum-slot', attrs: { 'aria-hidden': 'true' } }, h('p', 'stage__drum-label', STAGE_TEXT.drumPlaceholder));
    // The Pausa (ANIMATIONS.md › pause): the meditating nino breathes over «Tornem de seguida» (still with reduced motion).
    const pauseMoment = STAGE.stickers.pause;
    const pauseNino = pauseMoment ? ninoElement({ pose: ninoFor(pauseMoment, 0), motion: 'breathe' }, 'sticker stage__pause-nino') : null;
    this.pause = h('div', { class: 'stage__pause', hidden: true }, pauseNino, h('p', 'stage__pause-text', STAGE_TEXT.pause));
    this.box = h('div', 'stage__box', ...Object.values(this.scenes).map((s) => s.root), this.pause);
    this.link = h('div', { class: 'stage__link', hidden: true, attrs: { role: 'status' } }, h('span', 'stage__link-text'));
    root.classList.add('stage-root');
    // The design system's density and ground (packages/ui/ds): the projector's scale, on the night sky.
    root.dataset.density = 'projector';
    root.dataset.ground = 'night';
    root.dataset.mode = mode;
    root.setAttribute('aria-live', 'off');
    root.replaceChildren(h('div', { class: 'stage__backdrop', attrs: { 'aria-hidden': 'true' } }), this.slot, h('div', { class: 'stage__drum-cover', attrs: { 'aria-hidden': 'true' } }), this.box, this.link);
    setVar(root, '--box-w', `${STAGE.box.width}px`);
    setVar(root, '--box-h', `${STAGE.box.height}px`);
    setVar(root, '--band-top-ref', `${STAGE.drumBand.top}px`);
    setVar(root, '--band-h-ref', `${STAGE.drumBand.height}px`);
    setVar(root, '--finale-band-end-ref', `${STAGE.finale.band.top + STAGE.finale.band.height}px`);

    this.view = this.computeView();
    this.cleanups.push(
      source.onEvent((event) => this.onEvent(event)),
      source.onLink((link) => this.onLink(link)),
      this.planStore.subscribe(() => {
        this.plan = loadPlanForPage(this.planStore);
        this.update();
      }),
    );
    this.onLink(source.link());
    this.loadCatalog(options.catalogUrl ?? STAGE.catalogUrl);

    const resize = new ResizeObserver(() => this.layout());
    resize.observe(root);
    this.cleanups.push(() => resize.disconnect());
    // The projector's screen never sleeps while the stage shows (§8 Y4): a Screen Wake Lock, taken again whenever the page
    // is visible again. Both the show page (which mounts the stage) and the standalone /stage/ get it; where the browser
    // refuses it (plain http on another device in split mode), the screen follows the device's own settings.
    this.cleanups.push(keepScreenOn());
    this.leaveMs = parseCssTime(getComputedStyle(root).getPropertyValue('--dur-slow'), this.leaveMs);
    this.layout();
    this.update();
    this.loop();

    const self = this;
    this.handle = {
      root,
      drumSlot: this.slot,
      get scene() {
        return self.view.body.scene;
      },
      destroy: () => this.destroy(),
    };
  }

  private get reducedMotion(): boolean {
    return this.motionQuery?.matches ?? false;
  }

  // ------------------------------------------------------------------------------------------- input
  private onEvent(event: StageEvent): void {
    switch (event.kind) {
      case 'state':
        this.state = event.state;
        this.landed = pruneNotes(this.landed, event.state);
        this.spin = pruneSpinNote(this.spin, event.state);
        this.checkMemory = rememberCheck(this.checkMemory, event.state.check);
        break;
      case 'reviewing':
        this.checkMemory = { ...this.checkMemory, review: { claimId: event.claimId, atMs: event.atMs } };
        break;
      case 'unrevealed':
        this.checkMemory = { ...this.checkMemory, unrevealed: { claimId: event.claimId, index: event.index, atMs: event.atMs } };
        break;
      case 'spin':
        this.spin = { id: event.id, spinStartAtMs: event.spinStartAtMs, landAtMs: event.landAtMs, autoReleaseAtMs: event.autoReleaseAtMs };
        break;
      case 'landed':
        this.landed = [...this.landed.filter((n) => n.position !== event.position), noteOf(event)];
        if (this.spin?.id === event.id) this.spin = null;
        break;
      case 'cancelled':
        if (this.spin?.id === event.id) this.spin = null;
        break;
      case 'undone':
        this.landed = undoNotes(this.landed, event);
        break;
      case 'heat':
        this.heatSamples = [...this.heatSamples, { value: event.value, fromMs: event.fromMs, toMs: event.toMs }].slice(-STAGE.heatSamplesKept);
        break;
      case 'plan':
        // The relay's push: the store checks it and, when it changed, its subscription above redraws.
        this.planStore.receive?.(event.plan);
        return;
    }
    this.update();
  }

  private onLink(link: LinkState): void {
    setData(this.root, 'link', link);
    this.linkDownSinceMs = link === 'online' ? null : (this.linkDownSinceMs ?? Date.now());
  }

  private loadCatalog(url: string): void {
    loadCatalog(url)
      .then((catalog) => {
        this.catalog = catalog;
        setData(this.root, 'catalog', 'loaded');
        this.update();
      })
      .catch((error: unknown) => {
        // Titles still come from the snapshot; covers come from /covers by id.
        console.warn('[stage] cards.json not available: no card grids beyond the played songs', error);
        setData(this.root, 'catalog', 'missing');
      });
  }

  // ------------------------------------------------------------------------------------------ render
  private computeView(): StageView {
    return stageView(this.state, flowOf(this.state), this.plan, this.catalog, { landed: this.landed, spin: this.spin, check: this.checkMemory });
  }

  /** Recompute the view and draw it, then run one step right away (no frame shows a half-entered scene). */
  private update(): void {
    if (this.destroyed) return;
    this.view = this.computeView();
    const body = this.view.body;
    this.show(body.scene);
    switch (body.scene) {
      case 'before':
        this.scenes.before.render(body, this.view);
        break;
      case 'roundStart':
        this.scenes.roundStart.render(body);
        break;
      case 'play':
        this.scenes.play.render(body, this.view);
        break;
      case 'check':
        this.scenes.check.render(body);
        break;
      case 'celebration':
        this.scenes.celebration.render(body);
        break;
      case 'interval':
        this.scenes.interval.render(body);
        break;
      case 'after':
        this.scenes.after.render(body, this.view);
        break;
    }
    setData(this.root, 'scene', body.scene);
    setData(this.root, 'paused', this.view.paused ? 'true' : null);
    this.setBand(body.scene === 'play' && body.finale ? STAGE.finale.band : STAGE.drumBand);
    if (this.view.paused) this.enter(this.pause);
    else if (!this.pause.hidden) this.leave(this.pause, () => !this.view.paused);
    this.step();
  }

  /** Swap scenes: the old one fades out, the new one enters (its `scene-enter` comes from the moments). */
  private show(scene: ShowScene): void {
    if (scene === this.active) return;
    const previous = this.active ? this.scenes[this.active].root : null;
    this.active = scene;
    this.enter(this.scenes[scene].root);
    if (previous) this.leave(previous, () => this.active !== null && this.scenes[this.active].root !== previous);
  }

  private enter(el: HTMLElement): void {
    el.classList.remove('is-leaving');
    setHidden(el, false);
  }

  /** Fade `el` out (`is-leaving`, `--dur-slow`), then hide it if it should still go by then. */
  private leave(el: HTMLElement, stillGoing: () => boolean): void {
    if (el.classList.contains('is-leaving')) return;
    el.classList.add('is-leaving');
    setTimeout(() => {
      if (!el.classList.contains('is-leaving')) return;
      el.classList.remove('is-leaving');
      if (stillGoing()) setHidden(el, true);
    }, this.reducedMotion ? 0 : this.leaveMs);
  }

  private loop(): void {
    this.frame = requestAnimationFrame(() => {
      if (this.destroyed) return;
      this.step();
      this.loop();
    });
  }

  /** One frame: the clock-driven parts of the scene, the drum band, the Heat, then the moments. */
  private step(): void {
    const now = this.source.now();
    const body = this.view.body;
    const active = this.active ? this.scenes[this.active] : null;
    active?.tick(now);

    const shuffle = body.scene === 'roundStart' && body.shuffle ? shufflePhaseAt(body.shuffle, now) : null;
    setData(this.root, 'drum', drumShown(body.scene, shuffle, this.view.paused) ? 'shown' : 'hidden');

    const landAtMs = body.scene === 'play' ? (body.motion?.landAtMs ?? null) : null;
    if (now - this.lastHeatPaint >= STAGE.heatRepaintMs && !nearLanding(landAtMs, now, STAGE.quietBeforeLandingMs)) {
      this.lastHeatPaint = now;
      const heat = heatDisplay(this.heatSamples, now, this.reducedMotion);
      // Only the scene on screen: a hidden scene's garland neither shows nor runs.
      if (this.active === 'celebration') this.scenes.celebration.paintHeat(garlandLook(heat, 'win'));
      else this.scenes.play.paintHeat(garlandLook(heat));
    }

    const next = momentsOf(this.view, {
      nowMs: now,
      heat: activeHeatSample(this.heatSamples, now),
      linkLost: linkLost(this.linkDownSinceMs, Date.now(), STAGE.linkLostAfterMs),
      checkMarkAt: STAGE.checkMarkAt,
      checkTypeLeadMs: STAGE.checkTypeLeadMs,
      countdown: STAGE.countdown,
    });
    // The drum band's own hook follows the motion: `spin` while it spins, `suspense` while one is held open.
    setData(this.slot, 'anim', next.motion === 'idle' ? null : next.motion);
    const fired = diffMoments(this.moments, next);
    this.moments = next;
    for (const detail of fired) this.fire(detail);
  }

  /** A moment: the stage's own hooks, the scene's, then the event for a theme script. */
  private fire(detail: AnimDetail): void {
    switch (detail.name) {
      case 'scene-enter':
        playAnim(this.scenes[detail.scene].root, 'scene-enter');
        break;
      case 'pause':
        if (detail.on) playAnim(this.pause, 'pause');
        break;
      case 'link-lost':
        setHidden(this.link, !detail.lost);
        setData(this.link, 'anim', detail.lost ? 'link-lost' : null);
        this.link.firstElementChild?.replaceChildren(detail.lost ? STAGE_TEXT.link[this.source.link() === 'noShow' ? 'noShow' : 'offline'] : '');
        break;
      default:
        break;
    }
    const scene = this.active ? this.scenes[this.active] : null;
    scene?.onAnim?.(detail);
    this.root.dispatchEvent(new CustomEvent<AnimDetail>(ANIM_EVENT, { detail, bubbles: true }));
  }

  /** The finale shrinks the drum's band and back: it glides (`is-band-moving`, 500 ms), then the layout is plain again. */
  private setBand(band: { readonly top: number; readonly height: number }): void {
    if (band === this.band) return;
    this.band = band;
    this.root.classList.add('is-band-moving');
    if (this.bandTimer) clearTimeout(this.bandTimer);
    this.bandTimer = setTimeout(() => this.root.classList.remove('is-band-moving'), 600);
    this.layout();
  }

  /** Fit the box to the screen and stretch the drum band across it. */
  private layout(): void {
    const width = this.root.clientWidth;
    const height = this.root.clientHeight;
    const fit = fitBox(width, height, STAGE.box.width, STAGE.box.height);
    const band = bandOnScreen(fit, this.band);
    const bleed = boxBleed(fit);
    setVar(this.root, '--box-x', `${fit.x}px`);
    setVar(this.root, '--box-y', `${fit.y}px`);
    setVar(this.root, '--box-scale', String(fit.scale));
    // The screen past the box's sides (16:10, 16:9: D276), in box px: the screen-wide layers reach into it.
    setVar(this.root, '--box-bleed-x', `${bleed.x}px`);
    setVar(this.root, '--box-bleed-y', `${bleed.y}px`);
    setData(this.root, 'wide', bleed.x >= 1 ? '' : null);
    setVar(this.root, '--band-top', `${band.top}px`);
    setVar(this.root, '--band-h', `${band.height}px`);
    if (this.mode === 'overlay') {
      // The show page's drum CSS can read the band from :root (see stage/README.md › Integration).
      document.documentElement.style.setProperty('--stage-band-top', `${band.top}px`);
      document.documentElement.style.setProperty('--stage-band-height', `${band.height}px`);
    }
    this.root.dispatchEvent(new CustomEvent(LAYOUT_EVENT, { detail: { band: this.slot.getBoundingClientRect(), scale: fit.scale }, bubbles: true }));
  }

  private destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    cancelAnimationFrame(this.frame);
    if (this.bandTimer) clearTimeout(this.bandTimer);
    for (const off of this.cleanups.splice(0)) off();
    this.source.dispose();
    this.root.replaceChildren();
    this.root.classList.remove('stage-root');
    for (const key of ['mode', 'scene', 'drum', 'link', 'paused', 'catalog', 'density', 'ground', 'wide']) delete this.root.dataset[key];
    if (this.mode === 'overlay') {
      document.documentElement.style.removeProperty('--stage-band-top');
      document.documentElement.style.removeProperty('--stage-band-height');
    }
  }
}
