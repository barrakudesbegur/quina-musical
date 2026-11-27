# The 2026 printed cards: design so far

The design of this year's printed cards, made with the user in the card design session (27 Nov 2026), and the tool that
draws it. **Nothing here is built into the generator yet.** Once the user agrees the design, Frontend builds it into
`apps/cards/src` (the cards are made on 4–5 Dec, D83).

- **The boards:** the design canvas "Quina cards 2026" (https://claude.ai/code/artifact/8af06588-238f-4095-8d67-a594d91c7392),
  one page per proposal, every version kept, plus a page for the organizers. It's private: the user shares it.
- **The decisions:** D250–D253 and U209 in [docs/decision-log.md](../../docs/decision-log.md) and
  [docs/open-questions.md](../../docs/open-questions.md); terms as in [GLOSSARY.md](../../GLOSSARY.md).

## The card (proposal 7)

Last year's card, [apps/cards/dist/cards-normal.pdf](../../apps/cards/dist/cards-normal.pdf), kept as it was (the
Barrakudes figure, Londrina Solid, the double-bordered 3×4 grid, black ink, the faint logo stamp), with only what 2026
needs:

| Part | 2026 |
|---|---|
| Branding (top left) | The figure, «QUINA QUINA!» (no «3»), and «BARRAKUDES · 2026» under it |
| Heading (centred on the card, not between the side blocks) | Normal side 1 «QUINES 1–5»; side 2 «QUINES 6–10» in white on black. Special side 1 «DESGRACIAT»; side 2 «ESPECIAL» in white on black. The special card has no parts (D252) |
| GOMET circle | Dashed, 15 mm, «GOMET» in Londrina Light at 10.5 pt, letter-spaced 0.15 em, centred on the circle's middle (D253) |
| Number | «CARTRÓ», then the number with a faded «#» before it |
| QR | As today: `/26/<number>` on white |
| Each song | Its cover beside the title (16 mm in the 3×1 layout), or above it in tall cells; the title in Londrina Regular, capitals, fitted from 14 pt down (16 pt in the larger layouts), up to 3 lines, **never hyphenated**; the artist in Londrina Light, up to 2 lines, at 8 pt or more when it fits |
| Stamp | The faint logo only; the year moved into the branding |
| Removed | The event title, the corn-seeds line, the name field |

The two card types look the same; as last year, the paper colour tells them apart (pending U52). A duplex back mirrors
each row, so every card's side 2 lands behind its side 1; cut lines are on the front only (D102).

**Print titles** (a proposal, pending the user's OK): Spotify's tags come off («Dura - Remix» → «Dura»,
«Titanium (feat. Sia)» → «Titanium»), at most two artists, and a hand fix where the rules fail (#90). 20 of the 136 songs
change: [print-titles.py](print-titles.py) writes [data/songs-print.json](data/songs-print.json). If agreed, the field
and its hand fixes become Sound engine's data, shown the same on paper and screens.

## Layouts being tested

The user asked to compare page layouts. Page 1 of each is on the canvas's "Layouts (proposal 7)" page.

| Layout | Paper | Card | Per A4 | Cell | Cover | Titles (median, smallest) |
|---|---|---|---|---|---|---|
| `3x1-h` 3×1 horizontal (today) | portrait | 210 × 99 mm | 3 | 50 × 22 mm | 16 mm, beside | 14 pt, 10 pt |
| `2x1-h` 2×1 horizontal | portrait | 210 × 149 mm | 2 | 50 × 38 mm | 20 mm, above | 16 pt, 13 pt |
| `2x1-v` 2×1 vertical | landscape | 149 × 210 mm | 2 | 34 × 54 mm | 29 mm, above | 16 pt, 11 pt |
| `2x2-h` 2×2 horizontal | landscape | 149 × 105 mm | 4 | 34 × 19 mm | 12 mm, beside | 11.5 pt, 7 pt (25 of 192 too long) |
| `2x2-v` 2×2 vertical | portrait | 105 × 149 mm | 4 | 23 × 34 mm | 17 mm, above | 11.5 pt, 7 pt (28 of 192 too long) |

- Cards narrower than 176 mm get a two-row header: branding with the number and QR, then the heading with the GOMET
  circle.
- Amounts must fill whole pages: 399 normal and 300 special for 3 a page, 400 and 300 for 2 or 4.
- Duplex: a portrait sheet flips on its long edge («dúplex, vora llarga»); a landscape sheet flips on its short edge
  («vora curta») so the back reads the right way up. Either way each back row is mirrored.

## Open with the user

- U201: the GOMET circle on both sides.
- U198: the special card's label on screens during the Check (proposed: «Desgraciat», «Especial», as printed).
- U52: the paper (proposed: last year's coloured paper, a proof sheet first).
- The print titles (above), and the layout.
- A final design by 1 Dec, so Frontend can build it (about 2 days) and proof it before 4–5 Dec.

## Drawing the mockups

The PDFs carry the songs' album covers, so they are written to `out/` (ignored by git) and never committed.

1. Once, in `apps/cards`: `npm install` (with the `canvas` install script approved, see its README) and `npm run build`
   (the mockup uses its QR helper, `build/utils/qr.js`).
2. The covers: repertoire 2026's, in `data/media/2026/output/covers/<id>.jpg` (prepared by Sound engine).
3. `node tools/card-mockup/mockup.cjs` draws every layout, or name some: `node tools/card-mockup/mockup.cjs 3x1-h 2x1-v`.
   Each PDF has four pages: the normal card's side 1 and side 2, then the special card's.
4. After a playlist change: `python3 tools/card-mockup/print-titles.py data/repertoires/2026/songs.json tools/card-mockup/data/songs-print.json`.

[data/sample-cards.json](data/sample-cards.json) holds the sample cards (#1, #134, #267, #400, #500, #600); #134 and #500
carry the pools' longest titles and artists, as a stress test, and so does the second card of every page in the other
layouts. The title fit is measured with `fontkit` on the real fonts, as the PDF renderer lays them out.
