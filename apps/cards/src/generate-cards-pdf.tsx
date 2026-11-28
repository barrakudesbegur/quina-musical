// The printed cards as a PDF, one per card type: the 2026 design (D250–D267, D295, tools/card-mockup), in the layout
// config.ts picks (print/layouts.ts). One PDF may hold several runs, each in its own layout and on its own sheet size:
// the proof (index.ts) is a type's first A4 sheet and its A3 test sheet. Last year's card kept as it was (the Barrakudes figure, Londrina Solid, the double-bordered
// 3 × 4 grid, black ink, the faint logo stamp) with only what 2026 needs:
//
// - the header: the side's heading at 38 pt (side 2's white on a black box), the GOMET circle (a sticker goes there,
//   D253, D265), «CARTRÓ #n» next to its QR (45 pt, never smaller), and the figure (A3) or the branding (A4);
// - each song: its cover above it in colour (A3), its print name in capitals, fitted to its cell and never
//   hyphenated (print/fit.ts), its artist under it;
// - the faint logo stamp with the year above it (D263), and on a sample, a big faint diagonal «MOSTRA» (D264).
//
// A sheet prints side 1 then side 2 on the next page; side 2's rows are mirrored, so printed duplex on the long edge each
// card's back lands behind it (print/sheets.ts). Faint dashed cut lines on side 1 only (D102).
import { Circle, Document, Font, G, Image, Page, Path, Rect, render, Svg, Text, View } from '@react-pdf/renderer';
import type { Style, SVGPresentationAttributes } from '@react-pdf/types';
import React from 'react';
import type { PrintedCardTypeSpec } from './card-types';
import { PAPER_COLOR, SAMPLE_WORD, VERSION_STAMP, BRAND_SUBTITLE, CARD_TITLE } from './config';
import type { Card, CardSong } from './generate-cards-json';
import { FIGURE_PATH, STAMP_PATH } from './print/drawings';
import { fitSong, SONG_LETTER_SPACING_EM, SONG_LINE_HEIGHT, TITLE_ARTIST_GAP, type SongFit } from './print/fit';
import { BRAND, cardGeometry, FIGURE_HEIGHT, FIGURE_WIDTH, GOMET, HEADING_BOX_PAD_Y, HEADING_SIZE, QR_SIZE, STAMP, CARD_GAP, CARD_PADDING, type CardGeometry, type CardLayout } from './print/layouts';
import { capHeight, FONT_FILES, SONG_MEASURES, textWidth } from './print/measure';
import { printPages, sampleCount, sheetSlots, sideRows } from './print/sheets';
import { generateQRCodeDataUri } from './utils/qr';

// ── Fonts: last year's Londrina Solid. A word is never split: the sizes are fitted instead. ──
const FONT_FAMILY = 'LondrinaSolid';
Font.register({
  family: FONT_FAMILY,
  fonts: [
    { src: FONT_FILES.regular, fontWeight: 'normal' },
    { src: FONT_FILES.light, fontWeight: 'light' },
    { src: FONT_FILES.black, fontWeight: 'heavy' },
  ],
});
Font.registerHyphenationCallback((word) => [word]);

const INK = '#000000';
const GREY = '#4d4d4d';
const FADED = '#bdbdbd';
const CUT_LINE = '1px dashed #f0f0f0';

/** An SVG text's font. react-pdf reads it from the text's style, though its types only list presentation attributes. */
const svgFont = (fontSize: number, fontWeight: 'normal' | 'light' | 'heavy' = 'normal'): SVGPresentationAttributes =>
  ({ fontFamily: FONT_FAMILY, fontSize, fontWeight }) as SVGPresentationAttributes;

// ── The parts ──

/** Capitals drawn in a box exactly their cap height tall (plus padding), so a heading centres on its letters and the
 * black box never clips them. */
const CapText: React.FC<{ text: string; size: number; boxed: boolean; padX: number; padY: number }> = ({ text, size, boxed, padX, padY }) => {
  const width = textWidth('regular', text, size) + 2 * padX;
  const height = capHeight('regular', size) + 2 * padY;
  return (
    <Svg viewBox={`0 0 ${width} ${height}`} style={{ width, height }}>
      {boxed && <Rect x={0} y={0} width={width} height={height} fill={INK} />}
      <Text x={width / 2} y={padY + capHeight('regular', size)} textAnchor="middle" fill={boxed ? '#ffffff' : INK} style={svgFont(size)}>
        {text}
      </Text>
    </Svg>
  );
};

/** The side's heading at 38 pt: bare on side 1, white on a black box after it. */
const Heading: React.FC<{ g: CardGeometry; text: string; boxed: boolean }> = ({ g, text, boxed }) => (
  <CapText text={text} size={HEADING_SIZE} boxed={boxed} padX={boxed ? g.header.headingBoxPadX : 0} padY={boxed ? HEADING_BOX_PAD_Y : 0} />
);

/** The GOMET circle (D253): dashed, 15 mm, its word letter-spaced and centred on the circle's middle. */
const Gomet: React.FC = () => {
  const d = GOMET.diameter;
  const c = d / 2;
  const spacing = GOMET.letterSpacingEm * GOMET.fontSize;
  const letters = [...'GOMET'];
  const widths = letters.map((ch) => textWidth('light', ch, GOMET.fontSize));
  let x = c - (widths.reduce((a, b) => a + b, 0) + spacing * (letters.length - 1)) / 2;
  const y = c + capHeight('light', GOMET.fontSize) / 2;
  return (
    <Svg viewBox={`0 0 ${d} ${d}`} style={{ width: d, height: d }}>
      <Circle cx={c} cy={c} r={c - 0.5} fill="none" stroke={INK} strokeWidth={1} strokeDasharray="2.4 2.4" />
      {letters.map((ch, i) => {
        const letter = (
          <Text key={i} x={x} y={y} fill={GREY} style={svgFont(GOMET.fontSize, 'light')}>
            {ch}
          </Text>
        );
        x += widths[i] + spacing;
        return letter;
      })}
    </Svg>
  );
};

/** The Barrakudes figure. */
const Figure: React.FC<{ height: number; width: number }> = ({ height, width }) => (
  <Svg viewBox="0 0 512 683" style={{ height, width }}>
    <Path d={FIGURE_PATH} fill={INK} />
  </Svg>
);

/** The branding (the A4 card): the figure, the title and «BARRAKUDES · 2026». */
const Brand: React.FC = () => (
  <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: BRAND.gap }}>
    <Figure height={683 * BRAND.figureScale} width={512 * BRAND.figureScale} />
    <View style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-start', lineHeight: 0.7, gap: BRAND.lineGap }}>
      <Text style={{ fontSize: BRAND.topSize, fontWeight: 'light', letterSpacing: BRAND.letterSpacing }}>{CARD_TITLE}</Text>
      <Text style={{ fontSize: BRAND.bottomSize, fontWeight: 'light', letterSpacing: BRAND.letterSpacing, color: GREY }}>{BRAND_SUBTITLE}</Text>
    </View>
  </View>
);

/** «CARTRÓ #n» next to the QR, which encodes it. */
const NumberAndQr: React.FC<{ g: CardGeometry; id: number; qr: string }> = ({ g, id, qr }) => (
  <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: g.header.gap }}>
    <View style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', width: g.header.numberWidth, gap: 2 }}>
      <Text style={{ fontSize: 14, fontWeight: 'light', textAlign: 'right', lineHeight: 1 }}>CARTRÓ</Text>
      <Text style={{ fontSize: 24, fontWeight: 'light', textAlign: 'right', lineHeight: 1 }}>
        <Text style={{ color: FADED }}>#</Text>
        {String(id)}
      </Text>
    </View>
    <Image src={qr} style={{ width: QR_SIZE, height: QR_SIZE }} />
  </View>
);

const Header: React.FC<{ g: CardGeometry; heading: string; boxed: boolean; id: number; qr: string }> = ({ g, heading, boxed, id, qr }) => {
  const row: Style = { display: 'flex', flexDirection: 'row', alignItems: 'center', height: g.header.height };
  if (g.header.style === 'gometFigure') {
    // Header C: the GOMET circle and the figure, the heading in the space between, the number next to its QR.
    return (
      <View style={[row, { justifyContent: 'space-between', gap: g.header.gap }]}>
        <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: g.header.gap }}>
          <Gomet />
          <Figure height={FIGURE_HEIGHT} width={FIGURE_WIDTH} />
        </View>
        <View style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
          <Heading g={g} text={heading} boxed={boxed} />
        </View>
        <NumberAndQr g={g} id={id} qr={qr} />
      </View>
    );
  }
  // The branding header: the branding, the heading centred on the card, the GOMET circle, the number and the QR.
  return (
    <View style={[row, { position: 'relative', justifyContent: 'space-between' }]}>
      <View style={{ width: BRAND.width }}>
        <Brand />
      </View>
      <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Heading g={g} text={heading} boxed={boxed} />
      </View>
      <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: g.header.gap }}>
        <Gomet />
        <NumberAndQr g={g} id={id} qr={qr} />
      </View>
    </View>
  );
};

/** A song's title and artist at their fitted sizes. */
const SongWords: React.FC<{ song: CardSong; fit: SongFit; align: 'center' | 'left' }> = ({ song, fit, align }) => (
  <>
    <Text style={{ fontWeight: 'normal', textTransform: 'uppercase', lineHeight: SONG_LINE_HEIGHT, fontSize: fit.titleSize, letterSpacing: SONG_LETTER_SPACING_EM * fit.titleSize, textAlign: align }}>
      {song.title}
    </Text>
    <Text style={{ fontWeight: 'light', lineHeight: SONG_LINE_HEIGHT, color: GREY, fontSize: fit.artistSize, letterSpacing: SONG_LETTER_SPACING_EM * fit.artistSize, textAlign: align }}>
      {song.artist}
    </Text>
  </>
);

const CELL: Style = { flex: 1, display: 'flex', border: `1 solid ${INK}`, margin: -0.5, overflow: 'hidden' };

const SongCell: React.FC<{ g: CardGeometry; song: CardSong; fit: SongFit; cover: string | null | undefined }> = ({ g, song, fit, cover }) => {
  const c = g.cell;
  if (c.kind === 'coverAbove') {
    return (
      <View style={[CELL, { flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: c.gap, padding: c.padding }]}>
        {cover ? (
          <Image src={cover} style={{ width: c.cover, height: c.cover, objectFit: 'cover' }} />
        ) : (
          // A missing cover (--check lists it): an empty box in its place.
          <View style={{ width: c.cover, height: c.cover, border: `0.5 solid ${FADED}` }} />
        )}
        <View style={{ width: c.textWidth, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: TITLE_ARTIST_GAP }}>
          <SongWords song={song} fit={fit} align="center" />
        </View>
      </View>
    );
  }
  return (
    <View style={[CELL, { flexDirection: 'row', alignItems: 'center', paddingLeft: c.paddingX, paddingRight: c.paddingX }]}>
      <View style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: TITLE_ARTIST_GAP }}>
        <SongWords song={song} fit={fit} align="left" />
      </View>
    </View>
  );
};

/** The faint logo stamp in the bottom-right corner, with the year above it (D263). */
const Stamp: React.FC<{ g: CardGeometry }> = ({ g }) => {
  const size = g.stamp.size;
  return (
    <>
      <Svg viewBox="0 0 1024 1024" style={{ position: 'absolute', bottom: STAMP.bottom, right: STAMP.right, width: size, height: size, transform: 'rotate(15deg)' }}>
        <Path d={STAMP_PATH} fillRule="evenodd" fill={INK} opacity={0.09} />
      </Svg>
      {/* Last year's #e8e8e8 as the stamp's 9 % ink: the same on paper, and see-through over a cover. */}
      <Text style={{ position: 'absolute', bottom: STAMP.bottom + size, right: STAMP.right + STAMP.yearRightInset, textAlign: 'center', fontSize: STAMP.yearSize, color: INK, opacity: 0.09, transform: 'rotate(15deg)' }}>
        {VERSION_STAMP}
      </Text>
    </>
  );
};

/** «MOSTRA» across a sample, along the card's diagonal, faint like the stamp (D264). */
const SampleMark: React.FC<{ g: CardGeometry }> = ({ g }) => {
  const { width, height } = g.card;
  const angle = (Math.atan2(height, width) * 180) / Math.PI;
  const size = (0.72 * Math.hypot(width, height)) / textWidth('black', SAMPLE_WORD, 1);
  return (
    <Svg viewBox={`0 0 ${width} ${height}`} style={{ position: 'absolute', top: 0, left: 0, width, height }}>
      <G transform={`translate(${width / 2}, ${height / 2}) rotate(${-angle})`}>
        <Text x={0} y={capHeight('black', size) / 2} textAnchor="middle" fill={INK} opacity={0.12} style={svgFont(size, 'heavy')}>
          {SAMPLE_WORD}
        </Text>
      </G>
    </Svg>
  );
};

/** What one card side needs from the run: each song's fit and cover. */
interface SongPrint {
  fit: (song: CardSong) => SongFit;
  cover: (songId: number) => string | null | undefined;
}

const CardSide: React.FC<{ g: CardGeometry; card: Card; side: number; heading: string; qr: string; sample: boolean; songs: SongPrint }> = ({ g, card, side, heading, qr, sample, songs }) => {
  const lines = card.sides.find((s) => s.side === side)?.lines ?? [];
  return (
    <View style={{ position: 'relative', display: 'flex', flexDirection: 'column', padding: CARD_PADDING, fontFamily: FONT_FAMILY, lineHeight: 0.8, gap: CARD_GAP, width: g.card.width, height: g.card.height }}>
      <Header g={g} heading={heading} boxed={side > 1} id={card.id} qr={qr} />
      <View style={{ border: `1 solid ${INK}`, padding: 1, display: 'flex', flexDirection: 'column', height: g.grid.height }}>
        {lines.map((line, r) => (
          <View key={r} style={{ display: 'flex', flexDirection: 'row', flex: 1 }}>
            {line.map((song) => (
              <SongCell key={song.id} g={g} song={song} fit={songs.fit(song)} cover={songs.cover(song.id)} />
            ))}
          </View>
        ))}
      </View>
      {/* Over the songs, not under them: on the square card the corner cell's cover would hide it. */}
      <Stamp g={g} />
      {sample && <SampleMark g={g} />}
    </View>
  );
};

/** The faint dashed cut lines of side 1 (D102), between the cards, drawn under them so the cards' boxes stay the same
 * on both sides. */
const CutLines: React.FC<{ g: CardGeometry }> = ({ g }) => {
  const { cols, rows } = g.layout;
  const { width, height } = g.card;
  return (
    <>
      {Array.from({ length: rows * cols }, (_, i) => {
        const r = Math.floor(i / cols);
        const c = i % cols;
        return (
          <View
            key={i}
            style={{
              position: 'absolute', left: c * width, top: r * height, width, height,
              ...(c < cols - 1 ? { borderRight: CUT_LINE } : {}),
              ...(r < rows - 1 ? { borderBottom: CUT_LINE } : {}),
            }}
          />
        );
      })}
    </>
  );
};

// ── The document ──

/** Cards printed in one layout: they fill its sheets (print/sheets.ts), samples included. */
export interface PrintRun {
  layout: CardLayout;
  /** The cards, in number order. */
  cards: readonly Card[];
  /** Only the first sheets (a proof), else every sheet. */
  firstSheets?: number;
}

export interface CardsPdf {
  /** The type printed, with its sides' headings. */
  type: PrintedCardTypeSpec;
  /** The runs, one after another: each one's sheets, side 1 then side 2… */
  runs: readonly PrintRun[];
  /** Each song's cover as a data URI (null: missing, an empty box), for the layouts with covers. */
  covers: ReadonlyMap<number, string | null>;
  outputPath: string;
}

export interface CardsPdfResult {
  pages: number;
  sheets: number;
  samples: number;
}

/** Writes one type's PDF: each run's sheets in page order, each sheet's side 1 then side 2… */
export async function generateCardsPDF({ type, runs, covers, outputPath }: CardsPdf): Promise<CardsPdfResult> {
  // One QR per card, the same string on both sides, on its sample and in every run, so the PDF embeds it once.
  const qrs = new Map<number, string>();
  for (const card of runs.flatMap((r) => r.cards)) if (!qrs.has(card.id)) qrs.set(card.id, await generateQRCodeDataUri(card.id));
  const headings = new Map(type.sides.map((s) => [s.side, s.heading]));
  const sides = type.sides.map((s) => s.side);
  // A song's fit depends only on its name and the layout: measured once per layout.
  const fits = new Map<string, SongFit>();
  const songPrint = (layout: CardLayout, g: CardGeometry): SongPrint => ({
    fit: (song) => {
      const key = `${layout.id}:${song.id}`;
      let fit = fits.get(key);
      if (!fit) fits.set(key, (fit = fitSong(song, g.cell.textBox, layout.titleMax, SONG_MEASURES)));
      return fit;
    },
    cover: (songId) => (layout.covers ? covers.get(songId) : undefined),
  });
  const parts = runs.map((run, r) => {
    const g = cardGeometry(run.layout);
    const all = sheetSlots(run.cards.length, run.layout.cols * run.layout.rows);
    const sheets = run.firstSheets === undefined ? all : all.slice(0, run.firstSheets);
    return { r, run, g, sheets, songs: songPrint(run.layout, g), pages: printPages(sheets, sides) };
  });

  await render(
    <Document title={`${CARD_TITLE} · ${type.name}`} author="Barrakudes">
      {parts.flatMap(({ r, run, g, songs, pages }) =>
        pages.map(({ sheet, sheetIndex, side }) => (
          <Page key={`${r}-${sheetIndex}-${side}`} size={[g.page.width, g.page.height]} style={{ backgroundColor: PAPER_COLOR, position: 'relative' }}>
            {side === 1 && <CutLines g={g} />}
            {sideRows(sheet, run.layout.cols, side).map((row, i) => (
              <View key={i} style={{ display: 'flex', flexDirection: 'row' }}>
                {row.map(({ cardIndex, sample }) => {
                  const card = run.cards[cardIndex];
                  return (
                    <CardSide
                      key={`${card.id}${sample ? '-sample' : ''}`}
                      g={g}
                      card={card}
                      side={side}
                      heading={headings.get(side) ?? ''}
                      qr={qrs.get(card.id) ?? ''}
                      sample={sample}
                      songs={songs}
                    />
                  );
                })}
              </View>
            ))}
          </Page>
        )),
      )}
    </Document>,
    outputPath,
  );
  return {
    pages: parts.reduce((n, p) => n + p.pages.length, 0),
    sheets: parts.reduce((n, p) => n + p.sheets.length, 0),
    samples: parts.reduce((n, p) => n + sampleCount(p.sheets), 0),
  };
}
