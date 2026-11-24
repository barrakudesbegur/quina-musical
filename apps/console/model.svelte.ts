// The console's state, one per page: the engine's view (ShowStore, through ui/client), the Game plan, the
// printed cards, this device's label, theme and checklist, its helpers' tab and Futur reveal, the round's
// counted songs gathered from the snapshots (for the Futur tab), and the toasts. It derives what the
// components need from the pure logic in logic/, and `act` is the one way commands leave the console.
import type { CommandRejected, ResumePoint } from '@quina/protocol';
import { createShow, type ShowStore } from '../../packages/ui/client/show.svelte.ts';
import { loadCatalog, type Catalog } from '../../packages/ui/data/catalog.ts';
import { followPlanPushes, loadPlanForPage, planStoreForPage } from '../../packages/ui/data/plan-store.ts';
import type { AnyCommandArgs, AnyCommandName } from '../../packages/ui/flow.ts';
import type { GamePlan } from '../../packages/ui/plan.ts';
import { CONSOLE, DEFAULT_THEME, type Theme } from './config.ts';
import { lastSpinOf, parseChecklist, resolveLabel, resolveTheme, normalizeLabel, type LastSpin } from './logic/device.ts';
import { EMPTY_LANDING_LOG, countedSongs, recordLandings, roundKey, type LandingLog } from './logic/future.ts';
import { cardsInPlay } from './logic/possible-winners.ts';
import { canSend, controlsModel, sceneContext } from './logic/scene.ts';
import { nextSavedCode, resumeCommand } from '../../packages/rules/resume.ts';
import { consoleAlert, isOnline, looksUnpaired } from './logic/status.ts';
import { SentLog, dismissToast, isOwnRejection, pushToast, type Toast, type ToastTone } from './logic/toasts.ts';
import { S, commandText, reasonText } from './strings.ts';
import { readStored, writeStored } from './storage.ts';

/** This device's label: `?label=` (then stored) or the stored one. */
function startingLabel(): string | null {
  const param = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('label');
  const choice = resolveLabel(param, readStored(CONSOLE.storage.label), CONSOLE.labelMaxLength);
  if (choice.store) writeStored(CONSOLE.storage.label, choice.label);
  return choice.label;
}

/** The helpers' tabs (HelperTabs.svelte). */
export type HelperTab = 'future' | 'prizes' | 'effects';

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
  /** The latest resume code seen on this device (plan B), kept across reloads. */
  savedResume = $state<string | null>(readStored(CONSOLE.storage.resume));
  /** The round's counted songs seen so far (each snapshot carries only the last 10), for the Futur tab. */
  landingLog = $state.raw<LandingLog>(EMPTY_LANDING_LOG);
  /** The round (`roundKey`) whose future this device chose to see; it hides again for a new round. */
  futureRevealedFor = $state<string | null>(null);
  /** The helpers' tab on this device. */
  helperTab = $state<HelperTab>('future');

  /** Commands can reach the engine (relay connected, show page on it). */
  readonly online = $derived(isOnline(this.show.connected, this.show.showOnline));
  readonly scene = $derived(sceneContext(this.show.flow, this.show.state));
  readonly controls = $derived(controlsModel({ state: this.show.state, flow: this.show.flow, online: this.online }));
  readonly inPlay = $derived(cardsInPlay(this.show.state?.cards.inPlay));
  readonly counted = $derived(this.show.state ? countedSongs(this.landingLog, this.show.state) : { ids: [], complete: false });
  readonly futureRevealed = $derived(this.show.state !== null && this.futureRevealedFor === roundKey(this.show.state.round));
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
      if (event.type === 'state') this.landingLog = recordLandings(this.landingLog, event);
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

  /** Send a command. When it can't leave this device, a toast says so. Returns its reqId, or null. */
  act = <C extends AnyCommandName>(cmd: C, ...args: AnyCommandArgs<C>): string | null => {
    const reqId = this.show.send(cmd, ...args);
    if (reqId === null) this.toast('error', S.toast.notSent(commandText(cmd)));
    else this.sent.remember(reqId);
    return reqId;
  };

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
    this.toast('error', S.toast.rejected(commandText(rejection.cmd), reasonText(rejection.reason)), rejection.detail ?? null);
  }

  toast(tone: ToastTone, text: string, detail: string | null = null): void {
    const id = ++this.toastSeq;
    this.toasts = pushToast(this.toasts, { id, tone, text, detail, untilMs: Date.now() + CONSOLE.toastMs }, CONSOLE.toastMax);
    setTimeout(() => this.dismiss(id), CONSOLE.toastMs);
  }

  dismiss(id: number): void {
    this.toasts = dismissToast(this.toasts, id);
  }

  /** The header shows the new label at once; commands carry it from the next reload. */
  setLabel(raw: string): void {
    this.label = normalizeLabel(raw, CONSOLE.labelMaxLength);
    writeStored(CONSOLE.storage.label, this.label);
  }

  setTheme(theme: Theme): void {
    this.theme = theme;
    writeStored(CONSOLE.storage.theme, theme);
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
