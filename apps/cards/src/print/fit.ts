// The song's print size: the largest title, then artist, that fits its cell's text box. Titles are never hyphenated (a
// word is never split, the renderer is told so too), so a size is chosen instead, by measuring the words on the real
// fonts (measure.ts, fontkit, as the PDF renderer lays them out). Pure and self-contained (no imports): the widths come
// in as functions, so the tests run it with made-up ones.

/** The width of a text at a font size, in points, letter spacing included. */
export type MeasureText = (text: string, size: number) => number;

/** How a title and an artist are measured: the title in capitals, in Londrina Regular; the artist in Londrina Light. */
export interface SongMeasures {
  title: MeasureText;
  artist: MeasureText;
}

/** The letter spacing of a song's title and artist, in em. */
export const SONG_LETTER_SPACING_EM = 0.06;
/** The line height of a song's title and artist (× the font size). */
export const SONG_LINE_HEIGHT = 0.92;
/** The gap between the title and the artist, in points. */
export const TITLE_ARTIST_GAP = 3;
/** The smallest title, in points. */
export const TITLE_MIN = 7;
export const TITLE_MAX_LINES = 3;
export const ARTIST_MAX_LINES = 2;
/** The artist is at most this, and at least 3 pt under the title. */
export const ARTIST_MAX = 12;
/** First the artist at 8 pt or more (a tiny artist is unreadable); only if nothing fits that way, down to 6 pt. */
export const ARTIST_FLOORS = [8, 6] as const;
/** The sizes go down in half points. */
export const SIZE_STEP = 0.5;

/** The lines a text wraps to at word breaks in `maxWidth`, or null when one word alone is wider (it would be split). */
export function lineCount(text: string, measure: MeasureText, size: number, maxWidth: number): number | null {
  let lines = 0;
  let current = '';
  for (const word of text.split(' ').filter(Boolean)) {
    if (measure(word, size) > maxWidth) return null;
    const joined = current ? `${current} ${word}` : word;
    if (measure(joined, size) <= maxWidth) current = joined;
    else {
      lines += 1;
      current = word;
    }
  }
  return lines + (current ? 1 : 0);
}

/** A song's fitted sizes, in points; `fits` is false when nothing fits (then the smallest sizes, and it overflows). */
export interface SongFit {
  titleSize: number;
  artistSize: number;
  titleLines: number;
  artistLines: number;
  fits: boolean;
}

/** The text box a song is fitted into, in points. */
export interface TextBox {
  width: number;
  height: number;
}

/**
 * The largest title from `titleMax` down to 7 pt in up to 3 lines, with the largest artist under it (at most 12 pt and
 * 3 pt under the title) in up to 2 lines, whose lines fit the box's height. First with the artist at 8 pt or more; only
 * if no title fits that way, with the artist down to 6 pt. The title is measured in capitals, as it is printed.
 */
export function fitSong(song: { title: string; artist: string }, box: TextBox, titleMax: number, measures: SongMeasures): SongFit {
  const title = song.title.toUpperCase();
  for (const artistFloor of ARTIST_FLOORS) {
    for (let titleSize = titleMax; titleSize >= TITLE_MIN; titleSize -= SIZE_STEP) {
      const titleLines = lineCount(title, measures.title, titleSize, box.width);
      if (!titleLines || titleLines > TITLE_MAX_LINES) continue;
      for (let artistSize = Math.min(titleSize - 3, ARTIST_MAX); artistSize >= artistFloor; artistSize -= SIZE_STEP) {
        const artistLines = lineCount(song.artist, measures.artist, artistSize, box.width);
        if (!artistLines || artistLines > ARTIST_MAX_LINES) continue;
        const height = titleLines * titleSize * SONG_LINE_HEIGHT + TITLE_ARTIST_GAP + artistLines * artistSize * SONG_LINE_HEIGHT;
        if (height <= box.height) return { titleSize, artistSize, titleLines, artistLines, fits: true };
      }
    }
  }
  return { titleSize: TITLE_MIN, artistSize: ARTIST_FLOORS[ARTIST_FLOORS.length - 1], titleLines: 0, artistLines: 0, fits: false };
}
