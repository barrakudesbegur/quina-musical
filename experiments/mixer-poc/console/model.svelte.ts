// The console's state, one per page: the engine's view (ShowStore, through ui/client), the Game plan, the
// printed cards' song titles, this device's label, theme and checklist, and the toasts. It derives what the
// components need from the pure logic in logic/, and `act` is the one way commands leave the console.
import type { CommandRejected, ResumePoint } from '@quina/protocol';
import { createShow, type ShowStore } from '../ui/client/show.svelte.ts';
import { loadCatalog, type Catalog } from '../ui/data/catalog.ts';
import { LocalPlanStore, loadPlanForPage } from '../ui/data/plan-store.ts';
import type { AnyCommandArgs, AnyCommandName } from '../ui/flow.ts';
import type { GamePlan } from '../ui/plan.ts';
import { CONSOLE, DEFAULT_THEME, type Theme } from './config.ts';
import { lastSpinOf, parseChecklist, resolveLabel, resolveTheme, normalizeLabel, type LastSpin } from './logic/device.ts';
import { cardsInPlay } from './logic/possible-winners.ts';
import { canSend, controlsModel, sceneContext } from './logic/scene.ts';
import { nextSavedCode, resumeCommand } from '../ui/rules/resume.ts';
import { consoleAlert, isOnline } from './logic/status.ts';
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

export class ConsoleModel {
  /** This device's label, shown in the header. It also starts this console's clientId and reqIds. */
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

  /** Commands can reach the engine (relay connected, show page on it). */
  readonly online = $derived(isOnline(this.show.connected, this.show.showOnline));
  readonly scene = $derived(sceneContext(this.show.flow));
  readonly controls = $derived(controlsModel({ state: this.show.state, flow: this.show.flow, online: this.online }));
  readonly inPlay = $derived(cardsInPlay(this.show.state?.cards.inPlay));
  readonly alert = $derived(
    consoleAlert({ connected: this.show.connected, showOnline: this.show.showOnline, hasState: this.show.state !== null, status: this.show.state?.status ?? null }),
  );

  private readonly sent = new SentLog(CONSOLE.sentLogSize);
  private toastSeq = 0;

  constructor() {
    const planStore = new LocalPlanStore();
    this.plan = loadPlanForPage(planStore);
    planStore.subscribe(() => (this.plan = loadPlanForPage(planStore)));

    // Song titles for the Check steps; without cards.json the snapshot's titles and "Cançó N" remain.
    loadCatalog()
      .then((catalog) => (this.catalog = catalog))
      .catch(() => undefined);

    // Who started each Spin: the reqId starts with the sender's device label (null: auto-advance).
    this.show.client.on((event) => {
      if (event.type === 'transition.scheduled' || event.type === 'suspense.started') this.lastSpin = lastSpinOf(event);
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

  toggleChecklist(id: string): void {
    this.checklist = this.checklist.includes(id) ? this.checklist.filter((x) => x !== id) : [...this.checklist, id];
    writeStored(CONSOLE.storage.checklist, JSON.stringify(this.checklist));
  }
}
