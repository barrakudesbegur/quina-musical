// The 2026 printed cards' design mockup: real PDF pages in last year's style (apps/cards' react-pdf), at any layout.
// A design tool, not the generator: once the user agrees the design, Frontend builds it into apps/cards/src.
//
//   node mockup.cjs                 every layout
//   node mockup.cjs 3x1-h 2x1-v     some layouts
//
// Each PDF has four pages: the normal card's side 1 and side 2, then the special card's side 1 and side 2, printed
// duplex: on a back page each row's cards are mirrored, so every card's side 2 lands behind its side 1.
const fs = require('fs');
const path = require('path');

const R = process.env.QUINA_ROOT || path.resolve(__dirname, '../..');
const DATA = process.env.MOCKUP_DATA || path.join(__dirname, 'data');
const OUT = process.env.MOCKUP_OUT || path.join(__dirname, 'out');
const M = (m) => require(path.join(R, 'apps/cards/node_modules', m));
const React = M('react');
const { Document, Font, Image, Page, Path, Circle, Rect, render, StyleSheet, Svg, Text, View } = M('@react-pdf/renderer');
const fontkit = M('fontkit');
const { generateQRCodeDataUri } = require(path.join(R, 'apps/cards/build/utils/qr.js'));
const h = React.createElement;

// ── Fonts: last year's Londrina Solid; no hyphenation (a word is never split; sizes are fitted instead). ──
const fontPath = path.join(R, 'apps/cards/src/assets/LondrinaSolid');
Font.register({
  family: 'LondrinaSolid',
  fonts: [
    { src: path.join(fontPath, 'LondrinaSolid-Regular.ttf'), fontWeight: 'normal' },
    { src: path.join(fontPath, 'LondrinaSolid-Light.ttf'), fontWeight: 'light' },
  ],
});
Font.registerHyphenationCallback((word) => [word]);
const REGULAR = fontkit.openSync(path.join(fontPath, 'LondrinaSolid-Regular.ttf'));
const LIGHT = fontkit.openSync(path.join(fontPath, 'LondrinaSolid-Light.ttf'));
const CAP = REGULAR.capHeight / REGULAR.unitsPerEm; // 0.722, the same in Light
const advance = (font, s, size) => (font.layout(s).advanceWidth * size) / font.unitsPerEm;
const textWidth = (font, s, size, spacingEm = 0) => advance(font, s, size) + spacingEm * size * s.length;

// ── Last year's logo drawings, read from the generator so they stay identical. ──
const src = fs.readFileSync(path.join(R, 'apps/cards/src/generate-cards-pdf.tsx'), 'utf8');
const [STAMP_D, ICON_D] = [...src.matchAll(/<Path\s+d="([^"]+)"/g)].map((m) => m[1]);

// ── Data: the songs with their print titles, the sample cards, the covers (never in git). ──
const songs = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(DATA, 'songs-print.json'), 'utf8')).map((s) => [s.id, s]));
const sample = JSON.parse(fs.readFileSync(path.join(DATA, 'sample-cards.json'), 'utf8'));
const coverPath = (id) => path.join(R, 'data/media/2026/output/covers', `${id}.jpg`);
const POOL = { 1: Object.values(songs).filter((s) => s.pool === '1').map((s) => s.id), 2: Object.values(songs).filter((s) => s.pool === '2').map((s) => s.id) };

// ── The design (D250–D253, U209; the user, 27 Nov). ──
const BRAND = ['QUINA QUINA!', 'BARRAKUDES · 2026'];
const HEADINGS = { normal: ['QUINES 1–5', 'QUINES 6–10'], especial: ['DESGRACIAT', 'ESPECIAL'] };
const GOMET = { diameter: 42.52 /* 15 mm */, size: 10.5, spacingEm: 0.15 };

// The sheets a Catalan copy shop prints colour on (portrait, in points): A4, A3 and SRA3 (32 × 45 cm, the digital
// presses' sheet). A layout cuts one sheet into cols × rows cards.
const SHEETS = { A4: { w: 595.28, h: 841.89 }, A3: { w: 841.89, h: 1190.55 }, SRA3: { w: 907.09, h: 1275.59 } };
const LAYOUTS = {
  '3x1-h': { name: '3×1 horizontal (today)', sheet: 'A4', landscape: false, cols: 1, rows: 3, titleMax: 14, cover: 46 },
  // The organizers choose (the user, 27 Nov): covers in colour (A3 · 6, option C) or this card without covers, black and
  // white on coloured paper like last year's, with last year's 16 pt titles.
  '3x1-h-bw': { name: '3×1 horizontal, no covers (b&w)', sheet: 'A4', landscape: false, cols: 1, rows: 3, titleMax: 16, noCovers: true },
  '2x1-h': { name: '2×1 horizontal', sheet: 'A4', landscape: false, cols: 1, rows: 2, titleMax: 16 },
  '2x1-v': { name: '2×1 vertical', sheet: 'A4', landscape: true, cols: 2, rows: 1, titleMax: 16 },
  '2x2-h': { name: '2×2 horizontal', sheet: 'A4', landscape: true, cols: 2, rows: 2, titleMax: 16 },
  '2x2-v': { name: '2×2 vertical', sheet: 'A4', landscape: false, cols: 2, rows: 2, titleMax: 16 },
  'sra3-6': { name: 'SRA3 · 6 a sheet', sheet: 'SRA3', landscape: true, cols: 2, rows: 3, titleMax: 15 },
  'sra3-4': { name: 'SRA3 · 4 a sheet', sheet: 'SRA3', landscape: true, cols: 2, rows: 2, titleMax: 16 },
  'a3-3': { name: 'A3 · 3 a sheet', sheet: 'A3', landscape: false, cols: 1, rows: 3, titleMax: 18 },
  'a3-6': { name: 'A3 · 6 a sheet', sheet: 'A3', landscape: false, cols: 2, rows: 3, titleMax: 16 },
  // The A3 · 6 card is decided (the user, 27 Nov); its header proposals:
  'a3-6-one-row': { name: 'A3 · 6, header in one row', sheet: 'A3', landscape: false, cols: 2, rows: 3, titleMax: 16, header: 'oneRow' },
  'a3-6-band': { name: 'A3 · 6, heading band', sheet: 'A3', landscape: false, cols: 2, rows: 3, titleMax: 16, header: 'band' },
  'a3-6-footer': { name: 'A3 · 6, branding at the foot', sheet: 'A3', landscape: false, cols: 2, rows: 3, titleMax: 16, header: 'footer' },
  // The user, 27 Nov: the 2×2 retry's header on the A3 · 6 card, with the branding's figure right of the GOMET circle.
  'a3-6-gomet-nino': { name: 'A3 · 6, GOMET + figure, no branding text', sheet: 'A3', landscape: false, cols: 2, rows: 3, titleMax: 16, header: 'gometNino', cellMode: 'above' },
  // The QR can't shrink (the user, 27 Nov): GOMET + QR left, the figure + number right, the heading centred at 38 pt.
  // The user's order kept (27 Nov): GOMET + figure, the heading between, the number next to its QR.
  'a3-6-gomet-nino-between': { name: 'A3 · 6, GOMET + figure, heading between, number + QR', sheet: 'A3', landscape: false, cols: 2, rows: 3, titleMax: 16, header: 'gometNinoBetween', cellMode: 'above' },
  'a3-6-gomet-qr': { name: 'A3 · 6, GOMET + QR left, figure + number right', sheet: 'A3', landscape: false, cols: 2, rows: 3, titleMax: 16, header: 'gometQr', cellMode: 'above' },
  'a3-6-gomet-left': { name: 'A3 · 6, GOMET left, no branding', sheet: 'A3', landscape: false, cols: 2, rows: 3, titleMax: 16, header: 'gometLeft', cellMode: 'above' },
  // One more try (the user, 27 Nov): 2×2 on A4 with a one-line header (no branding, the GOMET circle on the left), so
  // the grid is taller, and every song's cover above its title.
  '2x2-h-gomet-left': { name: '2×2 horizontal, GOMET left', sheet: 'A4', landscape: true, cols: 2, rows: 2, titleMax: 16, header: 'gometLeft', cellMode: 'above' },
  '2x2-h-gomet-left-beside': { name: '2×2 horizontal, GOMET left, cover beside', sheet: 'A4', landscape: true, cols: 2, rows: 2, titleMax: 16, header: 'gometLeft', cellMode: 'beside' },
  '2x2-v-gomet-left': { name: '2×2 vertical, GOMET left', sheet: 'A4', landscape: false, cols: 2, rows: 2, titleMax: 16, header: 'gometLeft', cellMode: 'above' },
};
// Each type's amount fills whole sheets: last year's 399 normal and 300 special, rounded up.
const AMOUNTS = (perPage) => ({ normal: Math.ceil(399 / perPage) * perPage, especial: Math.ceil(300 / perPage) * perPage });

// A seeded shuffle, so a mockup's cards are the same on every run.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function draw(pool, seed) {
  const r = rng(seed);
  const a = pool.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, 12);
}
// A card's 12 songs on a side: the sample cards where they exist; the second card of every page is the stress test
// (the pools' longest titles and artists, as #134 and #500); the others are drawn.
function cardSongs(kind, num, side, position) {
  const known = sample[kind].find((c) => c.id === num);
  if (known) return known.sides[side - 1].flat();
  if (position === 1) return sample[kind][1].sides[side - 1].flat();
  return draw(POOL[side], num * 7 + side);
}

// Word-wrap by measured widths: the number of lines, or null when one word alone is too wide.
function lineCount(text, font, size, maxW) {
  let n = 0;
  let cur = '';
  for (const w of text.split(' ')) {
    if (textWidth(font, w, size, 0.06) > maxW) return null;
    const t = cur ? `${cur} ${w}` : w;
    if (textWidth(font, t, size, 0.06) <= maxW) cur = t;
    else { n += 1; cur = w; }
  }
  return n + (cur ? 1 : 0);
}
// The largest title (and then artist) that fits the text box: title up to 3 lines, artist up to 2, never hyphenated.
// First with the artist at 8 pt or more (a tiny artist is unreadable); only if nothing fits, smaller.
function fitSong(song, boxW, boxH, titleMax) {
  const title = song.printTitle.toUpperCase();
  for (const artistFloor of [8, 6]) {
    for (let ts = titleMax; ts >= 7; ts -= 0.5) {
      const tl = lineCount(title, REGULAR, ts, boxW);
      if (!tl || tl > 3) continue;
      for (let as = Math.min(ts - 3, 12); as >= artistFloor; as -= 0.5) {
        const al = lineCount(song.printArtist, LIGHT, as, boxW);
        if (!al || al > 2) continue;
        if (tl * ts * 0.92 + 3 + al * as * 0.92 <= boxH) return { ts, as, ok: true };
      }
    }
  }
  return { ts: 7, as: 6, ok: false };
}

// Capitals drawn in a box exactly their cap height tall, so a heading centres on its letters and a filled box never
// clips them.
function CapText({ text, size, filled = false, padX = 0, padY = 0, color }) {
  const W = textWidth(REGULAR, text, size) + 2 * padX;
  const H = CAP * size + 2 * padY;
  return h(Svg, { viewBox: `0 0 ${W} ${H}`, style: { width: W, height: H } },
    filled ? h(Rect, { x: 0, y: 0, width: W, height: H, fill: '#000000' }) : null,
    h(Text, { x: W / 2, y: padY + CAP * size, textAnchor: 'middle', fill: color || (filled ? '#ffffff' : '#000000'), style: { fontFamily: 'LondrinaSolid', fontSize: size } }, text));
}
const headingWidth = (text, size, filled) => textWidth(REGULAR, text, size) + (filled ? 20 : 0);

// The GOMET circle: dashed, 15 mm, its word letter-spaced and centred on the circle's middle.
function Gomet() {
  const d = GOMET.diameter;
  const c = d / 2;
  const sp = GOMET.spacingEm * GOMET.size;
  const chars = [...'GOMET'];
  const widths = chars.map((ch) => advance(LIGHT, ch, GOMET.size));
  const total = widths.reduce((a, b) => a + b, 0) + sp * (chars.length - 1);
  let x = c - total / 2;
  return h(Svg, { viewBox: `0 0 ${d} ${d}`, style: { width: d, height: d } },
    h(Circle, { cx: c, cy: c, r: c - 0.5, fill: 'none', stroke: '#000000', strokeWidth: 1, strokeDasharray: '2.4 2.4' }),
    chars.map((ch, i) => {
      const el = h(Text, { key: i, x, y: c + (CAP * GOMET.size) / 2, fill: '#4d4d4d', style: { fontFamily: 'LondrinaSolid', fontWeight: 'light', fontSize: GOMET.size } }, ch);
      x += widths[i] + sp;
      return el;
    }));
}

const st = StyleSheet.create({
  card: { position: 'relative', display: 'flex', flexDirection: 'column', padding: 15, fontFamily: 'LondrinaSolid', lineHeight: 0.8, gap: 7 },
  brand: { display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 6 },
  logoIcon: { height: 683 * 0.055, width: 512 * 0.055 },
  brandText: { display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-start', lineHeight: 0.7, gap: 9 },
  brandTop: { fontSize: 18, fontWeight: 'light', letterSpacing: 1.08 },
  brandBottom: { fontSize: 11, fontWeight: 'light', letterSpacing: 1.08, color: '#4d4d4d' },
  numberBox: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', width: 62, gap: 2 },
  numberLabel: { fontSize: 14, fontWeight: 'light', textAlign: 'right', lineHeight: 1 },
  numberValue: { fontSize: 24, fontWeight: 'light', textAlign: 'right', lineHeight: 1 },
  table: { border: '1 solid black', padding: 1, display: 'flex', flexDirection: 'column' },
  row: { display: 'flex', flexDirection: 'row', flex: 1 },
  songTitle: { fontWeight: 'normal', textTransform: 'uppercase', lineHeight: 0.92 },
  songArtist: { fontWeight: 'light', lineHeight: 0.92, color: '#4d4d4d' },
});

const Brand = () =>
  h(View, { style: st.brand },
    h(Svg, { viewBox: '0 0 512 683', style: st.logoIcon }, h(Path, { d: ICON_D, fill: '#000000' })),
    h(View, { style: st.brandText },
      h(Text, { style: st.brandTop }, BRAND[0]),
      h(Text, { style: st.brandBottom }, BRAND[1])));

const BRAND_COMPACT = { icon: 0.04, top: 13, bottom: 8 };
const BrandCompact = () =>
  h(View, { style: [st.brand, { gap: 5 }] },
    h(Svg, { viewBox: '0 0 512 683', style: { height: 683 * BRAND_COMPACT.icon, width: 512 * BRAND_COMPACT.icon } }, h(Path, { d: ICON_D, fill: '#000000' })),
    h(View, { style: [st.brandText, { gap: 6 }] },
      h(Text, { style: [st.brandTop, { fontSize: BRAND_COMPACT.top, letterSpacing: 0.8 }] }, BRAND[0]),
      h(Text, { style: [st.brandBottom, { fontSize: BRAND_COMPACT.bottom, letterSpacing: 0.8 }] }, BRAND[1])));
const brandCompactWidth = 512 * BRAND_COMPACT.icon + 5 + Math.max(
  textWidth(LIGHT, BRAND[0], BRAND_COMPACT.top) + 0.8 * BRAND[0].length,
  textWidth(LIGHT, BRAND[1], BRAND_COMPACT.bottom) + 0.8 * BRAND[1].length);
const FOOTER_H = 12;
// The branding's figure («nino») on its own, as tall as the header's QR.
const NINO_H = 38;
const NINO_W = (NINO_H * 512) / 683;
const Nino = () => h(Svg, { viewBox: '0 0 512 683', style: { height: NINO_H, width: NINO_W } }, h(Path, { d: ICON_D, fill: '#000000' }));
const BrandFooter = () =>
  h(View, { style: { display: 'flex', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5, height: FOOTER_H } },
    h(Svg, { viewBox: '0 0 512 683', style: { height: 12, width: 9 } }, h(Path, { d: ICON_D, fill: '#000000' })),
    h(Text, { style: { fontSize: 9, fontWeight: 'light', letterSpacing: 0.8, lineHeight: 1 } }, `${BRAND[0]} · ${BRAND[1]}`));

const NumberAndQr = ({ num, qr, qrSize, width = 62, gap = 8 }) =>
  h(View, { style: { display: 'flex', flexDirection: 'row', alignItems: 'center', gap } },
    h(View, { style: [st.numberBox, { width }] },
      h(Text, { style: st.numberLabel }, 'CARTRÓ'),
      h(Text, { style: st.numberValue }, h(Text, { style: { color: '#bdbdbd' } }, '#'), String(num))),
    h(Image, { src: qr, style: { width: qrSize, height: qrSize } }));

// The geometry of one card in a layout: header, heading size, cells, cover, text box.
function geometry(layout) {
  const sheet = SHEETS[layout.sheet];
  const page = layout.landscape ? { w: sheet.h, h: sheet.w } : sheet;
  const W = page.w / layout.cols;
  const H = page.h / layout.rows;
  const innerW = W - 30;
  const innerH = H - 30;
  const single = innerW >= 500; // wide cards: one header row
  // Header styles: 'single' (wide cards), 'twoRows' (narrow cards: branding + number + QR, then heading + GOMET),
  // 'oneRow' (compact branding, heading, GOMET, number, QR), 'band' (branding + GOMET + number + QR, then the heading in
  // a band on the grid), 'footer' (heading, GOMET, number, QR; the branding in a line under the grid).
  const style = layout.header || (single ? 'single' : 'twoRows');
  // The QR is never smaller than last year's, 45 pt (16 mm): "it is already hard to scan. it is not negotiable".
  const qrSize = 45;
  // The GOMET headers keep the heading at 38 pt ("dont make the text smaller"), centred on the card where the side blocks
  // allow it: the number box as wide as «#500», 6 pt gaps, a slimmer padding on the black box.
  const NINO_NUMBER_W = 54; // «#500», the widest number, is 52.8 pt
  const NINO_GAP = 6;
  const headingPad = ['gometNino', 'gometNinoBetween'].includes(style) ? 4 : style === 'gometQr' ? 5 : 10;
  const rightW = GOMET.diameter + 8 + 62 + 8 + qrSize; // GOMET, number, QR
  const ROW = 46;
  const BAND_SIZE = 22;
  const bandH = CAP * BAND_SIZE + 12;
  const spec = {
    single: { headerH: 54, room: innerW - 2 * 170, max: 38, footerH: 0 },
    twoRows: { headerH: 45 + 6 + GOMET.diameter, room: innerW - 2 * (GOMET.diameter + 8), max: 38, footerH: 0 },
    oneRow: { headerH: ROW, room: innerW - brandCompactWidth - rightW - 16, max: 38, footerH: 0 },
    band: { headerH: ROW + 6 + bandH, room: innerW - 20, max: BAND_SIZE, footerH: 0 },
    footer: { headerH: ROW, room: innerW - rightW - 8, max: 34, footerH: 6 + FOOTER_H },
    gometLeft: { headerH: ROW, room: innerW - rightW - 16, max: 38, footerH: 0 },
    // The heading centred on the card: it may reach as far as the nearer side block allows.
    gometNino: { headerH: ROW, room: 2 * Math.min(innerW / 2 - (GOMET.diameter + 8 + NINO_W) - NINO_GAP, innerW / 2 - (NINO_NUMBER_W + NINO_GAP + qrSize) - NINO_GAP), max: 38, footerH: 0 },
    // The user's order, GOMET + figure, heading, number + QR (the number stays next to its QR, which encodes it): the heading
    // centred in the space between the side blocks, at 38 pt.
    gometNinoBetween: { headerH: ROW, room: innerW - (GOMET.diameter + NINO_GAP + NINO_W) - (NINO_NUMBER_W + NINO_GAP + qrSize) - 2 * NINO_GAP, max: 38, footerH: 0 },
    // GOMET + QR on the left, the figure + number on the right: two balanced sides leave room for a centred 38 pt heading.
    gometQr: { headerH: ROW, room: 2 * Math.min(innerW / 2 - (GOMET.diameter + NINO_GAP + qrSize) - NINO_GAP, innerW / 2 - (NINO_W + NINO_GAP + NINO_NUMBER_W) - NINO_GAP), max: 38, footerH: 0 },
  }[style];
  const headerH = spec.headerH;
  const widest = Math.max(...[...HEADINGS.normal, ...HEADINGS.especial].map((t) => textWidth(REGULAR, t, 38) + 2 * headingPad));
  const headingSize = Math.min(spec.max, Math.floor((38 * spec.room) / widest));
  const gridH = innerH - headerH - 7 - spec.footerH;
  const cellW = (innerW - 4) / 4;
  const cellH = (gridH - 4) / 3;
  const top = layout.cellMode ? layout.cellMode === 'above' : cellH / cellW >= 0.7; // tall cells: the cover above the title
  const cover = layout.noCovers ? 0 : layout.cover || (top ? Math.min(cellW - 10, (cellH - 6) * 0.55) : Math.min(cellH - 10, cellW * 0.36));
  const text = layout.noCovers ? { w: cellW - 11, h: cellH - 8 } : top ? { w: cellW - 8, h: cellH - cover - 14 } : { w: cellW - cover - 14, h: cellH - 8 };
  return { noCovers: Boolean(layout.noCovers), page, W, H, innerW, single, style, qrSize, headingPad, numberW: ['gometNino', 'gometQr', 'gometNinoBetween'].includes(style) ? NINO_NUMBER_W : 62, numberGap: ['gometNino', 'gometQr', 'gometNinoBetween'].includes(style) ? NINO_GAP : 8, headerH, bandH, headingSize, gridH, cellW, cellH, top, cover, text };
}

function Header({ g, kind, side, num, qr }) {
  const filled = side === 2;
  const heading = h(CapText, { text: HEADINGS[kind][side - 1], size: g.headingSize, filled, padX: filled ? g.headingPad : 0, padY: filled ? 7 : 0 });
  const centred = (child) => h(View, { style: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' } }, child);
  const right = h(View, { style: { display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 8 } }, h(Gomet), h(NumberAndQr, { num, qr, qrSize: g.qrSize }));
  const row = (children, extra = {}) => h(View, { style: [{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 46 }, extra] }, ...children);
  if (g.style === 'single') {
    return h(View, { style: { position: 'relative', display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: g.headerH } },
      h(View, { style: { width: 170 } }, h(Brand)),
      centred(heading),
      right);
  }
  if (g.style === 'oneRow') {
    return row([h(BrandCompact), h(View, { style: { flex: 1, display: 'flex', alignItems: 'center' } }, heading), right], { gap: 8 });
  }
  if (g.style === 'footer') {
    return row([heading, right]);
  }
  if (g.style === 'gometNinoBetween') {
    return row([
      h(View, { style: { display: 'flex', flexDirection: 'row', alignItems: 'center', gap: g.numberGap } }, h(Gomet), h(Nino)),
      h(View, { style: { flex: 1, display: 'flex', alignItems: 'center' } }, heading),
      h(NumberAndQr, { num, qr, qrSize: g.qrSize, width: g.numberW, gap: g.numberGap }),
    ], { gap: g.numberGap });
  }
  if (g.style === 'gometQr') {
    return h(View, { style: { position: 'relative', display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: g.headerH } },
      h(View, { style: { display: 'flex', flexDirection: 'row', alignItems: 'center', gap: g.numberGap } }, h(Gomet), h(Image, { src: qr, style: { width: g.qrSize, height: g.qrSize } })),
      centred(heading),
      h(View, { style: { display: 'flex', flexDirection: 'row', alignItems: 'center', gap: g.numberGap } }, h(Nino),
        h(View, { style: [st.numberBox, { width: g.numberW }] },
          h(Text, { style: st.numberLabel }, 'CARTRÓ'),
          h(Text, { style: st.numberValue }, h(Text, { style: { color: '#bdbdbd' } }, '#'), String(num)))));
  }
  if (g.style === 'gometNino') {
    return h(View, { style: { position: 'relative', display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: g.headerH } },
      h(View, { style: { display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 8 } }, h(Gomet), h(Nino)),
      centred(heading),
      h(NumberAndQr, { num, qr, qrSize: g.qrSize, width: g.numberW, gap: g.numberGap }));
  }
  if (g.style === 'gometLeft') {
    // No branding: the GOMET circle on the left, the heading centred between it and the number.
    return row([h(Gomet), h(View, { style: { flex: 1, display: 'flex', alignItems: 'center' } }, heading), h(NumberAndQr, { num, qr, qrSize: g.qrSize })], { gap: 8 });
  }
  if (g.style === 'band') {
    // The heading in a band as wide as the grid: outlined on side 1, black on side 2.
    const band = h(View, { style: { height: g.bandH, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5 solid black', backgroundColor: filled ? '#000000' : '#ffffff' } },
      h(CapText, { text: HEADINGS[kind][side - 1], size: g.headingSize, color: filled ? '#ffffff' : '#000000' }));
    return h(View, { style: { display: 'flex', flexDirection: 'column', gap: 6, height: g.headerH } }, row([h(Brand), right]), band);
  }
  return h(View, { style: { display: 'flex', flexDirection: 'column', gap: 6, height: g.headerH } },
    h(View, { style: { display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 45 } },
      h(Brand), h(NumberAndQr, { num, qr, qrSize: 42 })),
    h(View, { style: { position: 'relative', display: 'flex', flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', height: GOMET.diameter } },
      centred(heading), h(Gomet)));
}

function Cell({ g, id, titleMax, stats }) {
  const s = songs[id];
  const fit = fitSong(s, g.text.w - 3, g.text.h, titleMax);
  stats.push(fit);
  const cover = g.noCovers ? null : h(Image, { src: coverPath(id), style: { width: g.cover, height: g.cover, objectFit: 'cover' } });
  const words = [
    h(Text, { key: 't', style: [st.songTitle, { fontSize: fit.ts, letterSpacing: 0.06 * fit.ts, textAlign: g.top ? 'center' : 'left' }] }, s.printTitle),
    h(Text, { key: 'a', style: [st.songArtist, { fontSize: fit.as, letterSpacing: 0.06 * fit.as, textAlign: g.top ? 'center' : 'left' }] }, s.printArtist),
  ];
  const cell = { flex: 1, display: 'flex', border: '1 solid black', margin: -0.5, overflow: 'hidden' };
  if (g.top) {
    return h(View, { style: [cell, { flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, padding: 4 }] },
      cover, h(View, { style: { width: g.text.w, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 } }, words));
  }
  return h(View, { style: [cell, { flexDirection: 'row', alignItems: 'center', gap: 5, paddingLeft: 4, paddingRight: 4 }] },
    cover, h(View, { style: { flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 3 } }, words));
}

function Card({ g, layout, kind, side, num, position, qr, stats, cut }) {
  const ids = cardSongs(kind, num, side, position);
  const stamp = Math.min(70, g.W * 0.17);
  return h(View, { style: [st.card, { width: g.W, height: g.H }, cut] },
    // The faint logo stamp; the year now lives in the branding line («BARRAKUDES · 2026»).
    h(Svg, { viewBox: '0 0 1024 1024', style: { position: 'absolute', bottom: 22, right: 6, width: stamp, height: stamp, transform: 'rotate(15deg)' } },
      h(Path, { d: STAMP_D, fillRule: 'evenodd', fill: '#000000', opacity: 0.09 })),
    h(Header, { g, kind, side, num, qr }),
    h(View, { style: [st.table, { height: g.gridH }] },
      [0, 1, 2].map((r) =>
        h(View, { key: r, style: st.row },
          ids.slice(r * 4, r * 4 + 4).map((id) => h(Cell, { key: id, g, id, titleMax: layout.titleMax, stats }))))),
    g.style === 'footer' ? h(BrandFooter) : null);
}

async function build(key) {
  const layout = LAYOUTS[key];
  const g = geometry(layout);
  const perPage = layout.cols * layout.rows;
  const amounts = AMOUNTS(perPage);
  const numbers = {
    normal: [...Array(perPage)].map((_, k) => 1 + (k * amounts.normal) / perPage),
    especial: [...Array(perPage)].map((_, k) => amounts.normal + 1 + (k * amounts.especial) / perPage),
  };
  const qrs = {};
  for (const n of [...numbers.normal, ...numbers.especial]) qrs[n] = await generateQRCodeDataUri(n);
  const stats = [];
  const pages = [];
  for (const kind of ['normal', 'especial']) {
    for (const side of [1, 2]) {
      const rows = [...Array(layout.rows)].map((_, r) => {
        let cards = numbers[kind].slice(r * layout.cols, (r + 1) * layout.cols).map((num, c) => ({ num, position: r * layout.cols + c, c }));
        if (side === 2) cards = cards.slice().reverse(); // duplex: a back row is mirrored, so each card's side 2 is behind it
        return h(View, { key: r, style: { display: 'flex', flexDirection: 'row' } },
          cards.map(({ num, position }, i) => {
            // Cut lines on the front only (D102), faint as last year's.
            const cut = side === 1 ? { borderRight: i < layout.cols - 1 ? '1px dashed #f0f0f0' : undefined, borderBottom: r < layout.rows - 1 ? '1px dashed #f0f0f0' : undefined } : {};
            return h(Card, { key: num, g, layout, kind, side, num, position, qr: qrs[num], stats, cut });
          }));
      });
      pages.push(h(Page, { key: kind + side, size: [g.page.w, g.page.h], style: { backgroundColor: '#ffffff' } }, rows));
    }
  }
  fs.mkdirSync(OUT, { recursive: true });
  const out = path.join(OUT, `cards-${key}.pdf`);
  await render(h(Document, null, pages), out);
  const ts = stats.map((s) => s.ts).sort((a, b) => a - b);
  const mm = (pt) => (pt / 2.8346).toFixed(0);
  const sheets = Math.ceil(amounts.normal / perPage) + Math.ceil(amounts.especial / perPage);
  console.log(`${key.padEnd(6)} ${layout.name.padEnd(24)} card ${mm(g.W)}×${mm(g.H)} mm, ${perPage} a ${layout.sheet} (${sheets} sheets for ${amounts.normal}+${amounts.especial}), cell ${mm(g.cellW)}×${mm(g.cellH)} mm, cover ${mm(g.cover)} mm ${g.top ? 'above' : 'beside'}, heading ${g.headingSize} pt, title median ${ts[Math.floor(ts.length / 2)]} pt (min ${ts[0]}), ${stats.filter((s) => !s.ok).length} not fitting → ${out}`);
}

(async () => {
  const keys = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(LAYOUTS);
  for (const k of keys) await build(k);
})().catch((e) => { console.error(e); process.exit(1); });
