// «Ara sona» in one line (D196, D199), where the full panel has no room: over the claim pad, over the finalists' pad,
// over Cerca while its box has the focus, and on the Check board (the Consola-Comprovacio-Revisio board's line). It
// names what sounds now, the first that applies:
//   - a throw song playing over everything («Llançament», «Tempesta»);
//   - the playlist of the breaks, of Pausa or of the end (`intervalMusic`), once its track is known;
//   - the music played instead of the song: the hold music, or a failed Check's error music (the ring's `holdMusic`,
//     as NowPlaying names it);
//   - the round's song (`current`);
//   - nothing.
// In a Check, the music from before it keeps playing far down (D118, D191): `low`. Pure.
import type { ShowScene, ShowState, ThrowSong } from '@quina/protocol';

/** The music the ring says plays instead of the song (NowPlaying's `music`). */
export type InsteadMusic = 'hold' | 'error';

export type NowSound =
  | { kind: 'throw'; song: ThrowSong; title: string; artist: string }
  | { kind: 'playlist'; title: string; artist: string }
  | { kind: 'music'; music: InsteadMusic }
  | { kind: 'song'; songId: number; title: string; artist: string }
  | { kind: 'none' };

export interface NowLineView {
  sound: NowSound;
  /** Far down under the Check (D118, D191). */
  low: boolean;
}

export function nowLine(state: ShowState, scene: ShowScene, instead: InsteadMusic | null): NowLineView {
  return { sound: nowSound(state, instead), low: scene === 'check' };
}

function nowSound(state: ShowState, instead: InsteadMusic | null): NowSound {
  const thrown = state.throwSong;
  if (thrown?.playing) return { kind: 'throw', song: thrown.song, title: thrown.title, artist: thrown.artist };
  const track = state.intervalMusic?.track;
  if (track) return { kind: 'playlist', title: track.title, artist: track.artist };
  if (instead) return { kind: 'music', music: instead };
  if (state.current) return { kind: 'song', songId: state.current.songId, title: state.current.title, artist: state.current.artist };
  return { kind: 'none' };
}
