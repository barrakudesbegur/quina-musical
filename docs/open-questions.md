# Open questions for the user

Sessions add questions here instead of blocking. Use one entry per question, newest at the bottom. Say which default you went with, so the user only has to answer when they disagree. The orchestrator gathers these for the user, and moves answered questions into the decision docs.

Format:

```md
## <short title> (<session>, <date>)
<question, with the options>
**Default taken:** <what you did meanwhile, and how to reverse it>
```

---

## Commit the mixer POC's generated data? (quina-musical-ed, 2026-11-24)
The mixer POC code, analysis scripts and docs are committed locally (cff415a, c62db2a, cc690fc), and nothing is pushed. The generated `data/` folder is not committed: analysis, stems, keys, Signatures, Hold loops and the reports. It's reproducible with `npm run prep`, but slow (about 30 min with stems). Some of those files carry per-song values derived from the Spotify features file (`tempo.estimates.spotify`, the report's tables), and that file itself is kept out of the public repo.
**Default taken:** `data/` stays uncommitted. To commit it, strip the Spotify-derived fields first, or confirm they may be published. The research report and `research_notes/` in the same folder belong to the orchestrator and are left for it.

## Signature candidates need your ear (quina-musical-ed, 2026-11-24)
Ten test songs have 37 candidates: 41, 26, 47, 12, 61, 21, 73, 2, 40 and 6. Approve or reject them on the audition page (`/show/audition.html?song=41`, "Signatures" section).
**Default taken:** none are approved, so none play in a show. Tests use made-up Signatures. A live check used temporary approvals, which are now reset.

## Move to apps/ and packages/? (quina-musical-1e, 2026-11-24)
The orchestrator approved this layout as the target, but the move restructures the repo and retires last year's `client/` and `server/`, so it waits for you:
```
apps/show/      ← experiments/mixer-poc: engine, relay, analysis, show page (sound engine)
apps/stage/     projector scenes, plain TS (UI)
apps/console/   presenters' console, Svelte (UI)
apps/admin/     Admin, Svelte, behind Cloudflare Access (UI)
apps/player/    player app, Svelte, static on Cloudflare (UI)
apps/cloud/     Worker + Durable Object (Platform)
packages/protocol/  @quina/protocol (sound engine)
packages/rules/     @quina/rules: pure game rules shared by engine, cloud and phones (sound engine)
packages/ui/        @quina/ui: tokens, theme, shared Svelte pieces, Catalan words, show client (UI)
brand/, docs/, card-generator/
client/, server/   last year's app, deleted once replaced
```
**Default taken:** the UI apps live in `experiments/mixer-poc/{ui,stage,console,player,manage}`, each self-contained, so the move is mechanical whenever you say yes.

## The visual direction in the mockups (quina-musical-1e, 2026-11-24)
The "Quina Musical look" canvas shows one direction:
- Londrina Solid (the cards' font) with game outlines, over Nunito for text;
- a night-blue background with Barrakudes orange and Christmas red, green and gold;
- songs marked with a corn kernel, as on the paper cards;
- Heat as a garland of Christmas lights that changes colour and twinkle but never fills like a bar;
- ninos as colour stickers.

Link: https://claude.ai/code/artifact/c959a819-18bf-486f-9443-2ecf508c1f3f (private until you share it).
**Default taken:** tonight's screens are built almost unstyled on design tokens with these values, so your feedback becomes a theme change, not a rewrite.

## Console button words (quina-musical-1e, 2026-11-24)
On the console: Next = "Següent", Hold = "Espera", Suspense = "Suspens", Back = "Enrere", Claim = "Comprovar cartó", Resume = "Continuar", Shuffle = "Barrejar". The one most open to debate is Hold: "Espera"? "Parlem"? "Pausa" is avoided, because the music never stops.
**Default taken:** the words above. They live in `console/strings.ts`.

## A QR library for the projector and console (quina-musical-1e, 2026-11-24)
The projector shows a "scan your card" QR (before the Game and in the Interval). The console's setup screen should show a QR with its LAN address. Both need a small QR encoder, for example `qrcode` (MIT, no dependencies). Adding it touches the mixer POC's `package.json` (sound engine's file).
**Default taken:** a placeholder box with the address in big text.

## Card text size on phones (quina-musical-1e, 2026-11-24)
The player app draws each card as the 3×4 grid of the printed card, with a cover and 2 lines of title per song. On a phone that makes titles about 12–13 px, which is small for the grandmother test.
**Default taken:** the grid stays (cover first, title under it, the 1-song-away banner names the song in large type). Possible change: a "Lletra gran" switch that shows each card as a list.

## This year's printed card (quina-musical-1e, 2026-11-24)
The QR now points to `quina.barrakudesbegur.org/26/<card>`. The card's title and paper colour are configurable in `card-generator/src/config.ts`.
**Default taken:** last year's title ("QUINA QUINA!") and colour until you choose. No cards are generated until the playlist is final.

## Sponsor logos before the cloud exists (quina-musical-1e, 2026-11-24)
Admin cleans up each logo in the browser (removes the white background, trims it, makes a WebP).
**Default taken:** until the Platform session's R2 storage exists, the cleaned logo is kept inside the Game plan as a data URL. It's exported with the JSON and kept in the browser's storage.
