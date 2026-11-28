// The home's empty state (D290, 28 Nov; the user: «no banner, simply 2 floating buttons centred and a text»): a phone
// that follows no card shows «Afegir cartrons» with «Escanejar el QR» and «Escriure el número», centred in the view's
// free space (EmptyCards). On Cartrons it shows whenever there are no cards. On Historial only while the round has no
// song to list (before the night, between rounds, before the first Landing): its own line would be all there is, and
// a first open lands there (logic/tabs.ts). Once songs are listed Historial keeps them, and the call waits on Cartrons.
// A phone whose cards all sit out this round («No juguen en aquesta quina») is not empty. Pure.
import type { AraView } from './tabs.ts';

export function showsEmptyCards(view: AraView, cardCount: number, songCount: number): boolean {
  if (cardCount > 0) return false;
  return view === 'cartrons' || songCount === 0;
}
