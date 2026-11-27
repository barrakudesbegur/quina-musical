# Bingo cards generator for musical bingo

This project generates bingo cards for a musical bingo game. The cards are generated in PDF and JSON formats.

## Usage

The output files are committed in [`dist`](./dist): `cards.json`, `card-types.json` and one PDF per card type
(`cards-normal.pdf`, `cards-especial.pdf`). Until this year's playlist is final they are last year's test cards; don't
regenerate them for real before then. `card-types.json` already carries this year's provisional title, prices and
sides (D67, D69, D171, D226), and `cards.json` every card's two sides, the especial card's too (side 1 as before, side
2 from the whole repertoire, since its pool 2 is empty); the committed PDFs still show last year's one-sided cards,
title and old cards #398 and #492.

The JSON files are written before the PDF renderer loads, so `cards.json` and `card-types.json` are written even when
the native `canvas` module is missing (the run then fails at the PDF step).

The cards are drawn from a **repertoire** (the edition's prepared songs, D178), `data/repertoires/<name>.json`: the same file the song preparation (`tools/prep`)
and the relay read. Its `songsJson` is the playlist; its `cardsJson` is where `cards.json` goes, with
`card-types.json` and the PDFs beside it (the folder the relay serves at `/cards/`).

## Sides and pools

A card has **sides** (D101, D102, D178), each printed from one **pool** of the repertoire: a song's `pool` in
songs.json (`"1"`, `"2"`; a song without one is in pool `"1"`). `CARD_TYPES` in [`src/config.ts`](./src/config.ts)
says which pool each side of a type is printed from (D171, provisional):

- the normal card: side 1 plays Quines 1–5, from pool 1 (`label: "1–5"`); side 2 plays Quines 6–10, from pool 2
  (`label: "6–10"`, D193). The same number and QR on both;
- the especial card (D226): side 1 plays the Quina Desgraciada, from pool 1 (`label: "Desgraciada"`); side 2 plays the
  Quina Especial, from pool 2 (`label: "Quina Especial"`). It's one card for both rounds (D81), under the same number
  and QR; the pool changes in the Break.

`cards.json` holds each card as `{ id, type, sides: [{ side, lines: [[{ id, title, artist } × 4] × 3] }] }`, and
`card-types.json` each type's `sides: [{ side, pool, label? }]` and its `shortName` ("Normal"): the Check shows the
type and side in one label (D163): a range label joins with a space, "Normal 1–5", "Normal 6–10"; a round's name with
« · », "Especial · Desgraciada", "Especial · Quina Especial" (U198's option (a) until the user picks). Readers take a
card from before sides (`lines` and no `sides`) as its side 1.

**A pool with no songs** (a repertoire not split into pools yet, like `default`): that side is drawn from the whole
repertoire, as the engine plays a round on an empty pool, and both `--check` and a generation say so:
`⚠️ card type "normal", side 2: pool 2 has no songs, so this side is drawn from the whole repertoire (77 songs)`. A song
whose `pool` no side is printed from, or a pool with 1 to 11 songs, stops the run.

**Side 1 stays as it was:** its draw keeps the seed cards had before sides, so the same repertoire and seed give the same
side 1; side 2 has its own seeds ([`src/sides.ts`](./src/sides.ts)).

**The PDF:** each sheet prints side 1, then side 2 on the next page (both card types) with the same cards in the same places (printed
double-sided, long-edge flip, each card's side 2 lands behind it). Side 2's design isn't decided (the user designs it
with Frontend, D102): until then it prints in side 1's layout, stamped «CARA 2 PROVISIONAL · NO IMPRIMIR» across every
card.

1. Once, in this folder: `npm install`. npm here doesn't run install scripts, and the PDF renderer needs the native
   `canvas` module built, so also run `npm install-scripts approve canvas` (then `npm rebuild canvas` if it says so).
2. Set this year's values in [`src/config.ts`](./src/config.ts):
   - `CARD_TITLE` (the big title) and `PAPER_COLOR`;
   - `CARD_TYPES`: each type's id, name, pastel colour, price in cents and `priceRule`. Prices aren't printed; the
     projector shows what a card costs before each round (the user's U5). `perRegularRound` (a normal card) multiplies
     the price by the regular rounds still to play (1.50 € a round in 2025); `fixed` (the especial card) is the price
     itself;
   - `CARD_AMOUNTS`: how many cards of each type, each a multiple of 3 (3 cards a page);
   - `EDITION`: the year tag in the QR links (`/26/123`), the same as the Game plan's `edition`;
   - `SEED` (optional): the same seed and repertoire always give the same cards.
3. Check without writing anything: `npm run build && node build/index.js --repertoire <name> --check`. It reports the repertoire's
   songs per pool, the types and the amounts, warns about a side drawn from the whole repertoire, draws the cards, and
   fails on any problem (a duplicate song id, a song without a title, a bad pool, a bad type id or side, an amount that
   isn't a multiple of 3, fewer than 12 songs, a repertoire too small to draw every card without repeating a card or a
   line).
4. Generate: `npm start -- --repertoire <name>`. Without `--repertoire` it uses `default` (last year's 77 songs). The build copies
   `src/assets` (the Londrina fonts the PDF uses) into `build/`; rendering both PDFs takes about 30 s.
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

## Development

1. Install node (I recommend using [nvm](https://github.com/nvm-sh/nvm)).
1. Run `npm install` to install the dependencies.
1. Run `npm run dev` to start the development server. (Watch mode)
