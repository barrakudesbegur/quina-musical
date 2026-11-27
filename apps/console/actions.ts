// The console's controls (components-v2.md § 11.3; D205, D210): each one's look, words, sound and Wii key in one
// preset, spread into a generic component: `<Button {...ACTIONS.next} onclick={…} />`. The concepts' colours come
// from packages/ui/concepts.ts; this file adds what only the console shows (its notes, its icon set's drawings, the
// remote's keys). Labels come from strings.ts, never typed here. Pure data and pure helpers, tested in
// apps/show/tests/ui/ds/registry.test.ts.
import { CONCEPTS } from '../../packages/ui/concepts.ts';
import type { ButtonColor, ButtonPreset, WiiKeySpec } from '../../packages/ui/components/types.ts';
import type { LineIconName } from '../../packages/ui/icons/line.ts';
import { S } from './strings.ts';

/** A console preset: a Button's look, its icon named by its drawing (packages/ui/icons). Labels may be overridden where
 *  the words depend on the show (a card number); the preset holds the usual words. */
export type ConsolePreset = Omit<ButtonPreset, 'color'> & {
  readonly color: ButtonColor;
  /** A TwoLevelButton's second level, on the strip at its foot, in the same palette as the top (D-k). */
  readonly level2?: { readonly label: string; readonly icon: LineIconName };
};

/** The remote's keys on the console's controls, as wii/mapping.ts assigns them. */
export const WII = {
  /** The default action. */
  a: { keys: ['a'] },
  /** Enrere: 1 or 2 held. */
  back: { keys: ['one', 'two'], hold: true, size: 'sm' },
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
  back: { color: colorOf('back'), icon: 'undo', label: S.cluster.back },
  claim: { color: colorOf('claim'), icon: 'rosette', label: S.cluster.claim },
  hold: { color: colorOf('hold'), icon: 'mic', label: S.cluster.talk, note: S.cluster.talkNote, level2: { label: S.cluster.pauseLevel, icon: 'pause' } },
  stay: { color: colorOf('stay'), icon: 'hand', label: S.cluster.stay, note: S.cluster.stayNote, level2: { label: S.cluster.suspense, icon: 'drum' } },
  next: { color: colorOf('next'), size: 'l', icon: 'skip', label: S.cluster.next },
  roundIntro: { color: colorOf('next'), size: 'l', icon: 'play', label: S.interval.start, note: S.interval.startNote },
  throw: { color: colorOf('throw'), pattern: 'stripes', icon: null, label: CONCEPTS.throw.label },
  storm: { color: colorOf('storm'), pattern: 'stripes', icon: null, label: CONCEPTS.storm.label },
  finaleAdd: { color: colorOf('claim'), size: 's', icon: 'plus', label: S.finale.add, note: S.finale.addNote },
  finaleCue: { color: colorOf('celebration'), icon: 'star', label: S.finale.celebrate, ring: 'gold' },

  // ---- the menu's long presses (Menu, ResumePanel: LongPressButton rows) ----
  confirmLine: { color: colorOf('claim'), icon: 'check', label: S.menu.confirmLine, note: S.menu.confirmLineNote },
  panic: { color: colorOf('back'), icon: 'warning', label: S.menu.panic, note: S.menu.panicNote },
  endNight: { color: colorOf('back'), variant: 'plain', icon: 'power', label: S.menu.end, note: S.menu.endNote },
  resume: { color: colorOf('celebration'), icon: 'play', label: S.resume.send, note: S.resume.sendNote },

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
