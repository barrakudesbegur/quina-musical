// The console's state, one per page: the engine's view (ShowStore, through ui/client), the Game plan, the
// printed cards, this device's label, theme and checklist, its helpers' tab and Futur reveal, the round's
// counted songs gathered from the snapshots (Estat, Futur) and the songs to come when a tab needs them (Cerca,
// Futur), the Cerca tab's search, the claim pad, the finalists' pad and the Dempeus tab's finale switches, and the
// toasts. It derives what the components need from the pure logic in logic/, and `act` is the one way commands leave
// the console.
import { roundCardType, roundSide, type CommandFields, type CommandRejected, type ResumePoint, type ShowState } from '@quina/protocol';
import { createShow, type ShowStore } from '../../packages/ui/client/show.svelte.ts';
import { loadCatalog, type Catalog } from '../../packages/ui/data/catalog.ts';
import { followPlanPushes, loadPlanForPage, planStoreForPage } from '../../packages/ui/data/plan-store.ts';
import { tick } from 'svelte';
import { capture, play, type Captured } from './morph.ts';
import { captureA } from './a-glide.ts';
import { shouldMorph } from './logic/next-to-now.ts';

const prefersReducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
import type { AnyCommandArgs, AnyCommandName } from '../../packages/ui/flow.ts';
import type { GamePlan } from '../../packages/ui/plan.ts';
import { CONSOLE, DEFAULT_THEME, type Theme } from './config.ts';
import { lastSpinOf, parseChecklist, resolveLabel, resolveTheme, normalizeLabel, type LastSpin } from './logic/device.ts';
import { EMPTY_LANDING_LOG, countedSongs, recordLandings, roundCards, roundKey, type LandingLog } from './logic/future.ts';
import { cardsInPlay } from './logic/possible-winners.ts';
import { addTyped, openPad, padAfterUnknown, padClaim, padKey, removeChip, type AddOutcome, type ClaimPadRules, type ClaimPadState } from './logic/claim-pad.ts';
import { defaultAction } from './logic/default-action.ts';
import {
  checkFinalist,
  finalePadAfterRefusal,
  finalePadCommand,
  finalePadEnter,
  finalePadKey,
  finalePadRemove,
  finaleRefusal,
  openFinalePad,
  withoutFinalist,
  type FinaleEnterOutcome,
  type FinalePadState,
} from './logic/finale.ts';
import type { PadKey } from './logic/numpad.ts';
import { defaultClaimKind, songIndex, type ClaimKind } from './logic/show-data.ts';
import { acceptUpcoming, forecastWins, freshUpcoming, roundSongs, shouldAskUpcoming, upcomingMoment, wantsUpcoming, type UpcomingSongs } from './logic/upcoming.ts';
import { canSend, controlsModel, sceneContext } from './logic/scene.ts';
import { EMPTY_TAB_MEMORY, fallenBetween, helperTabAfter, type HelperTab, type TabMemory } from './logic/standing.ts';
import { nextSavedCode, resumeCommand } from '../../packages/rules/resume.ts';
import { consoleAlert, isOnline, looksUnpaired } from './logic/status.ts';
import { SentLog, dismissToast, holdToasts, isOwnRejection, pushToast, releaseToasts, shownToasts, type Toast, type ToastTone } from './logic/toasts.ts';
import { S, commandText, reasonText } from './strings.ts';
import { readStored, writeStored } from './storage.ts';
import { storedSoundsOn, storedSoundsValue } from '../../packages/ui/sounds/logic.ts';

/** This device's label: `?label=` (then stored) or the stored one. */
function startingLabel(): string | null {
  const param = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('label');
  const choice = resolveLabel(param, readStored(CONSOLE.storage.label), CONSOLE.labelMaxLength);
  if (choice.store) writeStored(CONSOLE.storage.label, choice.label);
  return choice.label;
}

/** The helpers' tabs (HelperTabs.svelte; logic/standing.ts: Dempeus first in the Desgraciat round). */
export type { HelperTab } from './logic/standing.ts';

/** The Cerca tab on this device (kept here so it survives a tab switch or a Check). */
export interface SearchState {
  /** «Cançons / Cartró». */
  mode: 'songs' | 'card';
  query: string;
  /** The card number being typed on the tab's keypad. */
  digits: string;
  /** The card shown, once ↵ is pressed. */
  cardId: number | null;
  /** «Mostra el futur» on the card shown (apart from the Futur tab's reveal). */
  cardFuture: boolean;
  /** The search box has the focus: the tab grows over the column while the tablet's keyboard is up. */
  typing: boolean;
}

/** The last step back inside a Check (`check.unrevealed`, D134), for «Enrere: torna a sonar…». */
export interface StepBack {
  claimId: string;
  /** The mark that came off: the Check is back to this many revealed. */
  index: number;
  /** «Seguides» was on, and the step back turned it off for this card. */
  autoWasOn: boolean;
  /** When it happened (logic/check.ts stepBackOnScreen: only one made since the Check came on screen counts). */
  atMs: number;
}

/** The last landing that knocked cards out of the Desgraciat round (`standing-fall`), for the Dempeus tab. */
export interface StandingFall {
  /** Bumps with every fall, so the tab replays it. */
  seq: number;
  /** The cards that fell, in card order. */
  cardIds: number[];
  /** The song that sank them (the snapshot's current song), or null. */
  songId: number | null;
  /** The count left after it: the tab's "−3 amb «…»" shows while the count still is this. */
  countAfter: number;
  /** When this device saw it (Date.now()). */
  atMs: number;
}

export class ConsoleModel {
  /** When this page started (the pairing check waits a moment after it). */
  private readonly startedAt = Date.now();
  /** This device's label, set in the menu. It starts this console's clientId and reqIds, so it names who pressed what. */
  label = $state<string | null>(startingLabel());
  /** The engine's view (relay, or the demo transport with `?demo=`). */
  readonly show: ShowStore = createShow('tablet', { label: this.label ?? undefined });
  plan = $state.raw<GamePlan | null>(null);
  catalog = $state.raw<Catalog | null>(null);
  /** The last Spin and who asked for it (a device label, or null for auto-advance). */
  lastSpin = $state.raw<LastSpin | null>(null);
  theme = $state<Theme>(DEFAULT_THEME);
  checklist = $state.raw<readonly string[]>([]);
  toasts = $state.raw<readonly Toast[]>([]);
  /** The toasts on screen (the others wait for an open dialog to close). */
  readonly visibleToasts = $derived(shownToasts(this.toasts));
  /** A modal dialog is open (the menu, «Comandament», a review's warning): new toasts wait behind it. */
  private dialogOpen = false;
  /** Each showing toast's timer, by id: a dialog that opens stops them. */
  private readonly toastTimers = new Map<number, ReturnType<typeof setTimeout>>();
  /** The latest resume code seen on this device (plan B), kept across reloads. */
  savedResume = $state<string | null>(readStored(CONSOLE.storage.resume));
  /** The round's counted songs seen so far (each snapshot carries only the last 10), for the Futur tab. */
  landingLog = $state.raw<LandingLog>(EMPTY_LANDING_LOG);
  /** The round (`roundKey`) whose future this device chose to see; it hides again for a new round. */
  futureRevealedFor = $state<string | null>(null);
  /** The helpers' tab on this device. */
  helperTab = $state<HelperTab>('state');
  /** The engine's last `upcoming` answer (PRIVATE: the songs to come), kept while it matches the round on screen. */
  upcoming = $state.raw<UpcomingSongs | null>(null);
  search = $state<SearchState>({ mode: 'songs', query: '', digits: '', cardId: null, cardFuture: false, typing: false });
  /** Where each long list was scrolled (by its name), so a list keeps its place across tab switches. Not reactive. */
  readonly scrolls = new Map<string, number>();
  /** The Desgraciat round's last fall seen on this device (null: none yet this round). */
  standingFall = $state.raw<StandingFall | null>(null);
  /** The claim pad (logic/claim-pad.ts), while it's open. */
  pad = $state.raw<ClaimPadState | null>(null);
  /** The finalists' pad (logic/finale.ts), while it's open. */
  finalePad = $state.raw<FinalePadState | null>(null);
  /** The Dempeus tab's «Al revés» during the finale: this tablet faces the room (kept on this device). */
  finaleReversed = $state(readStored(CONSOLE.storage.finaleReversed) === '1');
  /** The menu's «Sons de la tauleta» (U182): this device's touch sounds (ui-sounds.ts), on by default. */
  uiSounds = $state(storedSoundsOn(readStored(CONSOLE.storage.uiSounds)));
  /** «Editar» in the finale: an × on each standing finalist (off by default, D183; off again when the finale ends). */
  finaleEditing = $state(false);
  /** The last step back inside a Check. */
  stepBack = $state.raw<StepBack | null>(null);
  /** The claim the pad sent last: the engine's `unknownCard` rejection brings it back, its chips marked (D126). */
  private padSent: { reqId: string; claim: CommandFields['claim'] } | null = null;
  /** The finalists' pad as it was sent: a refusal of the set brings it back, the refused numbers in red. */
  private finaleSent: { reqId: string; pad: FinalePadState } | null = null;
  /** The finale was on in the last snapshot (the Dempeus tab is selected as it starts). Not reactive. */
  private finaleSeen = false;
  /** The moment (`upcomingMoment`) the songs to come were last asked for. Not reactive. */
  private upcomingAsked: string | null = null;
  /** What the tab picker last saw (logic/standing.ts helperTabAfter). Not reactive. */
  private tabMemory: TabMemory = EMPTY_TAB_MEMORY;
  /** The standing cards in the previous snapshot, and its round, for `standing-fall`. Not reactive. */
  private standingSeen: { key: string; ids: readonly number[] | null } = { key: '', ids: null };
  private fallSeq = 0;
  /** Pausa was on in the last snapshot (for `a-glide`). Not reactive. */
  private pausedSeen = false;

  /** Commands can reach the engine (relay connected, show page on it). */
  readonly online = $derived(isOnline(this.show.connected, this.show.showOnline));
  readonly scene = $derived(sceneContext(this.show.flow, this.show.state));
  readonly controls = $derived(controlsModel({ state: this.show.state, flow: this.show.flow, online: this.online }));
  /** The pad's rules: card numbers, and the printed ones when the catalogue is loaded (else the engine checks). */
  readonly padRules = $derived.by((): ClaimPadRules => {
    const cards = this.catalog?.cards ?? null;
    return { maxDigits: CONSOLE.cardDigits, max: CONSOLE.cardMax, maxCards: CONSOLE.claimMaxCards, known: (id) => (cards ? cards.has(id) : null) };
  });
  /** What the pad's «Comprovar» would claim now, or null. */
  readonly padClaim = $derived(this.pad ? padClaim(this.pad, this.padRules) : null);
  /** What the finalists' pad's big button would send now, or null. */
  readonly finaleCommand = $derived(this.finalePad ? finalePadCommand(this.finalePad, CONSOLE.finale.minFinalists) : null);
  /** "Go ahead" here: the control drawn as primary, and what the Wii's A sends (logic/default-action.ts). */
  readonly defaultAction = $derived(
    defaultAction({
      state: this.show.state,
      flow: this.show.flow,
      nowMs: this.show.now,
      plan: this.plan,
      nextEnabled: this.controls.next.enabled,
      can: (cmd) => this.can(cmd),
      pad: this.pad ? { claim: this.padClaim } : null,
      finalePad: this.finalePad ? { command: this.finaleCommand } : null,
    }),
  );
  readonly inPlay = $derived(cardsInPlay(this.show.state?.cards.inPlay));
  readonly counted = $derived(this.show.state ? countedSongs(this.landingLog, this.show.state) : { ids: [], complete: false });
  readonly futureRevealed = $derived(this.show.state !== null && this.futureRevealedFor === roundKey(this.show.state.round));
  /** The songs to come, while the engine's answer is about the moment on screen. */
  readonly upcomingSongs = $derived(freshUpcoming(this.upcoming, this.show.state));
  /** Where the round's songs stand (logic/upcoming.ts). */
  readonly roundSongs = $derived(this.show.state ? roundSongs(this.landingLog, this.show.state, this.upcomingSongs) : null);
  /** Every song's title and artist this console knows. */
  readonly songInfo = $derived(songIndex(this.catalog, this.show.state, this.upcomingSongs));
  /** The round's printed cards (its card type, on its side), sold or not; empty until cards.json loads. */
  readonly roundCards = $derived.by(() => {
    const state = this.show.state;
    const printed = this.catalog?.cards;
    return state && printed ? roundCards(printed, roundCardType(state.round), roundSide(state.round)) : [];
  });
  /** The round's first Line and Quina, and who gets them, once the cards and the songs to come are known (Futur,
   * Cerca's card). */
  readonly forecast = $derived(
    this.show.state && this.roundSongs && this.roundCards.length ? forecastWins(this.roundCards, this.inPlay, this.roundSongs, this.show.state.round.lineConfirmed) : null,
  );
  readonly alert = $derived(
    consoleAlert({
      connected: this.show.connected,
      showOnline: this.show.showOnline,
      hasState: this.show.state !== null,
      status: this.show.state?.status ?? null,
      unpaired: looksUnpaired({
        connected: this.show.connected,
        heardClients: this.show.clients.length > 0,
        hasState: this.show.state !== null,
        hostname: typeof location === 'undefined' ? 'localhost' : location.hostname,
        connectedForMs: this.show.now - this.startedAt,
        graceMs: CONSOLE.pairingGraceMs,
      }),
    }),
  );

  /** The next-to-now morph captured at a landing, played once Ara sona shows that song. Not reactive. */
  private morph: Captured | null = null;
  private readonly sent = new SentLog(CONSOLE.sentLogSize);
  private toastSeq = 0;

  constructor() {
    const planStore = planStoreForPage();
    this.plan = loadPlanForPage(planStore);
    planStore.subscribe(() => (this.plan = loadPlanForPage(planStore)));
    // Admin's saves reach this console at once: the relay (or the cloud) pushes the plan on every change.
    followPlanPushes(this.show.client, planStore);

    // The printed cards: song titles for the Check steps, and the cards for the Futur tab. Without cards.json the
    // snapshot's titles and "Cançó N" remain, and the Futur chart shows "—".
    loadCatalog()
      .then((catalog) => (this.catalog = catalog))
      .catch(() => undefined);

    // Who started each Spin: the reqId starts with the sender's device label (null: auto-advance).
    this.show.client.on((event) => {
      if (event.type === 'transition.scheduled' || event.type === 'suspense.started') this.lastSpin = lastSpinOf(event);
      if (event.type === 'upcoming') {
        const kept = acceptUpcoming(event, this.show.state);
        if (kept) this.upcoming = kept;
      }
      if (event.type === 'state') {
        this.landingLog = recordLandings(this.landingLog, event);
        this.followStanding(event);
        // a-glide: Pausa turns on or off, so A's badge moves: note where it is before the screen changes (D128).
        const paused = event.pause != null;
        if (paused !== this.pausedSeen) captureA();
        this.pausedSeen = paused;
      }
      // A step back inside a Check: the snapshot before it still says whether «Seguides» was on.
      if (event.type === 'check.unrevealed') {
        const check = this.show.state?.check;
        this.stepBack = { claimId: event.claimId, index: event.index, autoWasOn: check?.claimId === event.claimId && check.auto, atMs: event.atMs };
      }
      // next-to-now: at the landing the panels still show the old songs; once Ara sona shows it, fly it in.
      if (event.type === 'transition.landed' && shouldMorph(event.songId, this.show.state?.next?.songId, prefersReducedMotion())) {
        this.morph = capture(event.songId);
      }
      if (event.type === 'state' && this.morph) {
        const morph = this.morph;
        this.morph = null;
        if (event.current?.songId === morph.songId) void tick().then(() => play(morph));
      }
      // Plan B: keep the engine's latest resume code on this device (never on the demo transport).
      if (event.type === 'state' && !this.show.demo) {
        const next = nextSavedCode(this.savedResume, event.resume);
        if (next !== this.savedResume) {
          this.savedResume = next;
          writeStored(CONSOLE.storage.resume, next);
        }
      }
    });

    this.theme = resolveTheme(readStored(CONSOLE.storage.theme), DEFAULT_THEME);
    this.checklist = parseChecklist(readStored(CONSOLE.storage.checklist), S.checklist.map((c) => c.id));
  }

  /**
   * The Desgraciat round on this device: Dempeus is selected as the round starts and when one card is left
   * (helperTabAfter), and the cards that fell since the last snapshot become `standingFall`.
   */
  private followStanding(state: ShowState): void {
    const picked = helperTabAfter(this.helperTab, this.tabMemory, state);
    this.tabMemory = picked.memory;
    if (picked.tab !== this.helperTab) this.helperTab = picked.tab;
    // The finale lives in the Dempeus tab (D187): selected as it starts; «Editar» goes off when it ends.
    const finale = state.finale != null;
    if (finale && !this.finaleSeen) this.helperTab = 'standing';
    if (!finale && this.finaleSeen) this.finaleEditing = false;
    this.finaleSeen = finale;
    const key = roundKey(state.round);
    const ids = state.standing?.cardIds ?? null;
    const sameRound = this.standingSeen.key === key;
    const fallen = fallenBetween(this.standingSeen.ids, ids, sameRound);
    if (!sameRound) this.standingFall = null;
    if (fallen.length && state.standing) {
      this.standingFall = { seq: ++this.fallSeq, cardIds: fallen, songId: state.current?.songId ?? null, countAfter: state.standing.count, atMs: Date.now() };
    }
    this.standingSeen = { key, ids };
  }

  /** Send a command. When it can't leave this device, a toast says so. Returns its reqId, or null. */
  act = <C extends AnyCommandName>(cmd: C, ...args: AnyCommandArgs<C>): string | null => {
    const reqId = this.show.send(cmd, ...args);
    if (reqId === null) this.toast('error', S.toast.notSent(commandText(cmd)));
    else this.sent.remember(reqId);
    // A claim sent from the pad (its «Comprovar», or A) closes it; a refused number brings it back.
    if (cmd === 'claim' && reqId !== null && this.pad) {
      this.padSent = { reqId, claim: args[0] as CommandFields['claim'] };
      this.pad = null;
    }
    return reqId;
  };

  /** Open the claim pad: what the round can be won by, as the Phase climbs (Línia or Quina). */
  openPad(kind: ClaimKind = defaultClaimKind(this.show.state)): void {
    this.pad = openPad(kind);
  }

  closePad(): void {
    this.pad = null;
  }

  padPress(key: PadKey): void {
    if (this.pad) this.pad = padKey(this.pad, key, this.padRules);
  }

  padKind(kind: ClaimKind): void {
    if (this.pad) this.pad = { ...this.pad, kind };
  }

  /** «+ Un altre»: the typed number becomes a chip, or is refused (the pad shows why). */
  padAdd(): AddOutcome | null {
    if (!this.pad) return null;
    const { pad, outcome } = addTyped(this.pad, this.padRules);
    this.pad = pad;
    return outcome;
  }

  padRemove(cardId: number): void {
    if (this.pad) this.pad = removeChip(this.pad, cardId);
  }

  /** «Comprovar»: claim the pad's numbers. A number no printed card has stays on the pad, marked. */
  padSubmit(): string | null {
    if (!this.pad) return null;
    const claim = this.padClaim;
    if (!claim) {
      this.padAdd();
      return null;
    }
    return this.act('claim', claim);
  }

  // ---- the Desgraciat's finale (logic/finale.ts) --------------------------------------------------------------
  /** Open the finalists' pad: to start the finale, or («+ Finalista») to add to it. */
  openFinalePad(): void {
    const finale = this.show.state?.finale;
    this.pad = null;
    this.finalePad = finale ? openFinalePad('add', finale.cardIds) : openFinalePad('start');
  }

  closeFinalePad(): void {
    this.finalePad = null;
  }

  finalePadPress(key: PadKey): void {
    if (this.finalePad) this.finalePad = finalePadKey(this.finalePad, key, this.padRules);
  }

  /** ↵: the typed number's card shows privately; it's added while it stands (D168). */
  finalePadEnter(): FinaleEnterOutcome | null {
    const pad = this.finalePad;
    const state = this.show.state;
    if (!pad || !state) return null;
    const ctx = {
      cards: this.catalog?.cards ?? null,
      round: state.round,
      inPlay: this.inPlay.ids,
      standing: state.standing?.cardIds ?? null,
      landed: new Set(this.counted.ids),
    };
    const { pad: next, outcome } = finalePadEnter(pad, { ...this.padRules, maxFinalists: CONSOLE.finale.maxFinalists }, (id, set) => checkFinalist(id, set, ctx));
    this.finalePad = next;
    return outcome;
  }

  finalePadRemove(cardId: number): void {
    if (this.finalePad) this.finalePad = finalePadRemove(this.finalePad, cardId);
  }

  /** «Començar final» (or «Afegir a la final»): the set goes to the engine, and the pad closes. */
  finalePadSubmit(): string | null {
    const pad = this.finalePad;
    const command = this.finaleCommand;
    if (!pad || !command) return null;
    const reqId = this.act('finale', command);
    if (reqId !== null) {
      this.finaleSent = { reqId, pad };
      this.finalePad = null;
    }
    return reqId;
  }

  /** «Editar»'s ×: that finalist leaves the finale at once, with no confirmation (D183). */
  removeFinalist(cardId: number): string | null {
    const finale = this.show.state?.finale;
    return finale ? this.act('finale', { cardIds: withoutFinalist(finale, cardId) }) : null;
  }

  setFinaleReversed(on: boolean): void {
    this.finaleReversed = on;
    writeStored(CONSOLE.storage.finaleReversed, on ? '1' : '0');
  }

  /** Plan B: resume a round by hand on this laptop (a replacement one, or after a restart). */
  resume(point: ResumePoint): string | null {
    return this.act('resumeAt', resumeCommand(point));
  }

  /** Whether `cmd` would be accepted now, as far as the console can tell (the engine has the last word). */
  can(cmd: AnyCommandName): boolean {
    return canSend(cmd, { state: this.show.state, flow: this.show.flow, online: this.online });
  }

  /** A rejection arrived: toast it when it answers one of this console's commands. */
  rejected(rejection: CommandRejected): void {
    if (!isOwnRejection(rejection, this.sent)) return;
    // A number that isn't a printed card (D126): privately, on the pad, never as a toast.
    const sent = this.padSent;
    if (rejection.reason === 'unknownCard' && sent?.reqId === rejection.reqId) {
      this.padSent = null;
      this.pad = padAfterUnknown(sent.claim, rejection.detail, defaultClaimKind(this.show.state));
      return;
    }
    // The finalists the pad sent, refused (D168): back on the pad, privately, the refused number in red.
    const finale = rejection.cmd === 'finale' ? finaleRefusal(rejection.reason, rejection.detail) : null;
    if (finale && this.finaleSent?.reqId === rejection.reqId) {
      this.finalePad = finalePadAfterRefusal(this.finaleSent.pad, finale);
      this.finaleSent = null;
      return;
    }
    const text = finale ? S.finale.refusal[finale.refusal] : reasonText(rejection.reason);
    this.toast('error', S.toast.rejected(commandText(rejection.cmd), text), rejection.detail ?? null);
  }

  toast(tone: ToastTone, text: string, detail: string | null = null): void {
    const id = ++this.toastSeq;
    this.toasts = pushToast(this.toasts, { id, tone, text, detail, untilMs: this.dialogOpen ? null : Date.now() + CONSOLE.toastMs }, CONSOLE.toastMax);
    if (!this.dialogOpen) this.toastTimers.set(id, setTimeout(() => this.dismiss(id), CONSOLE.toastMs));
  }

  /** A modal dialog opened or closed. Opening holds every toast; closing shows them again, each for its full time. */
  setDialogOpen(open: boolean): void {
    if (open === this.dialogOpen) return;
    this.dialogOpen = open;
    for (const timer of this.toastTimers.values()) clearTimeout(timer);
    this.toastTimers.clear();
    if (open) {
      this.toasts = holdToasts(this.toasts);
      return;
    }
    this.toasts = releaseToasts(this.toasts, Date.now() + CONSOLE.toastMs);
    for (const t of this.toasts) this.toastTimers.set(t.id, setTimeout(() => this.dismiss(t.id), CONSOLE.toastMs));
  }

  dismiss(id: number): void {
    clearTimeout(this.toastTimers.get(id));
    this.toastTimers.delete(id);
    this.toasts = dismissToast(this.toasts, id);
  }

  /** The header shows the new label at once; commands carry it from the next reload. */
  setLabel(raw: string): void {
    this.label = normalizeLabel(raw, CONSOLE.labelMaxLength);
    writeStored(CONSOLE.storage.label, this.label);
  }

  setUiSounds(on: boolean): void {
    this.uiSounds = on;
    writeStored(CONSOLE.storage.uiSounds, storedSoundsValue(on));
  }

  setTheme(theme: Theme): void {
    this.theme = theme;
    writeStored(CONSOLE.storage.theme, theme);
  }

  /**
   * Ask the engine for the songs to come when the open tab needs them and the last answer is out of date (a landing,
   * Back, a new round). Called from an effect, so it runs again as those change. Quietly: no toast when offline.
   */
  askUpcoming(): void {
    const state = this.show.state;
    if (!state || !shouldAskUpcoming(wantsUpcoming(this.helperTab, this.futureRevealed), state, this.upcoming, this.upcomingAsked)) return;
    if (this.show.send('getUpcoming') !== null) this.upcomingAsked = upcomingMoment(state);
  }

  /** Show or hide the Futur tab's contents (this device only, for the current round). */
  revealFuture(on: boolean): void {
    const state = this.show.state;
    this.futureRevealedFor = on && state ? roundKey(state.round) : null;
  }

  toggleChecklist(id: string): void {
    this.checklist = this.checklist.includes(id) ? this.checklist.filter((x) => x !== id) : [...this.checklist, id];
    writeStored(CONSOLE.storage.checklist, JSON.stringify(this.checklist));
  }
}
