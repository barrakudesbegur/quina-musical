// The player app's controls (components-v2.md § 11.4; D205, D210): each one's look, words and sound in one preset,
// spread into a generic component: `<Button {...PLAYER.addCard} onclick={…} />`. Labels come from strings.ts, never
// typed here. Pure data, tested in apps/show/tests/ui/ds/registry.test.ts.
import type { ButtonColor, ButtonPreset, ToastPreset } from '../../packages/ui/components/types.ts';
import { S } from './strings.ts';

/** A phone preset: a Button's look, its icon named by its drawing (packages/ui/icons). */
export type PlayerPreset = Omit<ButtonPreset, 'color'> & { readonly color: ButtonColor };

export const PLAYER = {
  /** «+ Cartró» where a list of cards ends or is empty (AddCardPrompt, CardsList, LegacyNotice). */
  addCard: { color: 'orange', size: 'l', icon: 'plus', label: S.addCard },
  /** The same in Ajustos: the smaller rounded rectangle (D189, D201). */
  addCardSmall: { color: 'orange', size: 's', icon: 'plus', label: S.addCard },
  /** The add-card pad's «Desar»: lit once the number is a card. */
  save: { color: 'green', size: 'm', icon: 'check', label: S.save, sound: 'submit' },
  /** The rename sheet's «Desar». */
  renameSave: { color: 'orange', size: 'l', label: S.save, sound: 'submit' },
  renameDiscard: { color: 'navy', size: 'l', label: S.renameDiscard },
  /** «Escriure el número» under the camera (D141). */
  typeNumber: { color: 'orange', size: 's', label: S.qrWrite },
  /** «Continuar» when leaving the pad with a number typed (D188). */
  keepEditing: { color: 'green', size: 's', icon: 'pencil', label: S.discardNo },
  close: { color: 'navy', size: 'l', label: S.close },
  ok: { color: 'navy', size: 'l', label: S.ok },
} as const satisfies Record<string, PlayerPreset>;

export type PlayerActionId = keyof typeof PLAYER;

/** A confirmation sheet's two answers: the risky yes in red, or the kind one in orange; the other is the neutral. */
export function confirmColors(danger: boolean): { yes: ButtonColor; no: ButtonColor } {
  return danger ? { yes: 'red', no: 'navy' } : { yes: 'navy', no: 'orange' };
}

/** The toasts (E3, Toast.svelte): a card added is green with its mark (the board's «Cartró #88 afegit»); any other
 *  notice is on paper, navy-edged (#85: the bottom edge in the toast's colour). */
export const PLAYER_TOASTS = {
  card: { color: 'green', variant: 'solid', icon: null },
  info: { color: 'navy', variant: 'paper', icon: null },
} as const satisfies Record<string, ToastPreset>;
