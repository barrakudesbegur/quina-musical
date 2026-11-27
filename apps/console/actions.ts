// The console's controls (components-v2.md § 11.3; D205, D210): each one's look, words, sound and Wii key in one
// preset, spread into a generic component: `<Button {...ACTIONS.next} onclick={…} />`. The concepts' colours come
// from packages/ui/concepts.ts; this file adds what only the console shows (its notes, its icon set's drawings, the
// remote's keys). Labels come from strings.ts, never typed here. Pure data and pure helpers, tested in
// apps/show/tests/ui/ds/registry.test.ts.
import { CONCEPTS } from '../../packages/ui/concepts.ts';
import type { ButtonColor, ButtonPreset, IconName, NoticePreset, ToastPreset, WiiKeySpec } from '../../packages/ui/components/types.ts';
import type { LineIconName } from '../../packages/ui/icons/line.ts';
import type { ToastTone } from './logic/toasts.ts';
import { S } from './strings.ts';

/** A console preset: a Button's look, its icon named by its drawing (packages/ui/icons). Labels may be overridden where
 *  the words depend on the show (a card number); the preset holds the usual words. */
export type ConsolePreset = Omit<ButtonPreset, 'color'> & {
  readonly color: ButtonColor;
  /** A TwoLevelButton's second level, on the strip at its foot, in the same palette as the top (D-k). */
  readonly level2?: { readonly label: string; readonly icon: LineIconName; readonly wii?: WiiKeySpec };
  /** A LongPressButton's layout: a Button (the default) or the menu's row (A2). */
  readonly layout?: 'button' | 'row';
};

/** The remote's keys on the console's controls, as wii/mapping.ts assigns them. */
export const WII = {
  /** The default action. */
  a: { keys: ['a'] },
  /** Enrere: 1 or 2 held. */
  back: { keys: ['one', 'two'], hold: true, size: 'sm' },
  /** Parlem: − or + (a tap); Pausa: − or + held, on its strip. */
  hold: { keys: ['minus', 'plus'] },
  pause: { keys: ['minus', 'plus'], hold: true, size: 'sm' },
  /** Aguanta: B held; Suspens: B + A held, on its strip (D144, D147). */
  stay: { keys: ['b'], hold: true },
  suspense: { keys: ['b'], hold: true, withA: true, size: 'sm' },
  /** Enrere inside a Check: a single press takes the last mark off (D127, D134). */
  checkBack: { keys: ['one', 'two'], size: 'sm' },
  /** − or + held in a Check: «Revisió manual» (D128). */
  review: { keys: ['minus', 'plus'], hold: true, size: 'sm' },
} as const satisfies Record<string, WiiKeySpec>;

/** A concept's colour, from the shared registry (only the colours a Button takes). */
function colorOf(id: 'back' | 'next' | 'claim' | 'checkReveal' | 'review' | 'celebration' | 'checkFail' | 'hold' | 'stay' | 'throw' | 'storm'): ButtonColor {
  return CONCEPTS[id].color;
}

export const ACTIONS = {
  // ---- the cluster (ThumbCluster) ----
  back: { color: colorOf('back'), icon: 'undo', label: S.cluster.back, note: S.cluster.backHint, wii: WII.back },
  claim: { color: colorOf('claim'), icon: 'rosette', label: S.cluster.claim },
  // R3: on (level 1) pans the stripes; level 2's strip pans the dots (TwoLevelButton draws them).
  hold: { color: colorOf('hold'), pattern: 'stripes', icon: 'mic', label: S.cluster.talk, note: S.cluster.talkNote, wii: WII.hold, level2: { label: S.cluster.pauseLevel, icon: 'pause', wii: WII.pause } },
  stay: { color: colorOf('stay'), pattern: 'stripes', icon: 'hand', label: S.cluster.stay, note: S.cluster.stayNote, wii: WII.stay, level2: { label: S.cluster.suspense, icon: 'drum', wii: WII.suspense } },
  next: { color: colorOf('next'), size: 'l', icon: 'skip', label: S.cluster.next },
  roundIntro: { color: colorOf('next'), size: 'l', icon: 'play', label: S.interval.start, note: S.interval.startNote },
  // Stripes only while the song plays (R3, #20); the strip restarts it from its hook (D138).
  throw: { color: colorOf('throw'), pattern: 'stripes', icon: null, label: CONCEPTS.throw.label, level2: { label: S.throws.restart, icon: 'restart' } },
  storm: { color: colorOf('storm'), pattern: 'stripes', icon: null, label: CONCEPTS.storm.label, level2: { label: S.throws.restart, icon: 'restart' } },
  finaleAdd: { color: colorOf('claim'), size: 's', icon: 'plus', label: S.finale.add, note: S.finale.addNote },
  finaleCue: { color: colorOf('celebration'), icon: 'star', label: S.finale.celebrate, ring: 'gold' },

  // ---- the menu's long presses (Menu, ResumePanel: LongPressButton rows) ----
  confirmLine: { color: colorOf('claim'), layout: 'row', icon: 'check', label: S.menu.confirmLine, note: S.menu.confirmLineNote },
  panic: { color: colorOf('back'), layout: 'row', icon: 'warning', label: S.menu.panic, note: S.menu.panicNote },
  endNight: { color: colorOf('back'), layout: 'row', variant: 'plain', icon: 'power', label: S.menu.end, note: S.menu.endNote },
  resume: { color: colorOf('celebration'), layout: 'row', icon: 'play', label: S.resume.send, note: S.resume.sendNote },

  // ---- the Check (CheckPanel) ----
  checkBack: { color: colorOf('back'), icon: 'undo', label: S.check.back, note: S.check.backNote, wii: WII.checkBack },
  checkReview: { color: colorOf('review'), label: S.check.review, note: S.check.reviewNote, wii: WII.review },
  addCandidate: { color: colorOf('claim'), icon: 'plus', label: S.check.add },
  checkAuto: { color: colorOf('hold'), pattern: 'stripes', icon: 'fast-forward', iconPlacement: 'top', label: S.check.auto.label },
  checkReveal: { color: colorOf('checkReveal'), icon: 'eye', label: S.check.big.reveal, note: S.check.big.revealNote },
  checkRevealing: { color: colorOf('checkReveal'), icon: 'fast-forward', label: S.check.big.revealing },
  checkValid: { color: colorOf('claim'), icon: 'check', label: S.check.big.validNext, note: S.check.big.validNextNote },
  checkCelebrate: { color: colorOf('celebration'), icon: 'star', label: S.check.big.celebrate, note: S.check.big.celebrateNote, ring: 'gold' },
  checkFail: { color: colorOf('checkFail'), icon: 'close', label: S.check.big.fail, note: S.check.big.failNote, ring: 'red' },

  // ---- the claim pad and the finalists' pad (ClaimPad, FinalePad) ----
  padCancel: { color: 'grey', label: S.numpad.cancel },
  /** «+ Candidat»: silent at the press; the chip's own sound plays once the number is in (or refused). */
  padAdd: { color: colorOf('claim'), icon: 'plus', label: S.numpad.add, sound: null },
  padSubmit: { color: colorOf('claim'), icon: 'check', label: S.numpad.submit([]), sound: 'submit' },
  finaleClose: { color: 'grey', icon: 'play', label: S.finale.close },
  finaleGo: { color: colorOf('claim'), icon: 'podium', iconPlacement: 'top', label: S.finale.begin, sound: 'submit' },
  // ---- the finale's head (FinaleStage): the compact height (D-h, #87), the small buttons' sound ----
  /** «Editar»: a toggle; on, it turns gold (`finaleEditOn`). */
  finaleEdit: { color: 'grey', variant: 'soft', size: 'xs', icon: 'pencil', label: S.finale.edit, sound: 'small' },
  finaleEditOn: { color: colorOf('celebration'), size: 'xs', icon: 'pencil', label: S.finale.edit, sound: 'small' },
  finaleAddOne: { color: colorOf('claim'), size: 'xs', icon: 'plus', label: S.finale.addOne, sound: 'small' },

  // ---- the review (ReviewPanel) ----
  reviewContinue: { color: colorOf('checkReveal'), icon: 'eye', iconPlacement: 'top', label: S.review.continue },
  reviewWin: { color: colorOf('celebration'), icon: 'star', iconPlacement: 'top', label: S.review.win, note: S.review.winNote },
  reviewLose: { color: colorOf('checkFail'), icon: 'close', iconPlacement: 'top', label: S.review.lose, note: S.review.loseNote },
  reviewDiscard: { color: 'grey', icon: 'trash', iconPlacement: 'top', label: S.review.discard, note: S.review.discardNote },
  reviewConfirmBack: { color: 'grey', label: S.review.confirm.cancel },
  reviewConfirmWin: { color: colorOf('celebration'), icon: 'star', label: S.review.confirm.yes.win },
  reviewConfirmLose: { color: colorOf('checkFail'), icon: 'close', label: S.review.confirm.yes.lose },
} as const satisfies Record<string, ConsolePreset>;

export type ConsoleActionId = keyof typeof ACTIONS;

/** The toasts (E3, Toasts.svelte): a rejected command is red, urgent, with the alert; a notice is navy with the check.
 *  Both on paper, their bottom edge in their colour (#85). */
export const TOASTS = {
  error: { color: 'red', variant: 'paper', icon: 'warning', urgent: true },
  info: { color: 'navy', variant: 'paper', icon: 'check' },
} as const satisfies Record<ToastTone, ToastPreset>;

/** A MiniButton's preset (A4): its look and words; a toggle's `pressed` and a preset's `variant` come from the show. */
export interface MiniPreset {
  readonly label?: string;
  readonly icon?: IconName;
  readonly color?: 'grey' | 'gold' | 'green' | 'orange';
  readonly pressedColor?: 'gold' | 'green';
  readonly size?: 'xs' | 's' | 'm' | 'l';
  readonly sound?: ButtonPreset['sound'];
  readonly wii?: WiiKeySpec;
}

/** The console's small buttons (MiniButton, components-v2.md § 11.3: lock, auto, pace, future…). */
export const MINI = {
  // ---- Ritme (PacePanel)
  lock: { icon: 'lock', label: S.pace.lock },
  /** «Auto»: green while on, with HOME on its corner. */
  auto: { icon: 'cycle', label: S.pace.auto, pressedColor: 'green', wii: { keys: ['home'], size: 'sm' } },
  paceMinus: { icon: 'minus' },
  pacePlus: { icon: 'plus' },
  // ---- Futur
  futureShow: { color: 'gold', icon: 'eye', label: S.future.show },
  // ---- the menu and its dialogs
  labelSave: { label: S.menu.labelSave },
  nightStart: { color: 'orange', icon: 'play', label: S.menu.start },
  roundsMinus: { size: 's', icon: 'minus' },
  roundsPlus: { size: 's', icon: 'plus' },
  wiiConnect: { label: S.wii.connect },
  wiiOpen: { label: S.wii.open },
  wiiClose: { icon: 'close', label: S.wii.close },
  winnerEdit: { size: 'xs', label: S.winnerForm.edit },
  resumeUseSaved: { size: 's', label: S.resume.useSaved },
} as const satisfies Record<string, MiniPreset>;

/** The «Efectes» tab's two grids (SoundPad, A9; D-l): the fanfares gold in one column, the effects snow in four. */
export const FX = {
  stingers: { color: 'gold', columns: 1 },
  effects: { color: 'snow', columns: 4 },
} as const satisfies Record<string, { color: 'gold' | 'snow'; columns: number }>;

/** An IconButton's preset (A7); a label that names a card comes from the call site. */
export interface IconPreset {
  readonly icon: IconName;
  readonly label?: string;
  readonly variant?: 'framed' | 'bare';
  readonly floating?: boolean;
  readonly color?: 'surface' | 'navy' | 'grey' | 'red' | 'gold' | 'snow';
  readonly size?: 's' | 'm';
  readonly tooltip?: boolean;
  readonly sound?: ButtonPreset['sound'];
}

/** The console's icon-only buttons (IconButton): every one also shows its name as the mouse's tooltip. */
export const ICONS = {
  menu: { icon: 'menu', label: S.header.menu, color: 'grey', tooltip: true },
  /** A typed number's ✕ on its chip: a small rounded square, not a disc (D189). */
  removeChip: { icon: 'close', size: 's', tooltip: true, sound: 'chipRemove' },
  /** The ✕ on a standing finalist while editing: floating over the nino, so a disc (D189). */
  removeFinalist: { icon: 'close', floating: true, tooltip: true, sound: 'chipRemove' },
} as const satisfies Record<string, IconPreset>;

/** The controls that show together on one screen: no two may share a Wii key (the registry test checks it). */
export const SCREENS = {
  cluster: ['back', 'claim', 'hold', 'stay', 'next'],
  check: ['checkBack', 'checkReview', 'addCandidate', 'checkAuto', 'checkReveal'],
  review: ['reviewContinue', 'reviewWin', 'reviewLose', 'reviewDiscard'],
} as const satisfies Record<string, readonly ConsoleActionId[]>;

/**
 * The default action's look (D36, B6): the A key, and the orange ring unless the control already shows a cue's ring
 * (gold for «Recomanat» or the celebrate cue, red for the fail cue), so two rings never stack.
 */
export function asDefault<P extends ConsolePreset>(preset: P, isDefault: boolean): P {
  if (!isDefault) return preset;
  return { ...preset, ring: preset.ring ?? 'orange', wii: WII.a };
}

/** The notes (E4, Notice): the pace's recovery note and the review's warning on orange's tint; the pads' private strip
 *  in green when a card is fine, red when it's refused (the error red #E8363D with white words, as every ✗: notice.css,
 *  U175 item 4). */
export const NOTICES = {
  recovery: { layout: 'note', color: 'orange', fill: 'subtle', icon: 'stopwatch' },
  warning: { layout: 'box', color: 'orange', fill: 'subtle', icon: 'warning', live: 'off' },
  refused: { layout: 'note', color: 'red', fill: 'solid', icon: 'close', live: 'assertive' },
  accepted: { layout: 'note', color: 'green', fill: 'solid', icon: 'check' },
} as const satisfies Record<string, NoticePreset>;

/** E5 · Verdict (a recipe, components-v2.md § 6 and § 11): the Check's result on the console's card, by outcome. The
 *  bar's words take the palette's text shade, the fail's ✗ disc its fill. */
export const VERDICT_LOOKS = {
  pass: { color: CONCEPTS.claim.color },
  fail: { color: CONCEPTS.checkFail.color },
} as const satisfies Record<'pass' | 'fail', { readonly color: ButtonColor }>;
