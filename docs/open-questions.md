# Waiting on the user

The only list of what waits on the user: decisions with the default in force meanwhile, and tasks only the user can do. Requirements, handoffs and the timeline refer to these by ID (U1, U2…).

- **Adding one:** sessions send it to the orchestrator, who adds it here with the next free ID. Sessions never edit this file directly: several share one checkout. Say which default you took, so the user only answers when they disagree.
- **Answering one:** the orchestrator records the answer in [decision-log.md](decision-log.md), updates the requirements, and moves the entry to "Answered" with its decision ID. IDs are never reused.
- Dates are in [timeline.md](timeline.md); the night is Sunday 27 December 2026.

## Decisions

### U1 · How to download this year's songs · needed before 2 Dec
YouTube answers every download with "Sign in to confirm you're not a bot". The cookie-free methods failed: another spotDL provider, a newer yt-dlp, other player clients (only 124 kbps audio). The options:
- (a) let Sound engine install the PO-token plugin `bgutil-ytdlp-pot-provider` in the playlist fetcher's venv and run its local server (already built in `data/cache/tools/bgutil-pot`). Its permission check needs the user's OK, given in that session;
- (b) download it yourself with an exported cookies file: `! cd tools/prep/playlist-fetcher && venv/bin/spotdl download <playlist URL> --cookie-file <cookies.txt> --output "output/songs/{list-position} {title} - {artist}.{output-ext}" --format opus --bitrate disable` (keeps YouTube's own audio);
- (c) another source.

The user's only condition is correct quality. Prep's quality step flags songs under about 128 kbps, with a low-pass under 15 kHz, more than 5 s off Spotify's length, or of a wrong version.
**Default:** nothing downloaded yet.

### U2 · The printed card's title and paper colour · by 30 Nov
Configurable in `apps/cards/src/config.ts`. The QR points to `quina.barrakudesbegur.org/26/<card>`.
**Default:** last year's title ("QUINA QUINA!") and colour.

### U3 · Card types and amounts to print · by 30 Nov
Normal and especial, as last year? How many of each (2024: 250 of each printed; 2025: 399 normal, 300 special)?
**Default:** normal and especial, amounts as in 2025.

### U4 · When cards are handed out, and the print lead time · soon
The printing deadline and the QR domain switch (U15) depend on it.
**Default:** sold from about 12 Dec; printed in about a week from 3 Dec.

### U7 · Two Desgraciat board points
On the canvas under "Quina Desgraciada · proposta per revisar":
- (a) Should the projector show how many cards still stand ("Queden 12 dempeus")? **Default:** no, console only, since the count includes unsold cards.
- (b) A fallen card shows the sitting nino, or the squashed nino of a failed Check? **Default:** the sitting nino.

### U8 · The prizes corner icon
Canvas board "Component · icona de premis", options A–E.

### U9 · The effect when the landed song is on your card
Canvas board "App · quan la cançó és teva", options A–D.

### U10 · The player app's layout
The 3 tabs (Ara · Premis · Horari, plus the menu) are built. The proposal: one "now" home screen, two corner buttons opening stacked drawers (Premis, Horari), plus drawers for add-card, the menu and last year's card. You also commented that "Ara" could be called "songs". Built so that switching is only a container swap.
**Default:** the 3 tabs.

### U11 · The phones' card-stacking scroll
Cards stack as you scroll (your canvas idea, "I will need to confirm this"). Specced as `card-stack` in ANIMATIONS.md, not built.
**Default:** not built.

### U12 · The theme pass
Pending your go on the visual theme pass across the screens.

### U13 · Listening pass on the new sound
Not heard yet: phrase landings, the lighter early palette and rare impacts, Signatures before the landing, the new Suspense, Aguanta's loop, vocal entries, Count-in. Two defaults to confirm while listening:
- **Suspense release:** it lands on the outgoing song's phrase boundary, up to about 9 s after the release. The alternative is a 2-bar boundary, about twice as fast. **Default:** the phrase.
- **Signatures are rarer:** about 5% of transitions (38 of last year's 77 songs get one). Options: keep it; lower the automatic pick's score (0.6); pick more by hand. **Default:** keep, and pick by hand while reviewing this year's songs.

### U20 · More Hold music and victory tracks (optional)
Only 3 Hold loops and 1 victory track exist, so they repeat a lot (`data/media/hold`, `data/media/celebration`).

### U21 · Card text size on phones
Each card is the printed 3×4 grid, so titles are about 12–13 px: small for the grandmother test.
**Default:** the grid stays. Possible addition: a "Lletra gran" switch showing a card as a list.

### U22 · The printed cards are public
`cards.json` (every card's songs) is public, because phones need it. Someone determined could work out live which card numbers are close to winning; card numbers are anonymous and the next song stays secret. The alternative, a secret per card in the QR, makes adding a card by number much harder.
**Default:** public (the orchestrator agrees).

## Tasks only the user can do

### U14 · Approve this year's hooks · from 2 Dec, done by 10 Dec
On the audition page: about 2 minutes a song, about 3 hours for 86. A song can't play until its hook is approved. Start early on draft songs once they're prepared.

### U15 · OK to point quina.barrakudesbegur.org at the new app · by 11 Dec
The printed QR codes use it. Planned with an undo in `apps/cloud/docs/deploy-plan.md` (step 7).

### U16 · Upload the logo library in Admin
It needs your Google login: Admin → "Pujar logos a la biblioteca" with the cleaned logos in `temp/logos-clean/`, then "Triar de la biblioteca" per sponsor. Two logos are small sources; ask those sponsors for bigger ones.

### U17 · Approve the install script for printing cards to PDF
Run it yourself: `! cd apps/cards && npm install-scripts approve canvas`

### U18 · The night's plan in Admin · by 13 Dec
Rounds in order, a card type per round, prize bundles, sponsors (money donors too), the Schedule with throw breaks.

### U19 · Checks on real devices · before the rehearsals
1. An iPhone with Safari and an Android phone with Chrome: scan a test QR, add a second card by number, lock and unlock (it reconnects, and the screen stays awake), sounds after the first tap.
2. An older phone: smooth scrolling with 3–4 cards, usable at the end of a round.
3. Last year's offline cache: after U15, open the old site on a phone that used it last year, then the new one.
4. The projector at 4:3, then 16:9: the drum, the last-3 row and the Check readable from the back.
5. The console on the actual tablet (iPad and Android) over the hotspot, then pair a phone as the tech's console.
6. The real Wii remote: every button, the shake for Suspens, and its range from the stage to the laptop.

## Housekeeping

### U23 · Frontend's session can't reach GitHub
`git fetch` fails there with "Permission denied (publickey)". Try `! ssh -T git@github.com` in that session, or restart it. Not blocking: other sessions push the shared main.

### U24 · Stray local files
- Uncommitted edits in `legacy/2025/client` (`VITE_SONGS_URL`) and the untracked `legacy/2025/last-year-data/` and `legacy/2025/shuffle-test/`: whose are they? `last-year-data/` is last year's database export and must never be committed.
- An old detached worktree from a previous Backend session (`…/scratchpad/ci-head`): OK to delete?

## Answered

- **U5 · Card prices on the projector** (2026-11-25): show only the price for the coming round, on that round's Interval screen (the before-the-start screen is round 1's). A normal card costs the per-round price × the regular rounds still to play, the coming one included, not counting the Desgraciat (2025: 1.50 €, so 15 € before round 1); before the Quina Especial, the special card's fixed price. The prices come from setup data, never hard-coded.
- **U6 · The Desgraciat's celebration title** (2026-11-25): none. "DEMPEUS!" is dropped; the rest of its Celebration stays. The phones' per-card "Dempeus" / "Assegut" labels stay.
- **Rehearsal dates:** 13 and 19 December (event.md).
- **Late claims (R2-Q12):** a late claimer wins if nobody else claimed; any other case is decided on the spot (event.md).
- **The Desgraciat when the last players fall together:** they share the win (event.md).
- **The Efectes pads:** icons, with the word version kept as a board (canvas, 24 Nov).
- **Wii remote mapping (R2-Q38):** decided and built.
- **Where the show runs (R2-Q26):** A+, an installed laptop with media from R2.
