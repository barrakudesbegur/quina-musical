// What would go wrong on paper, checked before anything is written (and by `--check`): a song whose name can't fit
// its cell at any size, a heading that doesn't fit its header at 38 pt, and (layouts with covers) a missing cover.
// Measured on the real fonts; no PDF renderer.
import type { PrintedCardTypeSpec } from '../card-types';
import { printName, type RepertoireSong } from '../repertoire';
import { missingCovers } from './covers';
import { fitSong, type SongFit } from './fit';
import { cardGeometry, headingProblems, type CardLayout } from './layouts';
import { SONG_MEASURES, textWidth } from './measure';
import { sampleCount, sheetSlots } from './sheets';

const mm = (pt: number): string => (pt / (72 / 25.4)).toFixed(0);

export interface PrintCheck {
  /** Stops the run: nothing is written. */
  problems: string[];
  /** Said out loud; the cards still print (a missing cover prints an empty box). */
  warnings: string[];
  /** One line on the layout: card and cell sizes, sheets, samples, the titles' sizes. */
  summary: string;
}

/** Checks the songs, the headings and the covers against a layout, for these types and amounts. */
export function checkPrint(
  layout: CardLayout,
  songs: readonly RepertoireSong[],
  types: readonly PrintedCardTypeSpec[],
  amounts: readonly { type: string; amount: number }[],
  coversDir: string | undefined,
): PrintCheck {
  const g = cardGeometry(layout);
  const problems: string[] = [];
  const warnings: string[] = [];

  const fits: SongFit[] = [];
  for (const song of songs) {
    const name = printName(song);
    const fit = fitSong(name, g.cell.textBox, layout.titleMax, SONG_MEASURES);
    fits.push(fit);
    if (!fit.fits) {
      problems.push(
        `song ${song.id} «${name.title}» (${name.artist}) doesn't fit its cell on layout ${layout.id} (a ${mm(g.cell.textBox.width)} × ${mm(g.cell.textBox.height)} mm text box), even with the title at 7 pt: shorten its printTitle or printArtist`,
      );
    }
  }
  problems.push(...headingProblems(g, types.flatMap((t) => t.sides.map((s) => ({ text: s.heading, side: s.side }))), (text, size) => textWidth('regular', text, size)));

  if (layout.covers) {
    const missing = missingCovers(coversDir, songs.map((s) => s.id));
    if (!coversDir) warnings.push(`layout ${layout.id} prints covers, but the repertoire has no "coversDir": every cover prints as an empty box`);
    else if (missing.length) warnings.push(`${missing.length} songs have no cover in ${coversDir} (an empty box is printed): ${missing.join(', ')}`);
  }

  const perSheet = layout.cols * layout.rows;
  const sheets = amounts.map((a) => sheetSlots(a.amount, perSheet));
  const sizes = fits.filter((f) => f.fits).map((f) => f.titleSize).sort((a, b) => a - b);
  const summary =
    `Layout ${layout.id}, ${layout.name}: cards ${mm(g.card.width)} × ${mm(g.card.height)} mm, ${perSheet} a ${layout.sheet.name} sheet; ` +
    amounts.map((a, i) => `${a.type} ${sheets[i].length} sheet${sheets[i].length === 1 ? '' : 's'} (${sampleCount(sheets[i])} samples)`).join(', ') +
    `; cells ${mm(g.cellSize.width)} × ${mm(g.cellSize.height)} mm` +
    (g.cell.kind === 'coverAbove' ? `, covers ${mm(g.cell.cover)} mm` : ', no covers') +
    (sizes.length ? `; titles ${sizes[0]}–${sizes[sizes.length - 1]} pt (median ${sizes[Math.floor(sizes.length / 2)]})` : '');
  return { problems, warnings, summary };
}
