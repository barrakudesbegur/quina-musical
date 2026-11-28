// The two printed layouts (D262, U212, D295), and the geometry of one card in each, in PDF points (1 mm = 2.835 pt).
// Everything the two share is here once; a layout only says its sheet, its grid, its header, whether it has covers and
// its largest title. Pure and self-contained (no imports), so the tests run it as it is.
//
// - `a4-3` (the 2026 card, the organizers' «Apaïsat sense portades», D295): A4 portrait cut into 1 × 3 cards of
//   210 × 99 mm, black and white without covers; the branding («QUINA QUINA!», «BARRAKUDES · 2026») top left, the
//   heading centred on the card, then the GOMET circle, the number and the QR; titles up to last year's 16 pt.
// - `a3-6` (the user's A3 test sheets, D295, D306; a whole run with `--layout a3-6`): A3 portrait cut into 2 × 3
//   cards of 148.5 × 140 mm; each song's cover in colour above its title; header C (D259): the GOMET circle and the
//   Barrakudes figure, the heading centred in the space between, «CARTRÓ #n» next to the QR.

export const CARD_LAYOUT_IDS = ['a3-6', 'a4-3'] as const;
export type CardLayoutId = (typeof CARD_LAYOUT_IDS)[number];
export const isCardLayoutId = (id: unknown): id is CardLayoutId => (CARD_LAYOUT_IDS as readonly unknown[]).includes(id);

/** A sheet the copy shop prints colour on, portrait, in points. */
export interface SheetSize {
  name: string;
  width: number;
  height: number;
}
export const SHEETS = {
  A4: { name: 'A4', width: 595.28, height: 841.89 },
  A3: { name: 'A3', width: 841.89, height: 1190.55 },
} as const satisfies Record<string, SheetSize>;

/**
 * A layout's header: `gometFigure` (header C) is the GOMET circle and the figure, the heading in the space between,
 * then the number and the QR; `brand` is the branding (figure, title, «BARRAKUDES · 2026»), the heading centred on the
 * card, then the GOMET circle, the number and the QR.
 */
export type HeaderStyle = 'gometFigure' | 'brand';

export interface CardLayout {
  id: CardLayoutId;
  name: string;
  sheet: SheetSize;
  cols: number;
  rows: number;
  header: HeaderStyle;
  /** Each song's cover above its title (in colour), or no covers (black and white, the text alone). */
  covers: boolean;
  /** With covers: the cover's side, in points, at most what the cell allows. */
  coverSize?: number;
  /** The largest song title, in points (it is fitted down from there, fit.ts). */
  titleMax: number;
}

export const CARD_LAYOUTS: Record<CardLayoutId, CardLayout> = {
  // Covers 17 mm (the user, 28 Nov: "make the cover a little smaller on the square version"; the cell allows 18.6 mm).
  'a3-6': { id: 'a3-6', name: 'A3 · 6 a sheet, covers in colour', sheet: SHEETS.A3, cols: 2, rows: 3, header: 'gometFigure', covers: true, coverSize: 17 * (72 / 25.4), titleMax: 16 },
  'a4-3': { id: 'a4-3', name: 'A4 · 3 a sheet, no covers, black and white', sheet: SHEETS.A4, cols: 1, rows: 3, header: 'brand', covers: false, titleMax: 16 },
};

// ── What every card shares, in points ──

/** The card's padding, all round. */
export const CARD_PADDING = 15;
/** The gap between the header and the grid. */
export const CARD_GAP = 7;
/** The heading's size: it never shrinks (the user, 27 Nov: "dont make the text smaller"). */
export const HEADING_SIZE = 38;
/** The QR is never smaller than last year's 45 pt, 16 mm (the user: "it is already hard to scan. it is not negotiable"). */
export const QR_SIZE = 45;
/** The black box of side 2's heading: its padding above and below the capitals. */
export const HEADING_BOX_PAD_Y = 7;
/** The GOMET circle (D253): dashed, 15 mm, «GOMET» in Londrina Light, letter-spaced, centred on the circle's middle. */
export const GOMET = { diameter: 42.52, fontSize: 10.5, letterSpacingEm: 0.15 } as const;
/** The grid's outer border and padding: a 1 pt border, 1 pt in, so with the cells' borders it reads as a double line. */
export const GRID_FRAME = 4;
/**
 * The faint logo stamp in the bottom-right corner: its size and place, and the year on top of it (D263). The year sits
 * as on last year's card (its code: the stamp at bottom 10, right 10, 70 pt; the year at bottom 80, right 15, react-pdf's
 * default 18 pt, #e8e8e8): flush with the stamp's top, its right edge 5 pt in from the stamp's, its own width, each
 * turned 15° about its own centre.
 */
export const STAMP = { maxSize: 70, widthShare: 0.17, bottom: 22, right: 6, yearSize: 18, yearRightInset: 5 } as const;

/** The branding (the A4 card): the figure 0.055 × its drawing (512 × 683), two lines of text, in a 170 pt block. */
export const BRAND = { figureScale: 0.055, width: 170, gap: 6, topSize: 18, bottomSize: 11, letterSpacing: 1.08, lineGap: 9 } as const;
/** The figure on its own (the A3 card, header C), as tall as the header's number block. */
export const FIGURE_HEIGHT = 38;
export const FIGURE_WIDTH = (FIGURE_HEIGHT * 512) / 683;

/** Each header's measures: its height, the gap between its blocks, the number block's width (as wide as «#500»,
 * the widest number, in header C), and the side 2 box's padding beside the heading. */
const HEADERS = {
  gometFigure: { height: 46, gap: 6, numberWidth: 54, headingBoxPadX: 4 },
  brand: { height: 54, gap: 8, numberWidth: 62, headingBoxPadX: 10 },
} as const satisfies Record<HeaderStyle, { height: number; gap: number; numberWidth: number; headingBoxPadX: number }>;

/** The song cells: with a cover above the title, or the text alone. */
export type CellGeometry =
  | { kind: 'coverAbove'; cover: number; padding: number; gap: number; textWidth: number; textBox: { width: number; height: number } }
  | { kind: 'textOnly'; paddingX: number; textBox: { width: number; height: number } };

export interface CardGeometry {
  layout: CardLayout;
  page: { width: number; height: number };
  card: { width: number; height: number };
  inner: { width: number; height: number };
  header: { style: HeaderStyle; height: number; gap: number; numberWidth: number; headingBoxPadX: number };
  /** How wide the heading (with side 2's box) may be: header C centres it in the space between the side blocks;
   * the branding header centres it on the card, as far as the 170 pt branding block on either side allows. */
  headingRoom: number;
  grid: { height: number };
  cellSize: { width: number; height: number };
  cell: CellGeometry;
  stamp: { size: number };
}

/** The geometry of one card of a layout. */
export function cardGeometry(layout: CardLayout): CardGeometry {
  const page = { width: layout.sheet.width, height: layout.sheet.height };
  const card = { width: page.width / layout.cols, height: page.height / layout.rows };
  const inner = { width: card.width - 2 * CARD_PADDING, height: card.height - 2 * CARD_PADDING };
  const header = { style: layout.header, ...HEADERS[layout.header] };
  const headingRoom =
    layout.header === 'gometFigure'
      ? inner.width - (GOMET.diameter + header.gap + FIGURE_WIDTH) - (header.numberWidth + header.gap + QR_SIZE) - 2 * header.gap
      : inner.width - 2 * BRAND.width;
  const grid = { height: inner.height - header.height - CARD_GAP };
  const cellSize = { width: (inner.width - GRID_FRAME) / 4, height: (grid.height - GRID_FRAME) / 3 };
  let cell: CellGeometry;
  if (layout.covers) {
    // The cover above the title: the layout's size, never more than 55 % of the cell's height.
    const cover = Math.min(layout.coverSize ?? Infinity, cellSize.width - 10, (cellSize.height - 6) * 0.55);
    const textWidth = cellSize.width - 8;
    cell = { kind: 'coverAbove', cover, padding: 4, gap: 4, textWidth, textBox: { width: textWidth - 3, height: cellSize.height - cover - 14 } };
  } else {
    cell = { kind: 'textOnly', paddingX: 4, textBox: { width: cellSize.width - 11 - 3, height: cellSize.height - 8 } };
  }
  const stamp = { size: Math.min(STAMP.maxSize, card.width * STAMP.widthShare) };
  return { layout, page, card, inner, header, headingRoom, grid, cellSize, cell, stamp };
}

/** The width of side 1's heading (bare capitals) or side 2's (in its black box), at the heading size. */
export function headingWidth(g: CardGeometry, textWidth: number, boxed: boolean): number {
  return textWidth + (boxed ? 2 * g.header.headingBoxPadX : 0);
}

/**
 * Every heading that doesn't fit its header at 38 pt (it never shrinks), as a sentence (empty when they all fit).
 * `measure` is the heading's width in Londrina Regular at that size; a side after the first is boxed.
 */
export function headingProblems(g: CardGeometry, headings: readonly { text: string; side: number }[], measure: (text: string, size: number) => number): string[] {
  return headings
    .filter(({ text, side }) => headingWidth(g, measure(text, HEADING_SIZE), side > 1) > g.headingRoom)
    .map(({ text }) => `layout ${g.layout.id}: the heading «${text}» doesn't fit its header at ${HEADING_SIZE} pt (${g.headingRoom.toFixed(0)} pt of room)`);
}

/** `--layout <id>` or `--layout=<id>` from the command line (a whole run in the other layout), else `fallback`. */
export function layoutIdFrom(argv: readonly string[], fallback: CardLayoutId): CardLayoutId {
  const i = argv.findIndex((a) => a === '--layout' || a.startsWith('--layout='));
  if (i < 0) return fallback;
  const id = argv[i].includes('=') ? argv[i].slice('--layout='.length) : argv[i + 1];
  if (!isCardLayoutId(id)) throw new Error(`--layout needs one of ${CARD_LAYOUT_IDS.join(', ')} (got "${id ?? ''}")`);
  return id;
}
