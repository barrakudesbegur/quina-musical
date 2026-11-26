// Which buttons the thumb cluster shows, and where (the Consola-Joc and Consola-Llancament-Tempesta boards). Pure.
//   - play, a round's start, a Celebration: «Enrere» and «Comprovar» on top, Parlem and Aguanta, Següent at the bottom.
//     In the night's last round «Tempesta» (the corn-seed storm, D155) joins the top row, between «Enrere» and
//     «Comprovar» on the play screen and between «Enrere» and «Revisió manual» in its Check (CheckPanel). Not in the last
//     round's Celebration (U138: today's behaviour);
//   - a break (D195): «Comença la quina» is the big button. «Llançament» is a slim line along the top, where «Enrere»
//     and «Comprovar» were: neither can act in a break (the engine takes no claim and no Enrere there), so they go;
//   - the end (D194, D199): «Tempesta» alone in the big place, under Parlem and Aguanta; no «Enrere» or «Comprovar»;
//   - before the night: «Llançament» in the big place, with «Enrere» and «Comprovar» on top as today. What the doors
//     show is with the user (U173), so they wait.
import type { ShowScene, ThrowSong } from '@quina/protocol';

export interface ClusterLayout {
  /** «Enrere» and «Comprovar» in the top row. */
  backAndClaim: boolean;
  /** A throw song's slim line along the top, in their place (a break), or null. */
  line: ThrowSong | null;
  /** «Tempesta» in the top row, between «Enrere» and «Comprovar» (the night's last round), or null. */
  top: ThrowSong | null;
  /** The big bottom place: Següent, «Comença la quina» (a break), or a throw song's button. */
  big: 'next' | 'roundIntro' | ThrowSong;
}

export function clusterLayout(scene: ShowScene, lastRound: boolean): ClusterLayout {
  switch (scene) {
    case 'before':
      return { backAndClaim: true, line: null, top: null, big: 'throw' };
    case 'interval':
      return { backAndClaim: false, line: 'throw', top: null, big: 'roundIntro' };
    case 'after':
      return { backAndClaim: false, line: null, top: null, big: 'storm' };
    case 'play':
    case 'check':
      return { backAndClaim: true, line: null, top: lastRound ? 'storm' : null, big: 'next' };
    case 'roundStart':
    case 'celebration':
      return { backAndClaim: true, line: null, top: null, big: 'next' };
  }
}

/** The throw songs a layout shows (each is on screen once at most). */
export function shownThrowSongs(layout: ClusterLayout): ThrowSong[] {
  return [layout.line, layout.top, layout.big].filter((b): b is ThrowSong => b === 'throw' || b === 'storm');
}
