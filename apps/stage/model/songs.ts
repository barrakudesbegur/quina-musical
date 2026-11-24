// Which songs the projector may name, and which of them show now. A song is revealed ONLY by its landing:
// a `transition.landed` event, or the snapshot's `landings` and `current`. Never by `next`,
// `transition.to` or the drum's target. A revealed song shows from its landing time (`atMs`, the show's
// clock), so a message that arrives a little early never names it before the drum stops. Pure.
import type { LandingUndone, ShowState, TransitionLanded } from '@quina/protocol';

/** A landed song, as the stage may draw it. */
export interface StageSong {
  songId: number;
  /** Null when neither the snapshot nor the catalog knows it. */
  title: string | null;
  artist: string | null;
  /** The landing (show clock, epoch ms). */
  atMs: number;
}

/** A `transition.landed` the stage saw before a snapshot included it. */
export interface LandedNote {
  songId: number;
  position: number;
  atMs: number;
}

/** Title and artist of a song id, from the catalog (cards.json), or null. */
export type SongLookup = (songId: number) => { title: string; artist: string } | null;

export const noteOf = (event: Pick<TransitionLanded, 'songId' | 'position' | 'atMs'>): LandedNote => ({
  songId: event.songId,
  position: event.position,
  atMs: event.atMs,
});

/**
 * The notes still needed after a snapshot: those newer than it and past its position. Anything older is
 * already in the snapshot's landings (or was undone there).
 */
export function pruneNotes(notes: readonly LandedNote[], state: Pick<ShowState, 'atMs' | 'queue'>): LandedNote[] {
  return notes.filter((n) => n.position > state.queue.position && n.atMs > state.atMs);
}

/** Back undid the landing at `position`: drop it (and anything after it). */
export function undoNotes(notes: readonly LandedNote[], undone: Pick<LandingUndone, 'position'>): LandedNote[] {
  return notes.filter((n) => n.position < undone.position);
}

/**
 * Every revealed song of the round, newest first: the snapshot's counted landings, plus notes it does not
 * have yet, plus `current` when no landing names it (an engine that sends no landings).
 */
export function revealedSongs(
  state: Pick<ShowState, 'landings' | 'current' | 'queue'> | null,
  notes: readonly LandedNote[],
  lookup: SongLookup,
): StageSong[] {
  const byPosition = new Map<number, StageSong>();
  const named = (songId: number, title: string | null | undefined, artist: string | null | undefined, atMs: number): StageSong => {
    const known = title ? null : lookup(songId);
    return { songId, title: title || known?.title || null, artist: (title ? artist : known?.artist) || null, atMs };
  };
  for (const l of state?.landings ?? []) {
    if (!l.undone) byPosition.set(l.position, named(l.songId, l.title, l.artist, l.atMs));
  }
  for (const n of notes) {
    if (!byPosition.has(n.position)) byPosition.set(n.position, named(n.songId, null, null, n.atMs));
  }
  const current = state?.current;
  if (current && ![...byPosition.values()].some((s) => s.songId === current.songId)) {
    // No landing time is known for it: it has landed, so it shows at once.
    byPosition.set(state.queue.position, named(current.songId, current.title, current.artist, 0));
  }
  return [...byPosition.entries()].sort((a, b) => b[0] - a[0]).map(([, song]) => song);
}

/** The songs on screen at `nowMs`: landed by then, newest first, at most `count`. */
export function visibleSongs(songs: readonly StageSong[], nowMs: number, count: number): StageSong[] {
  return songs.filter((s) => s.atMs <= nowMs).slice(0, Math.max(0, count));
}

/** A stable key for a list of visible songs (to skip DOM writes when nothing changed). */
export const songsKey = (songs: readonly StageSong[]): string => songs.map((s) => `${s.songId}@${s.atMs}`).join(',');
