// Text widths on the cards' real fonts (Londrina Solid, last year's), measured with fontkit as the PDF renderer lays
// them out. The song fit (fit.ts), the heading check (layouts.ts) and the drawings that centre text (the headings, the
// GOMET word, «MOSTRA») all use them. Plain fontkit, no renderer: `--check` measures without loading the PDF renderer.
import { openSync, type Font } from 'fontkit';
import { join } from 'path';
import { SONG_LETTER_SPACING_EM, type SongMeasures } from './fit';

/** The Londrina Solid files, copied next to the build by `npm run build`. */
export const FONT_DIR = join(__dirname, '..', 'assets', 'LondrinaSolid');
export const FONT_FILES = {
  regular: join(FONT_DIR, 'LondrinaSolid-Regular.ttf'),
  light: join(FONT_DIR, 'LondrinaSolid-Light.ttf'),
  black: join(FONT_DIR, 'LondrinaSolid-Black.ttf'),
} as const;

export type FontName = keyof typeof FONT_FILES;

const opened = new Map<FontName, Font>();
function font(name: FontName): Font {
  let f = opened.get(name);
  if (!f) opened.set(name, (f = openSync(FONT_FILES[name])));
  return f;
}

/** A text's width at `size`, in points, with `letterSpacingEm` added after every character (as the renderer does). */
export function textWidth(name: FontName, text: string, size: number, letterSpacingEm = 0): number {
  const f = font(name);
  return (f.layout(text).advanceWidth * size) / f.unitsPerEm + letterSpacingEm * size * [...text].length;
}

/** The height of a capital letter at `size`, in points (0.722 × the size in Londrina Regular and Light). */
export function capHeight(name: FontName, size: number): number {
  const f = font(name);
  return (f.capHeight / f.unitsPerEm) * size;
}

/** How a song is measured for the fit: its title in capitals in Regular, its artist in Light, both letter-spaced. */
export const SONG_MEASURES: SongMeasures = {
  title: (text, size) => textWidth('regular', text, size, SONG_LETTER_SPACING_EM),
  artist: (text, size) => textWidth('light', text, size, SONG_LETTER_SPACING_EM),
};
