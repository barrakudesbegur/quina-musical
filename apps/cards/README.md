# Bingo cards generator for musical bingo

This project generates bingo cards for a musical bingo game. The cards are generated in PDF and JSON formats.

## Usage

The output files are committed in [`dist`](./dist): `cards.json`, `card-types.json` and one PDF per card type
(`cards-normal.pdf`, `cards-especial.pdf`). Until this year's playlist is final they are last year's test cards; don't
regenerate them for real before then.

The cards are drawn from a **song pool**, `data/pools/<name>.json`: the same file the song preparation (`tools/prep`)
and the relay read. Its `songsJson` is the playlist; its `cardsJson` is where `cards.json` goes, with
`card-types.json` and the PDFs beside it (the folder the relay serves at `/cards/`).

1. Once, in this folder: `npm install`. npm here doesn't run install scripts, and the PDF renderer needs the native
   `canvas` module built, so also run `npm install-scripts approve canvas` (then `npm rebuild canvas` if it says so).
2. Set this year's values in [`src/config.ts`](./src/config.ts):
   - `CARD_TITLE` (the big title) and `PAPER_COLOR`;
   - `CARD_TYPES`: each type's id, name, pastel colour and price in cents;
   - `CARD_AMOUNTS`: how many cards of each type, each a multiple of 3 (3 cards a page);
   - `EDITION`: the year tag in the QR links (`/26/123`), the same as the Game plan's `edition`;
   - `SEED` (optional): the same seed and pool always give the same cards.
3. Check without writing anything: `npm run build && node build/index.js --pool <name> --check`. It reports the pool's
   songs, the types and the amounts, and fails on any problem (a duplicate song id, a song without a title, a bad type
   id, an amount that isn't a multiple of 3, fewer than 12 songs).
4. Generate: `npm start -- --pool <name>`. Without `--pool` it uses `default` (last year's 77 songs).
5. Proof the PDFs, then commit `dist/` (the cards are public: the player app needs every card's songs).

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
