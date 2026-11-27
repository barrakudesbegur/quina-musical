// What the home (AraHome) tells the controls that float over it (HomeFloats): they live outside the home's masked scroll
// box, so its fades never hide them, but follow the home's swipe and its cards (ANIMATIONS.md `add-card-float`,
// `card-hint`, `drum-pick`).

import type { HintSide } from './home-swipe.ts';

export interface HomeUi {
  /** Cartrons' share of the screen (0 Historial … 1 Cartrons), for «+ Cartró». */
  addShare: number;
  /** A swipe is following the finger: no transitions of their own. */
  following: boolean;
  /** The card holding the playing song is off screen (on Cartrons): which way it is, and its mark. */
  hint: { side: HintSide; identity: number; cardId: number } | null;
  /** Where the top hint sits: under the stuck strip (px from the screen's top). */
  hintTop: number;
  /** Scroll to the first card holding the playing song (AraHome's `drum-pick`). */
  pick: (() => void) | null;
}

export const homeUi: HomeUi = $state({ addShare: 0, following: false, hint: null, hintTop: 0, pick: null });
