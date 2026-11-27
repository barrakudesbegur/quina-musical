// The player app's model: Svelte 5 runes over the pure logic. It holds what came in (the feed, the player's
// saved data, the catalogue, the clock) and derives everything the components show, so components stay thin.
// Side effects (storage, sounds, vibration, the feed's cards) happen here, never in components.
import type { Catalog } from '../../packages/ui/data/catalog.ts';
import { knownCardTypes } from '../../packages/ui/data/card-types.ts';
import { heatAt } from '../../packages/rules/heat.ts';
import { touchRelease, touchTap } from '../../packages/ui/sounds/touch.ts';
import { buzz } from '../../packages/ui/sounds/delegate.ts';
import { PLAYER_CONFIG } from './config.ts';
import { InstallState } from './device/install.svelte.ts';
import { vibrate } from './device/screen.ts';
import type { Sounds } from './device/sounds.ts';
import type { FeedConnection, FeedUpdate, PlayerFeed } from './feed/feed.ts';
import type { PublicHeat, PublicState } from './feed/public.ts';
import { budgetMarks, fallStagger, fallenKeys, isDesgraciat, standingIds } from './logic/desgraciat.ts';
import { buzzFor, feedbackFor, type FeedbackSnapshot } from './logic/feedback.ts';
import { drawersOnCelebration, popDrawer, pushDrawer, type Drawer } from './logic/drawers.ts';
import type { Route } from './logic/router.ts';
import { NO_BANNER, nextBanner, pauseOn, type BannerState } from './logic/status.ts';
import { gameLive } from './logic/awake.ts';
import {
  addCard,
  dismiss,
  emptyData,
  noteEdition,
  moveCard,
  noteGame,
  removeCard,
  renameCard,
  renumberCard,
  setAraView,
  setIdentity,
  setSounds,
  soundsOn,
  type PlayerData,
  type PlayerStorage,
  type StorageLike,
} from './logic/storage.ts';
import { saveBootState } from './logic/boot-cache.ts';
import { araViewFor, type AraView } from './logic/tabs.ts';
import { celebrationOf, cardViews, currentRound, focusRoundNumber, latestLanding, markKeys, planOf, roundKindOf } from './logic/view.ts';
import { songsOnCards, yourSongOf } from './logic/your-song.ts';
import { S } from './strings.ts';

/** The sheet open over the app. A sheet opened from the menu goes back to the menu when it closes. */

export interface PlayerAppOptions {
  feed: PlayerFeed;
  storage: PlayerStorage;
  sounds: Sounds;
  loadCatalog: () => Promise<Catalog>;
  edition?: string;
  /** The state this tab saw last (logic/boot-cache.ts): the app opens on it until the feed's first snapshot. */
  initialState?: PublicState | null;
  /** Where each new state is kept for the next reload (sessionStorage; null: not kept). */
  bootStore?: StorageLike | null;
  /** Installing the app (D221): what the browser offers. Without one, nothing is offered. */
  install?: InstallState;
}

/** A toast: its words, and the identity of the card it is about (its icon), if any. */
export interface ToastNote {
  text: string;
  identity: number | null;
}

const HEAT_KEEP = 6;

export class PlayerApp {
  // ---- inputs -------------------------------------------------------------------------------------------
  state = $state.raw<PublicState | null>(null);
  /** True until the first state is on screen: the screen paints it as it is, with no transition into it (no fade
   *  from a blank or welcome screen, no offline veil fading in at load; the user, 27 Nov). */
  booting = $state(true);
  connection = $state.raw<FeedConnection>({ online: false, sinceMs: Date.now(), lastOutageMs: 0 });
  data = $state.raw<PlayerData>(emptyData(PLAYER_CONFIG.edition));
  catalog = $state.raw<Catalog | null>(null);
  catalogFailed = $state(false);
  /** The cloud's clock and the local one, refreshed every PLAYER_CONFIG.tickMs while visible. */
  cloudNow = $state(Date.now());
  localNow = $state(Date.now());
  heatSamples = $state.raw<PublicHeat[]>([]);

  // ---- UI state -----------------------------------------------------------------------------------------
  /** Ara's view for this visit only (after adding a card, its cards), over the player's saved choice. */
  araSession = $state<AraView | null>(null);
  /** The open drawers, bottom first (logic/drawers.ts); empty: the home screen. */
  drawers = $state.raw<Drawer[]>([]);
  /** The add-card pad has a number typed in it: a Celebration leaves it open (D90). */
  padTyping = $state(false);
  /** Last year's link (or another edition's) that opened the app, until dismissed. */
  legacy = $state.raw<Extract<Route, { kind: 'legacy' | 'otherEdition' }> | null>(null);
  /** A short notice over the screen. About a card (one just added), it carries that card's identity: its icon. */
  toast = $state.raw<ToastNote | null>(null);
  /** The card the cards view points at (one just added, or the pad's "Veure'l"): ringed in gold for a moment. */
  highlightCard = $state<number | null>(null);
  reducedMotion = $state(false);
  hidden = $state(false);
  /** Kernels that just dropped in ("cardId:songId"): the mark-in animation (a ✗ stamping, in the Desgraciat round). */
  freshMarks = $state.raw<ReadonlySet<string>>(new Set());
  /** Desgraciat round: the cards falling right now (`card-fall`), each with its place in the 120 ms stagger. */
  falls = $state.raw<ReadonlyMap<number, number>>(new Map());
  /** Desgraciat round: it just started, so the playing cards stand up (`stand-up`). */
  standUp = $state(false);
  /** The connection strip (offline, reconnecting, connected), stepped on every feed update and clock tick. */
  banner = $state.raw<BannerState>(NO_BANNER);

  // ---- derived ------------------------------------------------------------------------------------------
  plan = $derived(planOf(this.state));
  round = $derived(currentRound(this.state));
  scene = $derived(this.state?.scene ?? 'before');
  focusRound = $derived(focusRoundNumber(this.state));
  /** The kind of the round the screens talk about ('desgraciat' names it "Quina Desgraciada"). */
  focusKind = $derived(roundKindOf(this.focusRound, this.state, this.plan));
  /** The current round is the Desgraciat one: the cards stand or sit, and nothing is near a win. */
  desgraciat = $derived(isDesgraciat(this.round));
  latest = $derived(latestLanding(this.round));
  views = $derived(cardViews(this.data.cards, this.catalog, this.round));
  /** The printed card types' names and colours, from card-types.json (knownCardTypes). */
  cardTypes = $derived(knownCardTypes(this.catalog?.cardTypes));
  playingViews = $derived(this.views.filter((v) => v.valid));
  restingViews = $derived(this.views.filter((v) => !v.valid));
  /** Every song on the cards that play this round. */
  playingSongs = $derived(songsOnCards(this.playingViews));
  araView = $derived(araViewFor({ session: this.araSession, saved: this.data.araView, cardCount: this.data.cards.length }));
  celebration = $derived(celebrationOf(this.state, this.data.cards.map((c) => c.id)));
  celebrationOpen = $derived(this.celebration !== null && !this.data.dismissed.includes(this.celebration.key));
  /** Offline: the normal screen stays usable, greyed under the strip. */
  offline = $derived(this.banner.banner === 'offline');
  /** The presenters' technical pause: the meditating nino in the drum's place. */
  paused = $derived(pauseOn(this.state));
  /** The latest landing is on a card that plays this round (not in the Desgraciat round): the gold your-song look
   * until the next Spin starts (ANIMATIONS.md `your-song`, D74). */
  yourSong = $derived(
    yourSongOf({
      scene: this.scene,
      paused: this.paused,
      offline: this.offline,
      round: this.round,
      latest: this.latest,
      spin: this.state?.spin ?? null,
      songs: this.playingSongs,
      nowMs: this.cloudNow,
    }),
  );
  soundsOn = $derived(soundsOn(this.data, this.state?.soundsDefault ?? true));
  heat = $derived(this.heatSamples.length ? heatAt(this.heatSamples, this.cloudNow, this.heatSamples[0].value) : null);
  /** A game is live: the screen is kept on (logic/awake.ts, §8 Y4). */
  awake = $derived(gameLive(this.state));
  /** Root data-state: what the whole screen is in. */
  screenState = $derived(this.offline ? 'offline' : this.paused ? 'pause' : this.state ? 'live' : 'connecting');

  // ---- wiring -------------------------------------------------------------------------------------------
  private readonly feed: PlayerFeed;
  private readonly storage: PlayerStorage;
  private readonly sounds: Sounds;
  private readonly loadCatalog: () => Promise<Catalog>;
  private lastFeedback: FeedbackSnapshot | null = null;
  /** The last Celebration that closed the drawers (D90), so each one does it once. */
  private lastCelebration: string | null = null;
  private stops: (() => void)[] = [];
  private toastTimer: ReturnType<typeof setTimeout> | null = null;
  private highlightTimer: ReturnType<typeof setTimeout> | null = null;
  private freshTimer: ReturnType<typeof setTimeout> | null = null;
  private standUpTimer: ReturnType<typeof setTimeout> | null = null;

  /** Installing the app (D221): Ajustos's row and the home's InstallPrompt read `install.offer`. */
  readonly install: InstallState;

  constructor({ feed, storage, sounds, loadCatalog, edition = PLAYER_CONFIG.edition, initialState = null, bootStore = null, install = new InstallState() }: PlayerAppOptions) {
    this.install = install;
    this.feed = feed;
    this.storage = storage;
    this.sounds = sounds;
    this.loadCatalog = loadCatalog;
    this.data = storage.load(edition).data;
    this.bootStore = bootStore;
    this.state = initialState;
  }

  private readonly bootStore: StorageLike | null;

  /** The first state is painted: let transitions run again two frames later (after that paint has happened). */
  private settle(): void {
    if (!this.booting) return;
    if (typeof requestAnimationFrame !== 'function') {
      this.booting = false;
      return;
    }
    requestAnimationFrame(() => requestAnimationFrame(() => (this.booting = false)));
  }

  /** Start following the feed, the clock, the catalogue and other tabs. Returns a stop function. */
  start(): () => void {
    // A state saved by this tab opens the app quietly, as the first snapshot after opening would (no cues).
    if (this.state) {
      this.react();
      this.stepBanner();
      this.settle();
    }
    this.feed.setCards(this.data.cards.map((c) => c.id));
    this.stops.push(this.feed.subscribe((update) => this.onFeed(update)));
    this.feed.start();
    const tick = setInterval(() => {
      if (this.hidden) return;
      this.localNow = Date.now();
      this.cloudNow = this.feed.now();
      this.stepBanner();
    }, PLAYER_CONFIG.tickMs);
    this.stops.push(() => clearInterval(tick));
    void this.fetchCatalog(0);
    if (typeof window !== 'undefined') {
      const onStorage = (e: StorageEvent) => {
        if (this.storage.isOurKey(e.key)) this.data = this.storage.load(this.data.edition).data;
      };
      const onVisibility = () => {
        this.hidden = document.hidden;
        if (!this.hidden) {
          this.localNow = Date.now();
          this.cloudNow = this.feed.now();
          this.stepBanner();
        }
      };
      const onFirstTap = () => this.sounds.unlock();
      window.addEventListener('storage', onStorage);
      document.addEventListener('visibilitychange', onVisibility);
      window.addEventListener('pointerdown', onFirstTap, { passive: true });
      this.stops.push(() => {
        window.removeEventListener('storage', onStorage);
        document.removeEventListener('visibilitychange', onVisibility);
        window.removeEventListener('pointerdown', onFirstTap);
      });
    }
    return () => {
      this.feed.stop();
      for (const stop of this.stops) stop();
      this.stops = [];
    };
  }

  /** What the link that opened the app asks for. */
  openRoute(route: Route): void {
    if (route.kind === 'card') {
      const error = this.addCard(route.cardId, false);
      if (error === S.addError.duplicate(route.cardId)) this.seeCard(route.cardId);
      else if (error) this.showToast(error);
    } else if (route.kind === 'legacy' || route.kind === 'otherEdition') {
      this.legacy = route;
    }
  }

  // ---- actions (components call these) ------------------------------------------------------------------
  /** Ara's Historial | Cartrons switch: remembered on this device. */
  selectAraView(view: AraView): void {
    this.araSession = null;
    this.saveData(setAraView(this.data, view), false);
  }

  /** Open a drawer over whatever is open (ANIMATIONS.md `drawer-open`, `drawer-stack`). */
  open(drawer: Drawer): void {
    // The trigger played its press (its release gives way): the drawer's own sound as it starts to move.
    touchRelease('drawerOpen');
    this.drawers = pushDrawer(this.drawers, drawer);
  }

  /** Close the top drawer ("‹", the back gesture, a swipe down): the one under it comes back. */
  closeTop(): void {
    this.drawers = popDrawer(this.drawers);
  }

  setPadTyping(typing: boolean): void {
    this.padTyping = typing;
  }

  /** Close every drawer (✕ on a stacked drawer): back to the home screen. */
  closeAll(): void {
    this.drawers = [];
  }

  /** Move a card in the player's list (Ajustos, the grip): the home screen shows them in this order. */
  moveCard(id: number, to: number): void {
    const next = moveCard(this.data, id, to);
    if (next !== this.data) this.saveData(next, false);
  }

  /**
   * Add a card by number, with the icon and the name the pad gave it. With `checkCatalog`, a number that isn't a
   * printed card is refused (the pad); a scanned link is trusted. Returns the error to show, or null. `inPad`: the pad
   * saved it and stays open to confirm and ask for another (`pad-saved`, §8 Y3), so no toast and no trip home yet.
   */
  addCard(id: number, checkCatalog = true, identity?: number, name = '', inPad = false): string | null {
    if (checkCatalog && this.catalog && !this.catalog.cards.has(id)) return S.addError.unknown(id);
    const result = addCard(this.data, id, Date.now(), identity);
    if (!result.ok) return result.reason === 'duplicate' ? S.addError.duplicate(id) : result.reason === 'full' ? S.addError.full(PLAYER_CONFIG.maxCards) : S.addError.invalid;
    this.saveData(name ? renameCard(result.data, id, name) : result.data);
    if (inPad) {
      this.sounds.play('added');
      vibrate(PLAYER_CONFIG.vibrateAdded);
      return null;
    }
    // Added (board "afegir cartró: casos especials", the third frame): straight to the cards, never back to the
    // drawers it was opened from, with the new card ringed and a green toast with its icon.
    this.showToast(S.added(id), result.card.color);
    this.seeCard(id);
    return null;
  }

  /** One of the player's cards on the home screen ("Veure'l" in the pad): every drawer closes, the cards view
   * shows, and that card is ringed for a moment. */
  seeCard(id: number): void {
    this.drawers = [];
    this.showCards();
    this.highlightCard = id;
    if (this.highlightTimer) clearTimeout(this.highlightTimer);
    this.highlightTimer = setTimeout(() => (this.highlightCard = null), PLAYER_CONFIG.toastMs);
  }

  removeCard(id: number): void {
    this.saveData(removeCard(this.data, id));
    this.closeTop();
  }

  /** The card's edit drawer («Editar»): its number, its name and its icon. Returns the error to show, or null. */
  editCard(id: number, to: number, name: string, identity: number): string | null {
    const moved = renumberCard(this.data, id, to, this.catalog?.cards ?? null);
    if (!moved.ok) return moved.reason === 'duplicate' ? S.addError.duplicate(to) : moved.reason === 'unknown' ? S.addError.unknown(to) : S.addError.invalid;
    this.saveData(setIdentity(renameCard(moved.data, to, name), to, identity));
    this.closeTop();
    return null;
  }

  toggleSounds(): void {
    const on = !this.soundsOn;
    this.sounds.unlock();
    this.saveData(setSounds(this.data, on));
    this.sounds.enabled = on;
    // The switch plays its own sound (only turning on); the buzz comes either way (R4), as the delegate's would.
    buzz();
    if (on) touchTap('switchOn');
  }

  /** "Esborrar dades": everything of this app on this phone goes; the app starts fresh. */
  wipeData(): void {
    this.storage.clear();
    this.data = emptyData(this.data.edition);
    this.storage.save(this.data);
    this.feed.setCards([]);
    this.resetFeedback();
    this.drawers = [];
    this.araSession = null;
    this.showToast(S.wiped);
  }

  dismissCelebration(): void {
    if (this.celebration) this.saveData(dismiss(this.data, this.celebration.key), false);
  }

  dismissLegacy(): void {
    this.legacy = null;
  }

  setReducedMotion(reduced: boolean): void {
    this.reducedMotion = reduced;
  }

  // ---- internals ----------------------------------------------------------------------------------------
  /** A card was just added (or its link opened): the home screen with the cards, for this visit only. */
  private showCards(): void {
    this.araSession = 'cartrons';
  }

  /** The connection strip follows the feed and the clocks (assigned only when it changes). */
  private stepBanner(): void {
    const next = nextBanner(this.banner, { state: this.state, connection: this.connection, localNowMs: this.localNow, cloudNowMs: this.cloudNow });
    if (next !== this.banner) this.banner = next;
  }

  private onFeed({ state, connection }: FeedUpdate): void {
    this.connection = connection;
    this.localNow = Date.now();
    this.cloudNow = this.feed.now();
    if (state !== this.state) {
      const first = this.state === null && state !== null;
      this.state = state;
      if (state) {
        this.noteState(state);
        saveBootState(this.bootStore, this.data.edition, state, Date.now());
      }
      if (first) this.settle();
      this.react();
      this.celebrationClosesDrawers();
    }
    this.stepBanner();
  }

  /** A new Celebration closes Premis, Horari and Ajustos (D90; logic/drawers.ts drawersOnCelebration). */
  private celebrationClosesDrawers(): void {
    const c = this.celebration;
    if (!this.celebrationOpen || !c || c.key === this.lastCelebration) return;
    this.lastCelebration = c.key;
    this.drawers = drawersOnCelebration(this.drawers, this.padTyping);
  }

  /** Edition, Game and Heat bookkeeping for a new public state. */
  private noteState(state: PublicState): void {
    let data = this.data;
    const edition = noteEdition(data, state.edition);
    data = noteGame(edition.data, state.gameId);
    if (data !== this.data) this.saveData(data, false);
    if (edition.wiped) this.resetFeedback();
    const h = state.heat;
    const last = this.heatSamples[this.heatSamples.length - 1];
    if (h && (!last || last.value !== h.value || last.fromMs !== h.fromMs)) this.heatSamples = [...this.heatSamples, h].slice(-HEAT_KEEP);
  }

  /** Sounds, vibration, the mark-in cells, the falls and the stand-up for what just changed. */
  private react(): void {
    const next = this.feedbackSnapshot();
    const { cue, freshMarks, freshFalls, standUp } = feedbackFor(this.lastFeedback, next);
    this.lastFeedback = next;
    if (freshMarks.length || freshFalls.length) {
      // Within the phone budget: the falls first (each with its own ✗), then the other cells.
      const falls = fallStagger(freshFalls);
      this.falls = falls;
      this.freshMarks = new Set(budgetMarks(freshMarks, falls));
      if (this.freshTimer) clearTimeout(this.freshTimer);
      this.freshTimer = setTimeout(() => {
        this.freshMarks = new Set();
        this.falls = new Map();
      }, PLAYER_CONFIG.freshMs);
    }
    if (standUp) {
      this.standUp = true;
      if (this.standUpTimer) clearTimeout(this.standUpTimer);
      this.standUpTimer = setTimeout(() => (this.standUp = false), PLAYER_CONFIG.freshMs);
    }
    const buzz = buzzFor({ cue, freshMarks }, next.desgraciat);
    if (buzz) vibrate(buzz === 'fall' ? PLAYER_CONFIG.vibrateFall : PLAYER_CONFIG.vibrateYourSong);
    if (!cue) return;
    this.sounds.play(cue);
  }

  private feedbackSnapshot(): FeedbackSnapshot {
    const stands = this.playingViews.map((v) => ({ cardId: v.saved.id, stand: v.stand }));
    return {
      round: this.round?.number ?? null,
      landings: this.round?.landings.length ?? 0,
      marks: markKeys(this.views),
      celebration: this.celebration?.key ?? null,
      desgraciat: this.desgraciat,
      standing: standingIds(stands),
      fallen: fallenKeys(stands),
      latest: this.latest?.position ?? null,
    };
  }

  /** Forget the last feedback snapshot, so a change of cards doesn't sound like new marks. */
  private resetFeedback(): void {
    this.lastFeedback = null;
    queueMicrotask(() => (this.lastFeedback = this.feedbackSnapshot()));
  }

  private saveData(data: PlayerData, cardsMayChange = true): void {
    const cardsChanged = cardsMayChange && data.cards.map((c) => c.id).join() !== this.data.cards.map((c) => c.id).join();
    this.data = data;
    this.storage.save(data);
    this.sounds.enabled = this.soundsOn;
    if (cardsChanged) {
      this.feed.setCards(data.cards.map((c) => c.id));
      this.resetFeedback();
    }
  }

  private showToast(text: string, identity: number | null = null): void {
    this.toast = { text, identity };
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => (this.toast = null), PLAYER_CONFIG.toastMs);
  }

  private async fetchCatalog(attempt: number): Promise<void> {
    try {
      this.catalog = await this.loadCatalog();
      this.catalogFailed = false;
      this.resetFeedback();
    } catch {
      this.catalogFailed = true;
      const delays = PLAYER_CONFIG.catalogRetryMs;
      setTimeout(() => void this.fetchCatalog(attempt + 1), delays[Math.min(attempt, delays.length - 1)]);
    }
  }
}
