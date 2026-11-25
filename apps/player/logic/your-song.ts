// When the landed song is on one of the phone's cards (ANIMATIONS.md `your-song`, the user's D74): the screen turns
// gold behind a flash, with spotlights and particles, until the next Spin starts. Only cards that play this round
// count, and never in the Desgraciat round, where that landing sits the card down instead (`card-fall`). Pure.
import type { RoundKind, ShowScene } from '@quina/protocol';
import type { PublicLanding, PublicSpin } from '../feed/public.ts';

export interface YourSong {
  /** One per landing ("round:position"): a new key plays the look again, even for two of your songs in a row. */
  key: string;
  songId: number;
  /** When it landed, on the cloud's clock: the flash only marks a landing seen live (`YOUR_SONG_LIVE_MS`). */
  atMs: number;
}

/** A landing first seen this long after its `atMs` (opening the app, reconnecting) fades in quietly, with no flash. */
export const YOUR_SONG_LIVE_MS = 2000;

export interface YourSongInput {
  scene: ShowScene;
  paused: boolean;
  offline: boolean;
  round: { number: number; kind: RoundKind } | null;
  latest: PublicLanding | null;
  spin: PublicSpin | null;
  /** The songs on the phone's cards that play this round. */
  songs: ReadonlySet<number>;
  /** The cloud's clock. */
  nowMs: number;
}

/** The your-song look now, or null: off outside play, in a pause, offline, once the next Spin starts. */
export function yourSongOf({ scene, paused, offline, round, latest, spin, songs, nowMs }: YourSongInput): YourSong | null {
  if (scene !== 'play' || paused || offline || !round || round.kind === 'desgraciat' || !latest) return null;
  if (!songs.has(latest.songId)) return null;
  // The next Spin (a Suspense too) ends it as it starts; one announced for later leaves it on until then.
  if (spin && spin.startAtMs > latest.atMs && nowMs >= spin.startAtMs) return null;
  return { key: `${round.number}:${latest.position}`, songId: latest.songId, atMs: latest.atMs };
}

/** The look's entry: the flash for a landing seen live, else a quiet fade; reduced motion has neither. */
export function yourSongEntry(song: Pick<YourSong, 'atMs'>, nowMs: number, reduced: boolean): 'flash' | 'quiet' | 'still' {
  if (reduced) return 'still';
  return nowMs - song.atMs < YOUR_SONG_LIVE_MS ? 'flash' : 'quiet';
}

/** Every song on these cards (the playing ones: `PlayerApp.playingViews`). */
export function songsOnCards(views: readonly { card: { lines: readonly (readonly number[])[] } | null }[]): Set<number> {
  const out = new Set<number>();
  for (const v of views) for (const line of v.card?.lines ?? []) for (const id of line) out.add(id);
  return out;
}
