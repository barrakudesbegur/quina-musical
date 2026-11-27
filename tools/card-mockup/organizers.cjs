// The sheet for the organizers (the user, 27 Nov): last year's card and the two 2026 options, one card each, each at its
// real size, on one A3 page. Option 1: covers in colour (A3, 6 a sheet, header option C). Option 2: the 21 × 9.9 cm card
// without covers, black and white on coloured paper like last year's.
//
//   node tools/card-mockup/mockup.cjs a3-6-gomet-nino-between 3x1-h-bw
//   (crop one card of each at 300 dpi into out/org-2025.png, out/org-color.png, out/org-bw.png)
//   node tools/card-mockup/organizers.cjs      → out/cartrons-2026-opcions.pdf
const path = require('path');

const R = process.env.QUINA_ROOT || path.resolve(__dirname, '../..');
const OUT = process.env.MOCKUP_OUT || path.join(__dirname, 'out');
const M = (m) => require(path.join(R, 'apps/cards/node_modules', m));
const React = M('react');
const { Document, Font, Image, Page, render, Text, View } = M('@react-pdf/renderer');
const h = React.createElement;

const fontPath = path.join(R, 'apps/cards/src/assets/LondrinaSolid');
Font.register({
  family: 'LondrinaSolid',
  fonts: [
    { src: path.join(fontPath, 'LondrinaSolid-Regular.ttf'), fontWeight: 'normal' },
    { src: path.join(fontPath, 'LondrinaSolid-Light.ttf'), fontWeight: 'light' },
  ],
});

const MM = 72 / 25.4;
const A3 = { w: 420 * MM, h: 297 * MM };
// Londrina has no «×», so sizes read «21 x 9,9 cm». Each card at its real size, in points: last year's and option 2 are 210 × 99 mm, option 1 is 148.5 × 140 mm.
const CARDS = [
  { file: 'org-2025.png', x: 40, y: 132, w: 595.28, h: 280.63, title: "L'ANY PASSAT (2025)", sub: '21 x 9,9 cm · blanc i negre sobre paper de color · 3 per full A4' },
  { file: 'org-color.png', x: 695.28, y: 132, w: 420.94, h: 396.85, title: 'OPCIÓ 1 · AMB PORTADES, EN COLOR', sub: '14,9 x 14 cm · 6 per full A3' },
  { file: 'org-bw.png', x: 40, y: 477, w: 595.28, h: 280.63, title: 'OPCIÓ 2 · SENSE PORTADES, EN BLANC I NEGRE', sub: "21 x 9,9 cm · com l'any passat, sobre paper de color · 3 per full A4" },
];

const label = { fontFamily: 'LondrinaSolid', fontSize: 17, lineHeight: 1 };
const sub = { fontFamily: 'LondrinaSolid', fontWeight: 'light', fontSize: 11, lineHeight: 1, color: '#4d4d4d', letterSpacing: 0.4 };

const page = h(Page, { size: [A3.w, A3.h], style: { backgroundColor: '#ffffff', position: 'relative' } },
  h(View, { style: { position: 'absolute', left: 40, top: 34 } },
    h(Text, { style: { fontFamily: 'LondrinaSolid', fontSize: 30, lineHeight: 1 } }, 'CARTRONS 2026 · DUES OPCIONS'),
    h(Text, { style: [sub, { fontSize: 12, marginTop: 8 }] }, 'Mida real: imprimiu-lo en A3 al 100 %, sense ajustar a la pàgina.')),
  ...CARDS.map((c) => [
    h(View, { key: `${c.file}-label`, style: { position: 'absolute', left: c.x, top: c.y - 34 } },
      h(Text, { style: label }, c.title),
      h(Text, { style: [sub, { marginTop: 5 }] }, c.sub)),
    // A hairline where the card is cut, so its real size shows on screen and on paper.
    h(View, { key: c.file, style: { position: 'absolute', left: c.x, top: c.y, width: c.w, height: c.h, border: '0.5 solid #9a9a9a' } },
      h(Image, { src: path.join(OUT, c.file), style: { width: c.w - 1, height: c.h - 1 } })),
  ]).flat(),
  h(Text, { style: [sub, { position: 'absolute', left: 40, top: 792 }] },
    'Cara 1 (Quines 1–5). Les dues opcions porten la cara 2 (Quines 6–10) al darrere, i el cartró especial té les seves dues cares (Desgraciat i Especial).'));

render(h(Document, null, page), path.join(OUT, 'cartrons-2026-opcions.pdf'))
  .then(() => console.log('written', path.join(OUT, 'cartrons-2026-opcions.pdf')))
  .catch((e) => { console.error(e); process.exit(1); });
