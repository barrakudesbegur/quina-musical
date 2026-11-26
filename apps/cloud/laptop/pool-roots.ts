// Which folders of a pool the media sync covers on a laptop (laptop/media-sync.ts), by sync root: what the relay
// serves for playback. Pool locations come from relay/pool.ts, the one place that resolves a pool.
import path from 'node:path';
import { CACHE, MEDIA, OUT, type Pool } from '../../show/relay/pool.ts';
import type { RootDir } from './media-sync.ts';

/** The pool's playback files on this laptop, by sync root (the relay serves them from these folders). */
export function poolRoots(pool: Pool): RootDir[] {
  const roots: RootDir[] = [
    // Not the Blend renders (made on demand), other pools' folders, what has its own root, the download tools
    // (tools/), or the relay's pairing token (a secret: each laptop makes its own).
    { root: 'cache', dir: pool.cacheDir, exclude: (rel) => /^(stretch|pools|hold|interval|tools)\//.test(rel) || rel === 'relay-token' },
    // Not the Spotify features (they stay on the machine that fetched them), or the listening demo (not playback).
    { root: 'data', dir: pool.dataDir, exclude: (rel) => /^(pools|hold|interval|listen-demo)\//.test(rel) || rel === 'spotify_features.json' },
    { root: 'covers', dir: pool.coversDir },
    { root: 'overrides', dir: pool.overridesDir },
    // Not hold.py's audition renders (each loop three times, to hear its seam): listening checks, not playback.
    { root: 'hold-cache', dir: path.join(CACHE, 'hold'), exclude: (rel) => rel.startsWith('audition/') },
    { root: 'hold-data', dir: path.join(OUT, 'hold') },
    // The Interval playlist, shared by every pool like the Hold music (the relay serves it from these folders).
    { root: 'interval-cache', dir: path.join(CACHE, 'interval') },
    { root: 'interval-data', dir: path.join(OUT, 'interval') },
    { root: 'fx', dir: path.join(MEDIA, 'fx') },
    { root: 'stingers', dir: path.join(MEDIA, 'stingers') },
  ];
  // The printed cards and their types (card-types.json, beside cards.json as apps/cards writes it), nothing else
  // of that folder (the PDFs).
  if (pool.cardsJson) {
    const keep = new Set([path.basename(pool.cardsJson), 'card-types.json']);
    roots.push({ root: 'cards', dir: path.dirname(pool.cardsJson), exclude: (rel) => !keep.has(rel) });
  }
  return roots;
}
