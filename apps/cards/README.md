# Bingo cards generator for musical bingo

This project generates bingo cards for a musical bingo game. The cards are generated in PDF and JSON formats.

## Usage

The output files are committed in [`dist`](./dist): `cards.json`, `card-types.json` and one PDF per card type
(`cards-normal.pdf`, `cards-especial.pdf`). Until this year's playlist is final they are last year's test cards; don't
regenerate them for real before then. `card-types.json` already carries this year's provisional title and prices (D67,
D69); the committed PDFs still show last year's title, and the old cards #398 and #492, until the PDF renderer can build
(step 1).

The JSON files are written before the PDF renderer loads, so `cards.json` and `card-types.json` are written even when
the native `canvas` module is missing (the run then fails at the PDF step).

The cards are drawn from a **repertoire** (the edition's prepared songs, D178), `data/repertoires/<name>.json`: the same file the song preparation (`tools/prep`)
and the relay read. Its `songsJson` is the playlist; its `cardsJson` is where `cards.json` goes, with
`card-types.json` and the PDFs beside it (the folder the relay serves at `/cards/`).

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
   songs, the types and the amounts, draws the cards, and fails on any problem (a duplicate song id, a song without a
   title, a bad type id, an amount that isn't a multiple of 3, fewer than 12 songs, a repertoire too small to draw every card
   without repeating a card or a line).
4. Generate: `npm start -- --repertoire <name>`. Without `--repertoire` it uses `default` (last year's 77 songs). The build copies
   `src/assets` (the Londrina fonts the PDF uses) into `build/`; rendering both PDFs takes about 30 s.
5. Proof the PDFs, then commit `dist/` (the cards are public: the player app needs every card's songs).

**Choosing the playlist's size (R1-Q31):** `npm run report -- --repertoire <name> --sold 250` simulates rounds against the cards
drawn from its songs, played as one pool, and prints how many songs it takes to the first Line, the Quina and the Desgraciat's last card (the
median and the 10th–90th percentile), then how long a round takes: the songs at the Pace (22 s a song in round 1, 14 s
after) plus the Checks. `--sizes 60,80,100` does the same for pools of those sizes, before the playlist exists, and
`--plan <file>` (Admin's plan export) adds the whole night with its Intervals and breaks. With last year's 77 songs and
250 cards sold: the first Line after about 15 songs, the Quina after about 50, and the Desgraciat's last card after
about 25.

## No repeated card or line

No two printed cards and no two printed lines are the same ([`src/uniqueness.ts`](./src/uniqueness.ts)). Each new card is
checked against every card and every line drawn so far, across all the types in one run, and drawn again (the next
seed) until it fits. The run fails, writing nothing, if a card can't be drawn in 200 tries (the repertoire is too small for
that many cards). The finished set is checked once more before anything is written. A card's first draw keeps the seed it
always had, so a regenerated set differs only in the cards that used to repeat a line: with last year's 77 songs, #398
(it repeated a line of #186) and #492 (a line of #158).

## Card types

[`dist/card-types.json`](./dist/card-types.json) is the formal list of printed card types, written from `CARD_TYPES` in
[`src/config.ts`](./src/config.ts): each type's id (`type`), name, colour, printed title and price. Every screen reads
names, colours and prices from it (served at `/cards/card-types.json`, next to `/cards/cards.json`), and each round of
the Game plan names the type it plays by its id (picked in Admin). An id is lowercase letters and digits, starting with
a letter, at most 24 long (the same rule as `isCardTypeId` in `packages/protocol/vocabulary.ts`). The generator refuses
to write anything when an id breaks that rule or a card's `type` isn't in the list ([`src/card-types.ts`](./src/card-types.ts)).

## Development

1. Install node (I recommend using [nvm](https://github.com/nvm-sh/nvm)).
1. Run `npm install` to install the dependencies.
1. Run `npm run dev` to start the development server. (Watch mode)
