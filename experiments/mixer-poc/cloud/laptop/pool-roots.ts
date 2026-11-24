// Which folders of a pool the media sync covers on a laptop (laptop/media-sync.ts), by sync root: what the relay
// serves for playback. Pool locations come from relay/pool.ts, the one place that resolves a pool.
import path from 'node:path';
import { POC, type Pool } from '../../relay/pool.ts';
import type { RootDir } from './media-sync.ts';

/** The pool's playback files on this laptop, by sync root (the relay serves them from these folders). */
export function poolRoots(pool: Pool): RootDir[] {
  const shared = path.resolve(POC, '../..');
  const roots: RootDir[] = [
    // Not the Blend renders (made on demand), other pools' folders, or what has its own root.
    { root: 'cache', dir: pool.cacheDir, exclude: (rel) => /^(stretch|pools|hold)\//.test(rel) },
    // Not the Spotify features: they stay on the machine that fetched them.
    { root: 'data', dir: pool.dataDir, exclude: (rel) => /^(pools|hold)\//.test(rel) || rel === 'spotify_features.json' },
    { root: 'covers', dir: pool.coversDir },
    { root: 'overrides', dir: pool.overridesDir },
    { root: 'hold-cache', dir: path.join(POC, 'cache', 'hold') },
    { root: 'hold-data', dir: path.join(POC, 'data', 'hold') },
    { root: 'fx', dir: path.join(shared, 'client/public/audios/fx') },
    { root: 'stingers', dir: path.join(shared, 'client/public/audios/stingers') },
  ];
  if (pool.cardsJson) roots.push({ root: 'cards', dir: path.dirname(pool.cardsJson), exclude: (rel) => rel !== path.basename(pool.cardsJson as string) });
  return roots;
}
