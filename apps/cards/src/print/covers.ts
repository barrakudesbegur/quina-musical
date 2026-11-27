// The songs' album covers for the cards with covers (layout A): the repertoire's `coversDir`, `<songId>.jpg` (Sound
// engine's, 640 px, never in git). Each is cut square from its middle and scaled down for print, about 300 px: a cover
// prints at 15 mm, so that is over 500 dpi.
//
// Each cover becomes one data URI string, and every card that prints the song gets that same string: the PDF renderer
// embeds an image once per distinct source (@react-pdf/render keeps the embedded images of a render in a map keyed by
// the image's `uri`, a data URI's whole text), so 136 covers are embedded once each, however many cards print them.
import { existsSync } from 'fs';
import { join } from 'path';

/** The size covers are scaled to, in pixels. */
export const COVER_PIXELS = 300;
/** The JPEG quality of a scaled cover. */
export const COVER_QUALITY = 0.88;

/** A song's cover file in the covers folder. */
export const coverFile = (coversDir: string, songId: number): string => join(coversDir, `${songId}.jpg`);

/** The songs with no cover file (none at all when there's no covers folder): the cards draw an empty box there. */
export function missingCovers(coversDir: string | undefined, songIds: readonly number[]): number[] {
  return songIds.filter((id) => !coversDir || !existsSync(coverFile(coversDir, id)));
}

/**
 * Every song's cover, scaled for print, as a JPEG data URI; null for a song whose cover is missing or unreadable (the
 * card draws an empty box, and `--check` lists them). Loads the native `canvas` module.
 */
export async function loadCovers(coversDir: string | undefined, songIds: readonly number[]): Promise<Map<number, string | null>> {
  const { createCanvas, loadImage } = await import('canvas');
  const out = new Map<number, string | null>();
  for (const id of new Set(songIds)) {
    const file = coversDir ? coverFile(coversDir, id) : null;
    if (!file || !existsSync(file)) {
      out.set(id, null);
      continue;
    }
    try {
      const image = await loadImage(file);
      const side = Math.min(image.width, image.height);
      const canvas = createCanvas(COVER_PIXELS, COVER_PIXELS);
      const ctx = canvas.getContext('2d');
      ctx.quality = 'best'; // node-canvas's downscaling filter
      ctx.drawImage(image, (image.width - side) / 2, (image.height - side) / 2, side, side, 0, 0, COVER_PIXELS, COVER_PIXELS);
      out.set(id, `data:image/jpeg;base64,${canvas.toBuffer('image/jpeg', { quality: COVER_QUALITY }).toString('base64')}`);
    } catch (error) {
      console.warn(`⚠️  song ${id}: its cover ${file} can't be read (${error instanceof Error ? error.message : String(error)}); an empty box is printed`);
      out.set(id, null);
    }
  }
  return out;
}
