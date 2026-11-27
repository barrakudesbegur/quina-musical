// The player app's controls (components-v2.md § 11.4; D205, D210): each one's look, words and sound in one preset,
// spread into a generic component: `<Button {...PLAYER.addCard} onclick={…} />`. Labels come from strings.ts, never
// typed here. Pure data, tested in apps/show/tests/ui/ds/registry.test.ts.
import type { ButtonColor, ButtonPreset, IconName, ToastPreset } from '../../packages/ui/components/types.ts';
import { S } from './strings.ts';

/** A phone preset: a Button's look, its icon named by its drawing (packages/ui/icons). */
export type PlayerPreset = Omit<ButtonPreset, 'color'> & { readonly color: ButtonColor };

export const PLAYER = {
  /** «+ Cartró» where a list of cards ends or is empty (AddCardPrompt, CardsList, LegacyNotice). */
  addCard: { color: 'orange', size: 'l', icon: 'plus', label: S.addCard },
  /**
   * «+ Cartró» floating at the end of the cards list (D188, D218): a quiet pill, navy on the night sky with the floating
   * shadow, since it claims less attention than the cards (the user's phone test, 27 Nov). The home places it.
   */
  addCardFloating: { color: 'navy', floating: true, size: 's', icon: 'plus', label: S.addCard, sound: 'floating' },
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
  /** «Descartar» there: the destructive one, a soft red Button with the bin (C4, D188). */
  discardChanges: { color: 'red', variant: 'soft', size: 's', icon: 'trash', label: S.discardYes },
  close: { color: 'navy', size: 'l', label: S.close },
  ok: { color: 'navy', size: 'l', label: S.ok },
} as const satisfies Record<string, PlayerPreset>;

export type PlayerActionId = keyof typeof PLAYER;

/** An IconButton's preset (A7): its drawing, look and name; a card's own name comes from the call site. */
export interface PlayerIconPreset {
  readonly icon: IconName;
  readonly label?: string;
  readonly variant?: 'framed' | 'bare';
  readonly color?: 'surface' | 'navy' | 'grey' | 'red' | 'gold' | 'snow';
  readonly size?: 's' | 'm';
}

/** The phone's icon-only buttons (IconButton, components-v2.md § 11.4). */
export const PLAYER_ICONS = {
  /** The header's Ajustos: the plain cog on a rounded square (D87). */
  settings: { icon: 'cog', label: S.settings },
  /** A sheet's ‹ and ✕ (R7 places them), navy on the sheet. */
  sheetBack: { icon: 'chevron-left', label: S.back, color: 'navy' },
  sheetClose: { icon: 'close', label: S.close, color: 'navy' },
  /** A card's edit and remove in Ajustos: bare icons in the row. */
  cardEdit: { icon: 'pencil', variant: 'bare' },
  cardRemove: { icon: 'trash', variant: 'bare' },
} as const satisfies Record<string, PlayerIconPreset>;

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
