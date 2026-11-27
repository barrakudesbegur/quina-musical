// D5 · SongTile's DOM for the projector (plain TS): the same markup as SongTile.svelte, so both share song-tile.css.
import { coverElement, type CoverFallback } from './cover.ts';
import './song-tile.css';

export type SongTileLayout = 'row' | 'tile' | 'feature' | 'compact' | 'result' | 'mini' | 'headline';

/** A song tile, updated in place by `set` (null hides it). */
export function songTileElement(opts: { layout: SongTileLayout; tag?: 'li' | 'div'; fallback?: CoverFallback; className?: string }): {
  root: HTMLElement;
  set(song: { songId: number; title: string | null; artist: string | null } | null): void;
} {
  const root = document.createElement(opts.tag ?? 'div');
  root.className = `song-tile ${opts.className ?? ''}`.trim();
  root.dataset.layout = opts.layout;
  root.hidden = true;
  const cover = opts.layout === 'headline' ? null : coverElement({ fallback: opts.fallback ?? 'note', className: 'song-tile__cover' });
  const text = document.createElement('span');
  text.className = 'song-tile__text';
  const title = document.createElement('span');
  title.className = 'song-tile__title';
  const artist = document.createElement('span');
  artist.className = 'song-tile__artist';
  text.append(title, artist);
  if (cover) root.append(cover.root);
  root.append(text);
  return {
    root,
    set(song) {
      root.hidden = song === null;
      cover?.set(song?.songId ?? null);
      if (title.textContent !== (song?.title ?? '')) title.textContent = song?.title ?? '';
      if (artist.textContent !== (song?.artist ?? '')) artist.textContent = song?.artist ?? '';
      artist.hidden = !song?.artist;
    },
  };
}
