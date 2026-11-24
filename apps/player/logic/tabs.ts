// The player app's sections (the user's decision, 24 Nov): three tabs, Ara, Premis and Horari, plus a menu
// sheet of its own. Ara shows the drum on top and, under it, either Historial or the player's Cartrons.
// The tab bar is list-driven, so the drawers layout (still a proposal) would only swap the container.
export const TAB_IDS = ['ara', 'premis', 'horari'] as const;
export type TabId = (typeof TAB_IDS)[number];

/** What Ara shows under the drum: the Historial | Cartrons switch. */
export const ARA_VIEWS = ['historial', 'cartrons'] as const;
export type AraView = (typeof ARA_VIEWS)[number];

export const isAraView = (v: unknown): v is AraView => typeof v === 'string' && (ARA_VIEWS as readonly string[]).includes(v);

export interface AraViewInput {
  /** Shown for this visit only: after a card is added, its cards (the player's saved choice stays as it was). */
  session: AraView | null;
  /** The player's choice on this device (PlayerData.araView), or null until they tap the switch. */
  saved: AraView | null;
  /** How many cards the phone follows. */
  cardCount: number;
}

/** Which view Ara shows: this visit's, else the device's choice, else Cartrons for a player who follows cards. */
export function araViewFor({ session, saved, cardCount }: AraViewInput): AraView {
  return session ?? saved ?? (cardCount > 0 ? 'cartrons' : 'historial');
}
