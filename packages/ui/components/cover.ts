// D4 · Cover, the part every surface shares (components-v2.md § 5): where a song's cover comes from, the size ladder,
// and the projector's DOM version (`coverElement`), so the stage (plain TS) draws the same markup as Cover.svelte and
// shares cover.css. JPEG XL with a JPEG fallback, never WebP (R2-Q28), wherever the server has the .jxl files.
import { coverUrl } from '../data/catalog.ts';

/** Where an app's covers are served from: the relay serves only the JPEGs; production adds a JPEG XL of each. */
export interface CoverSource {
  base: string;
  jxl: boolean;
}

export const DEFAULT_COVER_SOURCE: CoverSource = { base: '/covers/', jxl: false };

/** The cover's files: the JPEG always, the JPEG XL only where the server has it. */
export function coverFiles(songId: number, source: CoverSource = DEFAULT_COVER_SOURCE): { jpg: string; jxl: string | null } {
  return { jpg: coverUrl(songId, source.base, 'jpg'), jxl: source.jxl ? coverUrl(songId, source.base, 'jxl') : null };
}

/** The size ladder (D4, px at each board's own scale): a name, or any number of px. Omitted, the context sizes it. */
export const COVER_SIZES = { xs: 28, s: 52, m: 72, l: 108, xl: 132 } as const;
export type CoverSize = keyof typeof COVER_SIZES;

/** The ladder's px for a size; null when the context sizes the cover. */
export function coverPx(size: CoverSize | number | null | undefined): number | null {
  if (size === null || size === undefined) return null;
  return typeof size === 'number' ? size : COVER_SIZES[size];
}

/** What a cover shows when there is no song (the Hold's music) or its file fails: a navy tile with a note (C5), or the
 *  surface's own empty box (the phone's card back). */
export type CoverFallback = 'note' | 'empty';

const SVG = 'http://www.w3.org/2000/svg';
/** The music note (the one icon family's `music`), drawn by the DOM version's fallback. */
const NOTE = ['M9 18V5l11-2v13', 'M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0z', 'M20 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z'];

/**
 * The projector's cover: the same markup as Cover.svelte (`.cover` > picture > `.cover__img`, `data-state`), updated
 * in place by `set`. Missing or no song: the fallback (`data-state="missing"`), so titles still show without covers.
 */
export function coverElement(opts: { fallback?: CoverFallback; source?: CoverSource; className?: string } = {}): {
  root: HTMLElement;
  set(songId: number | null): void;
} {
  const fallback = opts.fallback ?? 'note';
  const root = document.createElement('span');
  root.className = `cover ${opts.className ?? ''}`.trim();
  root.dataset.fallback = fallback;
  root.dataset.state = 'missing';
  const picture = document.createElement('picture');
  picture.className = 'cover__picture';
  const source = document.createElement('source');
  source.type = 'image/jxl';
  const img = document.createElement('img');
  img.className = 'cover__img';
  img.alt = '';
  img.decoding = 'async';
  img.draggable = false;
  picture.append(img);
  const note = document.createElementNS(SVG, 'svg');
  note.setAttribute('class', 'cover__note');
  note.setAttribute('viewBox', '0 0 24 24');
  note.setAttribute('aria-hidden', 'true');
  for (const d of NOTE) {
    const path = document.createElementNS(SVG, 'path');
    path.setAttribute('d', d);
    note.append(path);
  }
  root.append(picture, note);
  img.addEventListener('load', () => (root.dataset.state = 'ok'));
  img.addEventListener('error', () => (root.dataset.state = 'missing'));
  let shown: number | null | undefined;
  return {
    root,
    set(songId) {
      if (songId === shown) return;
      shown = songId;
      if (songId === null) {
        img.removeAttribute('src');
        source.remove();
        root.dataset.state = 'missing';
        return;
      }
      const files = coverFiles(songId, opts.source);
      if (files.jxl) {
        source.srcset = files.jxl;
        picture.prepend(source);
      } else source.remove();
      root.dataset.state = 'loading';
      img.src = files.jpg;
    },
  };
}
