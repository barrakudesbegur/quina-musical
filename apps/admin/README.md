# apps/admin: Admin

The organizers' setup and fixes page (GLOSSARY: **Admin**). Svelte 5 on the shared foundation in `packages/ui/` (see `packages/ui/README.md`). It connects as relay role `admin`.

Open it at `/admin/` on the relay (`npm run dev` in `apps/show`). Any `?demo=<fixture>` from `packages/ui/fixtures/states.ts` replays a fixture instead of the relay, for example `/admin/?demo=celebration#nit`. In demo mode nothing is saved.

## Views

One view per URL hash:

| Hash | View | What it does |
|---|---|---|
| `#preparacio` | Setup | The edition's name and year, when prizes are revealed, the printed card types (read-only, from card-types.json), cards in play (sent with `setCardsInPlay`), rounds with their card type and prize bundles (add, remove, move, "Destacat"), sponsors and logos, the schedule, and the cheat-sheet rules |
| `#json` | Import and export | Bulk import of a whole plan (paste or file) with every error and a diff, then "Substituir". Export as a download or a copy |
| `#nit` | On the night | Show status, start (`roundIntro`) and end (`endGame`) the Game, the Winners' names and notes (`winnerInfo`), plus stubs for Plan B resume, cards open on phones and player-app settings |
| `#eines` | Tools | The hook audition page, a full JSON export (the plan plus the night's data), and Shuffle seeds (stub) |
| `#xuleta` | Cheat sheet | Printable on one A4 page ("Imprimir") |

## Layout

```
apps/admin/
  index.html, main.ts   entry: show client, plan session, command tracker → App.svelte
  App.svelte            header, tabs, one view per hash
  components/           one component per section; markup and looks only
  state/                reactive glue (.svelte.ts): PlanSession (draft, check, autosave, other tabs), CommandTracker
  logic/                pure, tested in apps/show/tests/ui/admin/: cards preview, plan checks and diff, plan edits,
                        logo pixel pipeline, cheat-sheet model, command log, Winners, exports, routes
  data/                 I/O: plan store adapter (logos, failures), logo canvas glue, files, local settings
  config.ts             every tunable (autosave delay, logo limits, storage keys)
  strings.ts            every word on screen (Catalan); shared terms come from ui/i18n/ca.ts
  manage.css, print.css layout on tokens; print theme for the cheat sheet
```

## How the plan is saved

- **Autosave, valid plans only.** A plan is saved through the `PlanStore` (`packages/ui/data/plan-store.ts`, localStorage today, a cloud store later) 0.6 s after the last edit, but only when it passes the check. Otherwise Admin lists every error with its path and keeps the draft in memory. Leaving the page with unsaved edits asks first.
- **Logos.** A cleaned logo is a WebP data URL in `Sponsor.logo`. The shared validator only accepts logo paths of up to 500 characters, and a plan it refuses would read as "no plan" on every other screen. So Admin stores data-URL logos beside the plan (key `quina.manage.logos.v1`, by sponsor id), stores the plan with `logo: null` for them, and puts them back on load. Export and import carry them inline. When the Platform session moves logos to R2, `logo` becomes a short URL and this goes away by itself: a plan the shared validator accepts is always stored whole.
- **Another tab** saved a different plan: if this page has no unsaved edits, it loads it. Otherwise it asks which one wins.

## Defined failures

| What | What Admin does |
|---|---|
| Invalid JSON in the import | "No és JSON vàlid" with the parser's position. Nothing changes |
| A plan that fails the check | Every error with its JSON path (import or editing). Nothing is saved; the draft is kept |
| Browser storage full (big logos) | "Emmagatzematge ple". The plan without the new logos is still saved, and the draft is kept. Logos over 200 KB are refused before that |
| Browser refuses storage (private mode) | Says so permanently, and asks before the page is closed. Export still works |
| Relay disconnected | The status bar says so, and every command button is disabled. Setup keeps working |
| Show page not open | Same: the relay would drop the command, so it is not sent |
| A rejected command | The engine's reason, in Catalan, next to the button. A Winner's name stays in its field until the engine has it |
| Clipboard refused (the LAN console has no secure context) | The JSON is shown in a box to copy by hand |

## The plan's JSON (for an AI agent)

Loading the organizers' sponsor sheet (column by column, what goes into the plan and what never does): [`docs/sponsor-sheet.md`](docs/sponsor-sheet.md).

The import and the export use the `GamePlan` shape from `packages/ui/plan.ts`, checked by `checkGamePlan`. To fill it from the organizers' Google Sheet, produce exactly this:

```json
{
  "v": 3,
  "edition": "26",
  "title": "Quina Quina 3",
  "prizeReveal": "perRound",
  "rounds": [
    {
      "number": 1,
      "kind": "normal",
      "cardType": "normal",
      "line": [
        { "title": "Coca de recapte", "detail": null, "sponsorId": "forn-del-poble", "image": null, "headline": true },
        { "title": "Samarreta", "detail": null, "sponsorId": "barrakudes", "image": null, "headline": false }
      ],
      "bingo": [
        { "title": "Sopar per a dos", "detail": "Qualsevol divendres de gener", "sponsorId": "restaurant-de-la-placa", "image": null, "headline": true },
        { "title": "Lot de productes", "detail": null, "sponsorId": "forn-del-poble", "image": null, "headline": false }
      ]
    },
    {
      "number": 2,
      "kind": "desgraciat",
      "cardType": "normal",
      "line": [],
      "bingo": [{ "title": "Panera de Nadal", "detail": null, "sponsorId": "barrakudes", "image": null, "headline": true }]
    },
    {
      "number": 3,
      "kind": "special",
      "cardType": "especial",
      "line": [],
      "bingo": [{ "title": "Pernil", "detail": null, "sponsorId": "barrakudes", "image": null, "headline": true }]
    }
  ],
  "sponsors": [
    { "id": "forn-del-poble", "name": "Forn del poble", "logo": null },
    { "id": "restaurant-de-la-placa", "name": "Restaurant de la plaça", "logo": null },
    { "id": "barrakudes", "name": "Barrakudes", "logo": null }
  ],
  "schedule": { "startAtMs": 1798306200000, "roundMinutes": 25, "intervalMinutes": 3 },
  "cheatSheet": {
    "claimRules": [
      "Guanya el primer que canta. Si dos canten amb la mateixa cançó, es reparteixen el premi.",
      "Si algú canta tard i ningú més ha cantat, guanya igualment.",
      "Un premi que ningú canta es perd."
    ],
    "specialRoundRules": ["Només compten els cartrons especials."]
  }
}
```

Rules (every key is required, and an unknown key is an error, so a typo can't silently drop a prize):
- `v`: always `3`. Version 1 and 2 plans are still read: a version 1 plan's single prize per Line and Quina becomes a bundle of one headline prize, and a version 2 plan's `cardTypes` only picks each round's `cardType`, then is dropped.
- `edition`: the two-digit year as a string (`"26"`). It must match the cards' QR links (`apps/cards/src/config.ts`).
- `title`: the edition's name, on every screen (`"Quina Quina 3"`).
- `prizeReveal`: `"perRound"` (phones see round 1's prizes from the start and each round's as it is introduced) or `"allSecret"` (phones see none until the presenters reveal a round from the console).
- `rounds`: 1 to 20 rounds in play order, numbered `1, 2, 3…` with no gaps.
  - `kind`: `"normal"`, `"special"` (the Quina Especial) or `"desgraciat"` (the Quina Desgraciada: the last card standing wins). At most one round is special and at most one is Desgraciat. A Desgraciat round has no Line: its `line` must be `[]`, and its `bingo` bundle is the last-standing prize.
  - `cardType`: the printed card type the round plays, an id from `apps/cards/dist/card-types.json` (`"normal"`, `"especial"`…): only cards of that type count in it. A round that leaves it out plays its kind's default (normal cards in normal and Desgraciat rounds, especial cards in the special round). Admin picks it per round and warns when the id isn't in card-types.json.
- `line` and `bingo` (the Quina's prizes): the bundle, a list of up to 40 prizes in the order screens show them, `[]` while there are none. Headline prizes (usually one or two) come first.
  - `title`: what is won, as presenters read it out (1–200 characters).
  - `detail`: extra text, or `null`.
  - `sponsorId`: the `id` of a sponsor in `sponsors`, or `null`.
  - `image`: a picture path, or `null` (screens show it for headline prizes).
  - `headline`: `true` for the prizes shown first and bigger.
- `sponsors`: up to 200.
  - `id`: lowercase letters, digits and dashes (`forn-del-poble`), unique. Prizes refer to sponsors by this id.
  - `name`: as shown on screen.
  - `logo`: `null`. Logos are added and cleaned up in Admin. Admin's own export also accepts a PNG data URL of up to 200 KB.
- `schedule`:
  - `doorsAtMs` (optional): when the doors open and the cards go on sale, in epoch milliseconds, never after `startAtMs`. The phones' Horari starts with it ("Venda de cartrons"). Leave it out when not known.
  - `startAtMs`: when the first round starts, in epoch milliseconds (the example is 26 Dec 2026, 18:30 in Begur), or `null`.
  - `roundMinutes`: 1–240.
  - `intervalMinutes`: 0–120.
  - `throws` (optional): the planned Throws, `[{ "afterRound": 3, "minutes": 5 }]`, each after a round that isn't the last, once per round, 1–60 minutes on top of that break. Leave it out when there are none.
- `cheatSheet`: `claimRules` and `specialRoundRules`, each a list of up to 30 non-empty sentences in Catalan.

Text is trimmed. Errors come back as `path: message` lines, for example `plan.rounds[2].line[0].sponsorId: no sponsor with id "forn"`. An agent can fix them all and paste again.

**Full export** (`#eines`): `{ "kind": "quina.fullExport", "v": 1, "private": true, "exportedAtMs", "plan", "game": { "cardsInPlay", "cardsInPlayCount", "winners" } | null }`. It holds the Winners' names. Those are PRIVATE: they never go to git, the projector or the phones.

## Stubs and why

- **Plan B manual resume:** a disabled form. There is no command to resume at a given round and song yet; it needs the engine's and the Platform's restore path.
- **Cards opened on phones:** needs the Platform session's public feed.
- **Player-app settings** (default interface sounds, a banner for every phone): kept on this device only, until the feed can carry them.
- **Shuffle seeds:** the journal's `round.started` keeps them, but Admin has no way to read the journal yet.
- **Logos in R2:** the Platform session will store logos as files. Until then they are data URLs, as above.

## Checks

```sh
npx tsc -p tsconfig.ui.json
npx svelte-check --tsconfig ./tsconfig.ui.json --threshold error
node --test "tests/ui/**/*.test.ts"
```
