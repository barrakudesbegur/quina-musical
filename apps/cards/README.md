# Bingo cards generator for musical bingo

This project generates bingo cards for a musical bingo game. The cards are generated in PDF and JSON formats.

## Usage

A run writes `cards.json`, `card-types.json` and one PDF per card type (`cards-normal.pdf`, `cards-especial.pdf`) into
the folder of its repertoire's `cardsJson` (below), or into `--out <dir>`. **2026's real cards go to
`data/media/2026/cards/`** (gitignored, like all media: the A3 test sheets carry the album covers, never in the public repo), made on
4–5 Dec ([the checklist](#the-cards-for-the-night-45-dec-2026)). Until then repertoire 2026's `cardsJson` points at
the temporary ones, `data/media/2026/cards-TEMPORARY-not-for-print/`, which the relay and the cloud serve.

[`dist`](./dist) is **last year's test cards**, not output: the `default` repertoire's `cardsJson` is
`apps/cards/dist/cards.json`, and the show's tests, the UI fixtures and the e2e read `dist/cards.json` and
`dist/card-types.json` directly. So it stays committed as it is (its PDFs are last year's one-sided cards, with #398
and #492 as they were; `card-types.json` was rewritten from `CARD_TYPES` on 28 Nov). Never run the generator on the
`default` repertoire without `--out`: it would overwrite them.

The JSON files are written before the PDF renderer loads, so `cards.json` and `card-types.json` are written even when
the native `canvas` module is missing (the run then fails at the PDF step).

The cards are drawn from a **repertoire** (the edition's prepared songs, D178), `data/repertoires/<name>.json`: the same file the song preparation (`tools/prep`)
and the relay read. Its `songsJson` is the playlist; its `cardsJson` is where `cards.json` goes, with
`card-types.json` and the PDFs beside it (the folder the relay serves at `/cards/`, and the cloud's deploy and media sync
copy).

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

- `checkLabel` is the side's name on every screen (the Check above all), as printed (U198 answered (a), D266):
  «Normal 1–5», «Normal 6–10», «Desgraciat», «Especial». Every printed side has one, and the screens read no
  `card-types.json` without it (`packages/ui/data/card-types.ts`).
- `heading` is the big word at the top of the printed side: «QUINES 1–5», «QUINES 6–10», «DESGRACIAT», «ESPECIAL».
- `label` is the older label the screens used to join after `shortName`; no screen reads it any more (the engine's
  and the protocol's readers still carry it).

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

The design is final (D250–D267, D295), drawn first by [`tools/card-mockup`](../../tools/card-mockup/README.md); the
generator draws the same pages ([`src/generate-cards-pdf.tsx`](./src/generate-cards-pdf.tsx)), and apps/cards is now the
source of truth. Last year's card, with only what 2026 needs: the side's heading at 38 pt (side 2's white on a black
box), the GOMET circle for the sticker, «CARTRÓ #n» next to its QR (45 pt, never smaller), the faint logo stamp with
«2026» above it, and the 3 × 4 grid of songs, each title in capitals fitted to its cell (up to 3 lines from the
layout's largest size down to 7 pt, the artist up to 2 lines, 8 pt or more when it fits), **never hyphenated**
([`src/print/fit.ts`](./src/print/fit.ts), measured on the real fonts with fontkit). White pages: they print on last
year's coloured paper (blue normal, pink especial, D267), duplex.

**Two layouts.** The organizers picked «Apaïsat sense portades» (D295, U212). `CARD_LAYOUT` in
[`src/config.ts`](./src/config.ts) is the default ([`src/print/layouts.ts`](./src/print/layouts.ts)); the other stays,
whole, for the user's A3 test sheets (below):

| Layout | Sheet | Card | Songs | Header |
|---|---|---|---|---|
| `'a4-3'`, **the 2026 card** (`CARD_LAYOUT`; the mockups' `3x1-h-bw`, «Apaïsat sense portades») | A4 portrait, 1 × 3 | 210 × 99 mm | no covers, black and white, titles up to last year's 16 pt | the branding («QUINA QUINA!», «BARRAKUDES · 2026»), the heading centred on the card, the GOMET circle, the number and QR |
| `'a3-6'`, the A3 test sheets («Quadrat amb portades», D256, D259) | A3 portrait, 2 × 3 | 148.5 × 140 mm | each cover in colour above its title, titles up to 16 pt | header C: the GOMET circle and the Barrakudes figure, the heading centred in the space between, the number and QR |

`--layout a3-6` on the command line prints a whole run in the other layout without changing the config.

**Covers (the A3 layout):** from the repertoire's `coversDir`, `<songId>.jpg`, cut square and scaled to 300 px for
print. Each cover is embedded once in the PDF, however many cards print it (react-pdf keeps a render's embedded images
by their source, so every placement gets the same data URI string), and so is each card's QR. A missing cover is listed
by `--check` and printed as an empty box. Song #100's cover («La Revolución Sexual») is nearly white: it's on the A3 test
sheets (on 28 Nov: #394 and #398, #694 and #697, side 2), so the proof shows it.

**Sheets and samples:** sheet p holds the type's cards p, p + sheets, p + 2 × sheets…, so each cut stack runs in number
order ([`src/print/sheets.ts`](./src/print/sheets.ts)). On A4 both amounts fill whole sheets: 133 normal + 100 especial
= 233 sheets, both sides (D295). An amount that doesn't fill its last sheets (a whole A3 run: 399 normal cards on 67
sheets leaves 3) fills the empty places, in page order, with copies of the type's last cards (#397, #398, #399), each
with a big faint diagonal «MOSTRA» on both sides (D264). Samples aren't cards: they aren't in `cards.json`.

**Duplex:** each sheet prints side 1, then side 2 on the next page. On side 2 each row's cards are mirrored (on A4, one
card a row, nothing moves), so printed double-sided and flipped on the long edge («dúplex, vora llarga») every card's
back lands behind it. Faint dashed cut lines on side 1 only (D102). Everything is at least 5 mm inside each card's cut
edges except the faint logo stamp, whose rotated corner comes to about 4.4 mm of the right edge (last year's place,
D263).

**The A3 test sheets (D295, D306):** `--test-sheets` also writes `cards-<type>-test-a3.pdf`, one or two A3 sheets of the
square card with covers for the user's test with real players on the night. They repeat each type's **last** cards: the
very cards of the run (the same numbers, songs and QR), so the A4 cards with those numbers stay off sale with the user,
who hands a known buyer of two cards one or the other and tracks who holds them. `TEST_SHEETS` in
[`src/config.ts`](./src/config.ts) says how many sheets per type: one each, since each type prints on its own paper
colour (normal #394–399, especial #694–699). The run prints which numbers they hold.

**The proof (D267):** `--proof` writes only `proof-<type>.pdf` (no JSON, no full PDFs): the type's first A4 sheet (#1,
#134, #267; #400, #500, #600) and its A3 test sheet, both sides, four pages. One file per type, because each type goes on
its own paper colour. At the print shop, before the real run: print each duplex, long edge, at 100 %, and check
- the duplex alignment on their machine: held up to the light, each back's grid falls on its front's, and nothing is
  cut off (every element 5 mm inside the cut edges);
- a QR scanned from paper (a phone opens `quina.barrakudesbegur.org/26/1` and shows card #1);
- the colour: black on the blue and pink paper (the GOMET word and the artists are grey, the stamp 9 % ink), and the
  A3 covers in colour, #100's nearly white one above all;
- the cut: 21 × 9.9 cm on A4, 14.85 × 14 cm on A3.
`--out <dir>` writes into another folder (relative to where the command runs): the proof goes to the repo's `temp/`
(`npm start -- --repertoire 2026 --proof --out ../../temp/cards-proof-2026`), never into the folder the screens read.

## Making the cards

1. Once, in this folder: `npm install`. npm here doesn't run install scripts, and the PDF renderer needs the native
   `canvas` module built, so also run `npm install-scripts approve canvas` (then `npm rebuild canvas` if it says so).
2. Set this year's values in [`src/config.ts`](./src/config.ts):
   - `CARD_LAYOUT` (above), `CARD_TITLE` (card-types.json's `title`, and the branding on the A4 card) and `PAPER_COLOR`;
   - `CARD_TYPES`: each type's id, name, pastel colour, price in cents and `priceRule`. Prices aren't printed; the
     projector shows what a card costs before each round (the user's U5). `perRegularRound` (a normal card) multiplies
     the price by the regular rounds still to play (1.50 € a round in 2025); `fixed` (the especial card) is the price
     itself;
   - each side's `heading` and `checkLabel` in `CARD_TYPES`;
   - `CARD_AMOUNTS`: how many cards of each type (normal 1–399, especial 400–699: the first digit tells the type);
   - `TEST_SHEETS`: how many A3 test sheets per type (one each), in `TEST_SHEET_LAYOUT`;
   - `EDITION`: the year tag in the QR links (`/26/123`), the same as the Game plan's `edition`;
   - `SEED` (optional): the same seed and repertoire always give the same cards.
3. Check without writing anything: `npm run build && node build/index.js --repertoire <name> --check`. It reports the repertoire's
   songs per pool, the types and the amounts, the layout (card and cell sizes, sheets, samples, the titles' sizes),
   warns about a side drawn from the whole repertoire and about missing covers, draws the cards, and fails on any
   problem (a duplicate song id, a song without a title, a blank print name, a bad pool or pools, a bad type id or
   side, a side without its heading or Check label, an amount under 1, fewer than 12 songs, **a song whose name can't
   fit its cell even at 7 pt** (shorten its `printTitle` / `printArtist`), a heading too wide for its header at 38 pt,
   a repertoire too small to draw every card without repeating a card or a line).
4. Generate: `npm start -- --repertoire <name>` (`--test-sheets` for the A3 test sheets, `--proof` for the proof,
   `--out <dir>` to write elsewhere). Without `--repertoire` it uses `default` (last year's 77 songs, written into
   `dist/`: don't). The build copies `src/assets` (the Londrina fonts the PDF uses) into `build/`. It prints each PDF's
   sheets, pages, samples, size and time: with repertoire 2026's 135 songs (28 Nov), the A4 layout takes about 37 s and
   18 MB for the normal cards (266 pages) and 25 s and 13 MB for the especial cards (200 pages); each A3 test sheet about
   1 s and 2.5 MB; the proof about 10 s a type. A whole A3 run (27 Nov, 136 songs) took about 33 s and 22 MB, and 25 s
   and 17 MB.
5. Proof the PDFs (render a few pages, scan a few QRs), then print a proof at the shop (above) before the real run.

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

`card-types.json`, next to `cards.json`, is the formal list of printed card types, written from `CARD_TYPES` in
[`src/config.ts`](./src/config.ts): each type's id (`type`), name, short name, colour, printed title, price and sides. Every screen reads
names, colours and prices from it (served at `/cards/card-types.json`, next to `/cards/cards.json`), and each round of
the Game plan names the type it plays by its id (picked in Admin). An id is lowercase letters and digits, starting with
a letter, at most 24 long (the same rule as `isCardTypeId` in `packages/protocol/vocabulary.ts`). The generator refuses
to write anything when an id breaks that rule, a type's sides aren't numbered 1, 2… on a valid pool (each labelled when
there are several), or a card's `type` isn't in the list ([`src/card-types.ts`](./src/card-types.ts)).

## The cards for the night (4–5 Dec 2026)

After the user's check of the four flagged songs (U238; a swap means a download, prep and an R2 push first). Commands
from the repo's root unless they say otherwise; the uploads are the same as for the temporary cards (apps/cloud's
deploy-plan.md, 27–28 Nov).

1. **Check:** `cd apps/cards && npm run build && node build/index.js --repertoire 2026 --check --test-sheets`.
2. **Generate into the new folder,** with the test sheets:
   `npm start -- --repertoire 2026 --test-sheets --out ../../data/media/2026/cards` (in apps/cards). It writes
   `cards.json`, `card-types.json`, `cards-normal.pdf`, `cards-especial.pdf`, `cards-normal-test-a3.pdf` and
   `cards-especial-test-a3.pdf`, and says which numbers the test sheets hold (#394–399, #694–699). With the same
   songs and seed, `cards.json` is byte-identical to the temporary one (checked 28 Nov), so phones that already added a
   card keep its songs.
3. **Look at them:** render a few pages of each PDF, scan a few QRs, and compare with the proof the shop printed.
4. **Switch the repertoire:** `data/repertoires/2026.json`'s `cardsJson` becomes `data/media/2026/cards/cards.json`
   (tracked, Sound engine's file), and its `description` drops "temporary". Commit it.
5. **Check the plan against the new card types:** `npm run edition -- check data/editions/2026.plan.json --repertoire 2026`.
6. **The cloud** (the QR domain quina.barrakudesbegur.org and quina-dev serve `/cards/cards.json` and
   `card-types.json` from the deploy's static files): `cd apps/cloud && QUINA_REPERTOIRE=2026 npm run deploy`, on a sha
   whose e2e is green, then check both names serve them byte-identical to `data/media/2026/cards/`.
7. **R2** (the laptops' media sync carries the cards folder's `cards.json` and `card-types.json`):
   `cd apps/cloud && npm run media -- push --repertoire 2026 --dry-run`, then without `--dry-run`; then
   `npm run media -- prune` (a dry run) and, only if it lists blobs no manifest names, `npm run media -- prune --yes`.
   The other laptop: `npm run media -- pull --repertoire 2026`.
8. **Print:** the shop gets `cards-normal.pdf` on blue A4 and `cards-especial.pdf` on pink A4, duplex, long edge, at
   100 % (D88), and the two A3 test sheets. The A4 cards #394–399 and #694–699 stay off sale, with the user (D306).
9. The temporary folder stays until nothing serves it any more; then it can go.

## Tests

The pure parts (the sheets and samples, the duplex mirroring, the fit, the layouts' rules, the pools, the print names,
the types' checks, no repeated card or line) are tested from the show's UI suite, which CI runs:
`apps/show/tests/ui/cards-*.test.ts` and `card-types.test.ts`. `npm test` here runs just those (it needs the root
`npm install`). Those modules import only types, so Node runs them as they are.

## Development

1. Install node (I recommend using [nvm](https://github.com/nvm-sh/nvm)).
1. Run `npm install` to install the dependencies.
1. Run `npm run dev` to start the development server. (Watch mode)
