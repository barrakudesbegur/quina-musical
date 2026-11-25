# Waiting on the user

The only list of what waits on the user: decisions with the default in force meanwhile, and tasks only the user can do. Requirements, handoffs and the timeline refer to these by ID (U1, U2…).

- **Adding one:** sessions send it to the orchestrator, who adds it here with the next free ID. Sessions never edit this file directly: several share one checkout. Say which default you took, so the user only answers when they disagree.
- **Answering one:** the orchestrator records the answer in [decision-log.md](decision-log.md), updates the requirements, and moves the entry to "Answered" with its decision ID. IDs are never reused.
- Dates are in [timeline.md](timeline.md); the night is Sunday 27 December 2026.

## Decisions

### U12 · The theme pass
Pending your go on the visual theme pass across the screens. Not ready yet (25 Nov).

### U13 · Listening pass on the new sound
Not heard yet: phrase landings, the lighter early palette and rare impacts, Signatures before the landing, the new Suspense, Aguanta's loop, vocal entries, Count-in. Two defaults to confirm while listening:
- **Suspense release:** it lands on the outgoing song's phrase boundary, up to about 9 s after the release. The alternative is a 2-bar boundary, about twice as fast. **Default:** the phrase.
- **Signatures are rarer:** about 5% of transitions (38 of last year's 77 songs get one). Options: keep it; lower the automatic pick's score (0.6); pick more by hand. **Default:** keep, and pick by hand while reviewing this year's songs.

### U26 · One special card for both the Desgraciat and the Especial?
In 2025 the special card (5 €) played the Quina del Desgraciat and the Quina Especial (D70). Does one special card play both rounds, or does each round need its own?
**Default:** one card plays both; the plan's Desgraciat plays special cards.

### U27 · The rehearsal dates
The docs said 13 and 19 December, but those were the orchestrator's defaults, not yours. Are there full-show rehearsals before the night, and when?
**Default:** no dates in the plan until you give them.

### U28 · When the cards are printed
Printing takes a few hours and cards are sold only on the night (D71), but event.md says never the day before.
**Default:** none set.

### U29 · How far "no fallbacks" goes
For the player app the user said no fallback layout in the code (D73). event.md also asks that anything new has "a simple fallback to the old way", and the code has operational plan Bs (the tablet for the Wii remote, the laptop's keys for the tablet, the laptop for the cloud).
**Default:** the operational plan Bs stay; no alternative versions of a screen or feature are kept in the code.

### U30 · Pick the drawers and corner buttons
Once Frontend has its proposals (D73): the drawers' content and hierarchy, the prizes drawer, and the corner buttons' style and icons, in one consistent style.
**Default:** waits on the proposals.

## Tasks only the user can do

### U14 · Approve this year's hooks · before the first rehearsal
On the audition page: about 2 minutes a song, about 3 hours for 86. A song can't play until its hook is approved. Start early on draft songs once they're prepared.

### U16 · Upload the logo library in Admin
It needs your Google login: Admin → "Pujar logos a la biblioteca" with the cleaned logos in `temp/logos-clean/`, then "Triar de la biblioteca" per sponsor. Two logos are small sources; ask those sponsors for bigger ones.

### U17 · Approve the install script for printing cards to PDF
Run it yourself: `! cd apps/cards && npm install-scripts approve canvas`

### U18 · The night's plan in Admin · before the first rehearsal
Rounds in order, a card type per round, prize bundles, sponsors (money donors too), the Schedule with throw breaks.

### U19 · Checks on real devices · before the rehearsals
1. An iPhone with Safari and an Android phone with Chrome: scan a test QR, add a second card by number, lock and unlock (it reconnects, and the screen stays awake), sounds after the first tap.
2. An older phone: smooth scrolling with 3–4 cards, usable at the end of a round.
3. Last year's offline cache: after U15, open the old site on a phone that used it last year, then the new one.
4. The projector at 4:3, then 16:9: the drum, the last-3 row and the Check readable from the back.
5. The console on the actual tablet (iPad and Android) over the hotspot, then pair a phone as the tech's console.
6. The real Wii remote: every button, the shake for Suspens, and its range from the stage to the laptop.

### U20 · More Hold music and victory tracks
Only 3 Hold loops and 1 victory track exist, so they repeat a lot (`data/media/hold`, `data/media/celebration`). You'll add more.

## Housekeeping

### U23 · Frontend's session can't reach GitHub
`git fetch` fails there with "Permission denied (publickey)". Try `! ssh -T git@github.com` in that session, or restart it. Not blocking: other sessions push the shared main.

### U24 · Stray local files
- Uncommitted edits in `legacy/2025/client` (`VITE_SONGS_URL`) and the untracked `legacy/2025/last-year-data/` and `legacy/2025/shuffle-test/`: whose are they? `last-year-data/` is last year's database export and must never be committed.
- An old detached worktree from a previous Backend session (`…/scratchpad/ci-head`): OK to delete?

## Answered

- **U1 · How to download the songs** (2026-11-25) → D66: the method is Sound engine's call, as long as the quality is right and the user does little work; the user downloads only the few leftovers by hand.
- **U2 · The printed card's title and colours** (2026-11-25) → D67: "QUINA QUINA! 3" with last year's colours, provisionally; may change at print time.
- **U3 · Card types and amounts** (2026-11-25) → D68: as in 2025, provisionally.
- **U25 · This year's card prices** (2026-11-25) → D69: as in 2025, 1.50 € a round and 5 € for a special card.
- **U4 · When cards are handed out** (2026-11-25) → D71: only on the night, at the start and during it; printing takes a few hours.
- **U7 · Two Desgraciat board points** (2026-11-25) → D72: no standing count on the projector; the sitting nino.
- **U8 · The prizes corner icon** and **U10 · The player app's layout** (2026-11-25) → D73: drawers and two corner buttons, no fallback; proposals to pick from (U30).
- **U9 · The effect when the landed song is yours** (2026-11-25) → D74: spotlights and flashes, no bolt drawing, smooth in and out.
- **U11 · The card-stacking scroll** (2026-11-25) → D75: discarded for now.
- **U15 · The QR domain switch** (2026-11-25) → D76: now.
- **U21 · Card text size on phones** (2026-11-25) → D77: the current design is fine.
- **U22 · The printed cards are public** (2026-11-25) → D78: public, and anything may be public unless there's a reason.
- **U5 · Card prices on the projector** (2026-11-25): show only the price for the coming round, on that round's Interval screen (the before-the-start screen is round 1's). A normal card costs the per-round price × the regular rounds still to play, the coming one included, not counting the Desgraciat (2025: 1.50 €, so 15 € before round 1); before the Quina Especial, the special card's fixed price. The prices come from setup data, never hard-coded.
- **U6 · The Desgraciat's celebration title** (2026-11-25): none. "DEMPEUS!" is dropped; the rest of its Celebration stays. The phones' per-card "Dempeus" / "Assegut" labels stay.
- **Rehearsal dates:** 13 and 19 December (event.md).
- **Late claims (R2-Q12):** a late claimer wins if nobody else claimed; any other case is decided on the spot (event.md).
- **The Desgraciat when the last players fall together:** they share the win (event.md).
- **The Efectes pads:** icons, with the word version kept as a board (canvas, 24 Nov).
- **Wii remote mapping (R2-Q38):** decided and built.
- **Where the show runs (R2-Q26):** A+, an installed laptop with media from R2.
