// The edition's songs (D116): each song of the repertoire as the edition file carries it, with its pool (D178).
// Read from the repertoire's songs.json (tools/prep/pools.py writes it from the pools' playlists); no audio,
// covers or hooks. Every screen shows the clean names (printTitle ?? title), so the edition carries them as its titles.
import fs from 'node:fs';
import { DEFAULT_POOL, type EditionSong } from '@quina/protocol';
import type { Repertoire } from '../../apps/show/relay/repertoire.ts';

/** songs.json's entries → the edition's songs, in its order: each with its print names (tools/prep/print_names.py)
 * as its plain title and artist, Spotify's own where it has none; a song without a `pool` is in pool "1". */
export function songsOf(json: unknown): EditionSong[] {
  if (!Array.isArray(json)) throw new Error('songs.json: a list of songs');
  return json.map((s: Record<string, unknown>) => ({
    id: s.id as number,
    title: String(s.printTitle ?? s.title ?? ''),
    artist: String(s.printArtist ?? s.artist ?? ''),
    pool: typeof s.pool === 'string' ? s.pool : DEFAULT_POOL,
  }));
}

export function editionSongs(repertoire: Pick<Repertoire, 'songsJson'>): EditionSong[] {
  return songsOf(JSON.parse(fs.readFileSync(repertoire.songsJson, 'utf8')));
}
