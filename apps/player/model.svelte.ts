// The player app's model: Svelte 5 runes over the pure logic. It holds what came in (the feed, the player's
// saved data, the catalogue, the clock) and derives everything the components show, so components stay thin.
// Side effects (storage, sounds, vibration, the feed's cards) happen here, never in components.
import type { Catalog } from '../../packages/ui/data/catalog.ts';
import { knownCardTypes } from '../../packages/ui/data/card-types.ts';
import { heatAt } from '../../packages/rules/heat.ts';
import { PLAYER_CONFIG } from './config.ts';
import { vibrate } from './device/screen.ts';
import type { Blip, Sounds } from './device/sounds.ts';
import type { FeedConnection, FeedUpdate, PlayerFeed } from './feed/feed.ts';
import type { PublicHeat, PublicState } from './feed/public.ts';
import { budgetMarks, fallStagger, fallenKeys, isDesgraciat, standingIds } from './logic/desgraciat.ts';
import { nearKeys } from './logic/near-win.ts';
import { feedbackFor, type FeedbackSnapshot } from './logic/feedback.ts';
import type { DialogId, Route } from './logic/router.ts';
import { NO_BANNER, nextBanner, pauseOn, type BannerState } from './logic/status.ts';
import {
  addCard,
  dismiss,
  emptyData,
  noteEdition,
  noteGame,
  removeCard,
  renameCard,
  setAraView,
  setIdentity,
  setSounds,
  soundsOn,
  type PlayerData,
  type PlayerStorage,
} from './logic/storage.ts';
import { araViewFor, type AraView, type TabId } from './logic/tabs.ts';
import { celebrationOf, cardViews, currentRound, focusRoundNumber, latestLanding, markKeys, planOf, roundKindOf } from './logic/view.ts';
import { S } from './strings.ts';

/** The sheet open over the app. A sheet opened from the menu goes back to the menu when it closes. */
export type Dialog = ({ kind: DialogId | 'wipe' } | { kind: 'remove' | 'rename'; cardId: number }) & { from?: 'menu' };

export interface PlayerAppOptions {
  feed: PlayerFeed;
  storage: PlayerStorage;
  sounds: Sounds;
  loadCatalog: () => Promise<Catalog>;
  edition?: string;
}

const HEAT_KEEP = 6;

export class PlayerApp {
  // ---- inputs -------------------------------------------------------------------------------------------
  state = $state.raw<PublicState | null>(null);
  connection = $state.raw<FeedConnection>({ online: false, sinceMs: Date.now(), lastOutageMs: 0 });
  data = $state.raw<PlayerData>(emptyData(PLAYER_CONFIG.edition));
  catalog = $state.raw<Catalog | null>(null);
  catalogFailed = $state(false);
  /** The cloud's clock and the local one, refreshed every PLAYER_CONFIG.tickMs while visible. */
  cloudNow = $state(Date.now());
  localNow = $state(Date.now());
  heatSamples = $state.raw<PublicHeat[]>([]);

  // ---- UI state -----------------------------------------------------------------------------------------
  tab = $state<TabId>('ara');
  /** Ara's view for this visit only (after adding a card, its cards), over the player's saved choice. */
  araSession = $state<AraView | null>(null);
  dialog = $state.raw<Dialog | null>(null);
  /** Last year's link (or another edition's) that opened the app, until dismissed. */
  legacy = $state.raw<Extract<Route, { kind: 'legacy' | 'otherEdition' }> | null>(null);
  toast = $state<string | null>(null);
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
  /** The near-win highlights on the playing cards ("cardId:songId"). */
  near = $derived(nearKeys(this.playingViews.map((v) => ({ cardId: v.saved.id, near: v.near }))));
  araView = $derived(araViewFor({ session: this.araSession, saved: this.data.araView, cardCount: this.data.cards.length }));
  celebration = $derived(celebrationOf(this.state, this.data.cards.map((c) => c.id)));
  celebrationOpen = $derived(this.celebration !== null && !this.data.dismissed.includes(this.celebration.key));
  /** Offline: the normal screen stays usable, greyed under the strip. */
  offline = $derived(this.banner.banner === 'offline');
  /** The presenters' technical pause: the meditating nino in the drum's place. */
  paused = $derived(pauseOn(this.state));
  soundsOn = $derived(soundsOn(this.data, this.state?.soundsDefault ?? true));
  heat = $derived(this.heatSamples.length ? heatAt(this.heatSamples, this.cloudNow, this.heatSamples[0].value) : null);
  /** Root data-state: what the whole screen is in. */
  screenState = $derived(this.offline ? 'offline' : this.paused ? 'pause' : this.state ? 'live' : 'connecting');

  // ---- wiring -------------------------------------------------------------------------------------------
  private readonly feed: PlayerFeed;
  private readonly storage: PlayerStorage;
  private readonly sounds: Sounds;
  private readonly loadCatalog: () => Promise<Catalog>;
  private lastFeedback: FeedbackSnapshot | null = null;
  private stops: (() => void)[] = [];
  private toastTimer: ReturnType<typeof setTimeout> | null = null;
  private freshTimer: ReturnType<typeof setTimeout> | null = null;
  private standUpTimer: ReturnType<typeof setTimeout> | null = null;

  constructor({ feed, storage, sounds, loadCatalog, edition = PLAYER_CONFIG.edition }: PlayerAppOptions) {
    this.feed = feed;
    this.storage = storage;
    this.sounds = sounds;
    this.loadCatalog = loadCatalog;
    this.data = storage.load(edition).data;
  }

  /** Start following the feed, the clock, the catalogue and other tabs. Returns a stop function. */
  start(): () => void {
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
      if (error === S.addError.duplicate(route.cardId)) this.showCards();
      else if (error) this.showToast(error);
    } else if (route.kind === 'legacy' || route.kind === 'otherEdition') {
      this.legacy = route;
    }
  }

  // ---- actions (components call these) ------------------------------------------------------------------
  selectTab(tab: TabId): void {
    if (tab !== this.tab) this.blip('tap');
    this.tab = tab;
  }

  /** Ara's Historial | Cartrons switch: remembered on this device. */
  selectAraView(view: AraView): void {
    if (view !== this.araView) this.blip('tap');
    this.araSession = null;
    this.saveData(setAraView(this.data, view), false);
  }

  open(dialog: Dialog): void {
    this.blip('tap');
    this.dialog = dialog;
  }

  /** Close the open sheet; a card's sheet opened from the menu goes back to the menu. */
  closeDialog(): void {
    const d = this.dialog;
    this.dialog = d?.from === 'menu' ? { kind: 'menu' } : null;
  }

  /**
   * Add a card by number. With `checkCatalog`, a number that isn't a printed card is refused (the pad);
   * a scanned link is trusted. Returns the error to show, or null.
   */
  addCard(id: number, checkCatalog = true, identity?: number): string | null {
    if (checkCatalog && this.catalog && !this.catalog.cards.has(id)) return S.addError.unknown(id);
    const result = addCard(this.data, id, Date.now(), identity);
    if (!result.ok) return result.reason === 'duplicate' ? S.addError.duplicate(id) : result.reason === 'full' ? S.addError.full(PLAYER_CONFIG.maxCards) : S.addError.invalid;
    this.saveData(result.data);
    this.showToast(S.added(id));
    // Added: straight to the cards, never back to the menu it may have come from.
    this.dialog = null;
    this.showCards();
    return null;
  }

  removeCard(id: number): void {
    this.saveData(removeCard(this.data, id));
    this.closeDialog();
  }

  /** The card's sheet: its name and its icon. */
  editCard(id: number, name: string, identity: number): void {
    this.saveData(setIdentity(renameCard(this.data, id, name), id, identity));
    this.closeDialog();
  }

  toggleSounds(): void {
    const on = !this.soundsOn;
    this.sounds.unlock();
    this.saveData(setSounds(this.data, on));
    this.sounds.enabled = on;
    if (on) this.sounds.play('tap');
  }

  /** "Esborrar dades": everything of this app on this phone goes; the app starts fresh. */
  wipeData(): void {
    this.storage.clear();
    this.data = emptyData(this.data.edition);
    this.storage.save(this.data);
    this.feed.setCards([]);
    this.resetFeedback();
    this.dialog = null;
    this.tab = 'ara';
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

  /** A tap's blip (components call it for their own buttons). */
  blip(kind: Blip): void {
    this.sounds.play(kind);
  }

  // ---- internals ----------------------------------------------------------------------------------------
  /** A card was just added (or its link opened): Ara with the cards, for this visit only. */
  private showCards(): void {
    this.tab = 'ara';
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
      this.state = state;
      if (state) this.noteState(state);
      this.react();
    }
    this.stepBanner();
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
    if (!cue) return;
    this.sounds.play(cue);
    if (cue === 'nearWin') vibrate(PLAYER_CONFIG.vibrateNearWin);
    if (cue === 'fall') vibrate(PLAYER_CONFIG.vibrateFall);
  }

  private feedbackSnapshot(): FeedbackSnapshot {
    const stands = this.playingViews.map((v) => ({ cardId: v.saved.id, stand: v.stand }));
    return {
      round: this.round?.number ?? null,
      landings: this.round?.landings.length ?? 0,
      marks: markKeys(this.views),
      near: this.near,
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

  private showToast(text: string): void {
    this.toast = text;
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
