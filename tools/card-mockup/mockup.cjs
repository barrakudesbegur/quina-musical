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
  '2x1-h': { name: '2×1 horizontal', sheet: 'A4', landscape: false, cols: 1, rows: 2, titleMax: 16 },
  '2x1-v': { name: '2×1 vertical', sheet: 'A4', landscape: true, cols: 2, rows: 1, titleMax: 16 },
  '2x2-h': { name: '2×2 horizontal', sheet: 'A4', landscape: true, cols: 2, rows: 2, titleMax: 16 },
  '2x2-v': { name: '2×2 vertical', sheet: 'A4', landscape: false, cols: 2, rows: 2, titleMax: 16 },
  'sra3-6': { name: 'SRA3 · 6 a sheet', sheet: 'SRA3', landscape: true, cols: 2, rows: 3, titleMax: 15 },
  'sra3-4': { name: 'SRA3 · 4 a sheet', sheet: 'SRA3', landscape: true, cols: 2, rows: 2, titleMax: 16 },
  'a3-3': { name: 'A3 · 3 a sheet', sheet: 'A3', landscape: false, cols: 1, rows: 3, titleMax: 18 },
  'a3-6': { name: 'A3 · 6 a sheet', sheet: 'A3', landscape: false, cols: 2, rows: 3, titleMax: 16 },
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
function CapText({ text, size, filled = false, padX = 0, padY = 0 }) {
  const W = textWidth(REGULAR, text, size) + 2 * padX;
  const H = CAP * size + 2 * padY;
  return h(Svg, { viewBox: `0 0 ${W} ${H}`, style: { width: W, height: H } },
    filled ? h(Rect, { x: 0, y: 0, width: W, height: H, fill: '#000000' }) : null,
    h(Text, { x: W / 2, y: padY + CAP * size, textAnchor: 'middle', fill: filled ? '#ffffff' : '#000000', style: { fontFamily: 'LondrinaSolid', fontSize: size } }, text));
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

const NumberAndQr = ({ num, qr, qrSize }) =>
  h(View, { style: { display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 8 } },
    h(View, { style: st.numberBox },
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
  const single = innerW >= 500; // one header row (wide cards), or two rows (narrow cards)
  const headerH = single ? 54 : 45 + 6 + GOMET.diameter;
  const headingRoom = single ? innerW - 2 * 170 : innerW - 2 * (GOMET.diameter + 8);
  const widest = Math.max(...[...HEADINGS.normal, ...HEADINGS.especial].map((t) => headingWidth(t, 38, true)));
  const headingSize = Math.min(38, Math.floor((38 * headingRoom) / widest));
  const gridH = innerH - headerH - 7;
  const cellW = (innerW - 4) / 4;
  const cellH = (gridH - 4) / 3;
  const top = cellH / cellW >= 0.7; // tall cells: the cover above the title
  const cover = layout.cover || (top ? Math.min(cellW - 10, (cellH - 6) * 0.55) : Math.min(cellH - 10, cellW * 0.36));
  const text = top ? { w: cellW - 8, h: cellH - cover - 14 } : { w: cellW - cover - 14, h: cellH - 8 };
  return { page, W, H, innerW, single, headerH, headingSize, gridH, cellW, cellH, top, cover, text };
}

function Header({ g, kind, side, num, qr }) {
  const filled = side === 2;
  const heading = h(CapText, { text: HEADINGS[kind][side - 1], size: g.headingSize, filled, padX: filled ? 10 : 0, padY: filled ? 7 : 0 });
  const centred = (child) => h(View, { style: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' } }, child);
  if (g.single) {
    return h(View, { style: { position: 'relative', display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: g.headerH } },
      h(View, { style: { width: 170 } }, h(Brand)),
      centred(heading),
      h(View, { style: { display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 8 } }, h(Gomet), h(NumberAndQr, { num, qr, qrSize: 45 })));
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
  const cover = h(Image, { src: coverPath(id), style: { width: g.cover, height: g.cover, objectFit: 'cover' } });
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
          ids.slice(r * 4, r * 4 + 4).map((id) => h(Cell, { key: id, g, id, titleMax: layout.titleMax, stats }))))));
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
  console.log(`${key.padEnd(6)} ${layout.name.padEnd(24)} card ${mm(g.W)}×${mm(g.H)} mm, ${perPage} a ${layout.sheet} (${sheets} sheets for ${amounts.normal}+${amounts.especial}), cell ${mm(g.cellW)}×${mm(g.cellH)} mm, cover ${mm(g.cover)} mm ${g.top ? 'above' : 'beside'}, title median ${ts[Math.floor(ts.length / 2)]} pt (min ${ts[0]}), ${stats.filter((s) => !s.ok).length} not fitting → ${out}`);
}

(async () => {
  const keys = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(LAYOUTS);
  for (const k of keys) await build(k);
})().catch((e) => { console.error(e); process.exit(1); });
