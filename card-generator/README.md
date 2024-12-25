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
1. Run `npm run build` to generate the bingo cards.
1. The [`pdf`](./dist/cards.pdf) and [`json`](./dist/cards.json) files will be saved in the [`dist`](./dist) folder.

## Development

1. Install node (I recommend using [nvm](https://github.com/nvm-sh/nvm)).
1. Run `npm install` to install the dependencies.
1. Run `npm run dev` to start the development server. (Watch mode)
