# Bingo cards generator for musical bingo

This project generates bingo cards for a musical bingo game. The cards are generated in PDF and JSON formats.

## Usage

The output files are committed in [`dist`](./dist): `cards.json`, `card-types.json` and one PDF per card type
(`cards-normal.pdf`, `cards-especial.pdf`). Until this year's playlist is final they are last year's test cards; don't
regenerate them for real before then (the real cards are made after the final playlist, 1 Dec). The committed
`card-types.json` predates the 2026 design (no `checkLabel` or `heading`, the title «QUINA QUINA! 3»), and the committed
PDFs still show last year's one-sided cards, title and old cards #398 and #492.

The JSON files are written before the PDF renderer loads, so `cards.json` and `card-types.json` are written even when
the native `canvas` module is missing (the run then fails at the PDF step).

The cards are drawn from a **repertoire** (the edition's prepared songs, D178), `data/repertoires/<name>.json`: the same file the song preparation (`tools/prep`)
and the relay read. Its `songsJson` is the playlist; its `cardsJson` is where `cards.json` goes, with
`card-types.json` and the PDFs beside it (the folder the relay serves at `/cards/`).

## Sides and pools

A card has **sides** (D101, D102, D178), each printed from one **pool** of the repertoire: a song's `pools` in
songs.json (`["1", "2"]`, D268, below), or before D268 its one `pool` (`"1"`, `"2"`; a song with neither is in pool
`"1"`). `CARD_TYPES` in [`src/config.ts`](./src/config.ts) says which pool each side of a type is printed from (D171):

- the normal card: side 1 plays Quines 1–5, from pool 1 (`label: "1–5"`); side 2 plays Quines 6–10, from pool 2
  (`label: "6–10"`, D193). The same number and QR on both;
- the especial card (D226): side 1 plays the Quina del Desgraciat (D251), from pool 1 (`label: "Desgraciat"`, its short
  name); side 2 plays the Quina Especial, from pool 2 (`label: "Quina Especial"`). It's one card for both rounds (D81),
  under the same number and QR; the pool changes in the Break.

`cards.json` holds each card as `{ id, type, sides: [{ side, lines: [[{ id, title, artist } × 4] × 3] }] }`, and
`card-types.json` each type's `sides: [{ side, pool, label, checkLabel, heading }]` and its `shortName` ("Normal"):

- `checkLabel` is the side's whole label on the screens during the Check, as printed (U198 answered (a), D266):
  «Normal 1–5», «Normal 6–10», «Desgraciat», «Especial». Every printed side has one.
- `heading` is the big word at the top of the printed side: «QUINES 1–5», «QUINES 6–10», «DESGRACIAT», «ESPECIAL».
- `label` is the older label, which the screens join after `shortName` (D163: "Normal 1–5", "Especial ·
  Desgraciat"); kept until every screen reads `checkLabel`.

Readers take a card from before sides (`lines` and no `sides`) as its side 1.

**Songs in several pools (D268):** a song lists its pools, `pools: ["1", "2"]`, under one id. A song from before D268
has `pool: "1"` (none is pool 1); during the change a song may carry both, and `pools` wins (its `pool` must be one of
them). A side is drawn from the songs whose pools include its pool, so a card's side 1 and side 2 may share a song;
within a pool no card or line repeats. The per-pool counts (the run's first line, `--check`, the checks below) count a
song in each of its pools.

**Print names (D260):** a song may carry `printTitle` / `printArtist` in songs.json (Sound engine's, only where they
differ from Spotify's: tags off, the main artist only, hand fixes). The cards print `printTitle ?? title` and
`printArtist ?? artist`, and `cards.json`'s song lines carry those same names as `title` / `artist`, so the phones
show what the card shows.

**A pool with no songs** (a repertoire not split into pools yet, like `default`): that side is drawn from the whole
repertoire, as the engine plays a round on an empty pool, and both `--check` and a generation say so:
`⚠️ card type "normal", side 2: pool 2 has no songs, so this side is drawn from the whole repertoire (77 songs)`. A song
whose `pool` no side is printed from, or a pool with 1 to 11 songs, stops the run.

**Side 1 stays as it was:** its draw keeps the seed cards had before sides, so the same repertoire and seed give the same
side 1; side 2 has its own seeds ([`src/sides.ts`](./src/sides.ts)).

## The printed design (2026)

The design is final (D250–D267), drawn first by [`tools/card-mockup`](../../tools/card-mockup/README.md); the
generator draws the same pages ([`src/generate-cards-pdf.tsx`](./src/generate-cards-pdf.tsx)). Last year's card, with
only what 2026 needs: the side's heading at 38 pt (side 2's white on a black box), the GOMET circle for the sticker,
«CARTRÓ #n» next to its QR (45 pt, never smaller), the faint logo stamp with «2026» above it, and the 3 × 4 grid of
songs, each title in capitals fitted to its cell (up to 3 lines from the layout's largest size down to 7 pt, the artist
up to 2 lines, 8 pt or more when it fits), **never hyphenated** ([`src/print/fit.ts`](./src/print/fit.ts), measured on
the real fonts with fontkit). White pages: they print in colour on last year's coloured paper (blue normal, pink
especial, D267), duplex.

**Two layouts, one switch.** The organizers choose between two options (D262, U212); `CARD_LAYOUT` in
[`src/config.ts`](./src/config.ts) picks one ([`src/print/layouts.ts`](./src/print/layouts.ts)):

| `CARD_LAYOUT` | Sheet | Card | Songs | Header |
|---|---|---|---|---|
| `'a3-6'`, option A (the default) | A3 portrait, 2 × 3 | 148.5 × 140 mm | each cover in colour above its title, titles up to 16 pt | the GOMET circle and the Barrakudes figure, the heading centred in the space between, the number and QR |
| `'a4-3'`, option B | A4 portrait, 1 × 3 | 210 × 99 mm | no covers (black and white), titles up to 16 pt | the branding («QUINA QUINA!», «BARRAKUDES · 2026»), the heading centred on the card, the GOMET circle, the number and QR |

`--layout a4-3` (or `a3-6`) on the command line proofs the other one without changing the config. Once the organizers
pick, the other layout is deleted.

**Covers (layout A):** from the repertoire's `coversDir`, `<songId>.jpg`, cut square and scaled to 300 px for print.
Each cover is embedded once in the PDF, however many cards print it (react-pdf keeps a render's embedded images by
their source, so every placement gets the same data URI string), and so is each card's QR. A missing cover is listed
by `--check` and printed as an empty box.

**Sheets and samples:** sheet p holds the type's cards p, p + sheets, p + 2 × sheets…, so each cut stack runs in number
order ([`src/print/sheets.ts`](./src/print/sheets.ts)). The amounts don't have to fill whole sheets: the empty places
(layout A: 399 normal cards on 67 sheets leaves 3) hold, in page order, copies of the type's last cards (#397, #398,
#399), each with a big faint diagonal «MOSTRA» on both sides. Samples aren't cards: they aren't in `cards.json`.

**Duplex:** each sheet prints side 1, then side 2 on the next page. On side 2 each row's cards are mirrored, so printed
double-sided and flipped on the long edge («dúplex, vora llarga») every card's back lands behind it. Faint dashed cut
lines on side 1 only (D102).

1. Once, in this folder: `npm install`. npm here doesn't run install scripts, and the PDF renderer needs the native
   `canvas` module built, so also run `npm install-scripts approve canvas` (then `npm rebuild canvas` if it says so).
2. Set this year's values in [`src/config.ts`](./src/config.ts):
   - `CARD_LAYOUT` (above), `CARD_TITLE` (card-types.json's `title`, and the branding on layout B) and `PAPER_COLOR`;
   - `CARD_TYPES`: each type's id, name, pastel colour, price in cents and `priceRule`. Prices aren't printed; the
     projector shows what a card costs before each round (the user's U5). `perRegularRound` (a normal card) multiplies
     the price by the regular rounds still to play (1.50 € a round in 2025); `fixed` (the especial card) is the price
     itself;
   - each side's `heading` and `checkLabel` in `CARD_TYPES`;
   - `CARD_AMOUNTS`: how many cards of each type (normal 1–399, especial 400–699: the first digit tells the type);
   - `EDITION`: the year tag in the QR links (`/26/123`), the same as the Game plan's `edition`;
   - `SEED` (optional): the same seed and repertoire always give the same cards.
3. Check without writing anything: `npm run build && node build/index.js --repertoire <name> --check`. It reports the repertoire's
   songs per pool, the types and the amounts, the layout (card and cell sizes, sheets, samples, the titles' sizes),
   warns about a side drawn from the whole repertoire and about missing covers, draws the cards, and fails on any
   problem (a duplicate song id, a song without a title, a blank print name, a bad pool or pools, a bad type id or
   side, a side without its heading or Check label, an amount under 1, fewer than 12 songs, **a song whose name can't
   fit its cell even at 7 pt** (shorten its `printTitle` / `printArtist`), a heading too wide for its header at 38 pt,
   a repertoire too small to draw every card without repeating a card or a line).
4. Generate: `npm start -- --repertoire <name>`. Without `--repertoire` it uses `default` (last year's 77 songs). The build copies
   `src/assets` (the Londrina fonts the PDF uses) into `build/`. It prints each PDF's sheets, pages, samples, size and
   time: with repertoire 2026's 136 songs, layout A takes about 33 s and 22 MB for the normal cards (134 pages) and 25 s
   and 17 MB for the especial cards (100 pages); layout B about 33 s and 18 MB, and 22 s and 13 MB.
5. Proof the PDFs, then commit `dist/` (the cards are public: the player app needs every card's songs).

**Choosing the playlist's size (R1-Q31):** `npm run report -- --repertoire <name> --sold 250` simulates rounds against the cards
drawn from its songs, pool by pool (each normal side against its pool), and prints how many songs it takes to the first Line, the Quina and the Desgraciat's last card (the
median and the 10th–90th percentile), then how long a round takes: the songs at the Pace (22 s a song in round 1, 14 s
after) plus the Checks. `--sizes 60,80,100` does the same for pools of those sizes, before the playlist exists, and
`--plan <file>` (Admin's plan export) adds the whole night with its Intervals and breaks. With last year's 77 songs and
250 cards sold: the first Line after about 15 songs, the Quina after about 50, and the Desgraciat's last card after
about 25.

## No repeated card or line

No two printed cards and no two printed lines are the same ([`src/uniqueness.ts`](./src/uniqueness.ts)), pool by pool: a
round plays one pool, so each new side is checked against every side and every line drawn so far from its pool, across
all the types in one run, and drawn again (the next seed) until it fits. The run fails, writing nothing, if a card can't be drawn in 200 tries (the repertoire is too small for
that many cards). The finished set is checked once more before anything is written. A card's first draw keeps the seed it
always had, so a regenerated set differs only in the cards that used to repeat a line: with last year's 77 songs, #398
(it repeated a line of #186) and #492 (a line of #158).

## Card types

[`dist/card-types.json`](./dist/card-types.json) is the formal list of printed card types, written from `CARD_TYPES` in
[`src/config.ts`](./src/config.ts): each type's id (`type`), name, short name, colour, printed title, price and sides. Every screen reads
names, colours and prices from it (served at `/cards/card-types.json`, next to `/cards/cards.json`), and each round of
the Game plan names the type it plays by its id (picked in Admin). An id is lowercase letters and digits, starting with
a letter, at most 24 long (the same rule as `isCardTypeId` in `packages/protocol/vocabulary.ts`). The generator refuses
to write anything when an id breaks that rule, a type's sides aren't numbered 1, 2… on a valid pool (each labelled when
there are several), or a card's `type` isn't in the list ([`src/card-types.ts`](./src/card-types.ts)).

## Tests

The pure parts (the sheets and samples, the duplex mirroring, the fit, the layouts' rules, the pools, the print names,
the types' checks, no repeated card or line) are tested from the show's UI suite, which CI runs:
`apps/show/tests/ui/cards-*.test.ts` and `card-types.test.ts`. `npm test` here runs just those (it needs the root
`npm install`). Those modules import only types, so Node runs them as they are.

## Development

1. Install node (I recommend using [nvm](https://github.com/nvm-sh/nvm)).
1. Run `npm install` to install the dependencies.
1. Run `npm run dev` to start the development server. (Watch mode)
