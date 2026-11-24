# Bingo cards generator for musical bingo

This project generates bingo cards for a musical bingo game. The cards are generated in PDF and JSON formats.

## Usage

> [!NOTE]
> The output files are commited, so you can get them directly from the [`dist`](./dist) folder, without running the code:
>
> - [`cards.pdf`](./dist/cards.pdf)
> - [`cards.json`](./dist/cards.json)

1. Install node (I recommend using [nvm](https://github.com/nvm-sh/nvm)).
1. Run `npm install` to install the dependencies.
1. Save the songs in [`src/data/songs.ts`](./src/data/songs.ts).
1. Set a `SEED`, if necessary, in [`src/index.ts`](./src/index.ts).
1. Run `bun ./src/index.ts` to generate the bingo cards.
1. The [`pdf`](./dist/cards.pdf) and [`json`](./dist/cards.json) files will be saved in the [`dist`](./dist) folder.

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
