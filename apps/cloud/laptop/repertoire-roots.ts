// Which folders of a repertoire the media sync covers on a laptop (laptop/media-sync.ts), by sync root: what the
// relay serves for playback. Its locations come from relay/repertoire.ts, the one place that resolves a repertoire.
import path from 'node:path';
import { CACHE, MEDIA, OUT, type Repertoire } from '../../show/relay/repertoire.ts';
import type { RootDir } from './media-sync.ts';

/** The repertoire's playback files on this laptop, by sync root (the relay serves them from these folders). */
export function repertoireRoots(repertoire: Repertoire): RootDir[] {
  const roots: RootDir[] = [
    // Not the Blend renders (made on demand), other repertoires' folders, what has its own root, the download tools
    // (tools/), or the relay's pairing token (a secret: each laptop makes its own).
    { root: 'cache', dir: repertoire.cacheDir, exclude: (rel) => /^(stretch|repertoires|hold|interval|voice|tools)\//.test(rel) || rel === 'relay-token' },
    // Not the Spotify features (they stay on the machine that fetched them), or the listening demo (not playback).
    { root: 'data', dir: repertoire.dataDir, exclude: (rel) => /^(repertoires|hold|interval|voice|listen-demo)\//.test(rel) || rel === 'spotify_features.json' },
    { root: 'covers', dir: repertoire.coversDir },
    { root: 'overrides', dir: repertoire.overridesDir },
    // Not hold.py's audition renders (each loop three times, to hear its seam): listening checks, not playback.
    { root: 'hold-cache', dir: path.join(CACHE, 'hold'), exclude: (rel) => rel.startsWith('audition/') },
    { root: 'hold-data', dir: path.join(OUT, 'hold') },
    // The Interval playlist, shared by every repertoire like the Hold music (the relay serves it from these folders).
    { root: 'interval-cache', dir: path.join(CACHE, 'interval') },
    { root: 'interval-data', dir: path.join(OUT, 'interval') },
    // The voice cues (D198, D202–D204), shared too: tools/prep/voices.py prepares them from the user's recordings
    // (data/media/voice/, never synced) into these folders, which the relay serves.
    { root: 'voice-cache', dir: path.join(CACHE, 'voice') },
    { root: 'voice-data', dir: path.join(OUT, 'voice') },
    { root: 'fx', dir: path.join(MEDIA, 'fx') },
    { root: 'stingers', dir: path.join(MEDIA, 'stingers') },
  ];
  // The printed cards and their types (card-types.json, beside cards.json as apps/cards writes it), nothing else
  // of that folder (the PDFs).
  if (repertoire.cardsJson) {
    const keep = new Set([path.basename(repertoire.cardsJson), 'card-types.json']);
    roots.push({ root: 'cards', dir: path.dirname(repertoire.cardsJson), exclude: (rel) => !keep.has(rel) });
  }
  return roots;
}
