# The 2026 printed cards: the design

The design of this year's printed cards, made with the user in the card design session (27 Nov 2026), and the tool that
draws it. **The design is final (27 Nov), in two options**, because the organizers choose between covers in colour (A, the
working default) and no covers in black and white (B) (U212). The card design session builds both into `apps/cards/src`
behind one switch (the user: "assume we do a. and you can code both so i decide the final later"); the cards are made on
4–5 Dec (D83). The canvas's "Final (both options)" page shows every side of both.

- **The boards:** the design canvas "Quina cards 2026" (https://claude.ai/code/artifact/8af06588-238f-4095-8d67-a594d91c7392),
  one page per proposal, every version kept, plus a page for the organizers. It's private: the user shares it.
- **The decisions:** D250–D268 and U209 in [docs/decision-log.md](../../docs/decision-log.md) and
  [docs/open-questions.md](../../docs/open-questions.md); terms as in [GLOSSARY.md](../../GLOSSARY.md).

## The card (proposal 7)

Last year's card, [apps/cards/dist/cards-normal.pdf](../../apps/cards/dist/cards-normal.pdf), kept as it was (the
Barrakudes figure, Londrina Solid, the double-bordered 3×4 grid, black ink, the faint logo stamp), with only what 2026
needs:

| Part | 2026 |
|---|---|
| Branding (top left) | B: the figure, «QUINA QUINA!» (no «3»), and «BARRAKUDES · 2026» under it. A (header C): the figure alone, beside the GOMET circle |
| Heading (centred on the card, not between the side blocks) | Normal side 1 «QUINES 1–5»; side 2 «QUINES 6–10» in white on black. Special side 1 «DESGRACIAT»; side 2 «ESPECIAL» in white on black. The special card has no parts (D252) |
| GOMET circle | Dashed, 15 mm, «GOMET» in Londrina Light at 10.5 pt, letter-spaced 0.15 em, centred on the circle's middle (D253) |
| Number | «CARTRÓ», then the number with a faded «#» before it |
| QR | As today: `/26/<number>` on white |
| Each song | Its cover beside the title (16 mm in the 3×1 layout), or above it in tall cells; the title in Londrina Regular, capitals, fitted from 14 pt down (16 pt in the larger layouts), up to 3 lines, **never hyphenated**; the artist in Londrina Light, up to 2 lines, at 8 pt or more when it fits |
| Stamp | The faint logo with «2026» above it, as last year's card (D263) |
| Removed | The event title, the corn-seeds line, the name field |

The two card types look the same; as last year, the paper colour tells them apart (pending U52). A duplex back mirrors
each row, so every card's side 2 lands behind its side 1; cut lines are on the front only (D102).

**Print names** (agreed by the user, 27 Nov, D260): Spotify's tags come off («Dura - Remix» → «Dura»,
«Titanium (feat. Sia)» → «Titanium»), the artist is the main one only (#70, #97 and #129 keep two), with hand fixes for
typos and accents, and «Aserejé» for both #5 and #128 (D261). 38 of the 136 songs change:
[print-titles.py](print-titles.py) writes [data/songs-print.json](data/songs-print.json). Sound engine owns the field
(`printTitle` / `printArtist` in the repertoire's songs.json, its hand fixes keyed by Spotify id); paper and screens show
the same names.

## Decided: A3, 6 cards a sheet (the user, 27 Nov)

The card is 149 × 140 mm, six to an A3 portrait sheet (`a3-6`), printed «dúplex, vora llarga». The amounts stay
last year's, normal 1–399 and special 400–699, so a card's first digit tells its type (the user, D264). The normal card's
last sheets have 3 empty places: they repeat the last cards (#397–#399) as samples, with a big faint diagonal «MOSTRA»
on both sides; samples aren't cards. 67 + 50 = 117 A3 sheets. Each back row is mirrored, and front and back line up:
held up to the light, the back's grid falls exactly on the front's (the canvas's "Headers" page shows it).

**The header, being chosen.** Two rules from the user: the heading stays at 38 pt ("dont make the text smaller"), and the QR never gets smaller than last year's 45 pt, 16 mm ("it is already hard to scan. it is not negotiable"). Centred on the card, the heading can only reach as far as the busier side allows, so it sits centred in the space between them; the card number always stays next to its QR ("it is the content of the qr"). The card is too narrow for last year's one-row header, so the songs lose height to a two-row one:

| Proposal | Header | Cell | Cover | Titles (median, smallest) |
|---|---|---|---|---|
| `a3-6` two rows | branding + number + QR, then the heading + GOMET | 34 × 31 mm | 16 mm | 13.5 pt, 7 pt (5 too long) |
| `a3-6-one-row` one row | compact branding, heading, GOMET, number, QR | 34 × 36 mm | 19 mm | 13.5 pt, 9.5 pt |
| `a3-6-band` heading band | branding + GOMET + number + QR, then the heading in a band as wide as the grid | 34 × 32 mm | 17 mm | 13.5 pt, 7 pt (3 too long) |
| `a3-6-footer` branding at the foot | a big heading, GOMET, number, QR; the branding in a line under the grid | 34 × 34 mm | 18 mm | 13.5 pt, 7 pt (3 too long) |
| `a3-6-gomet-left` no branding | the GOMET circle, the heading, number, QR | 34 × 36 mm | 19 mm | 13.5 pt, 9.5 pt |
| `a3-6-gomet-nino-between` **option C, chosen** | the user's order: the GOMET circle and the Barrakudes figure, the heading at 38 pt centred in the space between (about 5 mm left of the card's centre), the number next to its QR | 34 × 36 mm | 19 mm | 13.5 pt, 9.5 pt |
| `a3-6-gomet-qr` rejected | the QR moved to the left to centre the heading: the number must sit next to its QR, which encodes it | | | |
| `a3-6-gomet-left` **option B** | option C without the figure: the GOMET circle, the heading at 38 pt centred between it and the number (about 1 cm left of the card's centre), the number and the QR | 34 × 36 mm | 19 mm | 13.5 pt, 9.5 pt |
| `a3-6-gomet-nino` superseded | the GOMET circle, the figure, the heading centred at 38 pt, the number and a 12 mm QR: too small | | | |

One more try the user asked for: 2×2 on A4 with that last header and every cover above its title
(`2x2-v-gomet-left`: 23 × 39 mm cells, 20 mm covers, 13 pt titles, 13 of 192 too long; `2x2-h-gomet-left`:
34 × 25 mm cells, 12 mm covers, 39 of 192 too long, or 25 with the cover beside).

## The organizers choose: covers in colour, or no covers in black and white (27 Nov)

The user chose header option C for the A3 · 6 card, and asked the organizers to choose between:

- **Option 1, covers in colour:** the A3 · 6 card (149 × 140 mm, header C, covers above the titles), `a3-6-gomet-nino-between`.
- **Option 2, no covers, black and white:** the 21 × 9.9 cm card the organizers saw before (3 a page on A4, the header
  with «QUINA QUINA!» and «BARRAKUDES · 2026», the centred 38 pt heading, the GOMET circle, the number next to its QR),
  without covers, so the titles are last year's 16 pt: `3x1-h-bw`. Black on coloured paper, like last year.

[organizers.cjs](organizers.cjs) puts last year's card and one card of each option on an A3 page, each at its real size
(out/cartrons-2026-opcions.pdf, captioned in Catalan; print it at 100 % on A3).

## Layouts compared

The user asked to compare layouts, and the copy shop prints colour on A4, A3 and SRA3 (32 × 45 cm, the digital
presses' sheet, common in Catalan copy shops). A bigger sheet only fits more cards per print; what it adds is card sizes
A4 can't cut. Page 1 of each layout is on the canvas's "Layouts" page.

| Layout | Sheet | Card | Per sheet | Sheets (normal + special) | Cell | Cover | Titles (median, smallest) |
|---|---|---|---|---|---|---|---|
| `3x1-h` today | A4 portrait | 210 × 99 mm | 3 | 233 | 50 × 22 mm | 16 mm, beside | 14 pt, 10 pt |
| `2x1-h` | A4 portrait | 210 × 149 mm | 2 | 350 | 50 × 38 mm | 20 mm, above | 16 pt, 13 pt |
| `2x1-v` | A4 landscape | 149 × 210 mm | 2 | 350 | 34 × 54 mm | 29 mm, above | 16 pt, 11 pt |
| `2x2-h` | A4 landscape | 149 × 105 mm | 4 | 175 | 34 × 19 mm | 12 mm, beside | 11.5 pt, 7 pt (25 of 192 too long) |
| `2x2-v` | A4 portrait | 105 × 149 mm | 4 | 175 | 23 × 34 mm | 17 mm, above | 11.5 pt, 7 pt (28 of 192 too long) |
| `sra3-6` | SRA3 landscape | 225 × 107 mm | 6 | 117 | 53 × 24 mm | 19 mm, beside | 15 pt, 10 pt |
| `sra3-4` | SRA3 landscape | 225 × 160 mm | 4 | 175 | 53 × 42 mm | 22 mm, above | 16 pt, 14 pt |
| `a3-3` | A3 portrait | 297 × 140 mm | 3 | 233 | 71 × 35 mm | 26 mm, beside | 18 pt, 14.5 pt |
| `a3-6` | A3 portrait | 149 × 140 mm | 6 | 117 | 34 × 31 mm | 16 mm, above | 13.5 pt, 7 pt (5 of 288 too long) |

- The same card on another sheet: the A4 `2x1-h` card (A5) fits 4 to an A3; today's card fits 6 to an A3 or an SRA3.
  The price per card follows the paper's area, so the copy shop's price per sheet (colour, duplex, about 160 g/m²)
  decides between them.
- The header keeps its size on every card, so a bigger card gives its extra room to the songs; on `a3-3` the header
  could grow too.
- Cards narrower than 176 mm get a two-row header: branding with the number and QR, then the heading with the GOMET
  circle.
- Amounts stay 399 normal and 300 special; a layout's empty places hold «MOSTRA» samples (D264).
- Duplex: a portrait sheet flips on its long edge («dúplex, vora llarga»), a landscape one on its short edge
  («vora curta»), so the back reads the right way up. Either way each back row is mirrored.

## Answered by the user (27 Nov, night; D260–D268)

- U201: the GOMET circle on both sides. A player who sticks different gomets on the two sides changes the card's mark
  in the app.
- U198: the special card's Check label is the printed word, «Desgraciat» / «Especial» (card-types.json's `checkLabel`).
- U52: last year's coloured paper (blue normal, pink special), printed in colour, a proof sheet first.
- The print names (above); «2026» in the stamp; 399 + 300 with «MOSTRA» samples.
- U199: pools may share songs (D268): one song library, pools reference songs, the Pausa and Break music included.

**Still open:** U212, the organizers' pick (A or B).

## Drawing the mockups

The PDFs carry the songs' album covers, so they are written to `out/` (ignored by git) and never committed.

1. Once, in `apps/cards`: `npm install` (with the `canvas` install script approved, see its README) and `npm run build`
   (the mockup uses its QR helper, `build/utils/qr.js`).
2. The covers: repertoire 2026's, in `data/media/2026/output/covers/<id>.jpg` (prepared by Sound engine).
3. `node tools/card-mockup/mockup.cjs` draws every layout, or name some: `node tools/card-mockup/mockup.cjs 3x1-h a3-3`.
   Each PDF has four pages: the normal card's side 1 and side 2, then the special card's.
4. After a playlist change: `python3 tools/card-mockup/print-titles.py data/repertoires/2026/songs.json tools/card-mockup/data/songs-print.json`.

[data/sample-cards.json](data/sample-cards.json) holds the sample cards (#1, #134, #267, #400, #500, #600); #134 and #500
carry the pools' longest titles and artists, as a stress test, and so does the second card of every page in the other
layouts. The title fit is measured with `fontkit` on the real fonts, as the PDF renderer lays them out.
